import { describe, expect, it } from 'vitest';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { prefixLayoutKey } from './catalog-snapshot.types.js';
import { isCodecContractError } from './codec-errors.js';
import { layoutToDecodeMap, reservedEntryLabel } from './decode-map.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

const OPTIONS = { snapshotVersion: 1, parentDigest: null } as const;

describe('layoutToDecodeMap', () => {
  it('shape는 capacity이고 headroom은 reserved entry로 채운다', async () => {
    const { snapshot } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    const map = layoutToDecodeMap(snapshot.layouts[prefixLayoutKey('svc', 'v1')]);
    expect(map.shape).toEqual([4, 3]);
    expect(map.size).toBe(12);
    expect(map.dims[0]).toEqual({
      dimId: 'env',
      snapshotId: 'env_v1',
      kind: { type: 'string_enum' },
      entries: ['dev', 'prod', reservedEntryLabel(2), reservedEntryLabel(3)],
    });
    expect(reservedEntryLabel(2)).toBe('(reserved:2)');
    expect(map.dims.every((d, i) => d.entries.length === map.shape[i])).toBe(true);
  });

  it('2^53 초과 layout은 StrideOverflow로 거부한다', async () => {
    const wide = structuredClone(SNAPSHOT_FIXTURE) as unknown as {
      axes: Record<string, unknown>;
      prefixes: Record<string, unknown>;
    };
    wide.axes.big = {
      id: 'big',
      name: 'big',
      versions: { v1: { entries: ['a'], capacity: 2 ** 20 } },
    };
    wide.prefixes.huge = {
      id: 'huge',
      name: 'huge',
      labels: ['x', 'y', 'z'],
      dims: {
        x: { kind: 'axis', axisId: 'big' },
        y: { kind: 'axis', axisId: 'big' },
        z: { kind: 'axis', axisId: 'big' },
      },
      versions: [{ version: 'v1', axisVersions: { x: 'v1', y: 'v1', z: 'v1' } }],
    };
    const { snapshot } = await buildCatalogSnapshot(wide as never, OPTIONS);
    try {
      layoutToDecodeMap(snapshot.layouts[prefixLayoutKey('huge', 'v1')]);
      throw new Error('StrideOverflow가 발생하지 않았습니다');
    } catch (error) {
      expect(isCodecContractError(error, 'StrideOverflow')).toBe(true);
    }
  });
});
