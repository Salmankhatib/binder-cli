import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  shims: true,
  clean: true,
  target: 'node20',
  jsx: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});