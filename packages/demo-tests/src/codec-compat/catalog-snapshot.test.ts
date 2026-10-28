import { buildCatalogSnapshot, findUnversionedBreakingChanges } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';

const OPTIONS = { snapshotVersion: 1, parentDigest: null } as const;

describe('DEMO_CATALOG snapshot', () => {
  it('모든 prefix version이 layout을 가진다', async () => {
    const { snapshot, issues } = await buildCatalogSnapshot(DEMO_CATALOG, OPTIONS);
    expect(issues).toEqual([]);
    const versionCount = Object.values(DEMO_CATALOG.prefixes).reduce(
      (n, p) => n + p.versions.length,
      0,
    );
    expect(Object.keys(snapshot.layouts)).toHaveLength(versionCount);
  });

  it('모든 축 version의 entries 수가 capacity 이하이다', () => {
    const over = Object.values(DEMO_CATALOG.axes).flatMap((axis) =>
      Object.entries(axis.versions)
        .filter(([, snap]) => snap.capacity !== undefined && snap.entries.length > snap.capacity)
        .map(([v]) => `${axis.id}@${v}`),
    );
    expect(over).toEqual([]);
  });

  it('같은 입력의 snapshot은 자기 자신과 breaking 변경이 없다', async () => {
    const { snapshot } = await buildCatalogSnapshot(DEMO_CATALOG, OPTIONS);
    expect(findUnversionedBreakingChanges(snapshot, snapshot)).toEqual([]);
  });
});
