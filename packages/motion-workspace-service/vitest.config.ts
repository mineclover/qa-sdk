import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'motion-content': resolve(packageDir, '../motion-content/src/index.ts'),
      'motion-workspace-client': resolve(packageDir, '../motion-workspace-client/src/index.ts'),
      'motion-workspace': resolve(packageDir, '../motion-workspace/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
