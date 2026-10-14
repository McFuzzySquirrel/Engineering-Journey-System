import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dump } from 'js-yaml';
import { parseRecord, type Config } from './index.js';
import { collectMarkdownFiles } from './markdown-files.js';
import type { Store } from '../store/store.js';

export interface SdrInput {
  decision: string;
  why: string;
  alt?: string[];
  appliesTo?: string[];
  agent?: string;
  session?: string;
}

export async function createSdr(
  root: string,
  config: Config,
  store: Store,
  title: string,
  options: SdrInput,
): Promise<{ id: string; path: string }> {
  const date = new Date().toISOString().slice(0, 10);
  const dateId = date.replaceAll('-', '');
  const indexed = await store.list(config.project, { type: 'sdr' });
  const fileRecords = collectMarkdownFiles(
    path.resolve(root, config.sdrDir),
  ).map((file) =>
    parseRecord(
      readFileSync(file, 'utf8'),
      path.relative(root, file).split(path.sep).join('/'),
      'auto',
    ),
  );
  const next = nextSdrNumber(
    [...indexed, ...fileRecords].map((record) => record.id),
    dateId,
  );
  const id = `SDR-${dateId}-${String(next).padStart(3, '0')}`;
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'decision';
  const relativeFile = path.join(config.sdrDir, `${id}-${slug}.md`);
  const absoluteFile = path.join(root, relativeFile);
  const metadata = {
    id,
    type: 'sdr',
    title,
    status: 'open',
    applies_to: options.appliesTo ?? [],
    tags: [],
    date,
    promoted_to: null,
    ...(options.agent ? { agent: options.agent } : {}),
    ...(options.session ? { session: options.session } : {}),
  };
  const alternatives = options.alt?.length
    ? options.alt.map((alternative) => `- ${alternative}`).join('\n')
    : 'None.';
  const content = `---\n${dump(metadata, { noRefs: true, lineWidth: -1 }).trimEnd()}\n---\n\n# ${id}: ${title}\n\n## Decision\n\n${options.decision}\n\n## Why\n\n${options.why}\n\n## Alternatives considered\n\n${alternatives}\n`;
  mkdirSync(path.dirname(absoluteFile), { recursive: true });
  writeFileSync(absoluteFile, content, { flag: 'wx' });

  await store.upsertProject({
    id: config.project,
    name: path.basename(root),
    type: config.projectType,
  });
  const record = parseRecord(
    content,
    relativeFile.split(path.sep).join('/'),
    'hybrid',
  );
  await store.upsertNode(config.project, record);
  return { id, path: absoluteFile };
}

function nextSdrNumber(ids: string[], dateId: string): number {
  const matching = ids
    .map((id) => new RegExp(`^SDR-${dateId}-(\\d+)$`, 'i').exec(id))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));
  return Math.max(0, ...matching) + 1;
}
