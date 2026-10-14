import { z } from 'zod';

export const RuleModalitySchema = z.enum([
  'MUST',
  'MUST NOT',
  'SHOULD',
  'SHOULD NOT',
  'MAY',
]);

export const AdrStatusSchema = z.enum([
  'proposed',
  'accepted',
  'superseded',
  'deprecated',
]);

export const SdrStatusSchema = z.enum(['open', 'promoted', 'discarded']);

export const RuleSchema = z.object({
  id: z.string().min(1),
  modality: RuleModalitySchema,
  text: z.string().min(1),
});

export const VerifySchema = z.object({
  check: z.string().min(1),
  expected: z.string().min(1),
});

const FrontmatterRuleSchema = z.object({
  id: z.string().optional(),
  modality: RuleModalitySchema,
  text: z.string().min(1),
});

const sharedRecordFields = {
  id: z.string().min(1),
  title: z.string().min(1),
  appliesTo: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  date: z.string().optional(),
  path: z.string(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
};

export const AdrRecordSchema = z.object({
  ...sharedRecordFields,
  type: z.literal('adr'),
  status: AdrStatusSchema,
  supersedes: z.array(z.string()).default([]),
  relatesTo: z.array(z.string()).default([]),
  derivedFrom: z.array(z.string()).default([]),
  deciders: z.array(z.string()).optional(),
  rules: z.array(RuleSchema).default([]),
  verify: z.array(VerifySchema).default([]),
  context: z.string().default(''),
  decisionDrivers: z.array(z.string()).default([]),
  consideredOptions: z.array(z.string()).default([]),
  decisionOutcome: z.string().default(''),
  consequences: z.array(z.string()).default([]),
  positiveConsequences: z.array(z.string()).default([]),
  negativeConsequences: z.array(z.string()).default([]),
  prosAndCons: z.array(z.string()).default([]),
  links: z.array(z.string()).default([]),
  body: z.string(),
});

export const SdrRecordSchema = z.object({
  ...sharedRecordFields,
  type: z.literal('sdr'),
  status: SdrStatusSchema,
  agent: z.string().optional(),
  session: z.string().optional(),
  promotedTo: z.string().nullable().optional(),
  decision: z.string().default(''),
  why: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  body: z.string(),
});

export const RecordSchema = z.discriminatedUnion('type', [
  AdrRecordSchema,
  SdrRecordSchema,
]);

export const ConfigSchema = z.object({
  project: z.string().min(1),
  projectType: z.string().min(1),
  adrDir: z.string().min(1),
  sdrDir: z.string().min(1),
  agentsMd: z.string().min(1),
  tokenBudget: z.number().int().positive(),
  remote: z.string().url().nullable(),
});

export const FrontmatterSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(['adr', 'sdr']).optional(),
  title: z.string().min(1).optional(),
  status: z.string().optional(),
  applies_to: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  supersedes: z.array(z.string()).optional(),
  relates_to: z.array(z.string()).optional(),
  derived_from: z.array(z.string()).optional(),
  date: z.union([z.string(), z.date()]).optional(),
  deciders: z.array(z.string()).optional(),
  agent: z.string().optional(),
  session: z.string().optional(),
  promoted_to: z.string().nullable().optional(),
  rules: z.array(z.union([z.string(), FrontmatterRuleSchema])).optional(),
  verify: z.array(VerifySchema).optional(),
});

export type AdrRecord = z.infer<typeof AdrRecordSchema>;
export type SdrRecord = z.infer<typeof SdrRecordSchema>;
export type DecisionRecord = z.infer<typeof RecordSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Verification = z.infer<typeof VerifySchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type Frontmatter = z.infer<typeof FrontmatterSchema>;
