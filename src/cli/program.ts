import { Command } from 'commander';
import packageJson from '../../package.json' with { type: 'json' };
import { registerCommands } from './commands.js';

export function createProgram(): Command {
  const program = new Command()
    .name('dg')
    .description('Index and query architecture decision records.')
    .version(packageJson.version);
  registerCommands(program);
  return program;
}
