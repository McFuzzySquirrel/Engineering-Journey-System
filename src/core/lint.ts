import picomatch from 'picomatch';
import type { DecisionRecord } from './schema.js';

export interface LintDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  id?: string;
  path?: string;
  message: string;
}

export interface RuleConflict {
  first: string;
  second: string;
}

const NEAR_DUPLICATE_THRESHOLD = 0.8;

export function lintRecords(records: DecisionRecord[]): {
  diagnostics: LintDiagnostic[];
  conflicts: RuleConflict[];
} {
  const diagnostics: LintDiagnostic[] = [];
  const recordsById = new Map<string, DecisionRecord>();

  for (const record of records) {
    const duplicate = recordsById.get(record.id);
    if (duplicate) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-id',
        id: record.id,
        path: record.path,
        message: `Record ID ${record.id} is also used by ${duplicate.path}.`,
      });
    } else {
      recordsById.set(record.id, record);
    }
  }

  const supersedes = new Map<string, string[]>();
  for (const record of recordsById.values()) {
    const links =
      record.type === 'adr'
        ? [
            ...record.supersedes.map((id) => ['supersedes', id] as const),
            ...record.relatesTo.map((id) => ['relates_to', id] as const),
            ...record.derivedFrom.map((id) => ['derived_from', id] as const),
          ]
        : record.promotedTo
          ? ([['promoted_to', record.promotedTo]] as const)
          : [];

    for (const [kind, target] of links) {
      if (!recordsById.has(target)) {
        diagnostics.push({
          severity: 'error',
          code: 'unknown-link',
          id: record.id,
          path: record.path,
          message: `${kind} references unknown record ${target}.`,
        });
      }
    }
    if (record.type === 'adr') {
      supersedes.set(record.id, record.supersedes);
    }
  }

  const supersededIds = new Set(
    [...supersedes.values()].flatMap((targets) => targets),
  );
  for (const id of supersededIds) {
    const target = recordsById.get(id);
    if (target?.type === 'adr' && target.status === 'accepted') {
      diagnostics.push({
        severity: 'error',
        code: 'superseded-status',
        id,
        path: target.path,
        message: `Accepted record ${id} is superseded but is not marked superseded.`,
      });
    }
  }

  diagnostics.push(...findSupersedeCycles(supersedes, recordsById));
  const conflicts: RuleConflict[] = [];
  const conflictKeys = new Set<string>();
  const adrRecords = [...recordsById.values()].filter(
    (record): record is Extract<DecisionRecord, { type: 'adr' }> =>
      record.type === 'adr',
  );

  for (let firstIndex = 0; firstIndex < adrRecords.length; firstIndex += 1) {
    const first = adrRecords[firstIndex];
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < adrRecords.length;
      secondIndex += 1
    ) {
      const second = adrRecords[secondIndex];
      const pair = [first.id, second.id].sort();
      for (const firstRule of first.rules) {
        for (const secondRule of second.rules) {
          if (
            oppositeModalities(firstRule.modality, secondRule.modality) &&
            normalizeSubject(firstRule.text) !== '' &&
            normalizeSubject(firstRule.text) ===
              normalizeSubject(secondRule.text) &&
            scopesOverlap(first.appliesTo, second.appliesTo)
          ) {
            const pairKey = pair.join('\0');
            if (!conflictKeys.has(pairKey)) {
              conflicts.push({ first: pair[0], second: pair[1] });
              conflictKeys.add(pairKey);
              diagnostics.push({
                severity: 'warning',
                code: 'conflicting-rules',
                id: `${first.id},${second.id}`,
                path: `${first.path},${second.path}`,
                message: `${firstRule.id} and ${secondRule.id} have opposite requirements for the same subject in overlapping scopes.`,
              });
            }
          }
        }
      }
    }
  }

  const ruleEntries = adrRecords.flatMap((record) =>
    record.rules.map((rule) => ({ record, rule })),
  );
  for (let firstIndex = 0; firstIndex < ruleEntries.length; firstIndex += 1) {
    const first = ruleEntries[firstIndex];
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < ruleEntries.length;
      secondIndex += 1
    ) {
      const second = ruleEntries[secondIndex];
      if (first.record.id === second.record.id) continue;
      const similarity = jaccard(
        normalizedTokens(first.rule.text),
        normalizedTokens(second.rule.text),
      );
      if (similarity >= NEAR_DUPLICATE_THRESHOLD) {
        diagnostics.push({
          severity: 'warning',
          code: 'near-duplicate-rule',
          id: `${first.rule.id},${second.rule.id}`,
          path: `${first.record.path},${second.record.path}`,
          message: `Rules are near duplicates (token Jaccard ${similarity.toFixed(2)}).`,
        });
      }
    }
  }

  return { diagnostics, conflicts };
}

function findSupersedeCycles(
  graph: Map<string, string[]>,
  records: Map<string, DecisionRecord>,
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const reported = new Set<string>();

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const target of graph.get(id) ?? []) {
      if (!graph.has(target)) continue;
      if (visiting.has(target)) {
        const cycle = stack.slice(stack.indexOf(target));
        const key = [...cycle].sort().join('\0');
        if (!reported.has(key)) {
          reported.add(key);
          diagnostics.push({
            severity: 'error',
            code: 'supersede-cycle',
            id,
            path: records.get(id)?.path,
            message: `Supersede cycle: ${[...cycle, target].join(' -> ')}.`,
          });
        }
      } else {
        visit(target);
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of graph.keys()) visit(id);
  return diagnostics;
}

function oppositeModalities(first: string, second: string): boolean {
  return (
    (first === 'MUST' && second === 'MUST NOT') ||
    (first === 'MUST NOT' && second === 'MUST')
  );
}

function normalizeSubject(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function normalizedTokens(text: string): Set<string> {
  return new Set(normalizeSubject(text).split(/\s+/).filter(Boolean));
}

function jaccard(first: Set<string>, second: Set<string>): number {
  const intersection = [...first].filter((token) => second.has(token)).length;
  const union = new Set([...first, ...second]).size;
  return union === 0 ? 0 : intersection / union;
}

function scopesOverlap(first: string[], second: string[]): boolean {
  return first.some((firstPattern) =>
    second.some((secondPattern) =>
      patternsOverlap(firstPattern, secondPattern),
    ),
  );
}

function patternsOverlap(first: string, second: string): boolean {
  const hints = [...literalGlobSegments(first), ...literalGlobSegments(second)];
  const candidates = new Set([
    ...globWitnesses(first, hints),
    ...globWitnesses(second, hints),
  ]);
  if (
    [...candidates].some(
      (file) =>
        picomatch.isMatch(file, first) && picomatch.isMatch(file, second),
    )
  ) {
    return true;
  }
  return mayOverlapByFixedParts(first, second);
}

function globWitnesses(pattern: string, hints: string[]): string[] {
  const candidates = new Set<string>([pattern]);
  const expanded = pattern.replace(
    /\{([^{}]+)\}/g,
    (_match, choices: string) => choices.split(',')[0],
  );
  candidates.add(expanded);
  candidates.add(expanded.replace(/\*\*\//g, ''));
  candidates.add(expanded.replace(/\*\*\//g, 'x/'));
  candidates.add(expanded.replace(/\*\*/g, 'x/y'));
  candidates.add(expanded.replace(/\*/g, 'x'));
  candidates.add(expanded.replace(/\*/g, 'file'));
  candidates.add(expanded.replace(/\*/g, ''));
  for (const hint of hints) {
    if (!hint) continue;
    candidates.add(expanded.replace(/\*\*\//g, `${hint}/`));
    candidates.add(expanded.replace(/\*/g, hint));
    candidates.add(expanded.replace(/\?/g, hint[0]));
  }

  return [...candidates].filter((candidate) => !/[?*{}[\]]/.test(candidate));
}

function literalGlobSegments(pattern: string): string[] {
  return pattern
    .replace(/\{[^{}]*\}/g, '')
    .replace(/[*?[\]]/g, '')
    .split('/')
    .filter(Boolean);
}

function mayOverlapByFixedParts(first: string, second: string): boolean {
  const firstBounds = fixedGlobBounds(first);
  const secondBounds = fixedGlobBounds(second);
  if (!firstBounds || !secondBounds) return true;
  const prefixesCompatible =
    firstBounds.prefix.startsWith(secondBounds.prefix) ||
    secondBounds.prefix.startsWith(firstBounds.prefix);
  const suffixesCompatible =
    firstBounds.suffix.endsWith(secondBounds.suffix) ||
    secondBounds.suffix.endsWith(firstBounds.suffix);
  return prefixesCompatible && suffixesCompatible;
}

function fixedGlobBounds(
  pattern: string,
): { prefix: string; suffix: string } | null {
  if (/[{}[\]()!+@\\]/.test(pattern)) return null;
  const firstWildcard = pattern.search(/[*?]/);
  if (firstWildcard === -1) {
    return { prefix: pattern, suffix: pattern };
  }
  const lastWildcard = Math.max(
    pattern.lastIndexOf('*'),
    pattern.lastIndexOf('?'),
  );
  return {
    prefix: pattern.slice(0, firstWildcard),
    suffix: pattern.slice(lastWildcard + 1),
  };
}
