// @def.boundary registry-system
// @def.doc registry-system

import { describe, expect, it } from 'vitest';

import {
  buildOntologyAddressAllocationRecord,
  buildOntologyAddressSegmentRecord,
  buildOntologyAxisRecord,
  buildOntologyNamespaceRecord,
  buildOntologyTaxonomyRecord,
  detectOntologyRegistrySameKeyDrift,
  recordsFromOntologyAllocationPlanWriteSet,
  validateOntologyAddressSegments,
  validateOntologyRegistryRows,
  validateOntologyTaxonomyAxisReferences,
} from './ontology-registry-validation.js';

describe('ontology registry validation helpers', () => {
  it('builds reusable fixtures without sharing array references', () => {
    const values = ['service', 'route'];
    const axis = buildOntologyAxisRecord({ values });
    values.push('database');

    const consumes = ['region'];
    const segment = buildOntologyAddressSegmentRecord({ consumes });
    consumes.push('env');

    expect(axis).toEqual(
      expect.objectContaining({
        ontologyId: 'ontology-a',
        axisId: 'region',
        values: ['service', 'route'],
      }),
    );
    expect(segment).toEqual(
      expect.objectContaining({
        allocationId: 'ontology-a:runtime-surface:v1',
        consumes: ['region'],
      }),
    );
  });

  it('validates taxonomy axes against matching ontology and version axes', () => {
    const taxonomy = buildOntologyTaxonomyRecord({
      ontologyId: 'ontology-a',
      versionId: 'v1',
      axisIds: ['region', 'env'],
      identityAxisIds: ['region', 'identity_only'],
    });

    const conflicts = validateOntologyTaxonomyAxisReferences({
      axes: [
        buildOntologyAxisRecord({
          ontologyId: 'ontology-a',
          axisId: 'region',
          versionId: 'v1',
        }),
        buildOntologyAxisRecord({
          ontologyId: 'ontology-b',
          axisId: 'env',
          versionId: 'v1',
        }),
        buildOntologyAxisRecord({
          ontologyId: 'ontology-a',
          axisId: 'identity_only',
          versionId: 'v2',
        }),
      ],
      taxonomies: [taxonomy],
    });

    expect(conflicts).toEqual([
      expect.objectContaining({
        code: 'missing-taxonomy-axis',
        ontologyId: 'ontology-a',
        taxonomyId: 'runtime-surface',
        versionId: 'v1',
        axisId: 'env',
      }),
      expect.objectContaining({
        code: 'missing-taxonomy-axis',
        axisId: 'identity_only',
      }),
    ]);
  });

  it('validates segment consumes, size, range containment, and overlap per allocation', () => {
    const allocation = buildOntologyAddressAllocationRecord({
      allocationId: 'allocation-a',
      addressOffset: 100,
      addressSize: 20,
    });
    const otherAllocation = buildOntologyAddressAllocationRecord({
      allocationId: 'allocation-b',
      addressOffset: 0,
      addressSize: 10,
    });

    const conflicts = validateOntologyAddressSegments({
      allocations: [allocation, otherAllocation],
      segments: [
        buildOntologyAddressSegmentRecord({
          allocationId: 'missing-allocation',
          segmentId: 'missing',
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'empty-consumes',
          consumes: [],
          addressOffset: 100,
          addressSize: 4,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'zero-size',
          addressOffset: 100,
          addressSize: 0,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'negative-offset',
          addressOffset: -1,
          addressSize: 2,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'outside',
          addressOffset: 118,
          addressSize: 3,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'base',
          addressOffset: 100,
          addressSize: 8,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'overlap',
          addressOffset: 107,
          addressSize: 4,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-b',
          segmentId: 'other-allocation',
          addressOffset: 0,
          addressSize: 10,
        }),
      ],
    });

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-segment',
          segmentId: 'missing',
          reason: 'missing-allocation',
        }),
        expect.objectContaining({
          code: 'invalid-segment',
          segmentId: 'empty-consumes',
          reason: 'empty-consumes',
        }),
        expect.objectContaining({
          code: 'invalid-segment',
          segmentId: 'zero-size',
          reason: 'non-positive-size',
        }),
        expect.objectContaining({
          code: 'invalid-segment',
          segmentId: 'negative-offset',
          reason: 'negative-offset',
        }),
        expect.objectContaining({
          code: 'invalid-segment',
          segmentId: 'outside',
          reason: 'outside-allocation-range',
        }),
        expect.objectContaining({
          code: 'segment-overlap',
          allocationId: 'allocation-a',
          segmentId: 'overlap',
          overlapsWithSegmentId: 'base',
        }),
      ]),
    );
  });

  it('allows adjacent segments and independent allocation ranges', () => {
    const conflicts = validateOntologyAddressSegments({
      allocations: [
        buildOntologyAddressAllocationRecord({
          allocationId: 'allocation-a',
          addressOffset: 0,
          addressSize: 10,
        }),
        buildOntologyAddressAllocationRecord({
          allocationId: 'allocation-b',
          addressOffset: 0,
          addressSize: 10,
        }),
      ],
      segments: [
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'a-1',
          addressOffset: 0,
          addressSize: 5,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-a',
          segmentId: 'a-2',
          addressOffset: 5,
          addressSize: 5,
        }),
        buildOntologyAddressSegmentRecord({
          allocationId: 'allocation-b',
          segmentId: 'b-1',
          addressOffset: 0,
          addressSize: 10,
        }),
      ],
    });

    expect(conflicts).toEqual([]);
  });

  it('detects same-key drift for every ontology registry row kind', () => {
    const conflicts = detectOntologyRegistrySameKeyDrift({
      existing: {
        namespaces: [buildOntologyNamespaceRecord()],
        axes: [buildOntologyAxisRecord()],
        taxonomies: [buildOntologyTaxonomyRecord()],
        allocations: [buildOntologyAddressAllocationRecord()],
        segments: [buildOntologyAddressSegmentRecord()],
      },
      attempted: {
        namespaces: [buildOntologyNamespaceRecord({ owner: 'new-owner' })],
        axes: [buildOntologyAxisRecord({ capacity: 8 })],
        taxonomies: [buildOntologyTaxonomyRecord({ axisIds: ['region', 'env'] })],
        allocations: [buildOntologyAddressAllocationRecord({ addressSize: 32 })],
        segments: [buildOntologyAddressSegmentRecord({ consumes: ['env'] })],
      },
    });

    expect(conflicts).toEqual([
      expect.objectContaining({
        code: 'drift',
        key: expect.objectContaining({ recordKind: 'namespace' }),
        fields: ['owner'],
      }),
      expect.objectContaining({
        code: 'drift',
        key: expect.objectContaining({ recordKind: 'axis' }),
        fields: ['capacity'],
      }),
      expect.objectContaining({
        code: 'drift',
        key: expect.objectContaining({ recordKind: 'taxonomy' }),
        fields: ['axisIds'],
      }),
      expect.objectContaining({
        code: 'drift',
        key: expect.objectContaining({ recordKind: 'allocation' }),
        fields: ['addressSize'],
      }),
      expect.objectContaining({
        code: 'drift',
        key: expect.objectContaining({ recordKind: 'segment' }),
        fields: ['consumes'],
      }),
    ]);
  });

  it('detects namespace and allocation drift on secondary keys', () => {
    const conflicts = detectOntologyRegistrySameKeyDrift({
      attempted: {
        namespaces: [
          buildOntologyNamespaceRecord({
            ontologyId: 'ontology-a',
            namespace: 'qa.shared',
          }),
          buildOntologyNamespaceRecord({
            ontologyId: 'ontology-b',
            namespace: 'qa.shared',
          }),
        ],
        allocations: [
          buildOntologyAddressAllocationRecord({
            allocationId: 'allocation-a',
            prefix: 'shared_prefix',
            taxonomyId: 'taxonomy-a',
          }),
          buildOntologyAddressAllocationRecord({
            allocationId: 'allocation-b',
            prefix: 'shared_prefix',
            taxonomyId: 'taxonomy-b',
          }),
          buildOntologyAddressAllocationRecord({
            allocationId: 'allocation-c',
            prefix: 'other_prefix',
            taxonomyId: 'taxonomy-a',
          }),
        ],
      },
    });

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: {
            recordKind: 'namespace',
            namespace: 'qa.shared',
          },
          fields: ['ontologyId'],
        }),
        expect.objectContaining({
          key: {
            recordKind: 'allocation',
            prefix: 'shared_prefix',
            versionId: 'v1',
          },
          fields: expect.arrayContaining(['allocationId', 'taxonomyId']),
        }),
        expect.objectContaining({
          key: {
            recordKind: 'allocation',
            ontologyId: 'ontology-a',
            taxonomyId: 'taxonomy-a',
            versionId: 'v1',
          },
          fields: expect.arrayContaining(['allocationId', 'prefix']),
        }),
      ]),
    );
  });

  it('validates a write set with existing context and does not mutate inputs', () => {
    const writeSet = {
      namespace: buildOntologyNamespaceRecord(),
      axes: [buildOntologyAxisRecord()],
      taxonomies: [buildOntologyTaxonomyRecord()],
      allocations: [buildOntologyAddressAllocationRecord()],
      segments: [buildOntologyAddressSegmentRecord()],
    };
    const existing = {
      allocations: [
        buildOntologyAddressAllocationRecord({
          allocationId: 'existing-allocation',
          taxonomyId: 'existing-taxonomy',
          prefix: 'qa_existing',
          addressOffset: 20,
          addressSize: 8,
        }),
      ],
      segments: [
        buildOntologyAddressSegmentRecord({
          allocationId: 'existing-allocation',
          segmentId: 'existing-segment',
          addressOffset: 20,
          addressSize: 8,
        }),
      ],
    };
    const before = JSON.stringify({ writeSet, existing });

    const conflicts = validateOntologyRegistryRows({
      existing,
      attempted: recordsFromOntologyAllocationPlanWriteSet(writeSet),
    });

    expect(conflicts).toEqual([]);
    expect(JSON.stringify({ writeSet, existing })).toBe(before);
  });
});
