import { describe, expect, it } from 'vitest';

import { normalizeDocumentEnvelope } from 'doc-envelope';
import type { DocumentEnvelope, DocumentEnvelopeInput } from 'doc-envelope';
import { collectDocsReadiness, filterMatchingDocsForPack } from './docs-readiness.js';
import type { OntologyPackValidateFileRef } from './types.js';

describe('ontology pack docs/source-map readiness', () => {
  it('keeps partial source-map coverage as warning-level readiness', async () => {
    const readiness = await collectDocsReadiness({
      packId: 'sample-ontology',
      rootDir: '/repo',
      fileRefs: [
        fileRef('packages/sample/src/covered.ts'),
        fileRef('packages/sample/src/uncovered.test.ts', 'test'),
      ],
      readDocsFamily: async () => [
        document({
          stableId: 'sample-ontology-system',
          path: 'docs/specs/sample-ontology-system.spec.md',
          metadata: { defId: 'sample-ontology-system' },
          sources: [{ id: 'source:1', path: 'packages/sample/src/covered.ts' }],
        }),
      ],
    });

    expect(readiness.docs).toEqual({
      status: 'partial',
      familyId: 'sample-ontology-system',
      matchingDocs: [
        {
          docId: 'sample-ontology-system',
          kind: 'spec',
          path: 'docs/specs/sample-ontology-system.spec.md',
          sourceCount: 1,
        },
      ],
    });
    expect(readiness.sourceMap).toEqual({
      status: 'partial',
      checkedRefs: ['packages/sample/src/covered.ts', 'packages/sample/src/uncovered.test.ts'],
      coveredRefs: ['packages/sample/src/covered.ts'],
      missingRefs: ['packages/sample/src/uncovered.test.ts'],
      coverage: [
        {
          path: 'packages/sample/src/covered.ts',
          covered: true,
          docIds: ['sample-ontology-system'],
        },
        {
          path: 'packages/sample/src/uncovered.test.ts',
          covered: false,
          docIds: [],
        },
      ],
    });
    expect(readiness.issues).toEqual([
      expect.objectContaining({
        level: 'warning',
        source: 'source-map',
        path: 'readiness.sourceMap.packages/sample/src/uncovered.test.ts',
        code: 'source-map-missing',
      }),
    ]);
  });

  it('filters matching docs by pack family id and generated family filenames', () => {
    const docs = [
      document({
        stableId: 'generated-stable',
        path: 'docs/specs/sample-ontology-system.spec.md',
        metadata: {},
      }),
      document({
        stableId: 'sample-ontology-rule',
        path: 'docs/specs/sample-ontology-rule.md',
        metadata: { defId: 'sample-ontology-rule' },
      }),
      document({
        stableId: 'other-ontology-system',
        path: 'docs/specs/other-ontology-system.spec.md',
        metadata: { defId: 'other-ontology-system' },
      }),
    ];

    expect(filterMatchingDocsForPack('sample-ontology', docs).map((doc) => doc.path)).toEqual([
      'docs/specs/sample-ontology-rule.md',
      'docs/specs/sample-ontology-system.spec.md',
    ]);
  });
});

function fileRef(
  path: string,
  kind: OntologyPackValidateFileRef['kind'] = 'implementation',
): OntologyPackValidateFileRef {
  return {
    kind,
    ref: path,
    path,
    absolutePath: `/repo/${path}`,
    exists: true,
    source: 'blueprint',
  };
}

function document(
  input: Omit<DocumentEnvelopeInput, 'adapterId' | 'kind' | 'rawSource'> & {
    readonly kind?: string;
  },
): DocumentEnvelope {
  return normalizeDocumentEnvelope({
    adapterId: 'test-docs',
    ...input,
    kind: input.kind ?? 'spec',
    rawSource: {
      path: input.path,
    },
  });
}
