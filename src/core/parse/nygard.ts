import { createHash } from 'node:crypto';
import {
  getDecisionOutcome,
  getSections,
  listItems,
  parseInlineMetadata,
  parseSource,
  validateRecord,
} from './common.js';
import {
  findTitle,
  inferId,
  missingId,
  missingTitle,
  normalizeDate,
  normalizeStatus,
} from './madr.js';

export function parseNygard(source: string, filePath: string) {
  const { data, content } = parseSource(source, filePath);
  const sections = getSections(content);
  const inline = parseInlineMetadata(content);
  const title = data.title ?? findTitle(content);
  const id = data.id ?? inferId(filePath, content);
  if (!title) throw missingTitle(filePath);
  if (!id) throw missingId(filePath);

  const statusText = sections.get('status') ?? inline.status ?? '';
  const supersededBy = statusText.match(
    /superseded by\s+(?:\[([^\]]+)\]|(ADR[-_ ]?\d{1,4}))/i,
  );
  const successor = supersededBy?.[1] ?? supersededBy?.[2];
  const relatesTo = [...(data.relates_to ?? [])];
  const successorId = successor ? normalizeAdrReference(successor) : undefined;
  if (successorId && !relatesTo.includes(successorId)) {
    relatesTo.push(successorId);
  }

  return validateRecord(
    {
      id,
      type: 'adr',
      title,
      status: normalizeStatus(statusText),
      appliesTo: data.applies_to ?? [],
      tags: data.tags ?? inline.tags ?? [],
      date: normalizeDate(data.date ?? inline.date),
      path: filePath,
      contentHash: createHash('sha256').update(source).digest('hex'),
      supersedes: data.supersedes ?? [],
      relatesTo,
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
      decisionOutcome: getDecisionOutcome(sections),
      consequences: listItems(sections.get('consequences')),
      positiveConsequences: listItems(sections.get('consequences')),
      negativeConsequences: [],
      prosAndCons: [],
      links: listItems(sections.get('links')),
      body: content.trim(),
    },
    filePath,
  );
}

function normalizeAdrReference(value: string): string {
  const match = value.match(/^(?:ADR[-_ ]?)?(\d{1,4})(?:[-_.].*)?$/i);
  return match ? `ADR-${match[1]}` : value;
}
