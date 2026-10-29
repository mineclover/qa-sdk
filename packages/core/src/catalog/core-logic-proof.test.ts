// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, expect, it } from 'vitest';
import type { Catalog } from './catalog.types.js';
import {
  decodePrefix,
  encodePrefix,
  encodePrefixByValue,
  getPrefixEntries,
  getPrefixShape,
} from './runtime.js';
import {
  buildCatalogSnapshot,
  classifyLayoutChange,
  findUnversionedBreakingChanges,
  layoutToDecodeMap,
  prefixLayoutKey,
  toSnapshotIdentity,
  toSnapshotWire,
} from './snapshot/index.js';
import { SNAPSHOT_FIXTURE } from './snapshot/__fixtures__/snapshot-fixture.js';

type PositionMap = Readonly<Record<string, number>>;

function cartesianPositions(
  labels: readonly string[],
  capacities: readonly number[],
): PositionMap[] {
  const result: PositionMap[] = [];

  function visit(index: number, current: Record<string, number>): void {
    if (index === labels.length) {
      result.push({ ...current });
      return;
    }
    for (let position = 0; position < capacities[index]; position++) {
      current[labels[index]] = position;
      visit(index + 1, current);
    }
  }

  visit(0, {});
  return result;
}

function validPrefixVersions(catalog: Catalog): Array<{ prefixId: string; version: string }> {
  const valid: Array<{ prefixId: string; version: string }> = [];
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    for (const version of prefix.versions) {
      try {
        getPrefixShape(catalog, prefixId, version.version);
        valid.push({ prefixId, version: version.version });
      } catch {
        // Invalid catalog definitions are represented by snapshot issues and are not
        // valid runtime coordinates for this proof.
      }
    }
  }
  return valid;
}

function withAxisEntries(catalog: Catalog, entries: readonly string[], capacity?: number): Catalog {
  const next = structuredClone(catalog) as Catalog;
  next.axes.env.versions.v1 = {
    ...next.axes.env.versions.v1,
    entries: [...entries],
    ...(capacity === undefined ? {} : { capacity }),
  };
  return next;
}

describe('core logic proof — catalog coordinates and snapshots', () => {
  it('every valid fixture coordinate round-trips position and meaning', () => {
    for (const { prefixId, version } of validPrefixVersions(SNAPSHOT_FIXTURE)) {
      const shape = getPrefixShape(SNAPSHOT_FIXTURE, prefixId, version);
      const entries = getPrefixEntries(SNAPSHOT_FIXTURE, prefixId, version).entries;
      const labels = Object.keys(shape.dimCapacities);
      const positions = cartesianPositions(labels, shape.shape);

      expect(positions.length).toBe(shape.capacity);
      for (const positionMap of positions) {
        const address = encodePrefix(SNAPSHOT_FIXTURE, prefixId, version, positionMap);
        const decoded = decodePrefix(SNAPSHOT_FIXTURE, prefixId, version, address);
        const decodedPositions = Object.fromEntries(
          labels.map((label) => [label, decoded[label].position]),
        );

        expect(decodedPositions).toEqual(positionMap);
        expect(encodePrefix(SNAPSHOT_FIXTURE, prefixId, version, decodedPositions)).toBe(address);

        const hasMeaningForEveryDimension = labels.every(
          (label) => positionMap[label] < (entries[label]?.length ?? 0),
        );
        if (hasMeaningForEveryDimension) {
          const values = Object.fromEntries(
            labels.map((label) => [label, entries[label][positionMap[label]]]),
          );
          expect(encodePrefixByValue(SNAPSHOT_FIXTURE, prefixId, version, values)).toBe(address);
        }
      }
    }
  });

  it('snapshot construction is stable and preserves layout arithmetic', async () => {
    const options = { snapshotVersion: 1, parentDigest: null } as const;
    const first = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, options);
    const second = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, options);

    expect(second.snapshot).toEqual(first.snapshot);
    expect(first.snapshot.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.snapshot.parentDigest).toBeNull();

    for (const layout of Object.values(first.snapshot.layouts)) {
      const totalSpace = layout.dims.reduce((product, dim) => product * BigInt(dim.capacity), 1n);
      expect(layout.totalSpace).toBe(String(totalSpace));
      expect(layout.strides).toHaveLength(layout.dims.length);
      expect(layout.safePrecision).toBe(Number(totalSpace - 1n) <= Number.MAX_SAFE_INTEGER);

      const decodeMap = layoutToDecodeMap(layout);
      expect(decodeMap.indexId).toBe(layout.prefixId);
      expect(decodeMap.versionId).toBe(layout.version);
      expect(decodeMap.shape).toEqual(layout.dims.map((dim) => dim.capacity));
      expect(decodeMap.size).toBe(Number(totalSpace));
      expect(
        decodeMap.dims.every((dim, index) => dim.entries.length === layout.dims[index].capacity),
      ).toBe(true);
    }
  });

  it('snapshot wire identity retains catalog, digest, and codec semantics', async () => {
    const { snapshot } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, {
      snapshotVersion: 7,
      parentDigest: null,
    });
    const wire = toSnapshotWire(snapshot);
    expect(toSnapshotIdentity(wire)).toEqual({
      catalogId: snapshot.catalogId,
      digest: snapshot.digest,
      codecVersion: snapshot.codecVersion,
    });
    expect(wire.snapshot_version).toBe(7);
  });

  it('classifies append-compatible and breaking layout changes', async () => {
    const options = { snapshotVersion: 1, parentDigest: null } as const;
    const base = (await buildCatalogSnapshot(SNAPSHOT_FIXTURE, options)).snapshot;
    const appended = (
      await buildCatalogSnapshot(
        withAxisEntries(SNAPSHOT_FIXTURE, ['dev', 'prod', 'stage']),
        options,
      )
    ).snapshot;
    const widened = (
      await buildCatalogSnapshot(withAxisEntries(SNAPSHOT_FIXTURE, ['dev', 'prod'], 8), options)
    ).snapshot;
    const key = prefixLayoutKey('svc', 'v1');

    expect(classifyLayoutChange(base.layouts[key], appended.layouts[key])).toEqual({
      kind: 'append-compatible',
      appended: { env: 1 },
    });
    expect(findUnversionedBreakingChanges(base, appended)).toEqual([]);
    expect(classifyLayoutChange(base.layouts[key], widened.layouts[key])).toEqual({
      kind: 'breaking',
      reason: 'capacity',
      label: 'env',
    });
    expect(findUnversionedBreakingChanges(base, widened)).toContainEqual({
      key,
      reason: 'capacity',
      label: 'env',
    });
  });
});
