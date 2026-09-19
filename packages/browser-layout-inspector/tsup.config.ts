import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/measurement.ts'],
  format: ['esm', 'cjs'],
  platform: 'neutral',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  ignoreWatch: ['**/*.test.ts'],
});
