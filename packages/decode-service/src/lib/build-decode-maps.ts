// @def.boundary decode-service-system
// @def.doc decode-service-system

import type { Catalog } from '@qa-sdk/core';
import { buildCatalogSnapshot, layoutToDecodeMap, prefixLayoutKey } from '@qa-sdk/core';
import type { DecodeMap } from 'index-meta-workers';

/**
 * catalog → DecodeMap[]. registry DecodeMapService와 같은 정본 빌더(layoutToDecodeMap)를 쓴다 —
 * shape는 capacity, headroom은 reserved entry (ADR-010). layout이 없거나 number 범위를 넘는
 * prefix version은 이유와 함께 skipped로 돌려준다.
 */
export async function buildDecodeMaps(
  catalog: Catalog,
): Promise<{ maps: DecodeMap[]; skipped: string[] }> {
  // DecodeMap은 layout만 사용 — 발행 순번은 registry snapshot store 소유
  const { snapshot, issues } = await buildCatalogSnapshot(catalog, {
    snapshotVersion: 1,
    parentDigest: null,
  });
  const maps: DecodeMap[] = [];
  const skipped = issues.map((issue) => `${issue.key}: ${issue.message}`);
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    for (const versionDef of prefix.versions) {
      const layout = snapshot.layouts[prefixLayoutKey(prefixId, versionDef.version)];
      if (!layout) continue;
      if (!layout.safePrecision) {
        skipped.push(`${prefixId}@${versionDef.version}: totalSpace ${layout.totalSpace} > 2^53`);
        continue;
      }
      const map = layoutToDecodeMap(layout);
      maps.push({
        indexId: map.indexId,
        versionId: map.versionId,
        shape: [...map.shape],
        size: map.size,
        dims: map.dims.map((dim) => ({ ...dim, entries: [...dim.entries] })),
      });
    }
  }
  return { maps, skipped };
}
