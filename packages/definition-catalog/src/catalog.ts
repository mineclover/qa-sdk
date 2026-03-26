/**
 * 소프트웨어 정의 카탈로그 (Definition Catalog)
 *
 * 5개 축 + 2개 prefix로 구성된 좌표 기반 카탈로그.
 * DEMO_CATALOG과 동일한 구조를 따른다 (axes + prefixes).
 *
 * prefix:
 *   def_document — 문서 메타데이터 좌표 (scope × aspect × depth × lifecycle)
 *   def_link     — 정의 간 관계 좌표 (scope × aspect × link_type)
 */

import type { VersionedAxis } from "./vocabulary.js";
import { DEFINITION_AXES } from "./vocabulary.js";

// ─── 카탈로그 타입 ───────────────────────────────────────

/** DimRef — 차원 참조 (axis kind만 사용) */
export interface DimRef {
  readonly kind: "axis";
  readonly axisId: string;
}

/** PrefixVersionDef — prefix 버전 정의 */
export interface PrefixVersionDef {
  readonly version: string;
  readonly axisVersions: Record<string, string>;
}

/** PrefixMeta — prefix 메타데이터 */
export interface PrefixMeta {
  readonly category: "entity" | "relation";
  readonly layer: number;
}

/** PrefixDef — prefix 정의 */
export interface PrefixDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly dims: Record<string, DimRef>;
  readonly versions: readonly PrefixVersionDef[];
  readonly meta: PrefixMeta;
}

/** DefinitionCatalog — 전체 카탈로그 */
export interface DefinitionCatalog {
  readonly id: string;
  readonly axes: Record<string, VersionedAxis>;
  readonly prefixes: Record<string, PrefixDef>;
}

// ─── 카탈로그 정의 ───────────────────────────────────────

/**
 * DEFINITION_CATALOG — 소프트웨어 정의 메타데이터 카탈로그.
 *
 * axes: def_scope(16), def_aspect(64, 22 entries), def_depth(8), def_lifecycle(16), link_type(16)
 *
 * prefixes:
 *   def_document: scope(16) × aspect(64) × depth(8) = 8,192  (lifecycle은 메타데이터)
 *   def_link:     scope(16) × aspect(64) × link_type(16) = 16,384
 *
 * data scope에 prefix_schema, axis_catalog aspect 포함 → prefix 정의 문서도 좌표 관리
 */
export const DEFINITION_CATALOG: DefinitionCatalog = {
  id: "definition",
  axes: DEFINITION_AXES,
  prefixes: {
    def_document: {
      id: "def_document",
      name: "정의 문서",
      description: "소프트웨어 정의 문서의 불변 정체성 좌표 (lifecycle은 메타데이터)",
      labels: ["def_scope", "def_aspect", "def_depth"],
      dims: {
        def_scope: { kind: "axis", axisId: "def_scope" },
        def_aspect: { kind: "axis", axisId: "def_aspect" },
        def_depth: { kind: "axis", axisId: "def_depth" },
      },
      versions: [{
        version: "v1",
        axisVersions: {
          def_scope: "v1",
          def_aspect: "v1",
          def_depth: "v1",
        },
      }],
      meta: { category: "entity", layer: 1 },
    },

    def_link: {
      id: "def_link",
      name: "정의 관계",
      description: "정의 간 관계의 좌표 (출발 문서의 scope × aspect × 관계 유형)",
      labels: ["def_scope", "def_aspect", "link_type"],
      dims: {
        def_scope: { kind: "axis", axisId: "def_scope" },
        def_aspect: { kind: "axis", axisId: "def_aspect" },
        link_type: { kind: "axis", axisId: "link_type" },
      },
      versions: [{
        version: "v1",
        axisVersions: {
          def_scope: "v1",
          def_aspect: "v1",
          link_type: "v1",
        },
      }],
      meta: { category: "relation", layer: 1 },
    },
  },
};
