import { describe, expect, it } from 'vitest';
import type { Catalog } from '../catalog.types.js';
import { buildCatalogSnapshot } from './build-snapshot.js';
import { prefixLayoutKey, type CatalogSnapshot } from './catalog-snapshot.types.js';
import { isCodecContractError, type CodecErrorCode } from './codec-errors.js';
import { assertAddressInLayout, resolveDecodeLayout } from './compatibility.js';
import { SNAPSHOT_FIXTURE } from './__fixtures__/snapshot-fixture.js';

async function snapshotOf(catalog: Catalog, snapshotVersion = 1): Promise<CatalogSnapshot> {
  return (await buildCatalogSnapshot(catalog, { snapshotVersion, parentDigest: null })).snapshot;
}

function expectCode(fn: () => unknown, code: CodecErrorCode): void {
  try {
    fn();
  } catch (error) {
    expect(isCodecContractError(error, code)).toBe(true);
    return;
  }
  throw new Error(`${code}가 발생하지 않았습니다`);
}

function patched(mutate: (c: any) => void): Catalog {
  const catalog = structuredClone(SNAPSHOT_FIXTURE);
  mutate(catalog);
  return catalog;
}

describe('resolveDecodeLayout', () => {
  it('같은 digest면 target layout을 돌려준다', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const layout = resolveDecodeLayout(
      { ref: target, prefixId: 'svc', version: 'v1' },
      target,
      () => undefined,
    );
    expect(layout).toBe(target.layouts[prefixLayoutKey('svc', 'v1')]);
  });

  it('producer snapshot을 찾을 수 없으면 UnknownCatalogSnapshot', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const ref = { ...target, digest: `sha256:${'0'.repeat(64)}` };
    expectCode(
      () => resolveDecodeLayout({ ref, prefixId: 'svc', version: 'v1' }, target, () => undefined),
      'UnknownCatalogSnapshot',
    );
  });

  it('catalogId가 다르면 CatalogMismatch', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const ref = { ...target, catalogId: 'other' };
    expectCode(
      () => resolveDecodeLayout({ ref, prefixId: 'svc', version: 'v1' }, target, () => undefined),
      'CatalogMismatch',
    );
  });

  it('지원하지 않는 codec이면 UnsupportedCodecVersion (wire에서 온 임의 문자열 포함)', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    const ref = { ...target, codecVersion: 'legacy-v2' as never };
    expectCode(
      () => resolveDecodeLayout({ ref, prefixId: 'svc', version: 'v1' }, target, () => undefined),
      'UnsupportedCodecVersion',
    );
  });

  it('target에 없는 prefix version이면 UnknownPrefix (R-11 layout 포함)', async () => {
    const target = await snapshotOf(SNAPSHOT_FIXTURE);
    expectCode(
      () =>
        resolveDecodeLayout(
          { ref: target, prefixId: 'nope', version: 'v1' },
          target,
          () => undefined,
        ),
      'UnknownPrefix',
    );
    expectCode(
      () =>
        resolveDecodeLayout(
          { ref: target, prefixId: 'build_event', version: 'v1' },
          target,
          () => undefined,
        ),
      'UnknownPrefix',
    );
  });

  it('producer와 target layout이 breaking이면 MigrationRequired', async () => {
    const producer = await snapshotOf(SNAPSHOT_FIXTURE, 1);
    const target = await snapshotOf(
      patched((c) => {
        c.axes.env.versions.v1.capacity = 8;
      }),
      2,
    );
    const lookup = (digest: string) => (digest === producer.digest ? producer : undefined);
    expectCode(
      () => resolveDecodeLayout({ ref: producer, prefixId: 'svc', version: 'v1' }, target, lookup),
      'MigrationRequired',
    );
  });

  it('producer → target이 append-only면 target layout으로 decode 허용', async () => {
    const producer = await snapshotOf(SNAPSHOT_FIXTURE, 1);
    const target = await snapshotOf(
      patched((c) => {
        c.axes.env.versions.v1.entries = ['dev', 'prod', 'qa'];
      }),
      2,
    );
    const lookup = (digest: string) => (digest === producer.digest ? producer : undefined);
    const layout = resolveDecodeLayout(
      { ref: producer, prefixId: 'svc', version: 'v1' },
      target,
      lookup,
    );
    expect(layout.dims[0].entries).toEqual(['dev', 'prod', 'qa']);
  });
});

describe('assertAddressInLayout', () => {
  it('[0, totalSpace) 안의 정수만 허용한다', async () => {
    const layout = (await snapshotOf(SNAPSHOT_FIXTURE)).layouts[prefixLayoutKey('svc', 'v1')];
    expect(() => assertAddressInLayout(layout, 11)).not.toThrow();
    expect(() => assertAddressInLayout(layout, 11n)).not.toThrow();
    for (const bad of [12, -1, 1.5, Number.NaN, 12n, -1n]) {
      expectCode(() => assertAddressInLayout(layout, bad), 'AddressOutOfRange');
    }
  });

  it('2^53 초과 layout을 number 주소로 검사하면 StrideOverflow', async () => {
    const wide = patched((c) => {
      c.axes.big = {
        id: 'big',
        name: 'big',
        versions: { v1: { entries: ['a'], capacity: 2 ** 20 } },
      };
      c.prefixes.huge = {
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
    });
    const layout = (await snapshotOf(wide)).layouts[prefixLayoutKey('huge', 'v1')];
    expect(layout.safePrecision).toBe(false);
    expect(layout.totalSpace).toBe(String(2n ** 60n));
    expectCode(() => assertAddressInLayout(layout, 1), 'StrideOverflow');
    expect(() => assertAddressInLayout(layout, 2n ** 59n)).not.toThrow();
  });
});
