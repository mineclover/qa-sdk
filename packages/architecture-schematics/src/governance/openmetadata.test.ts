import { describe, expect, it } from 'vitest';

import { validateGovernanceManifest, type GovernanceManifest } from './openmetadata.js';

describe('OpenMetadata governance manifest', () => {
  it('accepts a complete metadata + cache key manifest', () => {
    const manifest: GovernanceManifest = {
      openmetadata: {
        domain: { name: 'Assignment', team: 'Assignment Team', owner: 'sim-assignment-owner' },
        glossary: [{ term: 'Assignment', description: 'Manager assignment.' }],
        lineage: [
          {
            name: 'read-path',
            from: 'pm.assignments',
            to: 'reporting.assignment_read_model',
            via: 'outbox',
          },
        ],
        qualityTests: [
          { name: 'status_values', type: 'columnValuesToBeInSet', entity: 'pm.assignments.status' },
        ],
      },
      cacheKeys: [
        {
          id: 'assignment-read-model',
          domain: 'assignment',
          purpose: 'read_model',
          version: 'v1',
          prefix: 'assignment-read-model',
          ttl: 'medium',
          openmetadataEntity: 'reporting.assignment_read_model',
          segments: [{ name: 'assignmentId' }],
        },
      ],
    };

    expect(validateGovernanceManifest(manifest)).toEqual([]);
  });
});
