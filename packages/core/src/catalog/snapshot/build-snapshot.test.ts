import { describe, expect, it } from 'vitest';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { LEGACY_V1_CODEC, prefixLayoutKey } from './catalog-snapshot.types.js';
import { computeCatalogDigest } from './digest.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

const OPTIONS = { snapshotVersion: 1, parentDigest: null } as const;

describe('buildCatalogSnapshot', () => {
  it('snapshot ref 필드를 채우고 codec 기본값은 legacy-v1이다', async () => {
    const { snapshot } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    expect(snapshot.catalogId).toBe(SNAPSHOT_FIXTURE.id);
    expect(snapshot.snapshotVersion).toBe(1);
    expect(snapshot.codecVersion).toBe(LEGACY_V1_CODEC);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.digestAlgorithm).toBe('sha256-jcs');
    expect(snapshot.parentDigest).toBeNull();
    expect(snapshot.digest).toBe(await computeCatalogDigest(SNAPSHOT_FIXTURE));
  });

  it('layout은 capacity 기준 shape·stride를 기록한다 (core runtime과 같은 기준)', async () => {
    const { snapshot } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    const layout = snapshot.layouts[prefixLayoutKey('svc', 'v1')];
    expect(layout.dims.map((d) => [d.label, d.capacity])).toEqual([
      ['env', 4],
      ['role', 3],
    ]);
    expect(layout.strides).toEqual(['3', '1']);
    expect(layout.totalSpace).toBe('12');
    expect(layout.safePrecision).toBe(true);
    expect(layout.addressModel).toBe('product');
    expect(layout.dims[0]).toMatchObject({
      kind: 'axis',
      sourceId: 'env',
      sourceVersion: 'v1',
      entries: ['dev', 'prod'],
    });
    expect(layout.layoutDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('layout을 만들 수 없는 prefix version은 layouts에서 빼고 issues로 보고한다', async () => {
    const { snapshot, issues } = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    const broken = prefixLayoutKey('build_event', 'v1');
    expect(snapshot.layouts[broken]).toBeUndefined();
    expect(snapshot.layouts[prefixLayoutKey('build_event', 'v2')]).toBeDefined();
    expect(issues).toEqual([{ key: broken, message: expect.stringContaining('qa_module') }]);
  });

  it('같은 입력이면 같은 snapshot을 만든다 (시각·난수 미포함)', async () => {
    const a = await buildCatalogSnapshot(SNAPSHOT_FIXTURE, OPTIONS);
    const b = await buildCatalogSnapshot(structuredClone(SNAPSHOT_FIXTURE), OPTIONS);
    expect(b).toEqual(a);
  });

  it('snapshotVersion은 1 이상의 정수여야 한다', async () => {
    await expect(
      buildCatalogSnapshot(SNAPSHOT_FIXTURE, { snapshotVersion: 0, parentDigest: null }),
    ).rejects.toThrow(RangeError);
  });
});
