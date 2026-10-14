import path from 'node:path';
import picomatch from 'picomatch';
import type { GraphNode, Store } from '../store/store.js';

export interface ContextRule {
  id: string;
  modality: string;
  text: string;
  recordId: string;
  title: string;
  appliesTo: string[];
}

export async function getContextRules(
  store: Store,
  projectId: string,
  files: string[],
): Promise<ContextRule[]> {
  const normalizedFiles = files.map(normalizeFilePath);
  const matches = await store.byGlobMatch(projectId, normalizedFiles);
  const accepted = matches.filter(
    (record) => record.type === 'adr' && record.status === 'accepted',
  );
  accepted.sort(
    (first, second) =>
      ruleSpecificity(second, normalizedFiles) -
        ruleSpecificity(first, normalizedFiles) ||
      first.id.localeCompare(second.id),
  );
  return accepted.flatMap((record) =>
    record.rules.map((rule) => ({
      ...rule,
      recordId: record.id,
      title: record.title,
      appliesTo: record.appliesTo,
    })),
  );
}

function normalizeFilePath(file: string): string {
  return path.normalize(file).split(path.sep).join('/').replace(/^\.\//, '');
}

function ruleSpecificity(record: GraphNode, files: string[]): number {
  return record.appliesTo.reduce((specificity, pattern) => {
    const matchesFile = files.some((file) => picomatch.isMatch(file, pattern));
    return matchesFile
      ? Math.max(specificity, pattern.replace(/[*?[\]{}!]/g, '').length)
      : specificity;
  }, 0);
}
