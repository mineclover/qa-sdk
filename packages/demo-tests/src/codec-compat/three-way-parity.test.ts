import {
  buildCatalogSnapshot,
  decodePrefix,
  encodePrefix,
  flattenForBrowser,
  layoutToDecodeMap,
  type PrefixLayout,
} from '@qa-sdk/core';
import { decode as browserDecode } from '@qa-sdk/browser-codec';
import { DEMO_CATALOG } from 'demo-snapshot';
import { PrefixDecoder } from 'index-meta';
import { describe, expect, it } from 'vitest';

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

describe('3-way parity: core runtime ↔ DecodeMap(index-meta) ↔ browser-codec', async () => {
  const { snapshot } = await buildCatalogSnapshot(DEMO_CATALOG, {
    snapshotVersion: 1,
    parentDigest: null,
  });
  const layouts = Object.values(snapshot.layouts).filter(
    (l) => l.addressModel === 'product' && l.safePrecision,
  );
  const browserCatalog = flattenForBrowser(DEMO_CATALOG);

  it.each(layouts.map((l) => [`${l.prefixId}@${l.version}`, l] as const))('%s', (_key, layout) => {
    const decoder = new PrefixDecoder({ map: layoutToDecodeMap(layout) as never });
    for (const positions of samplePositions(layout)) {
      const address = encodePrefix(DEMO_CATALOG, layout.prefixId, layout.version, positions);
      const core = Object.fromEntries(
        Object.entries(decodePrefix(DEMO_CATALOG, layout.prefixId, layout.version, address)).map(
          ([label, d]) => [label, String(d.value)],
        ),
      );
      expect(asStrings(decoder.decode(address)), 'DecodeMap').toEqual(core);

      // browser catalog은 prefix마다 최신 version 하나만 담는다
      if (browserCatalog[layout.prefixId]?.version === layout.version) {
        const viaBrowser = browserDecode(
          browserCatalog,
          `${layout.prefixId}:${layout.version}:${address}`,
        );
        expect(viaBrowser && asStrings(viaBrowser.values), 'browser-codec').toEqual(core);
      }
    }
  });
});
