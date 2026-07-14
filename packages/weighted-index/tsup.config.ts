import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/math/index.ts', 'src/vocab/index.ts', 'src/protocol/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  // test 파일은 번들에서 제외
  ignoreWatch: ['**/*.test.ts'],
});
