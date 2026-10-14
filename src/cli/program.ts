import { Command } from 'commander';
import packageJson from '../../package.json' with { type: 'json' };

export function createProgram(): Command {
  return new Command()
    .name('dg')
    .description('Index and query architecture decision records.')
    .version(packageJson.version);
}
