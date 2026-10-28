import { describe, expect, it } from 'vitest';
import type { Catalog } from '../catalog.types.js';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { prefixLayoutKey } from './catalog-snapshot.types.js';
import { classifyLayoutChange, findUnversionedBreakingChanges } from './compatibility.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

const OPTIONS = { snapshotVersion: 1, parentDigest: null } as const;
const SVC_V1 = prefixLayoutKey('svc', 'v1');

async function layoutOf(catalog: Catalog, key = SVC_V1) {
  return (await buildCatalogSnapshot(catalog, OPTIONS)).snapshot.layouts[key];
}

function withAxis(axisId: string, version: string, patch: object): Catalog {
  const catalog = structuredClone(SNAPSHOT_FIXTURE) as {
    axes: Record<string, { versions: Record<string, object> }>;
  };
  Object.assign(catalog.axes[axisId].versions[version], patch);
  return catalog as unknown as Catalog;
}

describe('classifyLayoutChange', () => {
  it('같은 layout은 identical', async () => {
    const layout = await layoutOf(SNAPSHOT_FIXTURE);
    expect(classifyLayoutChange(layout, layout)).toEqual({ kind: 'identical' });
  });

  it('표시 이름 변경은 layout을 바꾸지 않는다', async () => {
    const renamed = withAxis('env', 'v1', { ko: { dev: 'DEV', prod: 'PROD' } });
    expect(classifyLayoutChange(await layoutOf(SNAPSHOT_FIXTURE), await layoutOf(renamed))).toEqual(
      {
        kind: 'identical',
      },
    );
    expect((await layoutOf(renamed)).layoutDigest).toBe(
      (await layoutOf(SNAPSHOT_FIXTURE)).layoutDigest,
    );
  });

  it('capacity 안에서 entry를 뒤에 추가하면 append-compatible', async () => {
    const v1 = await layoutOf(SNAPSHOT_FIXTURE, SVC_V1);
    const v2 = await layoutOf(SNAPSHOT_FIXTURE, prefixLayoutKey('svc', 'v2'));
    expect(classifyLayoutChange(v1, { ...v2, version: v1.version })).toEqual({
      kind: 'append-compatible',
      appended: { env: 1 },
    });
  });

  it('entry 삭제·순서 변경은 entries-rewritten', async () => {
    const removed = withAxis('env', 'v1', { entries: ['prod'] });
    const reordered = withAxis('env', 'v1', { entries: ['prod', 'dev'] });
    const base = await layoutOf(SNAPSHOT_FIXTURE);
    for (const next of [removed, reordered]) {
      expect(classifyLayoutChange(base, await layoutOf(next))).toEqual({
        kind: 'breaking',
        reason: 'entries-rewritten',
        label: 'env',
      });
    }
  });

  it('capacity 변경은 breaking', async () => {
    const widened = withAxis('env', 'v1', { capacity: 8 });
    expect(classifyLayoutChange(await layoutOf(SNAPSHOT_FIXTURE), await layoutOf(widened))).toEqual(
      {
        kind: 'breaking',
        reason: 'capacity',
        label: 'env',
      },
    );
  });

  it('dim 순서 변경은 breaking', async () => {
    const swapped = structuredClone(SNAPSHOT_FIXTURE) as unknown as {
      prefixes: { svc: { labels: string[] } };
    };
    swapped.prefixes.svc.labels = ['role', 'env'];
    expect(
      classifyLayoutChange(
        await layoutOf(SNAPSHOT_FIXTURE),
        await layoutOf(swapped as unknown as Catalog),
      ),
    ).toEqual({ kind: 'breaking', reason: 'dim-order' });
  });

  it('addressModel 변경은 breaking', async () => {
    const base = await layoutOf(SNAPSHOT_FIXTURE);
    expect(classifyLayoutChange(base, { ...base, addressModel: 'sum' })).toEqual({
      kind: 'breaking',
      reason: 'address-model',
    });
  });
});

describe('findUnversionedBreakingChanges', () => {
  it('같은 prefix version에서 capacity가 바뀌면 보고한다 (version bump 강제)', async () => {
    const prev = (await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS)).snapshot;
    const next = (await buildCatalogSnapshot(withAxis('env', 'v1', { capacity: 8 }), OPTIONS))
      .snapshot;
    expect(findUnversionedBreakingChanges(prev, next)).toContainEqual({
      key: SVC_V1,
      reason: 'capacity',
      label: 'env',
    });
  });

  it('기존 prefix version이 사라지면 removed로 보고한다', async () => {
    const prev = (await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS)).snapshot;
    const dropped = structuredClone(SNAPSHOT_FIXTURE) as unknown as {
      prefixes: { svc: { versions: unknown[] } };
    };
    dropped.prefixes.svc.versions = dropped.prefixes.svc.versions.slice(1);
    const next = (await buildCatalogSnapshot(dropped as unknown as Catalog, OPTIONS)).snapshot;
    expect(findUnversionedBreakingChanges(prev, next)).toEqual([
      { key: SVC_V1, reason: 'removed' },
    ]);
  });

  it('capacity 안의 append-only 변경은 보고하지 않는다', async () => {
    const prev = (await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS)).snapshot;
    const next = (
      await buildCatalogSnapshot(withAxis('env', 'v1', { entries: ['dev', 'prod', 'qa'] }), OPTIONS)
    ).snapshot;
    expect(findUnversionedBreakingChanges(prev, next)).toEqual([]);
  });
});
