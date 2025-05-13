import { defineConfig } from 'tsup';
import { readFileSync } from 'fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  clean: true,
  dts: true,
  outDir: 'dist',
  target: 'node14',
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    '__APP_VERSION__': JSON.stringify(pkg.version),
  },
});
