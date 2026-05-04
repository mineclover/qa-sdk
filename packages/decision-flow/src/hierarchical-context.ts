// @def.boundary df-narrative-group
/**
 * 계층적 컨텍스트 조합 (Hierarchical Context Assembly)
 *
 * decision-flow의 아키텍처 역할:
 * 시스템 구조(catalog/DKG/spec-core)의 조합으로 완성된 맥락을 정의하는 레이어.
 *
 * prefix에 대한 정보는 단일 레벨이 아니라 5개 레벨에 걸쳐 존재:
 *
 * Domain (shopping-domain)       → 공유 축, 경계, 소속 prefix 목록
 * DSL Bundle (dsl-checkout)      → 파이프라인 순서, fixedDims, invariants
 * Category (event)               → 구조 규칙, 검증 함수
 * Prefix (cart_event)            → dims, capacity, gate 상태, 의사결정 이력
 * Dim/Entry (action:add_to_cart) → 엔트리 목록, headroom, stride
 *
 * 이 모듈이 5개 레벨을 수직으로 관통하면서 정제된 맥락을 조합한다.
 */

// ─── 계층 입력 타입 (시스템 구조에서 추출) ────────────────

/** Domain 레벨 — 소속 prefix + 공유 축 + 경계 */
export interface DomainInfo {
  readonly id: string;
  readonly name: string;
  readonly prefixes: readonly string[];
  readonly sharedAxes: readonly string[];
  readonly boundary: {
    readonly exports: readonly string[];
    readonly internal: readonly string[];
  };
}

/** DSL Bundle 레벨 — 파이프라인 멤버 + 고정 차원 + 불변조건 */
export interface DslBundleInfo {
  readonly id: string;
  readonly name: string;
  readonly memberPrefixes: readonly string[];
  readonly fixedDims: readonly string[];
  readonly invariants: readonly string[];
}

/** Prefix 레벨 — 차원 구성 + 메타데이터 */
export interface PrefixInfo {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly dims: readonly { label: string; kind: string; ref: string }[];
  readonly totalSpace?: number;
}

/** Dim/Entry 레벨 — 엔트리 목록 + capacity/headroom */
export interface DimInfo {
  readonly axisId: string;
  readonly entries: readonly string[];
  readonly capacity: number;
  readonly headroom: number;
}

/** prefix_ref 해석 결과 — 참조된 prefix의 차원 체인 */
export interface PrefixRefChain {
  readonly dimLabel: string;
  readonly referencedPrefixId: string;
  readonly referencedPrefix?: PrefixInfo;
  readonly resolvedDims: readonly DimInfo[];
}

/** table_ref 해석 결과 — 참조된 테이블의 컬럼 구조 */
export interface TableRefInfo {
  readonly dimLabel: string;
  readonly table: string;
  readonly columns: readonly TableColumnInfo[];
}

/** 테이블 컬럼 정보 */
export interface TableColumnInfo {
  readonly name: string;
  readonly kind: string;   // "scalar" | "axis_ref" | "prefix_ref" | "table_ref"
  readonly ref?: string;   // axisId, prefixId, or table name
}

/** IntentLink 정보 — 이 prefix와 함께 관측되는 prefix들 */
export interface IntentLinkInfo {
  readonly id: string;
  readonly endpoints: readonly string[];
  readonly via: string;
  readonly intent: string;
  readonly invariant?: string;
}

/** 테이블 스키마 (catalog.tables에서 추출) */
export interface TableSchema {
  readonly table: string;
  readonly columns: Record<string, { kind: string; type?: string; axisId?: string; prefixId?: string; table?: string }>;
}

// ─── 조합된 계층 컨텍스트 ────────────────────────────────

/**
 * 5개 레벨에서 조합된 정제 맥락.
 *
 * "cart_event에 대한 결정을 해야 한다" → 이 구조체가 한 번에 제공됨.
 * 사람은 이걸 읽으면 어떤 도메인에 속하고, 어떤 DSL의 일부이고,
 * 어떤 차원이 있고, 각 차원의 여유는 얼마인지 한눈에 파악할 수 있다.
 */
export interface HierarchicalContext {
  /** 대상 prefix */
  readonly prefixId: string;

  /** Level 1: 소속 도메인 */
  readonly domain?: DomainInfo;
  /** Level 2: 소속 DSL 번들 (복수 가능) */
  readonly dslBundles: readonly DslBundleInfo[];
  /** Level 3: prefix 자체 정보 */
  readonly prefix?: PrefixInfo;
  /** Level 4-5: 차원별 엔트리 + headroom (axis kind만) */
  readonly dimensions: readonly DimInfo[];

  /** 조합된 제약 — 이 prefix에 적용되는 모든 불변조건/경계/규칙 */
  readonly constraints: readonly string[];
  /** 조합된 공유 축 — 도메인 + DSL에서 공유하는 축 */
  readonly sharedAxes: readonly string[];
  /** 요약 — 사람이 읽을 수 있는 한 줄 */
  readonly summary: string;
}

// ─── 조합기 ─────────────────────────────────────────────

/** 계층 데이터 소스 */
export interface HierarchySource {
  readonly domains: readonly DomainInfo[];
  readonly dslBundles: readonly DslBundleInfo[];
  readonly prefixes: ReadonlyMap<string, PrefixInfo>;
  readonly axes: ReadonlyMap<string, DimInfo>;
}

/**
 * 5개 레벨을 수직으로 관통하여 정제된 맥락을 조합한다.
 *
 * @param prefixId — 맥락을 조합할 대상 prefix
 * @param source — 시스템 구조 데이터 소스 (catalog, DKG에서 추출)
 */
export function assembleHierarchicalContext(
  prefixId: string,
  source: HierarchySource,
): HierarchicalContext {
  // Level 1: 소속 도메인 검색
  const domain = source.domains.find((d) => d.prefixes.includes(prefixId));

  // Level 2: 소속 DSL 번들 검색 (복수 가능)
  const dslBundles = source.dslBundles.filter((b) => b.memberPrefixes.includes(prefixId));

  // Level 3: prefix 자체
  const prefix = source.prefixes.get(prefixId);

  // Level 4-5: 차원별 정보
  const dimensions: DimInfo[] = [];
  if (prefix) {
    for (const dim of prefix.dims) {
      if (dim.kind === "axis") {
        const axisInfo = source.axes.get(dim.ref);
        if (axisInfo) dimensions.push(axisInfo);
      }
    }
  }

  // 제약 조합: 도메인 경계 + DSL 불변조건
  const constraints: string[] = [];
  if (domain) {
    if (domain.boundary.exports.length > 0) {
      constraints.push(`도메인 경계: exports=[${domain.boundary.exports.join(", ")}]`);
    }
    if (domain.boundary.internal.length > 0) {
      constraints.push(`도메인 내부: internal=[${domain.boundary.internal.join(", ")}]`);
    }
  }
  for (const bundle of dslBundles) {
    for (const inv of bundle.invariants) {
      constraints.push(`DSL ${bundle.id}: ${inv}`);
    }
  }

  // headroom 경고
  for (const dim of dimensions) {
    if (dim.headroom <= 1) {
      constraints.push(`⚠ ${dim.axisId}: headroom=${dim.headroom} (capacity=${dim.capacity}, entries=${dim.entries.length})`);
    }
  }

  // 공유 축 조합
  const sharedAxesSet = new Set<string>();
  if (domain) for (const ax of domain.sharedAxes) sharedAxesSet.add(ax);
  for (const bundle of dslBundles) {
    for (const fd of bundle.fixedDims) sharedAxesSet.add(fd);
  }
  const sharedAxes = [...sharedAxesSet].toSorted();

  // 요약
  const parts: string[] = [];
  parts.push(`${prefixId}`);
  if (domain) parts.push(`도메인:${domain.id}`);
  if (dslBundles.length > 0) parts.push(`DSL:[${dslBundles.map((b) => b.id).join(",")}]`);
  if (prefix) parts.push(`${prefix.dims.length}차원`);
  if (dimensions.length > 0) {
    const totalHeadroom = dimensions.reduce((s, d) => s + d.headroom, 0);
    parts.push(`총headroom:${totalHeadroom}`);
  }

  return {
    prefixId,
    domain,
    dslBundles,
    prefix,
    dimensions,
    constraints,
    sharedAxes,
    summary: parts.join(" | "),
  };
}

/**
 * 여러 prefix의 계층 컨텍스트를 한 번에 조합한다.
 * 결정에 관련된 prefix가 여러 개일 때 사용.
 */
export function assembleMultiPrefixContext(
  prefixIds: readonly string[],
  source: HierarchySource,
): readonly HierarchicalContext[] {
  return prefixIds.map((id) => assembleHierarchicalContext(id, source));
}
