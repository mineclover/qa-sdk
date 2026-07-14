import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/decode.ts', 'src/workers.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  ignoreWatch: ['**/*.test.ts'],
  external: ['better-sqlite3', 'node:sqlite'],
  onSuccess: 'rm -rf dist/drizzle && cp -r drizzle dist/drizzle',
});
