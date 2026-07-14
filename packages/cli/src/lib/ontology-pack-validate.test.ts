// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { OperationalOntologyPack } from 'operational-ontology/pack';
import { describe, expect, it } from 'vitest';

import { validateOntologyPackFromRef } from 'ontology-pack-validate';

import { readDocsFamilyFromDefinitionMarkdown } from './ontology-pack-docs-reader.js';

describe('ontology pack validate readiness assembly', () => {
  it('keeps validation successful when partial source-map readiness only emits warnings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'qa-sdk-pack-readiness-validate-'));
    try {
      await mkdir(join(dir, 'docs', 'specs'), { recursive: true });
      await mkdir(join(dir, 'packages', 'sample', 'src'), { recursive: true });
      await writeFile(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      await writeFile(join(dir, 'packages', 'sample', 'src', 'covered.ts'), 'export {};\n');
      await writeFile(join(dir, 'packages', 'sample', 'src', 'uncovered.test.ts'), 'export {};\n');
      await writeFile(
        join(dir, 'docs', 'specs', 'sample-ontology-system.spec.md'),
        [
          '---',
          'def:',
          '  id: sample-ontology-system',
          '  level: leaf',
          '  scope: interface',
          '  aspect: api_contract',
          '  depth: specification',
          '  lifecycle: draft',
          'sources:',
          '  - packages/sample/src/covered.ts',
          '---',
          '# Sample ontology system',
          '',
          '## 목적 ^purpose',
          'Partial source-map coverage test document.',
          '',
        ].join('\n'),
      );
      await writeFile(
        join(dir, 'sample-pack.json'),
        JSON.stringify(partialReadinessPack(), null, 2),
      );

      const result = await validateOntologyPackFromRef({
        packRef: 'sample-pack.json',
        rootDir: dir,
        readDocsFamily: readDocsFamilyFromDefinitionMarkdown,
      });

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([
        expect.objectContaining({
          level: 'warning',
          source: 'source-map',
          code: 'source-map-missing',
          path: 'readiness.sourceMap.packages/sample/src/uncovered.test.ts',
        }),
      ]);
      expect(result.readiness.implementationFiles.status).toBe('ready');
      expect(result.readiness.testFiles.status).toBe('ready');
      expect(result.readiness.docs.status).toBe('partial');
      expect(result.readiness.sourceMap).toMatchObject({
        status: 'partial',
        checkedRefs: ['packages/sample/src/covered.ts', 'packages/sample/src/uncovered.test.ts'],
        coveredRefs: ['packages/sample/src/covered.ts'],
        missingRefs: ['packages/sample/src/uncovered.test.ts'],
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});

function partialReadinessPack(): OperationalOntologyPack {
  return {
    packId: 'sample-ontology',
    schema: {
      axes: [
        {
          id: 'sample_kind',
          values: ['example'],
          stable: true,
          capacity: 4,
        },
      ],
      taxonomies: [
        {
          id: 'sample',
          appliesTo: ['node'],
          axisIds: ['sample_kind'],
          identityAxisIds: ['sample_kind'],
          space: 'sample-ontology',
        },
      ],
      relationCategories: [],
      traversals: [],
    },
    blueprints: [
      {
        blueprintId: 'sample-binding',
        coordinateRef: 'sample:binding',
        unitKind: 'corridor_bundle',
        requiredSchemas: ['sample'],
        implementationBinding: {
          coordinateRef: 'sample:binding',
          implementationRefs: [{ kind: 'code', ref: 'packages/sample/src/covered.ts' }],
        },
        verificationBinding: {
          coordinateRef: 'sample:binding',
          verificationRefs: [{ kind: 'test', ref: 'packages/sample/src/uncovered.test.ts' }],
        },
      },
    ],
  };
}
