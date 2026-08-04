#!/usr/bin/env node
import { defineConfig, processConfig } from '@robingenz/zli';
import { consola } from 'consola';
import doctor from './commands/doctor';
import login from './commands/login';
import logout from './commands/logout';
import { formatError } from './errors';
import { pkg } from './package';

const config = defineConfig({
  meta: {
    name: 'sevdesk',
    version: pkg.version,
    description: pkg.description,
  },
  commands: {
    login,
    logout,
    doctor,
  },
});

try {
  const result = processConfig(config, process.argv.slice(2));
  await result.command.action(result.options, result.args);
} catch (error) {
  consola.error(formatError(error));
  process.exitCode = 1;
}
