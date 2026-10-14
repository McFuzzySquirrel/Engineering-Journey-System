import matter from 'gray-matter';
import { z } from 'zod';
import {
  FrontmatterSchema,
  RecordSchema,
  type DecisionRecord,
  type Frontmatter,
  type Rule,
  type Verification,
} from '../schema.js';

export class RecordParseError extends Error {
  constructor(
    readonly filePath: string,
    message: string,
  ) {
    super(`${filePath}: ${message}`);
    this.name = 'RecordParseError';
  }
}

export interface ParsedSource {
  data: Frontmatter;
  content: string;
}

export function parseSource(source: string, filePath: string): ParsedSource {
  try {
    const parsed = matter(source);
    const data = FrontmatterSchema.safeParse(parsed.data);
    if (!data.success) {
      throw validationError(filePath, data.error);
    }
    return { data: data.data, content: parsed.content };
  } catch (error) {
    if (error instanceof RecordParseError) throw error;
    throw new RecordParseError(
      filePath,
      `invalid frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function validationError(
  filePath: string,
  error: z.ZodError,
): RecordParseError {
  const details = error.issues
    .map(
      (issue) => `${issue.path.join('.') || 'frontmatter'}: ${issue.message}`,
    )
    .join('; ');
  return new RecordParseError(filePath, `invalid record (${details})`);
}

export function validateRecord(
  record: unknown,
  filePath: string,
): DecisionRecord {
  const parsed = RecordSchema.safeParse(record);
  if (!parsed.success) throw validationError(filePath, parsed.error);
  return parsed.data;
}

export function getSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const headings = [...content.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)];
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? content.length;
    sections.set(
      normalizeHeading(heading[1]),
      content.slice(start, end).trim(),
    );
  }
  return sections;
}

export function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function listItems(section: string | undefined): string[] {
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

const modalityPattern =
  /[-*+]\s+(?:\*\*)?(MUST NOT|SHOULD NOT|MUST|SHOULD|MAY)(?:\*\*)?:\s*(.+)/i;

export function parseRules(section: string | undefined): Rule[] {
  if (!section) return [];
  return section.split(/\r?\n/).flatMap((line) => {
    const match = line.match(modalityPattern);
    return match
      ? [
          {
            id: '',
            modality: match[1].toUpperCase() as Rule['modality'],
            text: cleanInline(match[2]),
          },
        ]
      : [];
  });
}

export function parseVerification(section: string | undefined): Verification[] {
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const checks: Verification[] = [];
  let check = '';
  for (const line of lines) {
    const checkMatch = line.match(/^\s*[-*+]\s+\*\*Check:\*\*\s*(.+)$/i);
    const expectedMatch = line.match(/^\s*[-*+]\s+\*\*Expected:\*\*\s*(.+)$/i);
    if (checkMatch) {
      check = cleanInline(checkMatch[1]);
    } else if (expectedMatch && check) {
      checks.push({ check, expected: cleanInline(expectedMatch[1]) });
      check = '';
    }
  }
  return checks;
}

export function cleanInline(value: string): string {
  return value.replace(/\*\*/g, '').trim();
}

export function getFrontmatterRules(data: Frontmatter): Rule[] {
  return (data.rules ?? []).flatMap((rule) => {
    if (typeof rule === 'string') {
      const match = rule.match(
        /^(MUST NOT|SHOULD NOT|MUST|SHOULD|MAY):?\s+(.+)$/i,
      );
      return match
        ? [
            {
              id: '',
              modality: match[1].toUpperCase() as Rule['modality'],
              text: match[2],
            },
          ]
        : [];
    }
    return [{ ...rule, id: '' }];
  });
}
