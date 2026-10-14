import { expect, it } from 'vitest';
import { createProgram } from '../src/cli/program.js';

it('exposes the package version', () => {
  expect(createProgram().version()).toBe('0.1.0');
});

it('shows help for the CLI', () => {
  let output = '';
  const program = createProgram()
    .configureOutput({ writeOut: (text) => (output += text) })
    .exitOverride();

  expect(() => program.parse(['node', 'dg', '--help'])).toThrow();
  expect(output).toContain('Usage: dg');
  expect(output).toContain('--version');
});
