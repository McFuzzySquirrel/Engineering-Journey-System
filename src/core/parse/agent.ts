import { createHash } from 'node:crypto';
import { FrontmatterSchema } from '../schema.js';
import {
  getDecisionOutcome,
  getFrontmatterRules,
  getSections,
  parseInlineMetadata,
  parseRules,
  parseSource,
  parseVerification,
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
import { assignRuleIds } from './hybrid.js';

export function parseAgent(source: string, filePath: string) {
  const parsed = parseSource(source, filePath);
  const sections = getSections(parsed.content);
  const inline = parseInlineMetadata(parsed.content);
  const metadata = FrontmatterSchema.parse(parsed.data);
  const title = metadata.title ?? findTitle(parsed.content);
  const id = metadata.id ?? inferId(filePath, parsed.content);
  if (!title) throw missingTitle(filePath);
  if (!id) throw missingId(filePath);

  const rules = assignRuleIds(metadata.id ?? id, [
    ...getFrontmatterRules(metadata),
    ...parseRules(sections.get('agent rules') ?? sections.get('rules')),
  ]);
  return validateRecord(
    {
      id,
      type: metadata.type ?? 'adr',
      title,
      status: normalizeStatus(
        metadata.status ?? sections.get('status') ?? inline.status,
      ),
      appliesTo: metadata.applies_to ?? [],
      tags: metadata.tags ?? inline.tags ?? [],
      date: normalizeDate(metadata.date ?? inline.date),
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
      decisionOutcome: getDecisionOutcome(sections),
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
