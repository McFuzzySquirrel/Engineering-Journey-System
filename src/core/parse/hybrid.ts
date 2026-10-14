import { createHash } from 'node:crypto';
import { AdrRecordSchema, type Rule } from '../schema.js';
import {
  getFrontmatterRules,
  getSections,
  getSectionWithSubsections,
  listItems,
  parseRules,
  parseSource,
  parseVerification,
  RecordParseError,
  validateRecord,
} from './common.js';

export function parseHybrid(source: string, filePath: string) {
  const { data, content } = parseSource(source, filePath);
  if (!data.id || !data.title || !data.type || !data.status) {
    const missing = ['id', 'title', 'type', 'status'].filter(
      (key) => !data[key as keyof typeof data],
    );
    throw new RecordParseError(
      filePath,
      `missing required frontmatter field(s): ${missing.join(', ')}`,
    );
  }

  const sections = getSections(content);
  const rawRules = [
    ...getFrontmatterRules(data),
    ...parseRules(sections.get('agent rules')),
  ];
  const rules = assignRuleIds(data.id, rawRules);
  const hash = createHash('sha256').update(source).digest('hex');

  if (data.type === 'sdr') {
    const decision = sections.get('decision') ?? '';
    const why = sections.get('why') ?? '';
    return validateRecord(
      {
        id: data.id,
        type: 'sdr',
        title: data.title,
        status: data.status,
        appliesTo: data.applies_to ?? [],
        tags: data.tags ?? [],
        date: normalizeDate(data.date),
        path: filePath,
        contentHash: hash,
        agent: data.agent,
        session: data.session,
        promotedTo: data.promoted_to,
        decision,
        why,
        alternatives: listItems(sections.get('alternatives considered')),
        body: content.trim(),
      },
      filePath,
    );
  }

  const record = {
    id: data.id,
    type: 'adr',
    title: data.title,
    status: data.status,
    appliesTo: data.applies_to ?? [],
    tags: data.tags ?? [],
    date: normalizeDate(data.date),
    path: filePath,
    contentHash: hash,
    supersedes: data.supersedes ?? [],
    relatesTo: data.relates_to ?? [],
    derivedFrom: data.derived_from ?? [],
    deciders: data.deciders,
    rules,
    verify: [
      ...(data.verify ?? []),
      ...parseVerification(sections.get('verify')),
    ],
    context:
      sections.get('context and problem statement') ??
      sections.get('context') ??
      '',
    decisionDrivers: listItems(sections.get('decision drivers')),
    consideredOptions: listItems(sections.get('considered options')),
    decisionOutcome:
      sections.get('decision outcome') ?? sections.get('decision') ?? '',
    consequences: listItems(sections.get('consequences')),
    positiveConsequences: listItems(sections.get('positive consequences')),
    negativeConsequences: listItems(sections.get('negative consequences')),
    prosAndCons: listItems(
      getSectionWithSubsections(content, 'pros and cons of the options'),
    ),
    links: listItems(sections.get('links')),
    body: content.trim(),
  };
  return AdrRecordSchema.parse(validateRecord(record, filePath));
}

export function assignRuleIds<T extends Pick<Rule, 'id' | 'modality' | 'text'>>(
  recordId: string,
  rules: T[],
): Rule[] {
  return rules.map((rule, index) => ({
    id: `${recordId}#${index + 1}`,
    modality: rule.modality,
    text: rule.text,
  }));
}

function normalizeDate(date: string | Date | undefined): string | undefined {
  if (!date) return undefined;
  return date instanceof Date ? date.toISOString().slice(0, 10) : date;
}
