/**
 * DEMO_CATALOG → DKG 자동 파생.
 *
 * Axis/Prefix/Table 노드와 composes/references 엣지를
 * 카탈로그 구조에서 결정론적으로 추출한다.
 */

import { GraphRegistry } from "./graph-registry.js";
import type { AxisNode, PrefixNode, TableNode } from "./dkg.types.js";

/**
 * 카탈로그 호환 타입.
 * demo-snapshot에 강하게 결합되지 않도록 구조만 맞춘다.
 */
export interface DeriveInput {
  readonly axes: Record<string, {
    readonly id: string;
    readonly name: string;
    readonly versions: Record<string, unknown>;
  }>;
  readonly prefixes: Record<string, {
    readonly id: string;
    readonly name: string;
    readonly labels: readonly string[];
    readonly meta?: { readonly category?: PrefixNode["category"] };
    readonly dims: Record<string, {
      readonly kind: "axis" | "prefix_ref" | "table_ref";
      readonly axisId?: string;
      readonly prefixId?: string;
      readonly table?: string;
    }>;
  }>;
  readonly tables?: Record<string, {
    readonly table: string;
    readonly columns: Record<string, {
      readonly kind: "scalar" | "prefix_ref" | "table_ref" | "axis_ref";
      readonly type?: string;
      readonly prefixId?: string;
      readonly table?: string;
      readonly axisId?: string;
    }>;
  }>;
}

/**
 * 카탈로그에서 DKG 초기 그래프를 파생한다.
 *
 * - 각 axis → AxisNode
 * - 각 prefix → PrefixNode
 * - 각 table → TableNode
 * - axis dim → composes 엣지 (dimKind: "axis")
 * - prefix_ref dim → composes 엣지 (dimKind: "prefix_ref") + references 엣지
 * - table_ref dim → composes 엣지 (dimKind: "table_ref")
 * - table column axis_ref → composes 엣지 (dimKind: "column_axis")
 * - table column prefix_ref → references 엣지
 * - table column table_ref → references 엣지 (FK)
 */
export function deriveFromCatalog(catalog: DeriveInput, graph?: GraphRegistry): GraphRegistry {
  const g = graph ?? new GraphRegistry();

  // Axis 노드
  for (const [id, axis] of Object.entries(catalog.axes)) {
    const node: AxisNode = {
      kind: "axis",
      id,
      name: axis.name,
      currentVersions: Object.keys(axis.versions),
    };
    g.addNode(node);
  }

  // Prefix 노드 + 엣지
  for (const [id, prefix] of Object.entries(catalog.prefixes)) {
    const node: PrefixNode = {
      kind: "prefix",
      id,
      name: prefix.name,
      dimLabels: [...prefix.labels],
      category: inferCategory(id, prefix),
    };
    g.addNode(node);

    for (const [label, dimRef] of Object.entries(prefix.dims)) {
      switch (dimRef.kind) {
        case "axis":
          g.addEdge("composes", id, dimRef.axisId!, { dimKind: "axis", label });
          break;

        case "prefix_ref":
          g.addEdge("composes", id, dimRef.prefixId!, { dimKind: "prefix_ref", label });
          g.addEdge("references", id, dimRef.prefixId!, { label });
          break;

        case "table_ref":
          g.addEdge("composes", id, dimRef.table!, { dimKind: "table_ref", label });
          break;
      }
    }
  }

  // Table 노드 + 컬럼 엣지
  if (catalog.tables) {
    for (const [id, tableDef] of Object.entries(catalog.tables)) {
      const tableNode: TableNode = {
        kind: "table",
        id,
        name: tableDef.table,
        columns: Object.keys(tableDef.columns),
      };
      g.addNode(tableNode);

      for (const [colName, colRef] of Object.entries(tableDef.columns)) {
        switch (colRef.kind) {
          case "axis_ref":
            // 컬럼이 축 값을 저장 → table --composes--> axis
            g.addEdge("composes", id, colRef.axisId!, { dimKind: "column_axis", column: colName });
            break;

          case "prefix_ref":
            // 컬럼이 prefix 주소를 저장 → table --references--> prefix
            g.addEdge("references", id, colRef.prefixId!, { column: colName });
            break;

          case "table_ref":
            // FK → table --references--> table
            g.addEdge("references", id, colRef.table!, { column: colName, fk: true });
            break;

          // scalar: 엣지 없음
        }
      }
    }
  }

  return g;
}

/** prefix의 schema category를 결정: meta.category 우선, 없으면 구조 추론 */
function inferCategory(
  id: string,
  prefix: DeriveInput["prefixes"][string],
): PrefixNode["category"] {
  // meta.category가 있으면 우선 사용 (DEMO_CATALOG SSOT)
  if (prefix.meta?.category) {
    return prefix.meta.category;
  }

  // fallback: 구조 기반 추론
  const dimKinds = Object.values(prefix.dims).map(d => d.kind);
  const hasTableRef = dimKinds.includes("table_ref");
  const labels = prefix.labels as readonly string[];

  if (hasTableRef || id.endsWith("_event")) return "event";
  if (labels.includes("subjectKind") || labels.includes("predicate")) return "relation";

  const observationIds = ["page_view", "endpoint", "flow_point", "pipeline_point", "data_policy"];
  if (observationIds.includes(id)) return "observation";

  if (labels.includes("role") || labels.includes("action") || id === "permission" || id === "rbac") return "policy";

  return "entity";
}
