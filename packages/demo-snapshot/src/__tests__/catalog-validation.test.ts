import { describe, expect, it } from 'vitest';
import { DEMO_CATALOG } from '../demo-catalog.js';

describe('DEMO_CATALOG Validation', () => {
  describe('qa_pkg axis', () => {
    it('v3 entries should have no duplicates', () => {
      const entries = DEMO_CATALOG.axes.qa_pkg.versions.v3.entries;
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const id of entries) {
        if (seen.has(id)) duplicates.push(id);
        seen.add(id);
      }
      expect(duplicates, `Duplicate IDs found: ${duplicates.join(', ')}`).toEqual([]);
    });

    it('v3 all entries should have Korean labels', () => {
      const v3 = DEMO_CATALOG.axes.qa_pkg.versions.v3;
      const missing: string[] = [];
      for (const id of v3.entries) {
        if (!v3.ko[id]) missing.push(id);
      }
      expect(missing, `Missing Korean labels for: ${missing.join(', ')}`).toEqual([]);
    });
  });
});
