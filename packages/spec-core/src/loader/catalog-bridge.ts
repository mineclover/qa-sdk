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
import type { SchemaCategory } from "../schema/schema.types.js";

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
  readonly dims: Record<string, CatalogDimRef>;
  readonly versions: readonly { readonly version: string }[];
}

export type CatalogDimRef =
  | { readonly kind: "axis"; readonly axisId: string }
  | { readonly kind: "prefix_ref"; readonly prefixId: string }
  | { readonly kind: "table_ref"; readonly table: string };

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
        imports[label] = dimRef.prefixId;
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

  const category = inferSchemaCategory(prefix);

  return {
    id: prefix.id,
    version: latestVersion?.version ?? "v1",
    dims,
    export: exportSurface,
    imports: Object.keys(imports).length > 0 ? imports : undefined,
    schema: { category },
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

/**
 * prefix의 구조를 보고 schema category를 자동 추론한다.
 *
 * 판정 기준:
 * - table_ref 있음 + *_action/*_op axis → event
 * - subjectKind/predicate/objectKind → relation
 * - *_ref(prefix_ref) + 관측 축 → observation
 * - role/action/resource → policy
 * - 나머지 → entity
 */
function inferSchemaCategory(prefix: CatalogPrefix): SchemaCategory {
  const dimKinds = Object.values(prefix.dims).map(d => d.kind);
  const hasTableRef = dimKinds.includes("table_ref");
  const labels = prefix.labels;
  const id = prefix.id;

  // event: table_ref가 있거나 이름에 _event가 포함
  if (hasTableRef || id.endsWith("_event")) return "event";

  // relation: subjectKind/predicate/objectKind 패턴
  if (labels.includes("subjectKind") || labels.includes("predicate")) return "relation";

  // observation: 관측 포인트 prefix (page_view, endpoint, flow_point, pipeline_point 등)
  const observationIds = ["page_view", "endpoint", "flow_point", "pipeline_point", "data_policy"];
  if (observationIds.includes(id)) return "observation";

  // policy: 권한/접근 제어
  if (labels.includes("role") || labels.includes("action") || id === "permission" || id === "rbac") return "policy";

  // state: 상태 관련 (향후 확장)

  // 기본: entity
  return "entity";
}

function convertDimRef(raw: CatalogDimRef): DimRef {
  switch (raw.kind) {
    case "axis":
      return { kind: "axis", axisId: raw.axisId };
    case "prefix_ref":
      return { kind: "prefix_ref", prefixId: raw.prefixId };
    case "table_ref":
      return { kind: "table_ref", table: raw.table };
  }
}

// ═══════════════════════════════════════════════════════════════
//  catalogToSchemaSnapshot — registry-service import 형식 변환
// ═══════════════════════════════════════════════════════════════

/** SchemaSnapshot 호환 타입 (registry-service에서 import하는 형식) */
export interface SchemaSnapshotOutput {
  readonly id: string;
  readonly axes: readonly { readonly id: string; readonly entries: readonly string[]; readonly capacity: number }[];
  readonly composites: readonly { readonly id: string; readonly dims: readonly string[]; readonly owner: string }[];
}

/** CatalogInput (axis 정보 포함) */
export interface FullCatalogInput extends CatalogInput {
  readonly axes: Record<string, {
    readonly id: string;
    readonly name: string;
    readonly versions: Record<string, { readonly entries?: readonly string[]; readonly capacity?: number }>;
  }>;
}

/**
 * 카탈로그를 SchemaSnapshot 형식으로 변환한다.
 * registry-service의 POST /schema/import에 전달 가능.
 */
export function catalogToSchemaSnapshot(
  catalog: FullCatalogInput,
  options?: { id?: string },
): SchemaSnapshotOutput {
  const id = options?.id ?? "demo";

  // axes: 각 축의 최신 버전 entries + capacity
  const axes: SchemaSnapshotOutput["axes"][number][] = [];
  for (const [axisId, axis] of Object.entries(catalog.axes)) {
    const versions = Object.keys(axis.versions);
    const latestKey = versions[versions.length - 1];
    const latest = axis.versions[latestKey];
    if (!latest) continue;
    axes.push({
      id: axisId,
      entries: [...(latest.entries ?? [])],
      capacity: latest.capacity ?? (latest.entries?.length ?? 0),
    });
  }

  // composites: prefix → { id, dims (axis dim만), owner }
  const composites: SchemaSnapshotOutput["composites"][number][] = [];
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    const dims = prefix.labels.filter(label => {
      const dim = prefix.dims[label];
      return dim?.kind === "axis";
    });
    composites.push({
      id: prefixId,
      dims,
      owner: "catalog",
    });
  }

  return { id, axes, composites };
}
