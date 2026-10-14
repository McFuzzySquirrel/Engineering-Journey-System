import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import packageJson from '../../package.json' with { type: 'json' };
import { parseConfig } from '../core/config.js';
import { lintProject } from '../core/project-lint.js';
import { createSdr } from '../core/sdr.js';
import { SQLiteStore } from '../store/sqlite.js';
import { registerDecisionTools } from './tools.js';

const CONFIG_PATH = '.dg/config.json';

export function createMcpServer(root: string = process.cwd()): {
  server: McpServer;
  close(): Promise<void>;
} {
  const configFile = path.join(root, CONFIG_PATH);
  if (!existsSync(configFile)) {
    throw new Error(
      `Not initialized; run "dg init" first (missing ${CONFIG_PATH})`,
    );
  }
  const config = parseConfig(readFileSync(configFile, 'utf8'), CONFIG_PATH);
  const store = new SQLiteStore(path.join(root, '.dg', 'graph.db'));
  const server = new McpServer({
    name: 'decision-graph',
    version: packageJson.version,
  });
  registerDecisionTools(server, {
    config,
    store,
    listProjects: () => store.listProjects(),
    defaultProject: config.project,
    addSdr: async (title, input, projectId) => {
      if (projectId !== config.project) {
        throw new Error(
          'Local SDR creation is limited to the configured project',
        );
      }
      const result = await createSdr(root, config, store, title, input);
      return {
        id: result.id,
        path: path.relative(root, result.path).split(path.sep).join('/'),
      };
    },
    lint: () => lintProject(root, config, store),
  });
  return {
    server,
    async close() {
      try {
        await server.close();
      } finally {
        store.close();
      }
    },
  };
}

export async function runMcpServer(
  root: string = process.cwd(),
): Promise<void> {
  const { server, close } = createMcpServer(root);
  try {
    await server.connect(new StdioServerTransport());
    await new Promise<void>((resolve, reject) => {
      if (process.stdin.readableEnded) {
        resolve();
        return;
      }
      process.stdin.once('end', resolve);
      process.stdin.once('error', reject);
    });
  } finally {
    await close();
  }
}
