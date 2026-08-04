import { createRequire } from 'node:module';

export const pkg = createRequire(import.meta.url)('../package.json') as {
  name: string;
  version: string;
  description: string;
};
