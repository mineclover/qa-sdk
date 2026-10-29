// @def.boundary platform-chain-system

import { describe, expect, it } from 'vitest';
import {
  DEMO_CATALOG,
  decodePrefix,
  encodePrefix,
  encodePrefixByValue,
  getPrefixEntries,
  getPrefixShape,
  verifyRoundTrip,
} from './index.js';
import { buildCatalogSnapshot, layoutToDecodeMap, prefixLayoutKey } from '@qa-sdk/core/catalog';

function prefixVersions(): Array<{ prefixId: string; version: string }> {
  return Object.values(DEMO_CATALOG.prefixes).flatMap((prefix) =>
    prefix.versions.map((version) => ({ prefixId: prefix.id, version: version.version })),
  );
}

function sampleAddresses(capacity: number): number[] {
  if (capacity <= 1024) return Array.from({ length: capacity }, (_, address) => address);
  return [...new Set([0, Math.floor(capacity / 2), capacity - 1])];
}

describe('core logic proof — DEMO_CATALOG integration', () => {
  it('모든 prefix/version의 유효 주소를 encode→decode→re-encode한다', () => {
    for (const { prefixId, version } of prefixVersions()) {
      const shape = getPrefixShape(DEMO_CATALOG, prefixId, version);
      const addresses = sampleAddresses(shape.capacity);

      // 작은 공간은 전수 검증하고, 큰 공간은 경계·중간 표본으로 검증한다.
      if (shape.capacity <= 1024) {
        const proof = verifyRoundTrip(DEMO_CATALOG, prefixId, version);
        expect(proof, `${prefixId}@${version}`).toMatchObject({ valid: true });
      }

      for (const address of addresses) {
        const decoded = decodePrefix(DEMO_CATALOG, prefixId, version, address);
        const positions = Object.fromEntries(
          Object.entries(decoded).map(([label, dim]) => [label, dim.position]),
        );
        expect(encodePrefix(DEMO_CATALOG, prefixId, version, positions)).toBe(address);
      }
    }
  });

  it('각 prefix/version의 실제 entry 값도 동일 주소로 재구성된다', () => {
    for (const { prefixId, version } of prefixVersions()) {
      const entries = getPrefixEntries(DEMO_CATALOG, prefixId, version).entries;
      const labels = Object.keys(entries);
      if (labels.length === 0 || labels.some((label) => entries[label]?.length === 0)) continue;

      const values = Object.fromEntries(
        labels.map((label) => [label, entries[label][0]]),
      ) as Record<string, string | number>;
      const address = encodePrefixByValue(DEMO_CATALOG, prefixId, version, values);
      const decoded = decodePrefix(DEMO_CATALOG, prefixId, version, address);
      for (const label of labels) expect(decoded[label].value).toBe(values[label]);
    }
  });

  it('DEMO_CATALOG snapshot digest와 layout/decode-map 계약이 안정적이다', async () => {
    const first = (
      await buildCatalogSnapshot(DEMO_CATALOG, {
        snapshotVersion: 1,
        parentDigest: null,
      })
    ).snapshot;
    const second = (
      await buildCatalogSnapshot(DEMO_CATALOG, {
        snapshotVersion: 1,
        parentDigest: null,
      })
    ).snapshot;

    expect(second).toEqual(first);
    expect(first.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(Object.keys(first.layouts).length).toBeGreaterThan(0);

    for (const layout of Object.values(first.layouts)) {
      const totalSpace = layout.dims.reduce((product, dim) => product * BigInt(dim.capacity), 1n);
      expect(layout.totalSpace).toBe(String(totalSpace));
      if (!layout.safePrecision) continue;

      const decodeMap = layoutToDecodeMap(layout);
      expect(decodeMap.indexId).toBe(layout.prefixId);
      expect(decodeMap.versionId).toBe(layout.version);
      expect(decodeMap.shape).toEqual(layout.dims.map((dim) => dim.capacity));
      expect(decodeMap.size).toBe(Number(totalSpace));
      expect(decodeMap.dims).toHaveLength(layout.dims.length);
      expect(
        decodeMap.dims.every((dim, index) => dim.entries.length === layout.dims[index].capacity),
      ).toBe(true);
    }

    expect(first.layouts[prefixLayoutKey('service', 'v1')]).toBeDefined();
  });
});
