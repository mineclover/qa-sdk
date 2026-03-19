/**
 * DEMO_CATALOG → PrefixSpec[] 변환 브릿지.
 *
 * indexing 레이어의 PrefixDef에서 spec-engine의 PrefixSpec으로 자동 변환.
 * export surface를 자동 추론한다:
 *   - axis dims → export에 포함 (고정 enum, 좌표에 인코딩됨)
 *   - prefix_ref dims → export에 포함 (참조 주소, 좌표에 인코딩됨)
 *   - table_ref dims → export에서 제외 (런타임 데이터, 좌표에 인코딩 안 됨)
 */

import type { DimRef, PrefixSpec } from "../spec/prefix-spec.types.js";
import type { ExportSurface } from "../export-surface/export-surface.types.js";

/**
 * DemoCatalog 호환 타입.
 * demo-snapshot의 DemoCatalog를 직접 import하지 않고 구조만 맞춘다.
 * → spec-core가 demo-snapshot에 강하게 결합되지 않도록.
 */
export interface CatalogInput {
  readonly prefixes: Record<string, CatalogPrefix>;
}

export interface CatalogPrefix {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, { readonly kind: "axis" | "prefix_ref" | "table_ref"; readonly [key: string]: unknown }>;
  readonly versions: readonly { readonly version: string }[];
}

/**
 * 카탈로그의 모든 prefix를 PrefixSpec으로 변환한다.
 *
 * @param catalog - DemoCatalog 호환 객체
 * @returns PrefixSpec 배열
 */
export function catalogToPrefixSpecs(catalog: CatalogInput): PrefixSpec[] {
  return Object.values(catalog.prefixes).map(prefix =>
    prefixToPrefixSpec(prefix),
  );
}

/**
 * 단일 prefix를 PrefixSpec으로 변환한다.
 */
export function prefixToPrefixSpec(prefix: CatalogPrefix): PrefixSpec {
  const exportDims: string[] = [];
  const imports: Record<string, string> = {};
  const dims: Record<string, DimRef> = {};

  for (const [label, dimRef] of Object.entries(prefix.dims)) {
    // DimRef 변환
    dims[label] = convertDimRef(dimRef);

    switch (dimRef.kind) {
      case "axis":
        exportDims.push(label);
        break;
      case "prefix_ref":
        exportDims.push(label);
        imports[label] = (dimRef as unknown as { prefixId: string }).prefixId;
        break;
      case "table_ref":
        // export에서 제외 — 런타임 데이터, 좌표에 인코딩 안 됨
        break;
    }
  }

  // labels 순서를 유지하면서 export dims만 필터
  const orderedExportDims = prefix.labels.filter(l => exportDims.includes(l));

  const exportSurface = inferExportSurface(orderedExportDims);
  const latestVersion = prefix.versions[prefix.versions.length - 1];

  return {
    id: prefix.id,
    version: latestVersion?.version ?? "v1",
    dims,
    export: exportSurface,
    imports: Object.keys(imports).length > 0 ? imports : undefined,
    rationale: prefix.description,
  };
}

/**
 * export surface를 자동 추론한다.
 * 기본 패턴: axis/prefix_ref dims를 "." 으로 연결.
 */
function inferExportSurface(dims: readonly string[]): ExportSurface {
  return {
    dims,
    pattern: dims.map(d => `{${d}}`).join("."),
  };
}

function convertDimRef(raw: { readonly kind: string; readonly [key: string]: unknown }): DimRef {
  switch (raw.kind) {
    case "axis":
      return { kind: "axis", axisId: raw.axisId as string };
    case "prefix_ref":
      return { kind: "prefix_ref", prefixId: raw.prefixId as string };
    case "table_ref":
      return { kind: "table_ref", table: raw.table as string };
    default:
      throw new Error(`Unknown DimRef kind: ${raw.kind}`);
  }
}
