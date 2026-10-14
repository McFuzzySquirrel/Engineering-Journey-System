import { createHash } from 'node:crypto';
import {
  getSections,
  listItems,
  parseSource,
  RecordParseError,
  validateRecord,
} from './common.js';
import { findTitle, inferId, normalizeStatus } from './madr.js';

export function parseNygard(source: string, filePath: string) {
  const { data, content } = parseSource(source, filePath);
  const sections = getSections(content);
  const title = data.title ?? findTitle(content);
  const id = data.id ?? inferId(filePath, content);
  if (!title || !id) {
    throw new RecordParseError(filePath, 'could not determine ADR title or id');
  }

  const statusText = sections.get('status') ?? '';
  const supersededBy = statusText.match(/superseded by\s+(?:\[([^\]]+)\]|(ADR-\d{4}))/i);
  const supersedes = data.supersedes ?? (
    supersededBy ? [supersededBy[1] ?? supersededBy[2]] : []
  );

  return validateRecord(
    {
      id,
      type: 'adr',
      title,
      status: normalizeStatus(statusText),
      appliesTo: data.applies_to ?? [],
      tags: data.tags ?? [],
      date: data.date instanceof Date
        ? data.date.toISOString().slice(0, 10)
        : data.date,
      path: filePath,
      contentHash: createHash('sha256').update(source).digest('hex'),
      supersedes,
      relatesTo: data.relates_to ?? [],
      derivedFrom: data.derived_from ?? [],
      deciders: data.deciders,
      rules: [],
      verify: [],
      context:
        sections.get('context') ??
        sections.get('context and problem statement') ??
        '',
      decisionDrivers: [],
      consideredOptions: [],
      decisionOutcome: sections.get('decision') ?? '',
      positiveConsequences: [],
      negativeConsequences: [],
      prosAndCons: [],
      links: listItems(sections.get('links')),
      body: content.trim(),
    },
    filePath,
  );
}
