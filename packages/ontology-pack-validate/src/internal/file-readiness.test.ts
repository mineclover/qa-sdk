import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { OperationalOntologyPack } from 'operational-ontology/pack';
import { describe, expect, it } from 'vitest';

import { collectFileReadiness } from './file-readiness.js';

describe('ontology pack file readiness', () => {
  it('summarizes implementation and test refs without changing readiness shapes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-sdk-pack-file-readiness-'));
    try {
      await mkdir(join(dir, 'packages', 'sample', 'src'), { recursive: true });
      await writeFile(join(dir, 'packages', 'sample', 'src', 'ready.ts'), 'export {};\n');
      await writeFile(join(dir, 'packages', 'sample', 'src', 'ready.test.ts'), 'export {};\n');

      const readiness = await collectFileReadiness({
        pack: fileReadinessPack(),
        rootDir: dir,
      });

      expect(readiness.implementationFiles).toMatchObject({
        status: 'missing',
        checked: expect.any(Array),
        missing: expect.any(Array),
      });
      expect(readiness.testFiles).toMatchObject({
        status: 'ready',
        checked: expect.any(Array),
        missing: [],
      });
      expect(readiness.implementationFiles.checked.map((ref) => ref.path)).toEqual([
        'packages/sample/src/missing.ts',
        'packages/sample/src/ready.ts',
      ]);
      expect(readiness.implementationFiles.missing).toEqual([
        expect.objectContaining({
          kind: 'implementation',
          path: 'packages/sample/src/missing.ts',
          source: 'blueprint',
          blueprintId: 'sample-binding',
        }),
      ]);
      expect(readiness.issues).toEqual([
        expect.objectContaining({
          level: 'error',
          source: 'file',
          path: 'readiness.implementationFiles.packages/sample/src/missing.ts',
          code: 'implementation-file-missing',
          blueprintId: 'sample-binding',
        }),
      ]);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});

function fileReadinessPack(): OperationalOntologyPack {
  return {
    packId: 'sample-ontology',
    schema: {
      axes: [],
      taxonomies: [],
      relationCategories: [],
      traversals: [],
    },
    blueprints: [
      {
        blueprintId: 'sample-binding',
        coordinateRef: 'sample:binding',
        unitKind: 'sample_unit',
        requiredSchemas: ['sample'],
        implementationBinding: {
          coordinateRef: 'sample:binding',
          implementationRefs: [
            { kind: 'code', ref: 'packages/sample/src/ready.ts' },
            { kind: 'code', ref: 'packages/sample/src/missing.ts' },
          ],
        },
        verificationBinding: {
          coordinateRef: 'sample:binding',
          verificationRefs: [{ kind: 'test', ref: 'packages/sample/src/ready.test.ts' }],
        },
      },
    ],
  };
}
