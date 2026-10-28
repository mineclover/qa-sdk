import { decodePrefix, encodePrefix, latestPrefixVersion, type Catalog } from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { PrefixDecoder } from 'index-meta';
import { describe, expect, it } from 'vitest';
import { buildDecodeMaps } from './build-decode-maps.js';

const catalog = DEMO_CATALOG as unknown as Catalog;

describe('buildDecodeMaps (worker)', () => {
  it('모든 product prefix version의 DecodeMap을 만들고 건너뛴 항목이 없다', async () => {
    const { maps, skipped } = await buildDecodeMaps(catalog);
    const productVersions = Object.values(catalog.prefixes)
      .filter((p) => (p.addressModel ?? 'product') === 'product')
      .reduce((n, p) => n + p.versions.length, 0);
    expect(skipped).toEqual([]);
    expect(maps.filter((m) => catalog.prefixes[m.indexId]?.addressModel !== 'sum')).toHaveLength(
      productVersions,
    );
  });

  it('SDK(core runtime) 주소를 같은 값으로 decode한다 — capacity shape (R-1)', async () => {
    const { maps } = await buildDecodeMaps(catalog);
    const service = catalog.prefixes.service;
    const version = latestPrefixVersion(catalog, 'service');
    const positions = Object.fromEntries(service.labels.map((label) => [label, 1]));
    const address = encodePrefix(catalog, 'service', version, positions);
    const map = maps.find((m) => m.indexId === 'service' && m.versionId === version)!;
    const decoded = new PrefixDecoder({ map: map as never }).decode(address);
    const core = decodePrefix(catalog, 'service', version, address);
    expect(Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, String(v)]))).toEqual(
      Object.fromEntries(Object.entries(core).map(([k, v]) => [k, String(v.value)])),
    );
  });
});
