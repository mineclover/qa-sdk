import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packageDir = dirname(fileURLToPath(import.meta.url));

/**
 * Enrichment integration tests are owned by this test suite for historical
 * coverage, but the production dkg package must not depend upward on the
 * logic-tier dkg-enrichment package. Keep the test-only bridge explicit and
 * out of the workspace dependency graph.
 */
export default defineConfig({
  resolve: {
    alias: {
      'dkg-enrichment': resolve(packageDir, '../dkg-enrichment/src/index.ts'),
    },
  },
});
