import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createProgram } from '../src/cli/program.js';

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
  expect(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).toContain(
    '<!-- dg:begin -->',
  );
  expect(readFileSync(path.join(root, 'AGENTS.md'), 'utf8')).not.toContain(
    'dg sdr add',
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
  expect(log.mock.calls[0][0]).toBe(`Promoted ${sdrId} to ADR-0001`);
  const promotedSdr = readFileSync(sdrFile, 'utf8');
  expect(promotedSdr).toContain('status: promoted');
  expect(promotedSdr).toContain('promoted_to: ADR-0001');
  const adrPath = path.join(root, 'docs/decisions/adr/ADR-0001-use-sqlite.md');
  const adrContent = readFileSync(adrPath, 'utf8');
  expect(adrContent).toContain('derived_from:\n  - SDR-');
  expect(adrContent).toContain('It avoids a separate service.');
  expect(adrContent).toContain('Use SQLite for local storage.');
  log.mockClear();

  await invoke('related', sdrId, '--kind', 'promoted_to', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject([
    { id: 'ADR-0001' },
  ]);
  log.mockClear();
  await invoke('related', 'ADR-0001', '--kind', 'derived_from', '--json');
  expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject([
    { id: sdrId },
  ]);
  log.mockClear();
  await expect(invoke('sdr', 'promote', sdrId)).rejects.toThrow(
    `Cannot promote SDR ${sdrId}: status is promoted`,
  );

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
