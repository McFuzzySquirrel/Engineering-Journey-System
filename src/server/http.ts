import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { dump } from 'js-yaml';
import { z } from 'zod';
import { lintRecords, type LintDiagnostic } from '../core/lint.js';
import type { ProjectLintResult } from '../core/project-lint.js';
import { parseRecord, type Config } from '../core/index.js';
import type { SdrInput } from '../core/sdr.js';
import {
  AdrStatusSchema,
  RuleSchema,
  SdrStatusSchema,
  VerifySchema,
} from '../core/schema.js';
import { getContextRules } from '../core/context.js';
import { graphNodeToRecord } from '../store/transfer.js';
import type { EdgeKind, Project, Store } from '../store/store.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import packageJson from '../../package.json' with { type: 'json' };
import { registerDecisionTools } from '../mcp/tools.js';

const EDGE_KINDS = [
  'supersedes',
  'relates_to',
  'derived_from',
  'promoted_to',
  'conflicts_with',
] as const;
const graphNodeFields = {
  projectId: z.string().min(1),
  id: z.string().min(1),
  title: z.string().min(1),
  appliesTo: z.array(z.string()),
  tags: z.array(z.string()),
  rules: z.array(RuleSchema),
  verify: z.array(VerifySchema),
  body: z.string(),
  path: z.string(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  date: z.string().optional(),
  updatedAt: z.string(),
};
const GraphNodeSchema = z.discriminatedUnion('type', [
  z.object({
    ...graphNodeFields,
    type: z.literal('adr'),
    status: AdrStatusSchema,
  }),
  z.object({
    ...graphNodeFields,
    type: z.literal('sdr'),
    status: SdrStatusSchema,
  }),
]);
const PushSchema = z.object({
  project: z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    type: z.string().min(1),
    origin: z.string().optional(),
  }),
  records: z.array(GraphNodeSchema),
  edges: z.array(
    z.object({
      src: z.string().min(1),
      dst: z.string().min(1),
      kind: z.enum(EDGE_KINDS),
    }),
  ),
});

export function createDecisionGraphHttpServer(
  store: Store,
  config: Config,
): ReturnType<typeof createServer> {
  return createServer((request, response) => {
    void routeRequest(request, response, store, config).catch(
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        sendJson(
          response,
          error instanceof z.ZodError
            ? 400
            : error instanceof HttpError
              ? error.status
              : 500,
          {
            error: message,
          },
        );
      },
    );
  });
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: Store,
  config: Config,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/mcp') {
    await handleMcp(request, response, store, config);
    return;
  }

  const parts = url.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch (error) {
        throw new HttpError(
          `Invalid URL path encoding: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  if (request.method === 'GET' && url.pathname === '/projects') {
    sendJson(response, 200, await store.listProjects());
    return;
  }
  if (
    request.method === 'POST' &&
    parts.length === 3 &&
    parts[0] === 'projects' &&
    parts[2] === 'push'
  ) {
    await pushProject(parts[1], request, response, store);
    return;
  }
  if (
    request.method === 'GET' &&
    parts.length === 3 &&
    parts[0] === 'projects' &&
    parts[2] === 'records'
  ) {
    const project = await findProject(store, parts[1]);
    if (!project) {
      sendJson(response, 404, { error: `Project not found: ${parts[1]}` });
      return;
    }
    sendJson(response, 200, {
      project,
      records: await store.list(project.id),
      edges: await store.listEdges(project.id),
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/search') {
    const query = url.searchParams.get('q');
    if (!query) {
      sendJson(response, 400, { error: 'Query parameter "q" is required' });
      return;
    }
    const projects = await selectProjects(
      store,
      url.searchParams.get('project') ?? undefined,
      url.searchParams.get('projectType') ?? undefined,
    );
    const results = await Promise.all(
      projects.map((project) => store.search(project.id, query)),
    );
    sendJson(response, 200, results.flat());
    return;
  }
  if (request.method === 'GET' && url.pathname === '/context') {
    const files = (url.searchParams.get('files') ?? '')
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean);
    if (files.length === 0) {
      sendJson(response, 400, { error: 'Query parameter "files" is required' });
      return;
    }
    const projects = await selectProjects(
      store,
      url.searchParams.get('project') ?? undefined,
      url.searchParams.get('projectType') ?? undefined,
    );
    const results = await Promise.all(
      projects.map(async (project) =>
        (await getContextRules(store, project.id, files)).map((rule) => ({
          ...rule,
          projectId: project.id,
        })),
      ),
    );
    sendJson(response, 200, results.flat());
    return;
  }
  if (
    request.method === 'GET' &&
    parts.length === 4 &&
    parts[0] === 'records' &&
    parts[3] === 'related'
  ) {
    const project = await findProject(store, parts[1]);
    if (!project) {
      sendJson(response, 404, { error: `Project not found: ${parts[1]}` });
      return;
    }
    const depthValue = url.searchParams.get('depth');
    const depth = depthValue === null ? 1 : Number(depthValue);
    if (!Number.isInteger(depth) || depth < 0 || depth > 100) {
      sendJson(response, 400, {
        error: 'depth must be an integer from 0 to 100',
      });
      return;
    }
    const kinds = url.searchParams
      .getAll('kind')
      .flatMap((value) => value.split(','))
      .filter(Boolean)
      .map((kind) => parseEdgeKind(kind));
    sendJson(
      response,
      200,
      await store.related(
        project.id,
        parts[2],
        depth,
        kinds.length ? kinds : undefined,
      ),
    );
    return;
  }
  sendJson(response, 404, { error: 'Not found' });
}

async function pushProject(
  projectId: string,
  request: IncomingMessage,
  response: ServerResponse,
  store: Store,
): Promise<void> {
  const payload = PushSchema.parse(await readJson(request));
  if (payload.project.id && payload.project.id !== projectId) {
    sendJson(response, 400, {
      error: 'Project ID does not match request path',
    });
    return;
  }
  const records = payload.records.map((node) => {
    if (node.projectId !== projectId) {
      throw new HttpError(`Record ${node.id} belongs to a different project`);
    }
    return graphNodeToRecord(node);
  });
  const incomingIds = new Set(payload.records.map((node) => node.id));
  for (const edge of payload.edges) {
    for (const recordId of [edge.src, edge.dst]) {
      if (
        !incomingIds.has(recordId) &&
        !(await store.get(projectId, recordId))
      ) {
        throw new HttpError(
          `Relationship ${edge.src} -> ${edge.dst} references an unknown record`,
        );
      }
    }
  }
  const changed = await store.applyProjectPush(
    {
      id: projectId,
      name: payload.project.name,
      type: payload.project.type,
      origin: payload.project.origin,
    },
    records,
    payload.edges,
  );
  sendJson(response, 200, {
    project: projectId,
    received: records.length,
    changed,
  });
}

async function handleMcp(
  request: IncomingMessage,
  response: ServerResponse,
  store: Store,
  config: Config,
): Promise<void> {
  const server = new McpServer({
    name: 'decision-graph',
    version: packageJson.version,
  });
  registerDecisionTools(server, {
    config,
    store,
    listProjects: () => store.listProjects(),
    defaultProject: null,
    addSdr: (title, input, projectId) =>
      addRemoteSdr(store, title, input, projectId),
    lint: () => lintRemoteProjects(store),
  });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response);
  } finally {
    await transport.close();
    await server.close();
  }
}

async function addRemoteSdr(
  store: Store,
  title: string,
  input: SdrInput,
  projectId?: string,
): Promise<{ id: string; path: string }> {
  if (!projectId) throw new Error('sdr_add requires a selected project');
  const project = await findProject(store, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const date = new Date().toISOString().slice(0, 10);
  const dateId = date.replaceAll('-', '');
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'decision';
  for (;;) {
    const ids = (await store.list(projectId, { type: 'sdr' })).map(
      (node) => node.id,
    );
    const numbers = ids
      .map((id) => new RegExp(`^SDR-${dateId}-(\\d+)$`, 'i').exec(id))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => Number(match[1]));
    const id = `SDR-${dateId}-${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`;
    const relativePath = `remote/${projectId}/sdr/${id}-${slug}.md`;
    const metadata = {
      id,
      type: 'sdr',
      title,
      status: 'open',
      applies_to: input.appliesTo ?? [],
      tags: [],
      date,
      promoted_to: null,
      ...(input.agent ? { agent: input.agent } : {}),
      ...(input.session ? { session: input.session } : {}),
    };
    const alternatives = input.alt?.length
      ? input.alt.map((alternative) => `- ${alternative}`).join('\n')
      : 'None.';
    const content = `---\n${dump(metadata, { noRefs: true, lineWidth: -1 }).trimEnd()}\n---\n\n# ${id}: ${title}\n\n## Decision\n\n${input.decision}\n\n## Why\n\n${input.why}\n\n## Alternatives considered\n\n${alternatives}\n`;
    const record = parseRecord(content, relativePath, 'hybrid');
    if (await store.insertNodeIfAbsent(projectId, record)) {
      return { id, path: relativePath };
    }
  }
}

async function lintRemoteProjects(store: Store): Promise<ProjectLintResult> {
  const diagnostics: (LintDiagnostic & { project: string })[] = [];
  for (const project of await store.listProjects()) {
    const nodes = await store.list(project.id);
    const edges = await store.listEdges(project.id);
    const records = nodes.map((node) => {
      const record = graphNodeToRecord(node);
      const outgoing = edges.filter((edge) => edge.src === node.id);
      if (record.type === 'adr') {
        record.supersedes = outgoing
          .filter((edge) => edge.kind === 'supersedes')
          .map((edge) => edge.dst);
        record.relatesTo = outgoing
          .filter((edge) => edge.kind === 'relates_to')
          .map((edge) => edge.dst);
        record.derivedFrom = outgoing
          .filter((edge) => edge.kind === 'derived_from')
          .map((edge) => edge.dst);
      } else {
        record.promotedTo =
          outgoing.find((edge) => edge.kind === 'promoted_to')?.dst ?? null;
      }
      const lineCount = countLines(node.body);
      if (lineCount > 200) {
        diagnostics.push({
          severity: 'warning',
          code: 'line-budget',
          id: node.id,
          path: node.path,
          message: `Record has ${lineCount} lines; the budget is 200.`,
          project: project.id,
        });
      }
      return record;
    });
    const result = lintRecords(records);
    diagnostics.push(
      ...result.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        project: project.id,
      })),
    );
    await store.deleteEdges(project.id, undefined, 'conflicts_with');
    for (const conflict of result.conflicts) {
      await store.addEdge(
        project.id,
        conflict.first,
        conflict.second,
        'conflicts_with',
      );
      await store.addEdge(
        project.id,
        conflict.second,
        conflict.first,
        'conflicts_with',
      );
    }
  }
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length;
  return {
    ok: errors === 0,
    errors,
    warnings: diagnostics.length - errors,
    diagnostics,
  };
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  return content.split(/\r?\n/).length - (/\r?\n$/.test(content) ? 1 : 0);
}

async function selectProjects(
  store: Store,
  projectId?: string,
  projectType?: string,
): Promise<Project[]> {
  const projects = await store.listProjects();
  if (projectId) {
    const project = projects.find((item) => item.id === projectId);
    if (!project) throw new HttpError(`Project not found: ${projectId}`, 404);
    if (projectType && project.type !== projectType) {
      throw new HttpError(
        `Project ${projectId} does not have type ${projectType}`,
        400,
      );
    }
    return [project];
  }
  return projectType
    ? projects.filter((project) => project.type === projectType)
    : projects;
}

async function findProject(
  store: Store,
  projectId: string,
): Promise<Project | undefined> {
  return (await store.listProjects()).find(
    (project) => project.id === projectId,
  );
}

function parseEdgeKind(kind: string): EdgeKind {
  if (EDGE_KINDS.includes(kind as (typeof EDGE_KINDS)[number])) {
    return kind as EdgeKind;
  }
  throw new HttpError(`Unknown edge kind: ${kind}`);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 10 * 1024 * 1024) {
      throw new HttpError('Request body exceeds 10 MB');
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    throw new HttpError(
      `Invalid JSON request body: ${error instanceof Error ? error.message : String(error)}`,
      400,
      error,
    );
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
): void {
  if (response.headersSent || response.destroyed) return;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(`${JSON.stringify(value)}\n`);
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'HttpError';
  }
}
