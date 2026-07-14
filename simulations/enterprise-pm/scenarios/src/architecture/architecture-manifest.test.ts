import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildCacheKey,
  validateCacheKeyDefinitions,
  validateGovernanceManifest,
  type GovernanceManifest,
} from '@qa-sdk/scaffold';

import {
  ARCHITECTURE_CONCEPT_SOURCES,
  ARCHITECTURE_SIMULATION_SLICES,
  findSimulationSlice,
} from './architecture-manifest.js';

describe('architecture simulation manifest', () => {
  it('maps external architecture concepts to concrete simulation targets', () => {
    const sourceIds = new Set(ARCHITECTURE_CONCEPT_SOURCES.map((source) => source.id));

    expect(sourceIds).toContain('domain-layering');
    expect(sourceIds).toContain('data-governance');
    expect(sourceIds).toContain('openapi-contract');

    for (const slice of ARCHITECTURE_SIMULATION_SLICES) {
      expect(slice.targets.length).toBeGreaterThan(0);
      for (const sourceId of slice.sourceIds) {
        expect(sourceIds.has(sourceId)).toBe(true);
      }
    }
  });

  it('defines the first assignment command/read/governance slices', () => {
    expect(
      findSimulationSlice('assignment-command-write-model')?.targets.map((target) => target.kind),
    ).toContain('contract');
    expect(findSimulationSlice('assignment-read-model-sync')?.sourceIds).toContain(
      'read-model-query',
    );
    expect(findSimulationSlice('oa-sdk-openapi-merge-gate')?.targets[0]?.path).toBe(
      'simulations/enterprise-pm/contracts/openapi/src',
    );
  });

  it('validates the assignment OpenMetadata seed and cache key DSL', () => {
    const seedPath = join(
      process.cwd(),
      '..',
      'services',
      'pm-api',
      'src',
      'pm',
      'assignment',
      'metadata',
      'openmetadata.seed.json',
    );
    const manifest = JSON.parse(readFileSync(seedPath, 'utf-8')) as GovernanceManifest;

    expect(validateGovernanceManifest(manifest)).toEqual([]);
    expect(validateCacheKeyDefinitions(manifest.cacheKeys)).toEqual([]);
    expect(
      buildCacheKey({
        definition: manifest.cacheKeys[0],
        values: { assignmentId: 'asg_123' },
      }),
    ).toBe('assignment-read-model:v1:asg_123');
  });
});
