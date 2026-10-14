import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import { dump } from 'js-yaml';
import type { Command } from 'commander';
import {
  ConfigSchema,
  parseConfig,
  parseRecord,
  type Config,
  type DecisionRecord,
} from '../core/index.js';
import {
  SQLiteStore,
  type EdgeKind,
  type GraphNode,
  type NodeFilter,
  type Store,
} from '../store/index.js';

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
        await compileInstructions(runtime.root, runtime.config);
      } finally {
        runtime.store.close();
      }
    });

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
        const normalizedFiles = files.map(normalizeFilePath);
        const matches = await runtime.store.byGlobMatch(
          runtime.config.project,
          normalizedFiles,
        );
        const accepted = matches.filter(
          (record) => record.type === 'adr' && record.status === 'accepted',
        );
        accepted.sort(
          (a, b) =>
            ruleSpecificity(b, normalizedFiles) -
              ruleSpecificity(a, normalizedFiles) || a.id.localeCompare(b.id),
        );
        const rules = accepted.flatMap((record) =>
          record.rules.map((rule) => ({
            ...rule,
            recordId: record.id,
            title: record.title,
            appliesTo: record.appliesTo,
          })),
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
    await compileInstructions(root, config);
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

function collectMarkdownFiles(target: string): string[] {
  if (!existsSync(target)) return [];
  const stat = statSync(target);
  if (stat.isFile()) return /\.md$/i.test(target) ? [target] : [];
  if (!stat.isDirectory()) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.md$/i.test(entry.name))
        files.push(entryPath);
    }
  };
  visit(target);
  return files;
}

function ensureGitignore(root: string): void {
  const file = path.join(root, '.gitignore');
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (current.split(/\r?\n/).includes('.dg/graph.db')) return;
  const separator = current && !current.endsWith('\n') ? '\n' : '';
  writeFileSync(file, `${current}${separator}.dg/graph.db\n`);
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

async function createAdrDraft(
  runtime: Runtime,
  title: string,
  options: { appliesTo?: string[]; tags?: string[] },
): Promise<string> {
  const records = await runtime.store.list(runtime.config.project, {
    type: 'adr',
  });
  const next = nextAdrNumber(records.map((record) => record.id));
  const id = `ADR-${String(next).padStart(4, '0')}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'decision';
  const relativeFile = path.join(runtime.config.adrDir, `${id}-${slug}.md`);
  const absoluteFile = path.join(runtime.root, relativeFile);
  mkdirSync(path.dirname(absoluteFile), { recursive: true });
  const content = renderHybridDraft({
    id,
    type: 'adr',
    title,
    status: 'proposed',
    applies_to: options.appliesTo ?? [],
    tags: options.tags ?? [],
    supersedes: [],
    relates_to: [],
    derived_from: [],
    date: new Date().toISOString().slice(0, 10),
  });
  writeFileSync(absoluteFile, content, { flag: 'wx' });
  const record = parseRecord(
    content,
    relativeFile.split(path.sep).join('/'),
    'hybrid',
  );
  await indexRecords(runtime.store, runtime.config, [record]);
  return absoluteFile;
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
  source?: Extract<DecisionRecord, { type: 'adr' }>,
): string {
  const yaml = dump(metadata, { noRefs: true, lineWidth: -1 }).trimEnd();
  const list = (values: string[]) =>
    values.length ? values.map((value) => `- ${value}`).join('\n') : 'None.';
  const rules =
    source?.rules
      .map((rule) => `- **${rule.modality}:** ${rule.text}`)
      .join('\n') ?? 'None.';
  const checks =
    source?.verify
      .map(
        (check) =>
          `- **Check:** ${check.check}\n  **Expected:** ${check.expected}`,
      )
      .join('\n') ?? 'None.';
  return `---\n${yaml}\n---\n\n# ${metadata.id}: ${metadata.title}\n\n## Agent Rules\n\n${rules}\n\n## Verify\n\n${checks}\n\n## Context and Problem Statement\n\n${source?.context || 'Describe the context and problem.'}\n\n## Decision Drivers\n\n${list(source?.decisionDrivers ?? [])}\n\n## Considered Options\n\n${list(source?.consideredOptions ?? [])}\n\n## Decision Outcome\n\n${source?.decisionOutcome || 'Describe the decision.'}\n\n### Positive Consequences\n\n${list(source?.positiveConsequences ?? [])}\n\n### Negative Consequences\n\n${list(source?.negativeConsequences ?? [])}\n\n## Pros and Cons of the Options\n\n${list(source?.prosAndCons ?? [])}\n\n## Links\n\n${list(source?.links ?? [])}\n`;
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

function normalizeFilePath(file: string): string {
  return path.normalize(file).split(path.sep).join('/').replace(/^\.\//, '');
}

function ruleSpecificity(record: GraphNode, files: string[]): number {
  return record.appliesTo.reduce((specificity, pattern) => {
    const matchesFile = files.some((file) => picomatch.isMatch(file, pattern));
    return matchesFile
      ? Math.max(specificity, pattern.replace(/[*?[\]{}!]/g, '').length)
      : specificity;
  }, 0);
}

async function compileInstructions(
  root: string,
  config: Config,
): Promise<void> {
  const projectRoot = path.resolve(root);
  const file = path.resolve(projectRoot, config.agentsMd);
  const relativeFile = path.relative(projectRoot, file);
  if (
    relativeFile === '..' ||
    relativeFile.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFile)
  ) {
    throw new Error(
      `agentsMd must resolve within the project root: ${config.agentsMd}`,
    );
  }
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const begin = '<!-- dg:begin -->';
  const end = '<!-- dg:end -->';
  const block = `${begin}\nUse \`dg context <files>\` before editing.\n${end}`;
  const beginAt = current.indexOf(begin);
  const endAt = current.indexOf(end);
  let output: string;
  if (beginAt !== -1 || endAt !== -1) {
    if (beginAt === -1 || endAt < beginAt) {
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
