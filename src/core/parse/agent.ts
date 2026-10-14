import { createHash } from 'node:crypto';
import { FrontmatterSchema } from '../schema.js';
import {
  getFrontmatterRules,
  getSections,
  parseRules,
  parseSource,
  parseVerification,
  RecordParseError,
  validateRecord,
} from './common.js';
import { findTitle, inferId, normalizeStatus } from './madr.js';
import { assignRuleIds } from './hybrid.js';

export function parseAgent(source: string, filePath: string) {
  const parsed = parseSource(source, filePath);
  const sections = getSections(parsed.content);
  const metadata = FrontmatterSchema.parse(parsed.data);
  const title = metadata.title ?? findTitle(parsed.content);
  const id = metadata.id ?? inferId(filePath, parsed.content);
  if (!title || !id) {
    throw new RecordParseError(filePath, 'could not determine ADR title or id');
  }

  const rules = assignRuleIds(metadata.id ?? id, [
    ...getFrontmatterRules(metadata),
    ...parseRules(sections.get('agent rules') ?? sections.get('rules')),
  ]);
  return validateRecord(
    {
      id,
      type: metadata.type ?? 'adr',
      title,
      status: normalizeStatus(metadata.status),
      appliesTo: metadata.applies_to ?? [],
      tags: metadata.tags ?? [],
      date:
        metadata.date instanceof Date
          ? metadata.date.toISOString().slice(0, 10)
          : metadata.date,
      path: filePath,
      contentHash: createHash('sha256').update(source).digest('hex'),
      supersedes: metadata.supersedes ?? [],
      relatesTo: metadata.relates_to ?? [],
      derivedFrom: metadata.derived_from ?? [],
      deciders: metadata.deciders,
      rules,
      verify: [
        ...(metadata.verify ?? []),
        ...parseVerification(sections.get('verify')),
      ],
      context:
        sections.get('context and problem statement') ??
        sections.get('context') ??
        '',
      decisionDrivers: [],
      consideredOptions: [],
      decisionOutcome: sections.get('decision outcome') ?? '',
      consequences: [],
      positiveConsequences: [],
      negativeConsequences: [],
      prosAndCons: [],
      links: [],
      body: parsed.content.trim(),
    },
    filePath,
  );
}
