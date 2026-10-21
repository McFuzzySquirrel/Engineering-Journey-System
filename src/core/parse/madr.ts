import { createHash } from 'node:crypto';
import {
  getDecisionOutcome,
  getSections,
  getSectionWithSubsections,
  listItems,
  parseInlineMetadata,
  parseSource,
  RecordParseError,
  validateRecord,
} from './common.js';

export function parseMadr(source: string, filePath: string) {
  const { data, content } = parseSource(source, filePath);
  const sections = getSections(content);
  const inline = parseInlineMetadata(content);
  const title = data.title ?? findTitle(content);
  const id = data.id ?? inferId(filePath, content);
  if (!title) throw missingTitle(filePath);
  if (!id) throw missingId(filePath);
  const status = normalizeStatus(
    data.status ?? sections.get('status') ?? inline.status,
  );

  return validateRecord(
    {
      id,
      type: 'adr',
      title,
      status,
      appliesTo: data.applies_to ?? [],
      tags: data.tags ?? inline.tags ?? [],
      date: normalizeDate(data.date ?? inline.date),
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
      decisionOutcome: getDecisionOutcome(sections),
      consequences: listItems(sections.get('consequences')),
      positiveConsequences: listItems(sections.get('positive consequences')),
      negativeConsequences: listItems(sections.get('negative consequences')),
      prosAndCons: listItems(
        getSectionWithSubsections(content, 'pros and cons of the options'),
      ),
      links: listItems(sections.get('links')),
      body: content.trim(),
    },
    filePath,
  );
}

const ADR_HEADING = /^#\s+ADR[-_ ]?(\d{1,4})\b/im;
const NUMBERED_FILE = /^(?:ADR[-_ ]?)?(\d{1,4})(?:[-_.]|$)/i;

export function inferId(filePath: string, content: string): string | undefined {
  const fileName = filePath.split(/[/\\]/).pop() ?? '';
  const numericName = fileName.match(NUMBERED_FILE)?.[1];
  if (numericName) return `ADR-${numericName}`;
  const heading = content.match(ADR_HEADING)?.[1];
  if (heading) return `ADR-${heading}`;
  return undefined;
}

export function findTitle(content: string): string | undefined {
  return content
    .match(/^#\s+(.+?)\s*#*\s*$/m)?.[1]
    ?.replace(/^ADR[-_ ]?\d{1,4}\s*:?\s*/i, '')
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

export function normalizeDate(
  date: string | Date | undefined,
): string | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString().slice(0, 10) : date;
}

export function missingTitle(filePath: string): RecordParseError {
  return new RecordParseError(
    filePath,
    'could not determine ADR title (expected a title in frontmatter or a "# Title" heading)',
  );
}

export function missingId(filePath: string): RecordParseError {
  return new RecordParseError(
    filePath,
    'could not determine ADR id (expected an "id:" frontmatter field, an "ADR-0001" heading, or a numbered filename such as "0001-title.md")',
  );
}
