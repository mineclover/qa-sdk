import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  ignoreWatch: ['**/*.test.ts'],
});
