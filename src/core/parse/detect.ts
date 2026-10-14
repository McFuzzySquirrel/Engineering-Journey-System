import { getSections, RecordParseError } from './common.js';
import { parseAgent } from './agent.js';
import { parseHybrid } from './hybrid.js';
import { parseMadr } from './madr.js';
import { parseNygard } from './nygard.js';

export type RecordFormat = 'hybrid' | 'madr' | 'nygard' | 'agent';

export function detectFormat(source: string, filePath = ''): RecordFormat {
  const sections = getSections(source);
  const hasFrontmatter = /^---\s*$/m.test(source);
  if (hasFrontmatter) {
    if (/^---\s*[\r\n]+[\s\S]*?^\s*(?:rules|verify):/m.test(source)) {
      return 'agent';
    }
    if (/^##+\s+Agent Rules\s*$/im.test(source)) return 'hybrid';
    return 'agent';
  }
  if (
    /(?:^|[/\\])\d{4}[-_.]/.test(filePath) &&
    sections.has('decision') &&
    !sections.has('decision outcome')
  ) {
    return 'nygard';
  }
  return 'madr';
}

export function parseRecord(
  source: string,
  filePath: string,
  format: RecordFormat | 'auto' = 'auto',
) {
  const detected = format === 'auto' ? detectFormat(source, filePath) : format;
  switch (detected) {
    case 'hybrid':
      return parseHybrid(source, filePath);
    case 'madr':
      return parseMadr(source, filePath);
    case 'nygard':
      return parseNygard(source, filePath);
    case 'agent':
      return parseAgent(source, filePath);
    default:
      throw new RecordParseError(
        filePath,
        `unsupported record format: ${detected}`,
      );
  }
}
