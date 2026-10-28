// @def.boundary registry-system
// @def.doc registry-system

import {
  buildCatalogSnapshot,
  decodePrefix,
  encodePrefix,
  type Catalog,
  type PrefixLayout,
} from '@qa-sdk/core';
import { DEMO_CATALOG } from 'demo-snapshot';
import { PrefixDecoder, type DecodeMap as IndexMetaDecodeMap } from 'index-meta';
import { describe, expect, it } from 'vitest';
import type { CatalogStore } from '../../stores/catalog-store.js';
import { DecodeMapService } from './decode-map.service.js';

const catalog = DEMO_CATALOG as unknown as Catalog;

const store: CatalogStore = {
  register: async () => undefined,
  get: async () => ({
    id: catalog.id,
    name: catalog.name,
    data: JSON.stringify(catalog),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }),
  list: async () => [],
  update: async () => undefined,
  delete: async () => undefined,
};

/** dim별 0, 마지막 실제 entry, headroom(capacity-1) 위치 표본 */
function samplePositions(layout: PrefixLayout): Record<string, number>[] {
  const pick = (f: (d: PrefixLayout['dims'][number]) => number) =>
    Object.fromEntries(layout.dims.map((d) => [d.label, Math.max(0, f(d))]));
  const samples = [pick(() => 0), pick((d) => d.entries.length - 1)];
  if (layout.dims.some((d) => d.capacity > d.entries.length)) {
    samples.push(pick((d) => d.capacity - 1));
  }
  return samples;
}

function asStrings(record: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, String(v)]));
}

describe('DecodeMapService ↔ core runtime parity (R-1)', async () => {
  const { snapshot } = await buildCatalogSnapshot(catalog, {
    snapshotVersion: 1,
    parentDigest: null,
  });
  const layouts = Object.values(snapshot.layouts).filter(
    (l) => l.addressModel === 'product' && l.safePrecision,
  );
  const maps = await new DecodeMapService(store).list(catalog.id);

  it.each(layouts.map((l) => [`${l.prefixId}@${l.version}`, l] as const))(
    '%s: SDK 주소를 같은 값으로 decode한다',
    (_key, layout) => {
      const map = maps.find((m) => m.indexId === layout.prefixId && m.versionId === layout.version);
      expect(map, 'DecodeMap 누락').toBeDefined();
      const decoder = new PrefixDecoder({ map: map as unknown as IndexMetaDecodeMap });
      for (const positions of samplePositions(layout)) {
        const address = encodePrefix(catalog, layout.prefixId, layout.version, positions);
        const core = Object.fromEntries(
          Object.entries(decodePrefix(catalog, layout.prefixId, layout.version, address)).map(
            ([label, d]) => [label, String(d.value)],
          ),
        );
        expect(asStrings(decoder.decode(address))).toEqual(core);
      }
    },
  );
});
