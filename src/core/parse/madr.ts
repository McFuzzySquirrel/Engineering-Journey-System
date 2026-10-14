import { createHash } from 'node:crypto';
import {
  getSections,
  listItems,
  parseSource,
  RecordParseError,
  validateRecord,
} from './common.js';

export function parseMadr(source: string, filePath: string) {
  const { data, content } = parseSource(source, filePath);
  const sections = getSections(content);
  const title = data.title ?? findTitle(content);
  const id = data.id ?? inferId(filePath, content);
  if (!title || !id) {
    throw new RecordParseError(filePath, 'could not determine ADR title or id');
  }
  const status = normalizeStatus(data.status ?? sections.get('status'));

  return validateRecord(
    {
      id,
      type: 'adr',
      title,
      status,
      appliesTo: data.applies_to ?? [],
      tags: data.tags ?? [],
      date: normalizeDate(data.date),
      path: filePath,
      contentHash: createHash('sha256').update(source).digest('hex'),
      supersedes: data.supersedes ?? [],
      relatesTo: data.relates_to ?? [],
      derivedFrom: data.derived_from ?? [],
      deciders: data.deciders,
      rules: [],
      verify: [],
      context:
        sections.get('context and problem statement') ??
        sections.get('context') ??
        '',
      decisionDrivers: listItems(sections.get('decision drivers')),
      consideredOptions: listItems(sections.get('considered options')),
      decisionOutcome:
        sections.get('decision outcome') ?? sections.get('decision') ?? '',
      positiveConsequences: listItems(sections.get('positive consequences')),
      negativeConsequences: listItems(sections.get('negative consequences')),
      prosAndCons: listItems(sections.get('pros and cons of the options')),
      links: listItems(sections.get('links')),
      body: content.trim(),
    },
    filePath,
  );
}

export function inferId(filePath: string, content: string): string | undefined {
  const numericName = filePath.match(/(?:^|[/\\])(?:ADR-)?(\d{4})[-_.]/i)?.[1];
  if (numericName) return `ADR-${numericName}`;
  return content.match(/^#\s+(ADR-\d{4})\b/im)?.[1];
}

export function findTitle(content: string): string | undefined {
  return content
    .match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]
    ?.replace(/^ADR-\d{4}:\s*/i, '')
    .trim();
}

export function normalizeStatus(status: string | undefined): string {
  const normalized = status?.toLowerCase() ?? '';
  if (normalized.includes('supersed')) return 'superseded';
  if (normalized.includes('deprecat') || normalized.includes('reject')) {
    return 'deprecated';
  }
  if (normalized.includes('propos') || normalized.includes('draft')) {
    return 'proposed';
  }
  return 'accepted';
}

function normalizeDate(date: string | Date | undefined): string | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString().slice(0, 10) : date;
}
