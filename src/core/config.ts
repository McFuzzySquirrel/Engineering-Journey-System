import { ConfigSchema } from './schema.js';
import { RecordParseError, validationError } from './parse/common.js';

export function parseConfig(source: string, filePath: string) {
  let input: unknown;
  try {
    input = JSON.parse(source);
  } catch (error) {
    throw new RecordParseError(
      filePath,
      `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = ConfigSchema.safeParse(input);
  if (!parsed.success) throw validationError(filePath, parsed.error);
  return parsed.data;
}
