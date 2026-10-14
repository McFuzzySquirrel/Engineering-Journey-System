import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import { createMcpServer } from '../src/mcp/server.js';

const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];

afterEach(() => {
  process.chdir(originalCwd);
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

it('lists MCP tools and returns the same context rules as the CLI', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-images.md',
    hybridRecord('ADR-0001', ['**/*.tsx'], 'MUST', 'Use image components.'),
  );
  process.chdir(root);
  await invoke('init', '--yes');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  await invoke('context', 'src/card.tsx', '--json');
  const cliRules = JSON.parse(log.mock.calls.at(-1)?.[0] as string) as unknown;

  const mcp = createMcpServer(root);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'decision-graph-test', version: '1.0.0' });
  try {
    await mcp.server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      'search',
      'context',
      'get',
      'related',
      'list',
      'sdr_add',
      'lint',
    ]);

    const context = await client.callTool({
      name: 'context',
      arguments: { files: ['src/card.tsx'] },
    });
    expect(JSON.parse(toolText(context))).toEqual(cliRules);
  } finally {
    await client.close();
    await mcp.close();
  }
});

it('executes the remaining MCP tools against the local project', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-images.md',
    hybridRecord('ADR-0001', ['**/*.tsx'], 'MUST', 'Use image components.'),
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0002-related.md',
    hybridRecord('ADR-0002', ['**/*.ts'], 'SHOULD', 'Prefer typed helpers.', [
      'ADR-0001',
    ]),
  );
  process.chdir(root);
  await invoke('init', '--yes');

  const mcp = createMcpServer(root);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'decision-graph-test', version: '1.0.0' });
  try {
    await mcp.server.connect(serverTransport);
    await client.connect(clientTransport);

    const search = await client.callTool({
      name: 'search',
      arguments: { query: 'image components' },
    });
    expect(JSON.parse(toolText(search))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'ADR-0001' })]),
    );

    const get = await client.callTool({
      name: 'get',
      arguments: { id: 'ADR-0001' },
    });
    expect(JSON.parse(toolText(get))).toEqual(
      expect.objectContaining({ id: 'ADR-0001' }),
    );

    const list = await client.callTool({
      name: 'list',
      arguments: { type: 'adr' },
    });
    expect(JSON.parse(toolText(list))).toHaveLength(2);

    const related = await client.callTool({
      name: 'related',
      arguments: { id: 'ADR-0002', depth: 1, kinds: ['relates_to'] },
    });
    expect(JSON.parse(toolText(related))).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'ADR-0001' })]),
    );

    const sdr = await client.callTool({
      name: 'sdr_add',
      arguments: {
        title: 'Capture tool decision',
        decision: 'Use the MCP tool.',
        why: 'Keep the workflow accessible to agents.',
        alt: ['Use a manual file'],
        appliesTo: ['src/**/*.ts'],
        agent: 'test-agent',
        session: 'test-session',
      },
    });
    const sdrResult = JSON.parse(toolText(sdr)) as { id: string; path: string };
    expect(sdrResult.id).toMatch(/^SDR-\d{8}-001$/);
    expect(readFileSync(path.join(root, sdrResult.path), 'utf8')).toContain(
      'Use the MCP tool.',
    );

    const lint = await client.callTool({ name: 'lint', arguments: {} });
    expect(JSON.parse(toolText(lint))).toEqual(
      expect.objectContaining({ ok: true, errors: 0 }),
    );
  } finally {
    await client.close();
    await mcp.close();
  }
});

function createTempProject(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'decision-graph-mcp-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeRecord(root: string, file: string, content: string): void {
  const absolute = path.join(root, file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function hybridRecord(
  id: string,
  appliesTo: string[],
  modality: string,
  text: string,
  relatesTo: string[] = [],
): string {
  return `---
id: ${id}
type: adr
title: Use a decision
status: accepted
applies_to:
${appliesTo.map((pattern) => `  - "${pattern}"`).join('\n')}
${relatesTo.length ? `relates_to:\n${relatesTo.map((target) => `  - ${target}`).join('\n')}` : ''}
tags:
  - testing
---

# ${id}: Use a decision

## Agent Rules

- **${modality}:** ${text}

## Decision Outcome

Use this decision.
`;
}

function toolText(result: unknown): string {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('content' in result) ||
    !Array.isArray(result.content)
  ) {
    throw new Error('MCP tool returned no content');
  }
  const item = result.content.find(
    (content): content is { type: 'text'; text: string } =>
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      content.type === 'text' &&
      'text' in content &&
      typeof content.text === 'string',
  );
  const text = item?.text;
  if (!text) throw new Error('MCP tool returned no text content');
  return text;
}

async function invoke(...args: string[]): Promise<void> {
  await createProgram()
    .exitOverride()
    .parseAsync(['node', 'dg', ...args]);
}
