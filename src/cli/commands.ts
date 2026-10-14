import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { dump, load } from 'js-yaml';
import type { Command } from 'commander';
import {
  ConfigSchema,
  parseConfig,
  parseRecord,
  type AdrRecord,
  type Config,
  type DecisionRecord,
  type SdrRecord,
} from '../core/index.js';
import { getContextRules } from '../core/context.js';
import { collectMarkdownFiles } from '../core/markdown-files.js';
import { lintProject } from '../core/project-lint.js';
import { createSdr } from '../core/sdr.js';
import {
  SQLiteStore,
  PostgresStore,
  graphNodeToRecord,
  type EdgeKind,
  type GraphEdge,
  type GraphNode,
  type NodeFilter,
  type Store,
  type Project,
} from '../store/index.js';
import { runMcpServer } from '../mcp/server.js';
import { createDecisionGraphHttpServer } from '../server/http.js';

const CONFIG_PATH = '.dg/config.json';
const DEFAULT_ADR_DIR = 'docs/decisions/adr';
const DEFAULT_SDR_DIR = 'docs/decisions/sdr';
const COMMON_ADR_DIRS = [
  'doc/adr',
  'docs/adr',
  'docs/decisions',
  'adr',
  'architecture/decisions',
];
const EDGE_KINDS: EdgeKind[] = [
  'supersedes',
  'relates_to',
  'derived_from',
  'promoted_to',
  'conflicts_with',
];
const FORMAT_NAMES = ['auto', 'hybrid', 'madr', 'nygard', 'agent'] as const;
type FormatName = (typeof FORMAT_NAMES)[number];

interface Runtime {
  root: string;
  config: Config;
  store: SQLiteStore;
}

export function registerCommands(program: Command): void {
  program
    .command('init')
    .description('Initialize decision-graph in the current project')
    .option('--type <projectType>', 'project type', 'cli-tool')
    .option('-y, --yes', 'accept importing records from common ADR directories')
    .action(async (options: { type: string; yes?: boolean }) => {
      await initProject(process.cwd(), options.type, Boolean(options.yes));
    });

  program
    .command('import')
    .description('Index decision records from a file or directory')
    .argument('<path>', 'record file or directory')
    .option(
      '--format <format>',
      'record format: auto, hybrid, madr, nygard, or agent',
      'auto',
    )
    .option(
      '--convert',
      'write converted hybrid MADR drafts and keep originals',
    )
    .action(
      async (
        recordPath: string,
        options: { format: string; convert?: boolean },
      ) => {
        const format = requireFormat(options.format);
        const runtime = openRuntime(process.cwd());
        try {
          const files = collectMarkdownFiles(
            path.resolve(runtime.root, recordPath),
          );
          if (files.length === 0) {
            throw new Error(`No Markdown records found at ${recordPath}`);
          }
          const records = files.map((file) =>
            parseFile(runtime.root, file, format),
          );
          if (options.convert) {
            await indexRecords(runtime.store, runtime.config, records);
            const convertedRecords: DecisionRecord[] = [];
            for (const record of records) {
              if (record.type !== 'adr') {
                throw new Error(`Cannot convert SDR ${record.id} to an ADR`);
              }
              const converted = await writeConvertedDraft(runtime, record);
              convertedRecords.push(converted);
            }
            records.push(...convertedRecords);
          }
          const changed = await indexRecords(
            runtime.store,
            runtime.config,
            records,
          );
          printSyncResult(records.length, changed);
        } finally {
          runtime.store.close();
        }
      },
    );

  program
    .command('sync')
    .description('Synchronize decision records from configured directories')
    .action(async () => {
      const runtime = openRuntime(process.cwd());
      try {
        const result = await synchronize(runtime);
        console.log(
          `Indexed ${result.indexed} record(s); ${result.changed} changed, ${result.removed} removed.`,
        );
        await compileInstructions(
          runtime.root,
          runtime.config,
          await runtime.store.list(runtime.config.project, {
            type: 'adr',
            status: 'accepted',
          }),
        );
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('compile')
    .description(
      'Compile accepted decision rules into the managed AGENTS.md block',
    )
    .action(async () => {
      const runtime = openRuntime(process.cwd());
      try {
        const accepted = await runtime.store.list(runtime.config.project, {
          type: 'adr',
          status: 'accepted',
        });
        await compileInstructions(runtime.root, runtime.config, accepted);
        console.log(
          `Compiled ${accepted.length} accepted record(s) into ${runtime.config.agentsMd}`,
        );
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('verify')
    .description('Run decision-record verification checks')
    .argument('[ids...]', 'record IDs to verify')
    .option(
      '--timeout <seconds>',
      'timeout for each automated check',
      parsePositiveSeconds,
      30,
    )
    .action(async (ids: string[], options: { timeout: number }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const records = await runtime.store.list(runtime.config.project);
        const selected = ids.length
          ? records.filter((record) => ids.includes(record.id))
          : records;
        const rows: VerifyRow[] = [];
        for (const id of ids) {
          if (!records.some((record) => record.id === id)) {
            rows.push({
              status: 'FAIL',
              record: id,
              check: 'record lookup',
              expected: 'Record exists in the index.',
              result: `Record not found: ${id}`,
            });
          }
        }
        for (const record of selected) {
          if (record.type !== 'adr' || record.verify.length === 0) {
            rows.push({
              status: 'SKIP',
              record: record.id,
              check: '—',
              expected: 'Manual review required.',
              result: `No automated checks; review ${record.path}.`,
            });
            continue;
          }
          for (const verification of record.verify) {
            if (isManualCheck(verification.check)) {
              rows.push({
                status: 'SKIP',
                record: record.id,
                check: verification.check,
                expected: verification.expected,
                result: `Manual review: ${verification.check.replace(/^manual(?:\s+review)?\s*:\s*/i, '')}`,
              });
              continue;
            }
            const result = await runVerification(
              runtime.root,
              verification.check,
              options.timeout * 1000,
            );
            rows.push({
              status: result.timedOut
                ? 'FAIL'
                : result.code === 0
                  ? 'PASS'
                  : 'FAIL',
              record: record.id,
              check: verification.check,
              expected: verification.expected,
              result: result.timedOut
                ? `Timed out after ${options.timeout}s.`
                : `Exit code ${result.code}${result.output ? `: ${result.output}` : ''}`,
            });
          }
        }
        printVerifyTable(rows);
        if (rows.some((row) => row.status === 'FAIL')) process.exitCode = 1;
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('lint')
    .description('Validate indexed decision records and their graph')
    .option('--json', 'output diagnostics as JSON')
    .action(async (options: { json?: boolean }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const result = await lintProject(
          runtime.root,
          runtime.config,
          runtime.store,
        );
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.diagnostics.length === 0) {
          console.log('No decision-record issues found.');
        } else {
          for (const diagnostic of result.diagnostics) {
            const location = diagnostic.path ? ` ${diagnostic.path}` : '';
            console.log(
              `${diagnostic.severity.toUpperCase()} ${diagnostic.code}${location}: ${diagnostic.message}`,
            );
          }
          console.log(
            `${result.errors} error(s), ${result.warnings} warning(s).`,
          );
        }
        if (result.errors > 0) process.exitCode = 1;
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('graph')
    .description('Export the decision graph')
    .option('--format <format>', 'output format: mermaid or dot', 'mermaid')
    .option('--root <id>', 'start at a record and follow outgoing edges')
    .option('--depth <number>', 'maximum depth from the root', parseDepth)
    .action(
      async (options: { format: string; root?: string; depth?: number }) => {
        if (options.format !== 'mermaid' && options.format !== 'dot') {
          throw new Error('Graph format must be mermaid or dot');
        }
        const runtime = openRuntime(process.cwd());
        try {
          const allNodes = await runtime.store.list(runtime.config.project);
          const allEdges = await runtime.store.listEdges(
            runtime.config.project,
          );
          let nodes = allNodes;
          if (options.root) {
            const root = allNodes.find((node) => node.id === options.root);
            if (!root) throw new Error(`Record not found: ${options.root}`);
            const related = await runtime.store.related(
              runtime.config.project,
              options.root,
              options.depth ?? 1,
            );
            const included = new Set([
              root.id,
              ...related.map((node) => node.id),
            ]);
            nodes = allNodes.filter((node) => included.has(node.id));
          }
          const included = new Set(nodes.map((node) => node.id));
          const edges = allEdges.filter(
            (edge) => included.has(edge.src) && included.has(edge.dst),
          );
          console.log(renderGraph(nodes, edges, options.format));
        } finally {
          runtime.store.close();
        }
      },
    );

  program
    .command('new')
    .description('Create a proposed hybrid MADR')
    .argument('<title>', 'decision title')
    .option(
      '--applies-to <glob...>',
      'file glob(s) to which this decision applies',
    )
    .option('--tags <tag...>', 'tag(s) for the decision')
    .action(
      async (
        title: string,
        options: { appliesTo?: string[]; tags?: string[] },
      ) => {
        const runtime = openRuntime(process.cwd());
        try {
          const file = await createAdrDraft(runtime, title, options);
          console.log(`Created ${path.relative(runtime.root, file)}`);
        } finally {
          runtime.store.close();
        }
      },
    );

  const sdr = program
    .command('sdr')
    .description('Capture and manage session decision records');

  sdr
    .command('add')
    .description('Capture a session decision record')
    .argument('<title>', 'decision title')
    .requiredOption('--decision <text>', 'decision made')
    .requiredOption('--why <text>', 'reason for the decision')
    .option('--alt <alternative...>', 'alternative(s) considered')
    .option(
      '--applies-to <glob...>',
      'file glob(s) to which this decision applies',
    )
    .option('--agent <name>', 'agent that made the decision')
    .option('--session <reference>', 'session reference')
    .action(
      async (
        title: string,
        options: {
          decision: string;
          why: string;
          alt?: string[];
          appliesTo?: string[];
          agent?: string;
          session?: string;
        },
      ) => {
        const runtime = openRuntime(process.cwd());
        try {
          const result = await createSdr(
            runtime.root,
            runtime.config,
            runtime.store,
            title,
            options,
          );
          console.log(`Created ${path.relative(runtime.root, result.path)}`);
        } finally {
          runtime.store.close();
        }
      },
    );

  sdr
    .command('list')
    .description('List session decision records')
    .option('--status <status>', 'filter by status', 'open')
    .option('--json', 'output JSON')
    .action(async (options: { status: string; json?: boolean }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const records = await runtime.store.list(runtime.config.project, {
          type: 'sdr',
          status: options.status,
        });
        outputRecords(records, options.json);
      } finally {
        runtime.store.close();
      }
    });

  sdr
    .command('promote')
    .description('Promote an SDR to a proposed ADR')
    .argument('<sdr-id>', 'session decision record id')
    .action(async (id: string) => {
      const runtime = openRuntime(process.cwd());
      try {
        const adr = await promoteSdr(runtime, id);
        console.log(`Promoted ${id} to ${adr}`);
      } finally {
        runtime.store.close();
      }
    });

  sdr
    .command('discard')
    .description('Discard an open session decision record')
    .argument('<sdr-id>', 'session decision record id')
    .option('--reason <reason>', 'reason for discarding the record')
    .action(async (id: string, options: { reason?: string }) => {
      const runtime = openRuntime(process.cwd());
      try {
        await setSdrLifecycle(runtime, id, 'discarded', null, options.reason);
        console.log(`Discarded ${id}`);
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('list')
    .description('List indexed records')
    .option('--status <status>', 'filter by status')
    .option('--type <type>', 'filter by record type (adr or sdr)')
    .option('--tag <tag>', 'filter by tag')
    .option('--json', 'output JSON')
    .action(async (options: NodeFilter & { json?: boolean }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const records = await runtime.store.list(
          runtime.config.project,
          validatedFilter(options),
        );
        outputRecords(records, options.json);
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('get')
    .description('Show one indexed record')
    .argument('<id>', 'record id')
    .option('--json', 'output JSON')
    .action(async (id: string, options: { json?: boolean }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const record = await runtime.store.get(runtime.config.project, id);
        if (!record) throw new Error(`Record not found: ${id}`);
        outputRecords([record], options.json);
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('search')
    .description('Search indexed decision records')
    .argument('<query>', 'search query')
    .option('--json', 'output JSON')
    .action(async (query: string, options: { json?: boolean }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const results = await runtime.store.search(
          runtime.config.project,
          query,
        );
        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          for (const result of results) printRecord(result);
        }
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('context')
    .description('Show accepted rules that apply to files')
    .argument('<files...>', 'file paths to match')
    .option('--json', 'output JSON')
    .action(async (files: string[], options: { json?: boolean }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const rules = await getContextRules(
          runtime.store,
          runtime.config.project,
          files,
        );
        if (options.json) {
          console.log(JSON.stringify(rules, null, 2));
        } else {
          for (const rule of rules) {
            console.log(
              `${rule.id} [${rule.appliesTo.join(', ')}] ${rule.modality}: ${rule.text}`,
            );
          }
        }
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('related')
    .description('List records reachable from a record in the decision graph')
    .argument('<id>', 'starting record id')
    .option('--depth <number>', 'maximum graph depth', parseDepth, 1)
    .option('--kind <kind...>', 'edge kind(s) to follow')
    .option('--json', 'output JSON')
    .action(
      async (
        id: string,
        options: { depth: number; kind?: string[]; json?: boolean },
      ) => {
        const runtime = openRuntime(process.cwd());
        try {
          const kinds = options.kind?.map(requireEdgeKind);
          const records = await runtime.store.related(
            runtime.config.project,
            id,
            options.depth,
            kinds,
          );
          outputRecords(records, options.json);
        } finally {
          runtime.store.close();
        }
      },
    );

  program
    .command('mcp')
    .description('Start the Model Context Protocol stdio server')
    .action(async () => runMcpServer(process.cwd()));

  program
    .command('serve')
    .description('Serve the project API and streamable-HTTP MCP endpoint')
    .option(
      '--db <postgres-url|sqlite-path>',
      'database URL or SQLite path',
      '.dg/server.db',
    )
    .option('--port <number>', 'HTTP port', parsePort, 3000)
    .option('--host <host>', 'HTTP bind address', '127.0.0.1')
    .action(async (options: { db: string; port: number; host: string }) => {
      await serveProject(process.cwd(), options.db, options.port, options.host);
    });

  program
    .command('push')
    .description('Push the current project index to a decision-graph server')
    .option('--remote <url>', 'server URL (defaults to .dg/config.json remote)')
    .action(async (options: { remote?: string }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const remote = requireRemote(options.remote, runtime.config);
        const result = await synchronize(runtime);
        const payload = {
          project: {
            id: runtime.config.project,
            name: path.basename(runtime.root),
            type: runtime.config.projectType,
            origin: sanitizeRemoteOrigin(remote),
          },
          records: await runtime.store.list(runtime.config.project),
          edges: await runtime.store.listEdges(runtime.config.project),
        };
        const response = await requestJson(
          `${remote}/projects/${encodeURIComponent(runtime.config.project)}/push`,
          { method: 'POST', body: JSON.stringify(payload) },
        );
        console.log(
          `Pushed ${payload.records.length} record(s) (${result.changed} local change(s)); server: ${JSON.stringify(response)}`,
        );
      } finally {
        runtime.store.close();
      }
    });

  program
    .command('pull')
    .description(
      'Import server records read-only into a separate local namespace',
    )
    .option('--remote <url>', 'server URL (defaults to .dg/config.json remote)')
    .option('--project <id>', 'pull one remote project')
    .action(async (options: { remote?: string; project?: string }) => {
      const runtime = openRuntime(process.cwd());
      try {
        const remote = requireRemote(options.remote, runtime.config);
        const projects = await requestJson<Project[]>(`${remote}/projects`);
        const selected = options.project
          ? projects.filter((project) => project.id === options.project)
          : projects;
        if (options.project && selected.length === 0) {
          throw new Error(`Remote project not found: ${options.project}`);
        }
        let imported = 0;
        for (const project of selected) {
          const result = await requestJson<{
            project: Project;
            records: GraphNode[];
            edges: GraphEdge[];
          }>(`${remote}/projects/${encodeURIComponent(project.id)}/records`);
          const namespace = remoteProjectNamespace(remote, project.id);
          await runtime.store.upsertProject({
            id: namespace,
            name: result.project.name,
            type: result.project.type,
            origin: `${sanitizeRemoteOrigin(remote)}/projects/${encodeURIComponent(project.id)}`,
          });
          for (const node of result.records) {
            const importedNode = {
              ...node,
              projectId: namespace,
              path: `remote/${encodeURIComponent(project.id)}/${node.path}`,
            };
            if (
              await runtime.store.upsertNode(
                namespace,
                graphNodeToRecord(importedNode),
              )
            ) {
              imported += 1;
            }
          }
          await runtime.store.deleteEdges(namespace);
          for (const edge of result.edges) {
            await runtime.store.addEdge(
              namespace,
              edge.src,
              edge.dst,
              edge.kind,
            );
          }
          console.log(
            `Pulled ${result.records.length} record(s) from ${project.id} into ${namespace}.`,
          );
        }
        console.log(
          `Imported ${imported} changed record(s); repository files were not modified.`,
        );
      } finally {
        runtime.store.close();
      }
    });
}

async function initProject(
  root: string,
  projectType: string,
  yes: boolean,
): Promise<void> {
  const configFile = path.join(root, CONFIG_PATH);
  if (existsSync(configFile))
    throw new Error(`Already initialized: ${CONFIG_PATH}`);

  const projectName = path.basename(root);
  const config = ConfigSchema.parse({
    project: projectName.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    projectType,
    adrDir: DEFAULT_ADR_DIR,
    sdrDir: DEFAULT_SDR_DIR,
    agentsMd: 'AGENTS.md',
    tokenBudget: 1500,
    remote: null,
  });
  mkdirSync(path.dirname(configFile), { recursive: true });
  mkdirSync(path.join(root, config.adrDir), { recursive: true });
  mkdirSync(path.join(root, config.sdrDir), { recursive: true });
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  ensureGitignore(root);

  const runtime = openRuntime(root);
  try {
    await runtime.store.upsertProject({
      id: config.project,
      name: projectName,
      type: config.projectType,
    });
    const candidates = COMMON_ADR_DIRS.filter(
      (directory) =>
        collectMarkdownFiles(path.resolve(root, directory)).length > 0,
    );
    const importCandidates =
      candidates.length > 0 && (yes || (await confirmImport(candidates)));
    const result = await synchronize(
      runtime,
      importCandidates ? candidates : [],
    );
    await compileInstructions(
      root,
      config,
      await runtime.store.list(config.project, {
        type: 'adr',
        status: 'accepted',
      }),
    );
    console.log(`Initialized decision-graph in ${root}`);
    console.log(
      `Indexed ${result.indexed} record(s); ${result.changed} changed, ${result.removed} removed.`,
    );
  } finally {
    runtime.store.close();
  }
}

function openRuntime(root: string): Runtime {
  const configFile = path.join(root, CONFIG_PATH);
  if (!existsSync(configFile)) {
    throw new Error(
      `Not initialized; run "dg init" first (missing ${CONFIG_PATH})`,
    );
  }
  const config = parseConfig(readFileSync(configFile, 'utf8'), CONFIG_PATH);
  const store = new SQLiteStore(path.join(root, '.dg', 'graph.db'));
  return { root, config, store };
}

async function serveProject(
  root: string,
  database: string,
  port: number,
  host: string,
): Promise<void> {
  const isPostgres = /^postgres(?:ql)?:\/\//i.test(database);
  const configFile = path.join(root, CONFIG_PATH);
  const config = existsSync(configFile)
    ? parseConfig(readFileSync(configFile, 'utf8'), CONFIG_PATH)
    : ConfigSchema.parse({
        project: 'remote-server',
        projectType: 'remote-server',
        adrDir: DEFAULT_ADR_DIR,
        sdrDir: DEFAULT_SDR_DIR,
        agentsMd: 'AGENTS.md',
        tokenBudget: 1500,
        remote: null,
      });
  let store: SQLiteStore | PostgresStore;
  if (isPostgres) {
    store = new PostgresStore(database);
  } else {
    const file = path.resolve(root, database);
    mkdirSync(path.dirname(file), { recursive: true });
    store = new SQLiteStore(file);
  }

  try {
    await store.listProjects();
  } catch (error) {
    await store.close();
    throw error;
  }

  const server = createDecisionGraphHttpServer(store, config);
  server.once('close', () => {
    void Promise.resolve(store.close()).catch((error: unknown) => {
      console.error(
        `Failed to close decision-graph store: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const onListening = () => {
        server.off('error', onError);
        resolve();
      };
      const onError = (error: Error) => {
        server.off('listening', onListening);
        reject(error);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });
  } catch (error) {
    await store.close();
    throw error;
  }
  if (!isLocalHost(host)) {
    console.warn(
      `WARNING: decision-graph server is bound to ${host}:${port} without authentication. Only bind to a trusted network.`,
    );
  }
  console.log(`decision-graph server listening on http://${host}:${port}`);
}

function isLocalHost(host: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(
    host.toLowerCase(),
  );
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be an integer from 1 to 65535');
  }
  return port;
}

function requireRemote(remote: string | undefined, config: Config): string {
  const value = remote ?? config.remote;
  if (!value) {
    throw new Error(
      'No remote configured; use --remote <url> or set .dg/config.json remote.',
    );
  }
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Remote must use HTTP or HTTPS');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('Remote must be a base URL without a query or fragment');
  }
  return parsed.toString().replace(/\/+$/, '');
}

async function requestJson<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Remote request failed (${response.status} ${response.statusText}): ${text.slice(0, 1000)}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      `Remote returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function remoteProjectNamespace(remote: string, projectId: string): string {
  const fingerprint = createHash('sha256')
    .update(remote)
    .digest('hex')
    .slice(0, 12);
  return `remote:${fingerprint}:${projectId}`;
}

function sanitizeRemoteOrigin(remote: string): string {
  const url = new URL(remote);
  url.username = '';
  url.password = '';
  return url.toString().replace(/\/+$/, '');
}

async function synchronize(
  runtime: Runtime,
  additionalDirectories: string[] = [],
): Promise<{ indexed: number; changed: number; removed: number }> {
  const { root, config, store } = runtime;
  await store.upsertProject({
    id: config.project,
    name: path.basename(root),
    type: config.projectType,
  });
  const existing = await store.list(config.project);
  const knownPaths = existing.map((record) => path.resolve(root, record.path));
  const files = new Set([
    ...collectMarkdownFiles(path.resolve(root, config.adrDir)),
    ...collectMarkdownFiles(path.resolve(root, config.sdrDir)),
    ...additionalDirectories.flatMap((directory) =>
      collectMarkdownFiles(path.resolve(root, directory)),
    ),
    ...knownPaths.filter((file) => existsSync(file)),
  ]);
  const records = [...files]
    .sort()
    .map((file) => parseFile(root, file, 'auto'));
  const changed = await indexRecords(store, config, records);
  const removed = await store.deleteMissing(
    config.project,
    records.map((record) => record.id),
  );
  await rebuildEdges(store, config.project, records);
  return { indexed: records.length, changed, removed };
}

async function indexRecords(
  store: Store,
  config: Config,
  records: DecisionRecord[],
): Promise<number> {
  await store.upsertProject({
    id: config.project,
    name: path.basename(process.cwd()),
    type: config.projectType,
  });
  let changed = 0;
  for (const record of records) {
    if (await store.upsertNode(config.project, record)) changed += 1;
  }
  await rebuildEdges(store, config.project, records);
  return changed;
}

async function rebuildEdges(
  store: Store,
  projectId: string,
  records: DecisionRecord[],
): Promise<void> {
  await store.deleteEdges(
    projectId,
    records.map((record) => record.id),
  );
  for (const record of records) {
    if (record.type === 'adr') {
      for (const target of record.supersedes) {
        await addEdgeIfPresent(
          store,
          projectId,
          record.id,
          target,
          'supersedes',
        );
      }
      for (const target of record.relatesTo) {
        await addEdgeIfPresent(
          store,
          projectId,
          record.id,
          target,
          'relates_to',
        );
      }
      for (const target of record.derivedFrom) {
        await addEdgeIfPresent(
          store,
          projectId,
          record.id,
          target,
          'derived_from',
        );
      }
    } else if (record.promotedTo) {
      await addEdgeIfPresent(
        store,
        projectId,
        record.id,
        record.promotedTo,
        'promoted_to',
      );
    }
  }
}

async function addEdgeIfPresent(
  store: Store,
  projectId: string,
  source: string,
  target: string,
  kind: EdgeKind,
): Promise<void> {
  if (
    (await store.get(projectId, source)) &&
    (await store.get(projectId, target))
  ) {
    await store.addEdge(projectId, source, target, kind);
  }
}

function parseFile(
  root: string,
  file: string,
  format: FormatName,
): DecisionRecord {
  const relative = path.relative(root, file).split(path.sep).join('/');
  return parseRecord(readFileSync(file, 'utf8'), relative, format);
}

function ensureGitignore(root: string): void {
  const file = path.join(root, '.gitignore');
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const ignored = new Set(current.split(/\r?\n/));
  const missing = ['.dg/graph.db', '.dg/server.db'].filter(
    (entry) => !ignored.has(entry),
  );
  if (missing.length === 0) return;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  writeFileSync(file, `${current}${separator}${missing.join('\n')}\n`);
}

async function confirmImport(directories: string[]): Promise<boolean> {
  const { createInterface } = await import('node:readline/promises');
  const { stdin, stdout } = await import('node:process');
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question(
      `Import records from ${directories.join(', ')}? [y/N] `,
    );
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

async function promoteSdr(runtime: Runtime, id: string): Promise<string> {
  const source = await loadSdr(runtime, id);
  const existingAdr = readAdrRecords(runtime).find((record) =>
    record.derivedFrom.includes(id),
  );
  if (existingAdr) {
    if (
      source.status !== 'open' &&
      (source.status !== 'promoted' || source.promotedTo !== existingAdr.id)
    ) {
      throw new Error(`Cannot promote SDR ${id}: status is ${source.status}`);
    }
    await indexRecords(runtime.store, runtime.config, [existingAdr]);
    if (source.status === 'open') {
      await setSdrLifecycle(runtime, id, 'promoted', existingAdr.id);
    } else {
      await indexRecords(runtime.store, runtime.config, [source]);
    }
    return existingAdr.id;
  }
  if (source.status !== 'open') {
    throw new Error(`Cannot promote SDR ${id}: status is ${source.status}`);
  }
  const adrFile = await createAdrDraft(
    runtime,
    source.title,
    {
      appliesTo: source.appliesTo,
      tags: source.tags,
      derivedFrom: [source.id],
    },
    source,
  );
  const adr = parseFile(runtime.root, adrFile, 'hybrid');
  if (adr.type !== 'adr') {
    throw new Error(`Generated draft for SDR ${id} is not an ADR`);
  }
  await setSdrLifecycle(runtime, id, 'promoted', adr.id);
  return adr.id;
}

async function loadSdr(runtime: Runtime, id: string): Promise<SdrRecord> {
  const node = await runtime.store.get(runtime.config.project, id);
  if (!node) throw new Error(`SDR not found: ${id}`);
  const file = path.resolve(runtime.root, node.path);
  if (!existsSync(file)) {
    throw new Error(`Source file for SDR ${id} is missing; run "dg sync"`);
  }
  const record = parseFile(runtime.root, file, 'auto');
  if (record.type !== 'sdr') throw new Error(`Record is not an SDR: ${id}`);
  if (record.id !== id) {
    throw new Error(`Source file for SDR ${id} contains record ${record.id}`);
  }
  return record;
}

async function setSdrLifecycle(
  runtime: Runtime,
  id: string,
  status: 'promoted' | 'discarded',
  promotedTo: string | null,
  reason?: string,
): Promise<SdrRecord> {
  const record = await loadSdr(runtime, id);
  if (record.status !== 'open') {
    throw new Error(`Cannot update SDR ${id}: status is ${record.status}`);
  }
  const file = path.resolve(runtime.root, record.path);
  const original = readFileSync(file, 'utf8');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(original);
  if (!frontmatter) throw new Error(`Invalid frontmatter for SDR ${id}`);
  const data = load(frontmatter[1]);
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`Invalid frontmatter for SDR ${id}`);
  }
  const metadata = data as Record<string, unknown>;
  metadata.status = status;
  metadata.promoted_to = promotedTo;
  const originalBody = original.slice(frontmatter[0].length);
  const body =
    reason === undefined
      ? originalBody
      : `${originalBody.trimEnd()}\n\n## Discard Reason\n\n${reason}\n`;
  const content = `---\n${dump(metadata, { noRefs: true, lineWidth: -1 }).trimEnd()}\n---\n${body}`;
  writeFileSync(file, content);
  const updated = parseFile(runtime.root, file, 'auto');
  if (updated.type !== 'sdr') throw new Error(`Record is not an SDR: ${id}`);
  await indexRecords(runtime.store, runtime.config, [updated]);
  return updated;
}

async function createAdrDraft(
  runtime: Runtime,
  title: string,
  options: {
    appliesTo?: string[];
    tags?: string[];
    derivedFrom?: string[];
  },
  source?: SdrRecord,
): Promise<string> {
  const records = await runtime.store.list(runtime.config.project, {
    type: 'adr',
  });
  const adrRecords = readAdrRecords(runtime);
  const next = nextAdrNumber([
    ...records.map((record) => record.id),
    ...adrRecords.map((record) => record.id),
  ]);
  const id = `ADR-${String(next).padStart(4, '0')}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'decision';
  const relativeFile = path.join(runtime.config.adrDir, `${id}-${slug}.md`);
  const absoluteFile = path.join(runtime.root, relativeFile);
  mkdirSync(path.dirname(absoluteFile), { recursive: true });
  const draft = renderHybridDraft(
    {
      id,
      type: 'adr',
      title,
      status: 'proposed',
      applies_to: options.appliesTo ?? [],
      tags: options.tags ?? [],
      supersedes: [],
      relates_to: [],
      derived_from: options.derivedFrom ?? [],
      date: new Date().toISOString().slice(0, 10),
    },
    source,
  );
  writeFileSync(absoluteFile, draft, { flag: 'wx' });
  const record = parseRecord(
    draft,
    relativeFile.split(path.sep).join('/'),
    'hybrid',
  );
  await indexRecords(runtime.store, runtime.config, [record]);
  return absoluteFile;
}

function readAdrRecords(runtime: Runtime): AdrRecord[] {
  return collectMarkdownFiles(path.resolve(runtime.root, runtime.config.adrDir))
    .map((file) => parseFile(runtime.root, file, 'auto'))
    .filter((record): record is AdrRecord => record.type === 'adr');
}

async function writeConvertedDraft(
  runtime: Runtime,
  source: Extract<DecisionRecord, { type: 'adr' }>,
): Promise<DecisionRecord> {
  const adrFiles = collectMarkdownFiles(
    path.resolve(runtime.root, runtime.config.adrDir),
  );
  const adrRecords: DecisionRecord[] = [];
  for (const file of adrFiles) {
    const existing = parseFile(runtime.root, file, 'auto');
    adrRecords.push(existing);
    if (
      existing.type === 'adr' &&
      existing.status === 'proposed' &&
      existing.title === source.title &&
      existing.relatesTo.includes(source.id)
    ) {
      return existing;
    }
  }
  const records = await runtime.store.list(runtime.config.project, {
    type: 'adr',
  });
  const next = nextAdrNumber([
    ...records.map((record) => record.id),
    ...adrRecords.map((record) => record.id),
  ]);
  const id = `ADR-${String(next).padStart(4, '0')}`;
  const relativeFile = path.join(
    runtime.config.adrDir,
    `${id}-${
      source.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'decision'
    }.md`,
  );
  const content = renderHybridDraft(
    {
      id,
      type: 'adr',
      title: source.title,
      status: 'proposed',
      applies_to: source.appliesTo,
      tags: source.tags,
      supersedes: [],
      relates_to: [source.id],
      derived_from: [],
      date: source.date ?? new Date().toISOString().slice(0, 10),
    },
    source,
  );
  const absoluteFile = path.join(runtime.root, relativeFile);
  mkdirSync(path.dirname(absoluteFile), { recursive: true });
  writeFileSync(absoluteFile, content, { flag: 'wx' });
  return parseRecord(content, relativeFile.split(path.sep).join('/'), 'hybrid');
}

function renderHybridDraft(
  metadata: Record<string, unknown>,
  source?: AdrRecord | SdrRecord,
): string {
  const yaml = dump(metadata, { noRefs: true, lineWidth: -1 }).trimEnd();
  const list = (values: string[]) =>
    values.length ? values.map((value) => `- ${value}`).join('\n') : 'None.';
  const rules =
    source?.type === 'adr'
      ? source.rules
          .map((rule) => `- **${rule.modality}:** ${rule.text}`)
          .join('\n')
      : 'None.';
  const checks =
    source?.type === 'adr'
      ? source.verify
          .map(
            (check) =>
              `- **Check:** ${check.check}\n  **Expected:** ${check.expected}`,
          )
          .join('\n')
      : 'None.';
  const isAdr = source?.type === 'adr';
  return `---\n${yaml}\n---\n\n# ${metadata.id}: ${metadata.title}\n\n## Agent Rules\n\n${rules}\n\n## Verify\n\n${checks}\n\n## Context and Problem Statement\n\n${(isAdr ? source.context : source?.why) || 'Describe the context and problem.'}\n\n## Decision Drivers\n\n${list(isAdr ? source.decisionDrivers : [])}\n\n## Considered Options\n\n${list(isAdr ? source.consideredOptions : (source?.alternatives ?? []))}\n\n## Decision Outcome\n\n${(isAdr ? source.decisionOutcome : source?.decision) || 'Describe the decision.'}\n\n### Positive Consequences\n\n${list(isAdr ? source.positiveConsequences : [])}\n\n### Negative Consequences\n\n${list(isAdr ? source.negativeConsequences : [])}\n\n## Pros and Cons of the Options\n\n${list(isAdr ? source.prosAndCons : [])}\n\n## Links\n\n${list(isAdr ? source.links : [])}\n`;
}

function nextAdrNumber(ids: string[]): number {
  return (
    ids.reduce((max, id) => {
      const match = /^ADR-(\d+)$/i.exec(id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0) + 1
  );
}

function outputRecords(records: GraphNode[], json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }
  for (const record of records) printRecord(record);
}

function printRecord(record: GraphNode): void {
  console.log(`${record.id} [${record.type}/${record.status}] ${record.title}`);
}

function printSyncResult(total: number, changed: number): void {
  console.log(`Indexed ${total} record(s); ${changed} changed.`);
}

function validatedFilter(options: NodeFilter): NodeFilter {
  if (options.type && options.type !== 'adr' && options.type !== 'sdr') {
    throw new Error(`Invalid record type: ${options.type}`);
  }
  return options;
}

function requireFormat(value: string): FormatName {
  if (FORMAT_NAMES.includes(value as FormatName)) return value as FormatName;
  throw new Error(
    `Invalid format "${value}". Expected one of ${FORMAT_NAMES.join(', ')}`,
  );
}

function requireEdgeKind(value: string): EdgeKind {
  if (EDGE_KINDS.includes(value as EdgeKind)) return value as EdgeKind;
  throw new Error(
    `Invalid edge kind "${value}". Expected one of ${EDGE_KINDS.join(', ')}`,
  );
}

function parseDepth(value: string): number {
  const depth = Number(value);
  if (!Number.isInteger(depth) || depth < 0 || depth > 100) {
    throw new Error('Depth must be an integer from 0 to 100');
  }
  return depth;
}

async function compileInstructions(
  root: string,
  config: Config,
  acceptedRecords: GraphNode[],
): Promise<void> {
  const file = resolveManagedFile(root, config.agentsMd);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const begin = '<!-- dg:begin -->';
  const end = '<!-- dg:end -->';
  const rules = acceptedRecords
    .filter((record) => record.type === 'adr' && record.status === 'accepted')
    .sort((first, second) => compareText(first.id, second.id))
    .flatMap((record) =>
      record.rules.map(
        (rule) =>
          `${rule.id} [${record.appliesTo.join(', ')}] ${rule.modality} ${rule.text}`,
      ),
    );
  const instructionLines = [
    'Run `dg context <files>` before editing.',
    'Record decisions with `dg sdr add`.',
    'MCP server: `dg mcp`.',
    '',
    '## Accepted rules',
    ...(rules.length ? rules : ['No accepted rules are indexed.']),
  ];
  const includedRules = rules.length ? [] : ['No accepted rules are indexed.'];
  let omittedRules = false;
  for (const rule of rules) {
    const candidate = renderManagedBlock(
      [...instructionLines.slice(0, 5), ...includedRules, rule],
      begin,
      end,
    );
    if (estimateTokens(candidate) <= config.tokenBudget) {
      includedRules.push(rule);
    } else {
      omittedRules = true;
    }
  }
  if (omittedRules) {
    const note =
      'Rule index trimmed; run `dg context <files>` for the full list.';
    while (
      includedRules.length > 0 &&
      estimateTokens(
        renderManagedBlock(
          [...instructionLines.slice(0, 5), ...includedRules, note],
          begin,
          end,
        ),
      ) > config.tokenBudget
    ) {
      includedRules.pop();
    }
    instructionLines.splice(
      5,
      instructionLines.length - 5,
      ...includedRules,
      note,
    );
  } else {
    instructionLines.splice(5, instructionLines.length - 5, ...includedRules);
  }
  const block = renderManagedBlock(instructionLines, begin, end);
  if (estimateTokens(block) > config.tokenBudget) {
    throw new Error(
      `tokenBudget ${config.tokenBudget} is too small for the managed usage instructions in ${config.agentsMd}`,
    );
  }
  const beginAt = current.indexOf(begin);
  const endAt = current.indexOf(end);
  const beginCount = current.split(begin).length - 1;
  const endCount = current.split(end).length - 1;
  let output: string;
  if (beginAt !== -1 || endAt !== -1) {
    if (
      beginAt === -1 ||
      endAt < beginAt ||
      beginCount !== 1 ||
      endCount !== 1
    ) {
      throw new Error(
        `Malformed managed decision-graph block in ${config.agentsMd}`,
      );
    }
    output = `${current.slice(0, beginAt)}${block}${current.slice(endAt + end.length)}`;
  } else {
    output = `${current}${current && !current.endsWith('\n') ? '\n' : ''}${block}\n`;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, output);
}

function resolveManagedFile(root: string, configuredPath: string): string {
  const projectRoot = path.resolve(root);
  const absoluteFile = path.resolve(projectRoot, configuredPath);
  const errorMessage = `agentsMd must resolve within the project root: ${configuredPath}`;
  if (!isPathWithin(projectRoot, absoluteFile)) throw new Error(errorMessage);

  const canonicalRoot = realpathSync(projectRoot);
  let ancestor = absoluteFile;
  const missingSegments: string[] = [];
  while (true) {
    try {
      lstatSync(ancestor);
      break;
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        throw error;
      }
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      missingSegments.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }

  const target = path.resolve(realpathSync(ancestor), ...missingSegments);
  if (!isPathWithin(canonicalRoot, target)) throw new Error(errorMessage);
  return target;
}

function isPathWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

interface VerifyRow {
  status: 'PASS' | 'FAIL' | 'SKIP';
  record: string;
  check: string;
  expected: string;
  result: string;
}

function isManualCheck(check: string): boolean {
  return /^manual(?:\s+review)?\s*:/i.test(check);
}

function runVerification(
  root: string,
  command: string,
  timeoutMs: number,
): Promise<{ code: number | null; timedOut: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd: root,
      shell: true,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let capturedBytes = 0;
    let outputTruncated = false;
    let timedOut = false;
    let settled = false;
    const append = (chunk: Buffer) => {
      const remaining = MAX_VERIFICATION_OUTPUT_BYTES - capturedBytes;
      if (remaining <= 0) {
        outputTruncated = true;
        return;
      }
      const retained = chunk.subarray(0, remaining);
      output += retained.toString();
      capturedBytes += retained.byteLength;
      if (retained.byteLength < chunk.byteLength) outputTruncated = true;
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined && process.platform !== 'win32') {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          output += `Unable to stop process group: ${error instanceof Error ? error.message : String(error)}. `;
          child.kill('SIGKILL');
        }
      } else if (child.pid !== undefined) {
        const killer = spawn(
          'taskkill',
          ['/PID', String(child.pid), '/T', '/F'],
          { stdio: 'ignore', windowsHide: true },
        );
        killer.once('error', () => child.kill('SIGKILL'));
      } else {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    timer.unref();

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code: 127,
        timedOut,
        output: error.message,
      });
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        code,
        timedOut,
        output: formatVerificationOutput(output, outputTruncated),
      });
    });
  });
}

const MAX_VERIFICATION_OUTPUT_BYTES = 16 * 1024;

function formatVerificationOutput(output: string, truncated: boolean): string {
  const compact = output.trim().replace(/\s+/g, ' ');
  const marker = truncated ? ' [output truncated]' : '';
  return `${compact.slice(0, 500 - marker.length)}${marker}`;
}

function printVerifyTable(rows: VerifyRow[]): void {
  console.log('STATUS | RECORD | CHECK | EXPECTED | RESULT');
  for (const row of rows) {
    console.log(
      [row.status, row.record, row.check, row.expected, row.result]
        .map((cell) => cell.replace(/\s+/g, ' ').replace(/\|/g, '\\|'))
        .join(' | '),
    );
  }
}

function parsePositiveSeconds(value: string): number {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error('Timeout must be a positive number of seconds');
  }
  return seconds;
}

function renderManagedBlock(
  lines: string[],
  begin: string,
  end: string,
): string {
  return `${begin}\n${lines.join('\n')}\n${end}`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function renderGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  format: 'mermaid' | 'dot',
): string {
  const orderedNodes = [...nodes].sort((first, second) =>
    compareText(first.id, second.id),
  );
  const identifiers = new Map(
    orderedNodes.map((node, index) => [node.id, `n${index}`]),
  );
  if (format === 'mermaid') {
    const lines = ['flowchart TD'];
    for (const node of orderedNodes) {
      const id = identifiers.get(node.id);
      if (id) {
        lines.push(
          `  ${id}["${escapeGraphLabel(`${node.id}: ${node.title}`)}"]`,
        );
      }
    }
    for (const edge of [...edges].sort(compareEdges)) {
      const source = identifiers.get(edge.src);
      const target = identifiers.get(edge.dst);
      if (source && target) {
        lines.push(`  ${source} -->|${edge.kind}| ${target}`);
      }
    }
    return lines.join('\n');
  }

  const lines = ['digraph decision_graph {'];
  for (const node of orderedNodes) {
    const id = identifiers.get(node.id);
    if (id) {
      lines.push(
        `  ${id} [label="${escapeGraphLabel(`${node.id}: ${node.title}`)}"];`,
      );
    }
  }
  for (const edge of [...edges].sort(compareEdges)) {
    const source = identifiers.get(edge.src);
    const target = identifiers.get(edge.dst);
    if (source && target) {
      lines.push(`  ${source} -> ${target} [label="${edge.kind}"];`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

function compareEdges(first: GraphEdge, second: GraphEdge): number {
  return (
    compareText(first.src, second.src) ||
    compareText(first.dst, second.dst) ||
    compareText(first.kind, second.kind)
  );
}

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}

function escapeGraphLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ');
}
