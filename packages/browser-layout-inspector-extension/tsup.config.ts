import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    background: 'src/background.ts',
    content: 'src/content.ts',
    popup: 'src/popup.ts',
  },
  format: ['esm', 'iife'],
  platform: 'browser',
  target: 'es2023',
  outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.js' }),
  noExternal: ['browser-layout-inspector'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});
