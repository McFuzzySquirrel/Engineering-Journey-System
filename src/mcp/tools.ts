import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Config } from '../core/schema.js';
import { getContextRules } from '../core/context.js';
import type { ProjectLintResult } from '../core/project-lint.js';
import type { SdrInput } from '../core/sdr.js';
import type { Project, Store } from '../store/store.js';

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
  listProjects(): Promise<Project[]>;
  defaultProject?: string | null;
  addSdr(
    title: string,
    input: SdrInput,
    projectId?: string,
  ): Promise<{ id: string; path: string }>;
  lint(): Promise<ProjectLintResult>;
}

export function registerDecisionTools(
  server: McpServer,
  services: DecisionToolServices,
): void {
  const { store } = services;

  server.registerTool(
    'search',
    {
      description: 'Search indexed decision records.',
      inputSchema: {
        query: z.string().min(1),
        project: z.string().min(1).optional(),
        projectType: z.string().min(1).optional(),
      },
    },
    async ({ query, project, projectType }) => {
      const projects = await selectProjects(services, project, projectType);
      const results = await Promise.all(
        projects.map((item) => store.search(item.id, query)),
      );
      return textResult(results.flat());
    },
  );

  server.registerTool(
    'context',
    {
      description: 'Get accepted decision rules that apply to file paths.',
      inputSchema: {
        files: z.array(z.string().min(1)).min(1),
        project: z.string().min(1).optional(),
        projectType: z.string().min(1).optional(),
      },
    },
    async ({ files, project, projectType }) => {
      const projects = await selectProjects(services, project, projectType);
      const includeProject =
        project !== undefined ||
        projectType !== undefined ||
        services.defaultProject === null;
      const results = await Promise.all(
        projects.map(async (item) => {
          const rules = await getContextRules(store, item.id, files);
          return includeProject
            ? rules.map((rule) => ({ ...rule, projectId: item.id }))
            : rules;
        }),
      );
      return textResult(results.flat());
    },
  );

  server.registerTool(
    'get',
    {
      description: 'Get one indexed decision record by ID.',
      inputSchema: {
        id: z.string().min(1),
        project: z.string().min(1).optional(),
        projectType: z.string().min(1).optional(),
      },
    },
    async ({ id, project, projectType }) => {
      const projects = await selectProjects(services, project, projectType);
      const records = (
        await Promise.all(projects.map((item) => store.get(item.id, id)))
      ).filter((record) => record !== null);
      if (records.length === 0) throw new Error(`Record not found: ${id}`);
      return textResult(
        project || projectType || projects.length !== 1 ? records : records[0],
      );
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
        project: z.string().min(1).optional(),
        projectType: z.string().min(1).optional(),
      },
    },
    async ({ id, depth, kinds, project, projectType }) => {
      const projects = await selectProjects(services, project, projectType);
      const results = await Promise.all(
        projects.map((item) =>
          store.related(item.id, id, depth, kinds ? [...kinds] : undefined),
        ),
      );
      return textResult(results.flat());
    },
  );

  server.registerTool(
    'list',
    {
      description: 'List indexed decision records with optional filters.',
      inputSchema: {
        type: z.enum(['adr', 'sdr']).optional(),
        status: z.string().min(1).optional(),
        tag: z.string().min(1).optional(),
        project: z.string().min(1).optional(),
        projectType: z.string().min(1).optional(),
      },
    },
    async ({ type, status, tag, project, projectType }) => {
      const projects = await selectProjects(services, project, projectType);
      const results = await Promise.all(
        projects.map((item) => store.list(item.id, { type, status, tag })),
      );
      return textResult(results.flat());
    },
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
        project: z.string().min(1).optional(),
        projectType: z.string().min(1).optional(),
      },
    },
    async ({ title, project, projectType, ...input }) => {
      const projects = await selectProjects(services, project, projectType);
      if (projects.length !== 1) {
        throw new Error('sdr_add requires exactly one selected project');
      }
      const result = await services.addSdr(title, input, projects[0].id);
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

async function selectProjects(
  services: DecisionToolServices,
  projectId?: string,
  projectType?: string,
): Promise<Project[]> {
  const projects = await services.listProjects();
  if (projectId) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    if (projectType && project.type !== projectType) {
      throw new Error(`Project ${projectId} does not have type ${projectType}`);
    }
    return [project];
  }
  if (projectType) {
    return projects.filter((item) => item.type === projectType);
  }
  if (services.defaultProject === null) return projects;
  const defaultProject = services.defaultProject ?? services.config.project;
  return projects.filter((item) => item.id === defaultProject);
}
