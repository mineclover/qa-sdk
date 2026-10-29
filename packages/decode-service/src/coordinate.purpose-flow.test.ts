// @def.boundary decode-service-system
// @def.doc decode-service-system

/**
 * @purpose F 좌표계 — 핵심 흐름 (docs/proposals/swc-next-qa-sdk-optimization/07-purpose-alignment.md §5 단계 1)
 *
 * Catalog → registry decode-map → decode-service 동기화 → SDK(core runtime) encode 주소를 HTTP /decode로
 * 풀어 같은 값이 나온다. catalog에 entry를 덧붙여도(append-only) 동기화 후 예전 주소는 같은 값으로 풀린다.
 */
import {
  decodePrefix,
  encodePrefix,
  getPrefixEntries,
  latestPrefixVersion,
  type Catalog,
} from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { buildDecodeMaps } from './lib/build-decode-maps.js';
import { createDecodeMapSync } from './lib/decode-map-sync.js';
import { DecoderPool } from './lib/decoder-pool.js';

const silent = { info: () => {}, warn: () => {} };

/** registry 역할 — catalog에서 decode-map과 generation digest를 내준다 */
function registryFor(state: { catalog: Catalog; digest: string }): typeof fetch {
  return (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path === '/health/generation') {
      return Response.json({
        generations: { [state.catalog.id]: { catalogDigest: state.digest } },
      });
    }
    const { maps } = await buildDecodeMaps(state.catalog);
    return Response.json(maps);
  }) as typeof fetch;
}

/** prefix의 고정 차원마다 마지막 entry 위치를 고른 SDK 주소 */
function sdkAddress(catalog: Catalog, prefixId: string, version: string) {
  const { entries } = getPrefixEntries(catalog, prefixId, version);
  const positions = Object.fromEntries(
    Object.entries(entries).map(([label, values]) => [label, Math.max(values.length - 1, 0)]),
  );
  return encodePrefix(catalog, prefixId, version, positions);
}

function productPrefixes(catalog: Catalog) {
  return Object.values(catalog.prefixes)
    .filter((prefix) => (prefix.addressModel ?? 'product') === 'product')
    .map((prefix) => ({ prefixId: prefix.id, version: latestPrefixVersion(catalog, prefix.id) }));
}

async function decodeOverHttp(
  app: ReturnType<typeof createApp>,
  prefix: string,
  version: string,
  input: number,
) {
  const res = await app.request('/decode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, prefix, version }),
  });
  expect(res.status, `${prefix}@${version}:${input}`).toBe(200);
  return ((await res.json()) as { entities: Record<string, unknown> }).entities;
}

function coreValues(catalog: Catalog, prefixId: string, version: string, address: number) {
  return Object.fromEntries(
    Object.entries(decodePrefix(catalog, prefixId, version, address)).map(([label, d]) => [
      label,
      String(d.value),
    ]),
  );
}

const stringify = (entities: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(entities).map(([k, v]) => [k, String(v)]));

describe('F 좌표계 — catalog → decode-service 동기화 → SDK 주소 decode', () => {
  it('모든 product prefix 최신 version에서 SDK encode 주소를 같은 값으로 decode한다', async () => {
    const catalog = DEMO_CATALOG as unknown as Catalog;
    const pool = new DecoderPool(0);
    const sync = createDecodeMapSync({
      registryUrl: 'http://registry.test',
      pool,
      logger: silent,
      fetch: registryFor({ catalog, digest: `sha256:${'1'.repeat(64)}` }),
    });
    expect(await sync.sync()).toMatchObject({ status: 'loaded' });
    const app = createApp({ pool });

    const prefixes = productPrefixes(catalog);
    expect(prefixes.length).toBeGreaterThan(0);
    for (const { prefixId, version } of prefixes) {
      const address = sdkAddress(catalog, prefixId, version);
      expect(stringify(await decodeOverHttp(app, prefixId, version, address))).toEqual(
        coreValues(catalog, prefixId, version, address),
      );
    }
  });

  it('catalog에 entry를 덧붙이면 다시 동기화하고, 예전 주소는 같은 값으로 풀린다 (append-only)', async () => {
    const before = DEMO_CATALOG as unknown as Catalog;
    const state = { catalog: before, digest: `sha256:${'1'.repeat(64)}` };
    const pool = new DecoderPool(0);
    const sync = createDecodeMapSync({
      registryUrl: 'http://registry.test',
      pool,
      logger: silent,
      fetch: registryFor(state),
    });
    await sync.sync();
    const app = createApp({ pool });

    const prefixId = 'service';
    const version = latestPrefixVersion(before, prefixId);
    const address = sdkAddress(before, prefixId, version);
    const expected = coreValues(before, prefixId, version, address);

    // service가 쓰는 첫 axis에 entry 하나를 덧붙인다 (capacity headroom 안)
    const after = structuredClone(before);
    const vdef = after.prefixes[prefixId].versions.find((v) => v.version === version)!;
    const [label, axisVersion] = Object.entries(vdef.axisVersions)[0];
    const dim = after.prefixes[prefixId].dims[label];
    if (dim.kind !== 'axis') throw new Error(`${label}은 axis가 아니다`);
    const snapshot = after.axes[dim.axisId].versions[axisVersion];
    (snapshot as { entries: string[] }).entries = [...snapshot.entries, 'purpose_flow_added'];
    state.catalog = after;
    state.digest = `sha256:${'2'.repeat(64)}`;

    expect(await sync.sync()).toMatchObject({ status: 'loaded' });
    expect(stringify(await decodeOverHttp(app, prefixId, version, address))).toEqual(expected);

    // 덧붙인 entry도 새 decode-map으로 풀린다
    const added = sdkAddress(after, prefixId, version);
    expect((await decodeOverHttp(app, prefixId, version, added))[label]).toBe('purpose_flow_added');
  });
});
