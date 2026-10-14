import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseRecord, type Config, type DecisionRecord } from './index.js';
import { lintRecords, type LintDiagnostic } from './lint.js';
import { collectMarkdownFiles } from './markdown-files.js';
import type { Store } from '../store/store.js';

export interface ProjectLintResult {
  ok: boolean;
  errors: number;
  warnings: number;
  diagnostics: LintDiagnostic[];
}

export async function lintProject(
  root: string,
  config: Config,
  store: Store,
): Promise<ProjectLintResult> {
  const indexed = await store.list(config.project);
  const files = new Set([
    ...collectMarkdownFiles(path.resolve(root, config.adrDir)),
    ...collectMarkdownFiles(path.resolve(root, config.sdrDir)),
    ...indexed.map((record) => path.resolve(root, record.path)),
  ]);
  const records: DecisionRecord[] = [];
  const diagnostics: LintDiagnostic[] = [];
  for (const file of [...files].sort()) {
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8');
    const lineCount = countLines(content);
    const relativePath = path.relative(root, file).split(path.sep).join('/');
    if (lineCount > 200) {
      diagnostics.push({
        severity: 'warning',
        code: 'line-budget',
        path: relativePath,
        message: `Record has ${lineCount} lines; the budget is 200.`,
      });
    }
    try {
      records.push(parseRecord(content, relativePath, 'auto'));
    } catch (error) {
      diagnostics.push({
        severity: 'error',
        code: 'schema',
        path: relativePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const analysis = lintRecords(records);
  diagnostics.push(...analysis.diagnostics);
  await store.deleteEdges(config.project, undefined, 'conflicts_with');
  for (const conflict of analysis.conflicts) {
    await store.addEdge(
      config.project,
      conflict.first,
      conflict.second,
      'conflicts_with',
    );
    await store.addEdge(
      config.project,
      conflict.second,
      conflict.first,
      'conflicts_with',
    );
  }
  diagnostics.sort(
    (first, second) =>
      compareText(first.severity, second.severity) ||
      compareText(first.code, second.code) ||
      compareText(first.id ?? first.path ?? '', second.id ?? second.path ?? ''),
  );
  const errors = diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length;
  return {
    ok: errors === 0,
    errors,
    warnings: diagnostics.length - errors,
    diagnostics,
  };
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  return content.split(/\r?\n/).length - (/\r?\n$/.test(content) ? 1 : 0);
}

function compareText(first: string, second: string): number {
  return first < second ? -1 : first > second ? 1 : 0;
}
