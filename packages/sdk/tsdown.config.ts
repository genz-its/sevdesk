import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  fixedExtension: false,
  dts: true,
  clean: true,
  sourcemap: true,
});
