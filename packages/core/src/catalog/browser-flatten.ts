// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * browser-flatten — Catalog → BrowserCatalog 경량 변환.
 *
 * DEMO_CATALOG → BROWSER_CATALOG 수동 동기화를 제거.
 * 각 prefix의 최신 버전만 추출하고, table_ref dim은 제외.
 */

import type { Catalog, PrefixDef, VersionedAxis } from "./catalog.types.js";

// ── Browser 타입 (viz-3d/browser-codec.ts 호환) ──────────────

export interface BrowserDimDef {
  readonly kind: "axis" | "prefix_ref";
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

// ── 변환 ──────────────────────────────────────────────────────

/**
 * Catalog를 브라우저용 경량 JSON으로 변환.
 *
 * - 각 prefix의 최신 버전만 사용
 * - table_ref dim은 제외 (브라우저에서 외부 테이블 참조 불가)
 * - axis dim은 해당 axis의 entries/capacity 인라인
 * - prefix_ref dim은 refEntries 값 인라인
 */
export function flattenForBrowser(catalog: Catalog): BrowserCatalog {
  const result: Record<string, BrowserPrefixDef> = {};

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    const flattened = flattenPrefix(prefix, catalog.axes);
    if (flattened) {
      result[prefixId] = flattened;
    }
  }

  return result;
}

function flattenPrefix(
  prefix: PrefixDef,
  axes: Record<string, VersionedAxis>,
): BrowserPrefixDef | null {
  const latestVersion = prefix.versions[prefix.versions.length - 1];
  if (!latestVersion) return null;

  const dims: Record<string, BrowserDimDef> = {};
  const labels: string[] = [];

  for (const [label, dimRef] of Object.entries(prefix.dims)) {
    switch (dimRef.kind) {
      case "axis": {
        const axis = axes[dimRef.axisId];
        if (!axis) continue;

        const axisVersion = latestVersion.axisVersions[label]
          ?? latestVersion.axisVersions[dimRef.axisId];
        if (!axisVersion) continue;

        const snapshot = axis.versions[axisVersion];
        if (!snapshot) continue;

        dims[label] = {
          kind: "axis",
          entries: snapshot.entries,
          capacity: snapshot.capacity ?? snapshot.entries.length,
        };
        labels.push(label);
        break;
      }

      case "prefix_ref": {
        const refEntries = latestVersion.refEntries?.[label];
        if (refEntries) {
          dims[label] = {
            kind: "prefix_ref",
            values: refEntries.values,
          };
          labels.push(label);
        }
        // prefix_ref without refEntries → skip (no concrete values for browser)
        break;
      }

      case "table_ref":
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
