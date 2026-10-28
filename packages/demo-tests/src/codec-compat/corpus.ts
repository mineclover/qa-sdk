import {
  buildCatalogSnapshot,
  decodePrefix,
  encodePrefix,
  type Catalog,
  type PrefixLayout,
  type PrefixLayoutKey,
} from '@qa-sdk/core';

export interface LegacyCorpusCase {
  readonly key: PrefixLayoutKey;
  readonly positions: Readonly<Record<string, number>>;
  readonly address: number;
  readonly serialized: string;
  readonly values: Readonly<Record<string, string | number>>;
}

export interface LegacyCorpus {
  readonly codecVersion: 'legacy-v1';
  readonly catalogId: string;
  readonly catalogDigest: string;
  readonly cases: readonly LegacyCorpusCase[];
}

/** 경계값(0, 마지막 entry, headroom)과 dim별 단독 이동을 포함하는 결정론적 표본 */
function samplePositions(layout: PrefixLayout): Record<string, number>[] {
  const zero = Object.fromEntries(layout.dims.map((d) => [d.label, 0]));
  const samples: Record<string, number>[] = [zero];
  samples.push(
    Object.fromEntries(layout.dims.map((d) => [d.label, Math.max(0, d.entries.length - 1)])),
  );
  for (const dim of layout.dims) {
    if (dim.entries.length > 1) samples.push({ ...zero, [dim.label]: dim.entries.length - 1 });
    if (dim.capacity > dim.entries.length) samples.push({ ...zero, [dim.label]: dim.capacity - 1 });
  }
  return samples;
}

/**
 * 현재 codec(legacy-v1) 동작의 기록. sum 모델 prefix는 path-summation 테스트가 소유하므로 제외하고,
 * 2^53을 넘는 layout은 number 주소로 표현할 수 없어 제외한다.
 */
export async function buildLegacyCorpus(catalog: Catalog): Promise<LegacyCorpus> {
  const { snapshot } = await buildCatalogSnapshot(catalog, {
    snapshotVersion: 1,
    parentDigest: null,
  });
  const cases: LegacyCorpusCase[] = [];
  for (const key of Object.keys(snapshot.layouts).sort() as PrefixLayoutKey[]) {
    const layout = snapshot.layouts[key];
    if (layout.addressModel !== 'product' || !layout.safePrecision) continue;
    for (const positions of samplePositions(layout)) {
      const address = encodePrefix(catalog, layout.prefixId, layout.version, positions);
      const decoded = decodePrefix(catalog, layout.prefixId, layout.version, address);
      cases.push({
        key,
        positions,
        address,
        serialized: `${layout.prefixId}:${layout.version}:${address}`,
        values: Object.fromEntries(Object.entries(decoded).map(([k, v]) => [k, v.value])),
      });
    }
  }
  return {
    codecVersion: 'legacy-v1',
    catalogId: catalog.id,
    catalogDigest: snapshot.digest,
    cases,
  };
}
