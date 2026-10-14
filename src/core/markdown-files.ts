import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export function collectMarkdownFiles(target: string): string[] {
  if (!existsSync(target)) return [];
  const stat = statSync(target);
  if (stat.isFile()) return /\.md$/i.test(target) ? [target] : [];
  if (!stat.isDirectory()) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.md$/i.test(entry.name))
        files.push(entryPath);
    }
  };
  visit(target);
  return files;
}
