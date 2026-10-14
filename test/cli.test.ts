import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';
import { SQLiteStore } from '../src/store/sqlite.js';

const originalCwd = process.cwd();
const temporaryDirectories: string[] = [];
afterEach(() => {
  process.chdir(originalCwd);
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

it('exposes the package version', () => {
  expect(createProgram().version()).toBe('0.1.0');
});

it('shows help for the CLI', () => {
  let output = '';
  const program = createProgram()
    .configureOutput({ writeOut: (text) => (output += text) })
    .exitOverride();

  expect(() => program.parse(['node', 'dg', '--help'])).toThrow();
  expect(output).toContain('Usage: dg');
  expect(output).toContain('--version');
});

it('initializes, syncs, and returns only applicable accepted rules', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-images.md',
    hybridRecord('ADR-0001', ['**/*.tsx'], 'MUST', 'Use image components.'),
  );
  process.chdir(root);
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await invoke('init', '--yes', '--type', 'app');
  expect(readFileSync(path.join(root, '.dg/config.json'), 'utf8')).toContain(
    '"projectType": "app"',
  );
  expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain(
    '.dg/graph.db',
  );
  expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toContain(
    '.dg/server.db',
  );
  expect(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain(
    '<!-- dg:begin -->',
  );
  expect(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain(
    'Record decisions with `dg sdr add`.',
  );
  log.mockClear();

  await invoke('sync');
  expect(log).toHaveBeenCalledWith(
    'Indexed 1 record(s); 0 changed, 0 removed.',
  );
  log.mockClear();

  await invoke('context', 'src/card.tsx', '--json');
  const output = JSON.parse(log.mock.calls[0][0] as string) as {
    id: string;
    text: string;
  }[];
  expect(output).toEqual([
    expect.objectContaining({
      id: 'ADR-0001#1',
      text: 'Use image components.',
    }),
  ]);
  log.mockClear();

  await invoke('list', '--type', 'adr', '--tag', 'testing', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toHaveLength(1);
  unlinkSync(path.join(root, 'docs/decisions/adr/ADR-0001-images.md'));
  log.mockClear();

  await invoke('sync');
  expect(log).toHaveBeenCalledWith(
    'Indexed 0 record(s); 0 changed, 1 removed.',
  );
});

it('does not prompt to import when no Markdown records are present', async () => {
  const root = createTempProject();
  process.chdir(root);
  const stdoutWrite = vi.spyOn(process.stdout, 'write');

  await invoke('init');

  expect(
    stdoutWrite.mock.calls.some(([chunk]) =>
      String(chunk).includes('Import records from'),
    ),
  ).toBe(false);
});

it('compiles a deterministic, budgeted managed block without changing surrounding text', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-images.md',
    hybridRecord(
      'ADR-0001',
      ['src/**/*.tsx'],
      'MUST',
      'Use the shared image rendering component for all image content.',
    ),
  );
  writeFileSync(path.join(root, 'AGENTS.md'), 'Project guidance before.\n');
  process.chdir(root);
  await invoke('init', '--yes');

  const file = path.join(root, 'AGENTS.md');
  const initial = readFileSync(file, 'utf8');
  const begin = initial.indexOf('<!-- dg:begin -->');
  const end = initial.indexOf('<!-- dg:end -->') + '<!-- dg:end -->'.length;
  expect(initial.slice(begin, end)).toBe(
    [
      '<!-- dg:begin -->',
      'Run `dg context <files>` before editing.',
      'Record decisions with `dg sdr add`.',
      'MCP server: `dg mcp`.',
      '',
      '## Accepted rules',
      'ADR-0001#1 [src/**/*.tsx] MUST Use the shared image rendering component for all image content.',
      '<!-- dg:end -->',
    ].join('\n'),
  );
  writeFileSync(file, `${initial.trimEnd()}\nProject guidance after.\n`);
  const configFile = path.join(root, '.dg/config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as {
    tokenBudget: number;
  };
  config.tokenBudget = 58;
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  await invoke('compile');
  const compiled = readFileSync(file, 'utf8');
  expect(compiled).toContain('Project guidance before.');
  expect(compiled).toContain('Project guidance after.');
  expect(compiled).toContain(
    'Rule index trimmed; run `dg context <files>` for the full list.',
  );
  expect(compiled).not.toContain('Use the shared image rendering component');
  expect(compiled.match(/<!-- dg:begin -->/g)).toHaveLength(1);
  log.mockClear();

  await invoke('compile');
  expect(readFileSync(file, 'utf8')).toBe(compiled);
});

it('verifies automated checks, reports manual reviews, and times out long checks', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-checks.md',
    `---
id: ADR-0001
type: adr
title: Verify checks
status: accepted
applies_to: []
tags: []
---

# ADR-0001: Verify checks

## Verify

- **Check:** node -e "process.exit(0)"
  **Expected:** exits successfully
- **Check:** node -e "process.exit(2)"
  **Expected:** exits unsuccessfully
- **Check:** manual review: inspect the deployment configuration
  **Expected:** deployment settings match the project requirements
- **Check:** node -e "setTimeout(() => {}, 2000)"
  **Expected:** completes within the timeout
`,
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0002-timeout.md',
    `---
id: ADR-0002
type: adr
title: Time out checks
status: accepted
applies_to: []
tags: []
---

# ADR-0002: Time out checks

## Verify

- **Check:** node -e "setTimeout(() => {}, 2000)"
  **Expected:** completes within the timeout
`,
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0003-no-checks.md',
    hybridRecord('ADR-0003', ['**/*.md'], 'MUST', 'Keep the source.'),
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0004-large-output.md',
    `---
id: ADR-0004
type: adr
title: Bound verification output
status: accepted
applies_to: []
tags: []
---

# ADR-0004: Bound verification output

## Verify

- **Check:** node -e "process.stdout.write('x'.repeat(1000000))"
  **Expected:** exits successfully
`,
  );
  process.chdir(root);
  await invoke('init', '--yes');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  process.exitCode = undefined;
  await invoke('verify', 'ADR-0001', '--timeout', '3');
  const output = log.mock.calls.map(([line]) => String(line)).join('\n');
  expect(output).toContain('PASS | ADR-0001');
  expect(output).toContain('FAIL | ADR-0001');
  expect(output).toContain('SKIP | ADR-0001');
  expect(output).toContain(
    'Manual review: inspect the deployment configuration',
  );
  expect(output).not.toContain('Timed out after');
  expect(process.exitCode).toBe(1);
  process.exitCode = undefined;
  log.mockClear();

  await invoke('verify', 'ADR-0002', '--timeout', '0.05');
  const timeoutOutput = log.mock.calls.map(([line]) => String(line)).join('\n');
  expect(timeoutOutput).toContain('Timed out after 0.05s.');
  expect(process.exitCode).toBe(1);
  process.exitCode = undefined;
  log.mockClear();
  await invoke('verify', 'ADR-0003');
  expect(log.mock.calls.map(([line]) => String(line)).join('\n')).toContain(
    'No automated checks; review docs/decisions/adr/ADR-0003-no-checks.md.',
  );
  log.mockClear();
  await invoke('verify', 'ADR-0004');
  expect(log.mock.calls.map(([line]) => String(line)).join('\n')).toContain(
    '[output truncated]',
  );
});

it('lints record and graph errors, detects conflicts, and exports the graph', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-first.md',
    hybridRecord(
      'ADR-0001',
      ['x/ab*b'],
      'MUST',
      'Use the shared storage interface.',
      ['ADR-9999'],
    ).replace(
      'status: accepted',
      'status: accepted\nsupersedes:\n  - ADR-0002',
    ),
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0002-second.md',
    hybridRecord(
      'ADR-0002',
      ['x/a*ab'],
      'MUST NOT',
      'Use the shared storage interface.',
    ).replace(
      'status: accepted',
      'status: accepted\nsupersedes:\n  - ADR-0001',
    ),
  );
  writeRecord(
    root,
    'docs/decisions/adr/duplicate.md',
    hybridRecord('ADR-0001', ['src/**/*.ts'], 'SHOULD', 'Keep the source.'),
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0003-long.md',
    `${hybridRecord('ADR-0003', ['docs/**/*.md'], 'MUST', 'Keep the source.')}${'Long note.\n'.repeat(205)}`,
  );
  process.chdir(root);
  await invoke('init', '--yes');
  writeRecord(
    root,
    'docs/decisions/adr/broken.md',
    '---\nid: [\n---\n# Invalid',
  );
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  process.exitCode = undefined;
  await invoke('lint', '--json');
  const report = JSON.parse(log.mock.calls[0][0] as string) as {
    ok: boolean;
    diagnostics: { code: string }[];
  };
  expect(report.ok).toBe(false);
  expect(report.diagnostics.map(({ code }) => code)).toEqual(
    expect.arrayContaining([
      'schema',
      'line-budget',
      'duplicate-id',
      'unknown-link',
      'supersede-cycle',
      'superseded-status',
      'conflicting-rules',
      'near-duplicate-rule',
    ]),
  );
  expect(process.exitCode).toBe(1);
  process.exitCode = undefined;
  const store = new SQLiteStore(path.join(root, '.dg/graph.db'));
  const project = (
    JSON.parse(readFileSync(path.join(root, '.dg/config.json'), 'utf8')) as {
      project: string;
    }
  ).project;
  const edges = await store.listEdges(project);
  store.close();
  expect(edges).toEqual(
    expect.arrayContaining([
      { src: 'ADR-0001', dst: 'ADR-0002', kind: 'conflicts_with' },
      { src: 'ADR-0002', dst: 'ADR-0001', kind: 'conflicts_with' },
    ]),
  );
  log.mockClear();

  await invoke(
    'graph',
    '--format',
    'mermaid',
    '--root',
    'ADR-0001',
    '--depth',
    '1',
  );
  expect(log.mock.calls[0][0]).toContain('flowchart TD');
  expect(log.mock.calls[0][0]).toContain('supersedes');
  log.mockClear();
  await invoke('graph', '--format', 'dot');
  expect(log.mock.calls[0][0]).toContain('digraph decision_graph');
});

it('keeps unrelated graph edges when importing a single record', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-source.md',
    hybridRecord(
      'ADR-0001',
      ['src/**/*.tsx'],
      'MUST',
      'Use image components.',
      ['ADR-0002'],
    ),
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0002-target.md',
    hybridRecord('ADR-0002', ['src/**/*.tsx'], 'MUST', 'Use typed props.'),
  );
  process.chdir(root);
  await invoke('init', '--yes');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  writeRecord(
    root,
    'incoming/ADR-0003-unrelated.md',
    hybridRecord('ADR-0003', ['src/**/*.tsx'], 'MUST', 'Keep records indexed.'),
  );
  await invoke('import', 'incoming/ADR-0003-unrelated.md');
  log.mockClear();
  await invoke('related', 'ADR-0001', '--json');

  expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject([
    { id: 'ADR-0002' },
  ]);
});

it('assigns distinct IDs when converting multiple records in one import', async () => {
  const root = createTempProject();
  process.chdir(root);
  await invoke('init', '--yes');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  mkdirSync(path.join(root, 'incoming'), { recursive: true });
  for (const [number, title] of [
    ['0003', 'First imported decision'],
    ['0004', 'Second imported decision'],
  ]) {
    writeRecord(
      root,
      `incoming/${number}-decision.md`,
      `# ${number.slice(1)}. ${title}\n\n## Status\n\nAccepted\n\n## Context\n\nExisting context.\n\n## Decision\n\nKeep the source file.\n`,
    );
  }

  await invoke('import', 'incoming', '--format', 'nygard', '--convert');
  await invoke('list', '--status', 'proposed', '--json');

  const proposed = JSON.parse(log.mock.calls[1][0] as string) as {
    id: string;
  }[];
  expect(proposed.map(({ id }) => id)).toEqual(['ADR-0005', 'ADR-0006']);
});

it('rejects generated instruction paths outside the project', async () => {
  const root = createTempProject();
  process.chdir(root);
  await invoke('init', '--yes');
  const outside = path.join(
    path.dirname(root),
    `${path.basename(root)}-outside.md`,
  );
  writeFileSync(outside, 'Do not overwrite.');
  const configFile = path.join(root, '.dg/config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as {
    agentsMd: string;
  };
  config.agentsMd = `../${path.basename(outside)}`;
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

  await expect(invoke('sync')).rejects.toThrow(
    'agentsMd must resolve within the project root',
  );
  expect(readFileSync(outside, 'utf8')).toBe('Do not overwrite.');
  unlinkSync(outside);
});

it('rejects managed instruction paths through symlinks outside the project', async () => {
  const root = createTempProject();
  const outside = createTempProject();
  const outsideFile = path.join(outside, 'AGENTS.md');
  writeFileSync(outsideFile, 'Do not overwrite.');
  process.chdir(root);
  await invoke('init', '--yes');
  symlinkSync(
    outside,
    path.join(root, 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const configFile = path.join(root, '.dg/config.json');
  const config = JSON.parse(readFileSync(configFile, 'utf8')) as {
    agentsMd: string;
  };
  config.agentsMd = 'linked/AGENTS.md';
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

  await expect(invoke('compile')).rejects.toThrow(
    'agentsMd must resolve within the project root',
  );
  expect(readFileSync(outsideFile, 'utf8')).toBe('Do not overwrite.');
});

it('orders matching context by specificity using normalized file paths', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-general.md',
    hybridRecord('ADR-0001', ['**/*.tsx'], 'MUST', 'Use general guidance.'),
  );
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0002-specific.md',
    hybridRecord(
      'ADR-0002',
      ['src/card.tsx'],
      'MUST',
      'Use specific guidance.',
    ),
  );
  process.chdir(root);
  await invoke('init', '--yes');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await invoke('context', path.join('src', 'card.tsx'), '--json');

  const rules = JSON.parse(log.mock.calls[0][0] as string) as {
    recordId: string;
  }[];
  expect(rules.map(({ recordId }) => recordId)).toEqual([
    'ADR-0002',
    'ADR-0001',
  ]);
});

it('supports draft creation, import conversion, and JSON query commands', async () => {
  const root = createTempProject();
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-images.md',
    hybridRecord('ADR-0001', ['**/*.tsx'], 'MUST', 'Use image components.'),
  );
  process.chdir(root);
  await invoke('init', '--yes');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await invoke(
    'new',
    'Prefer typed components',
    '--applies-to',
    'src/**/*.tsx',
    '--tags',
    'typescript',
  );
  expect(log.mock.calls[0][0]).toContain('ADR-0002-prefer-typed-components.md');
  log.mockClear();

  mkdirSync(path.join(root, 'incoming'), { recursive: true });
  writeRecord(
    root,
    'incoming/0003-existing.md',
    '# 3. Existing decision\n\n## Status\n\nAccepted\n\n## Context\n\nExisting context.\n\n## Decision\n\nKeep the source file.\n',
  );
  await invoke(
    'import',
    'incoming/0003-existing.md',
    '--format',
    'nygard',
    '--convert',
  );
  expect(log.mock.calls[0][0]).toBe('Indexed 2 record(s); 1 changed.');
  log.mockClear();

  await invoke(
    'import',
    'incoming/0003-existing.md',
    '--format',
    'nygard',
    '--convert',
  );
  expect(log.mock.calls[0][0]).toBe('Indexed 2 record(s); 0 changed.');
  log.mockClear();

  await invoke('list', '--status', 'proposed', '--json');
  const listed = JSON.parse(log.mock.calls[0][0] as string) as { id: string }[];
  expect(listed.map(({ id }) => id)).toEqual(['ADR-0002', 'ADR-0004']);
  log.mockClear();

  await invoke('related', 'ADR-0004', '--kind', 'relates_to', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject([
    { id: 'ADR-0003' },
  ]);
  log.mockClear();

  await invoke('get', 'ADR-0001', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject([
    {
      id: 'ADR-0001',
      title: 'Use a decision',
    },
  ]);
  log.mockClear();

  await invoke('search', 'image', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toHaveLength(1);
});

it('adds, lists, promotes, and discards SDRs with lifecycle edges', async () => {
  const root = createTempProject();
  process.chdir(root);
  await invoke('init', '--yes');
  writeRecord(
    root,
    'docs/decisions/adr/ADR-0001-existing.md',
    hybridRecord(
      'ADR-0001',
      ['**/*.ts'],
      'MUST',
      'Keep the existing decision.',
    ),
  );
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await invoke(
    'sdr',
    'add',
    'Use SQLite',
    '--decision',
    'Use SQLite for local storage.',
    '--why',
    'It avoids a separate service.',
    '--alt',
    'Use Postgres',
    'Keep files only',
    '--applies-to',
    'src/**/*.ts',
    '--agent',
    'copilot-cli',
    '--session',
    'session-1',
  );
  const sdrPath = log.mock.calls[0][0] as string;
  expect(sdrPath).toMatch(/SDR-\d{8}-001-use-sqlite\.md$/);
  const sdrFile = path.join(root, sdrPath.replace(/^Created /, ''));
  const sdrContent = readFileSync(sdrFile, 'utf8');
  expect(sdrContent).toContain('Use SQLite for local storage.');
  expect(sdrContent).toContain('- Use Postgres\n- Keep files only');
  log.mockClear();

  await invoke('sdr', 'list', '--json');
  const listed = JSON.parse(log.mock.calls[0][0] as string) as {
    id: string;
    status: string;
  }[];
  expect(listed).toMatchObject([{ status: 'open' }]);
  const sdrId = listed[0].id;
  log.mockClear();

  await invoke('sdr', 'promote', sdrId);
  expect(log.mock.calls[0][0]).toBe(`Promoted ${sdrId} to ADR-0002`);
  const promotedSdr = readFileSync(sdrFile, 'utf8');
  expect(promotedSdr).toContain('status: promoted');
  expect(promotedSdr).toContain('promoted_to: ADR-0002');
  const adrPath = path.join(root, 'docs/decisions/adr/ADR-0002-use-sqlite.md');
  const adrContent = readFileSync(adrPath, 'utf8');
  expect(adrContent).toContain('derived_from:\n  - SDR-');
  expect(adrContent).toContain('It avoids a separate service.');
  expect(adrContent).toContain('Use SQLite for local storage.');
  log.mockClear();

  await invoke('related', sdrId, '--kind', 'promoted_to', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject([
    { id: 'ADR-0002' },
  ]);
  log.mockClear();
  await invoke('related', 'ADR-0002', '--kind', 'derived_from', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject([
    { id: sdrId },
  ]);
  log.mockClear();
  await invoke('sdr', 'promote', sdrId);
  expect(log.mock.calls[0][0]).toBe(`Promoted ${sdrId} to ADR-0002`);
  log.mockClear();

  await invoke(
    'sdr',
    'add',
    'Discard this choice',
    '--decision',
    'Try the other option.',
    '--why',
    'The first option is no longer relevant.',
  );
  const secondId = /SDR-\d{8}-\d{3}/.exec(log.mock.calls[0][0] as string)?.[0];
  expect(secondId).toBeDefined();
  log.mockClear();
  await invoke(
    'sdr',
    'discard',
    secondId!,
    '--reason',
    'Requirements changed.',
  );
  const secondPath = (log.mock.calls[0][0] as string).replace(
    /^Discarded /,
    '',
  );
  expect(secondPath).toBe(secondId);
  const discardedFile = readFileSync(
    path.join(root, 'docs/decisions/sdr', `${secondId}-discard-this-choice.md`),
    'utf8',
  );
  expect(discardedFile).toContain('status: discarded');
  expect(discardedFile).toContain('## Discard Reason\n\nRequirements changed.');
  log.mockClear();

  await invoke('sdr', 'list', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual([]);
});

it('resumes promotion when indexing the SDR lifecycle update fails', async () => {
  const root = createTempProject();
  process.chdir(root);
  await invoke('init', '--yes');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await invoke(
    'sdr',
    'add',
    'Use SQLite',
    '--decision',
    'Use SQLite for local storage.',
    '--why',
    'It avoids a separate service.',
  );
  const sdrId = /SDR-\d{8}-\d{3}/.exec(log.mock.calls[0][0] as string)?.[0];
  expect(sdrId).toBeDefined();
  log.mockClear();

  const upsertNode = SQLiteStore.prototype.upsertNode;
  const upsertSpy = vi
    .spyOn(SQLiteStore.prototype, 'upsertNode')
    .mockImplementation(async function (this: SQLiteStore, projectId, record) {
      if (record.type === 'sdr' && record.status === 'promoted') {
        throw new Error('simulated SDR index failure');
      }
      return upsertNode.call(this, projectId, record);
    });

  await expect(invoke('sdr', 'promote', sdrId!)).rejects.toThrow(
    'simulated SDR index failure',
  );
  upsertSpy.mockRestore();
  expect(
    readFileSync(
      path.join(root, `docs/decisions/sdr/${sdrId}-use-sqlite.md`),
      'utf8',
    ),
  ).toContain('status: promoted');

  await invoke('sdr', 'promote', sdrId!);
  expect(log.mock.calls[0][0]).toBe(`Promoted ${sdrId} to ADR-0001`);
  expect(
    readFileSync(
      path.join(root, 'docs/decisions/adr/ADR-0001-use-sqlite.md'),
      'utf8',
    ),
  ).toContain(`derived_from:\n  - ${sdrId}`);
  expect(
    readdirSync(path.join(root, 'docs/decisions/adr')).filter((file) =>
      file.startsWith('ADR-'),
    ),
  ).toHaveLength(1);
});

function createTempProject(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'decision-graph-'));
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

async function invoke(...args: string[]): Promise<void> {
  await createProgram()
    .exitOverride()
    .parseAsync(['node', 'dg', ...args]);
}
