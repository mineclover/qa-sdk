// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * browser-flatten — Catalog → BrowserCatalog 경량 변환.
 *
 * DEMO_CATALOG → BROWSER_CATALOG 수동 동기화를 제거.
 * 각 prefix의 최신 버전만 추출하고, table_ref dim은 제외.
 */

import type { Catalog, PrefixDef, PrefixVersionDef, VersionedAxis } from './catalog.types.js';
import { latestPrefixVersion } from './runtime.js';
import { LEGACY_V1_CODEC } from './snapshot/catalog-snapshot.types.js';
import { computeCatalogDigest } from './snapshot/digest.js';

// ── Browser 타입 (viz-3d/browser-codec.ts 호환) ──────────────

export interface BrowserDimDef {
  readonly kind: 'axis' | 'prefix_ref';
  readonly entries?: readonly string[];
  readonly capacity?: number;
  readonly values?: readonly number[];
}

export interface BrowserPrefixDef {
  readonly version: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, BrowserDimDef>;
}

export type BrowserCatalog = Record<string, BrowserPrefixDef>;

/**
 * BrowserCatalog가 어느 Catalog에서 파생됐는지 나타내는 문맥.
 * CatalogSnapshotWire와 필드 호환 (snapshot_version 없음 — 브라우저 카탈로그는 snapshot 저장소를 거치지 않는다).
 */
export interface BrowserCatalogSnapshot {
  readonly catalog_id: string;
  /** computeCatalogDigest 결과 (`sha256:<64 hex>`) */
  readonly digest: string;
  readonly codec_version: string;
}

// ── 변환 ──────────────────────────────────────────────────────

/**
 * Catalog를 브라우저용 경량 JSON으로 변환.
 *
 * - 각 prefix의 최신 버전(latestPrefixVersion)만 사용, 차원 순서는 그 버전의 labels
 * - table_ref dim은 제외 (브라우저에서 외부 테이블 참조 불가)
 * - axis dim은 해당 axis의 entries/capacity 인라인
 * - prefix_ref dim은 refEntries 값 인라인
 */
export function flattenForBrowser(catalog: Catalog): BrowserCatalog {
  const result: Record<string, BrowserPrefixDef> = {};

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    const latestKey = latestPrefixVersion(catalog, prefixId);
    const latestVersion = prefix.versions.find((v) => v.version === latestKey);
    if (!latestVersion) continue;
    const flattened = flattenPrefix(prefix, latestVersion, catalog.axes);
    if (flattened) {
      result[prefixId] = flattened;
    }
  }

  return result;
}

/** BrowserCatalog 생성물에 함께 기록할 Catalog 문맥 (digest·codec 버전) */
export async function browserCatalogSnapshotOf(catalog: Catalog): Promise<BrowserCatalogSnapshot> {
  return {
    catalog_id: catalog.id,
    digest: await computeCatalogDigest(catalog),
    codec_version: LEGACY_V1_CODEC,
  };
}

function flattenPrefix(
  prefix: PrefixDef,
  latestVersion: PrefixVersionDef,
  axes: Record<string, VersionedAxis>,
): BrowserPrefixDef | null {
  const dims: Record<string, BrowserDimDef> = {};
  const labels: string[] = [];

  // 버전별 dim 목록(D-8) 순서 = runtime encode 순서
  for (const label of latestVersion.labels ?? prefix.labels) {
    const dimRef = prefix.dims[label];
    if (!dimRef) {
      throw new Error(`Unknown dim label in ${prefix.id}@${latestVersion.version}: ${label}`);
    }
    switch (dimRef.kind) {
      case 'axis': {
        const axis = axes[dimRef.axisId];
        if (!axis) continue;

        const axisVersion =
          latestVersion.axisVersions[label] ?? latestVersion.axisVersions[dimRef.axisId];
        if (!axisVersion) continue;

        const snapshot = axis.versions[axisVersion];
        if (!snapshot) continue;

        dims[label] = {
          kind: 'axis',
          entries: snapshot.entries,
          capacity: snapshot.capacity ?? snapshot.entries.length,
        };
        labels.push(label);
        break;
      }

      case 'prefix_ref': {
        const refEntries = latestVersion.refEntries?.[label];
        if (refEntries) {
          dims[label] = {
            kind: 'prefix_ref',
            values: refEntries.values,
          };
          labels.push(label);
        }
        // prefix_ref without refEntries → skip (no concrete values for browser)
        break;
      }

      case 'table_ref':
        // table_ref는 브라우저에서 사용 불가 → 제외
        break;
    }
  }

  // dim이 없으면 이 prefix는 브라우저에서 encode/decode 불가
  if (Object.keys(dims).length === 0) return null;

  return {
    version: latestVersion.version,
    labels,
    dims,
  };
}
