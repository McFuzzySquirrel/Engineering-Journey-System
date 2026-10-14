import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import { parseRecord } from '../src/core/index.js';
import { createDecisionGraphHttpServer } from '../src/server/http.js';
import { SQLiteStore } from '../src/store/sqlite.js';
import type { Server } from 'node:http';

const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];
let server: Server | undefined;
let serverStore: SQLiteStore | undefined;
let serverUrl = '';

afterEach(async () => {
  process.chdir(originalCwd);
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
  server = undefined;
  serverStore?.close();
  serverStore = undefined;
  serverUrl = '';
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

it('pushes two project types, searches by type, and pulls without writing files', async () => {
  await startServer();
  const library = createTempProject();
  const app = createTempProject();
  const destination = createTempProject();
  writeRecord(
    library,
    'docs/decisions/adr/ADR-0001-icons.md',
    record('ADR-0001', 'Use icon components.'),
  );
  writeRecord(
    app,
    'docs/decisions/adr/ADR-0001-icons.md',
    record('ADR-0001', 'Use SVG icons.'),
  );

  await runIn(library, 'init', '--yes', '--type', 'library');
  const libraryId = projectId(library);
  const configFile = path.join(library, '.dg/config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as {
    remote: string | null;
  };
  config.remote = serverUrl;
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  await runIn(library, 'push');
  await runIn(library, 'push', '--remote', serverUrl);
  await runIn(app, 'init', '--yes', '--type', 'app');
  await runIn(app, 'push', '--remote', serverUrl);

  const search = await fetch(
    `${serverUrl}/search?q=icon&projectType=library`,
  ).then((response) => response.json());
  expect(search).toHaveLength(1);
  expect(search[0]).toMatchObject({
    projectId: libraryId,
    id: 'ADR-0001',
  });

  await runIn(destination, 'init', '--yes');
  const recordsDirectory = path.join(destination, 'docs/decisions/adr');
  const beforePull = readdirSync(recordsDirectory);
  await runIn(
    destination,
    'pull',
    '--remote',
    serverUrl,
    '--project',
    libraryId,
  );
  expect(readdirSync(recordsDirectory)).toEqual(beforePull);

  const localStore = new SQLiteStore(path.join(destination, '.dg/graph.db'));
  try {
    const imported = (await localStore.listProjects()).find((project) =>
      project.id.startsWith('remote:'),
    );
    expect(imported).toMatchObject({
      name: path.basename(library),
      type: 'library',
    });
    await expect(localStore.list(imported!.id)).resolves.toMatchObject([
      { id: 'ADR-0001', title: 'Use icon components.' },
    ]);
  } finally {
    localStore.close();
  }
});

it('exposes cross-project query selectors through streamable HTTP MCP', async () => {
  await startServer();
  await serverStore?.upsertProject({
    id: 'project-library',
    name: 'Library',
    type: 'library',
  });
  await serverStore?.upsertProject({
    id: 'project-app',
    name: 'Application',
    type: 'app',
  });
  const libraryRecord = parseRecord(
    record('ADR-0001', 'Use icon components.'),
    'docs/decisions/adr/ADR-0001.md',
    'hybrid',
  );
  const appRecord = parseRecord(
    record('ADR-0001', 'Use app icon components.'),
    'docs/decisions/adr/ADR-0001.md',
    'hybrid',
  );
  await serverStore?.upsertNode('project-library', libraryRecord);
  await serverStore?.upsertNode('project-app', appRecord);

  const client = new Client({ name: 'decision-graph-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${serverUrl}/mcp`),
  );
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'search',
      arguments: { query: 'icon', projectType: 'library' },
    });
    expect(JSON.parse(toolText(response))).toMatchObject([
      { projectId: 'project-library', id: 'ADR-0001' },
    ]);

    const sdrResponses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        client.callTool({
          name: 'sdr_add',
          arguments: {
            title: `Concurrent decision ${index}`,
            decision: `Decision ${index}.`,
            why: 'Preserve every concurrent decision.',
            project: 'project-library',
          },
        }),
      ),
    );
    const sdrIds = sdrResponses.map((result) => {
      const sdr = JSON.parse(toolText(result)) as { id: string };
      return sdr.id;
    });
    expect(new Set(sdrIds).size).toBe(sdrResponses.length);
    await expect(
      serverStore?.list('project-library', { type: 'sdr' }),
    ).resolves.toHaveLength(8);
  } finally {
    await client.close();
    await transport.close();
  }
});

function toolText(response: unknown): string {
  if (
    typeof response !== 'object' ||
    response === null ||
    !('content' in response) ||
    !Array.isArray(response.content)
  ) {
    throw new Error('MCP tool response has no content array');
  }
  const textContent = response.content.find(
    (item: unknown): item is { type: 'text'; text: string } =>
      typeof item === 'object' &&
      item !== null &&
      'type' in item &&
      item.type === 'text' &&
      'text' in item &&
      typeof item.text === 'string',
  );
  if (!textContent) throw new Error('MCP tool response has no text content');
  return textContent.text;
}

async function startServer(): Promise<void> {
  const root = mkdtempSync(path.join(os.tmpdir(), 'decision-graph-server-'));
  temporaryDirectories.push(root);
  serverStore = new SQLiteStore(path.join(root, 'server.db'));
  const config = {
    project: 'server',
    projectType: 'server',
    adrDir: 'docs/decisions/adr',
    sdrDir: 'docs/decisions/sdr',
    agentsMd: 'AGENTS.md',
    tokenBudget: 1500,
    remote: null,
  };
  server = createDecisionGraphHttpServer(serverStore, config);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind to a TCP port');
  }
  serverUrl = `http://127.0.0.1:${address.port}`;
}

function createTempProject(): string {
  const directory = mkdtempSync(
    path.join(os.tmpdir(), 'decision-graph-project-'),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function projectId(root: string): string {
  return path
    .basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
}

function writeRecord(root: string, file: string, content: string): void {
  const absolute = path.join(root, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function record(id: string, text: string): string {
  return `---
id: ${id}
type: adr
title: ${text}
status: accepted
applies_to: ["src/**/*.ts"]
tags: [remote]
---

# ${id}: ${text}

## Agent Rules

- **MUST:** ${text}
`;
}

async function runIn(root: string, ...args: string[]): Promise<void> {
  process.chdir(root);
  await createProgram()
    .exitOverride()
    .parseAsync(['node', 'dg', ...args]);
}
