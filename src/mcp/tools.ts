import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Config } from '../core/schema.js';
import { getContextRules } from '../core/context.js';
import type { ProjectLintResult } from '../core/project-lint.js';
import type { SdrInput } from '../core/sdr.js';
import type { Store } from '../store/store.js';

const EDGE_KINDS = [
  'supersedes',
  'relates_to',
  'derived_from',
  'promoted_to',
  'conflicts_with',
] as const;

export interface DecisionToolServices {
  config: Config;
  store: Store;
  addSdr(title: string, input: SdrInput): Promise<{ id: string; path: string }>;
  lint(): Promise<ProjectLintResult>;
}

export function registerDecisionTools(
  server: McpServer,
  services: DecisionToolServices,
): void {
  const { config, store } = services;

  server.registerTool(
    'search',
    {
      description: 'Search indexed decision records.',
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => textResult(await store.search(config.project, query)),
  );

  server.registerTool(
    'context',
    {
      description: 'Get accepted decision rules that apply to file paths.',
      inputSchema: { files: z.array(z.string().min(1)).min(1) },
    },
    async ({ files }) =>
      textResult(await getContextRules(store, config.project, files)),
  );

  server.registerTool(
    'get',
    {
      description: 'Get one indexed decision record by ID.',
      inputSchema: { id: z.string().min(1) },
    },
    async ({ id }) => {
      const record = await store.get(config.project, id);
      if (!record) throw new Error(`Record not found: ${id}`);
      return textResult(record);
    },
  );

  server.registerTool(
    'related',
    {
      description:
        'List records reachable from a record in the decision graph.',
      inputSchema: {
        id: z.string().min(1),
        depth: z.number().int().min(0).max(100).default(1),
        kinds: z.array(z.enum(EDGE_KINDS)).optional(),
      },
    },
    async ({ id, depth, kinds }) =>
      textResult(
        await store.related(
          config.project,
          id,
          depth,
          kinds ? [...kinds] : undefined,
        ),
      ),
  );

  server.registerTool(
    'list',
    {
      description: 'List indexed decision records with optional filters.',
      inputSchema: {
        type: z.enum(['adr', 'sdr']).optional(),
        status: z.string().min(1).optional(),
        tag: z.string().min(1).optional(),
      },
    },
    async (filter) => textResult(await store.list(config.project, filter)),
  );

  server.registerTool(
    'sdr_add',
    {
      description: 'Create and index a session decision record.',
      inputSchema: {
        title: z.string().min(1),
        decision: z.string().min(1),
        why: z.string().min(1),
        alt: z.array(z.string().min(1)).optional(),
        appliesTo: z.array(z.string().min(1)).optional(),
        agent: z.string().min(1).optional(),
        session: z.string().min(1).optional(),
      },
    },
    async ({ title, ...input }) => {
      const result = await services.addSdr(title, input);
      return textResult({
        id: result.id,
        path: result.path,
      });
    },
  );

  server.registerTool(
    'lint',
    {
      description:
        'Validate decision records and refresh graph conflict edges.',
      inputSchema: {},
    },
    async () => textResult(await services.lint()),
  );
}

function textResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}
