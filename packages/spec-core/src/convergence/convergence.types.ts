/**
 * Convergence Layer 타입 정의.
 *
 * 관측 데이터(UsageData)와 DKG 그래프를 입력으로,
 * 수렴 후보(Observation)를 출력한다.
 */

// ═══════════════════════════════════════════════════════════════
//  관측 데이터 (입력)
// ═══════════════════════════════════════════════════════════════

export interface EntryUsage {
  readonly axisId: string;
  readonly entry: string;
  readonly count: number;
  readonly lastSeen: string;
}

export interface AddressUsage {
  readonly prefix: string;
  readonly version: string;
  readonly address: number;
  readonly count: number;
}

export interface CoOccurrence {
  readonly sourcePrefix: string;
  readonly sourceEntry: string;
  readonly targetPrefix: string;
  readonly targetEntry: string;
  readonly count: number;
  readonly totalSourceCount: number;
}

/** prefix:version별 실제 사용량 — 배포 상태 추적의 근거 */
export interface VersionUsage {
  readonly prefix: string;
  readonly version: string;
  readonly count: number;
  readonly lastSeen: string;
  /** 이 version을 사용한 session ID 목록 (= 서비스/소비자 식별) */
  readonly sessions: readonly string[];
}

export interface UsageData {
  readonly entryUsages: readonly EntryUsage[];
  readonly addressUsages: readonly AddressUsage[];
  readonly coOccurrences: readonly CoOccurrence[];
  readonly collectionPeriod: { readonly from: string; readonly to: string };
  /** prefix:version별 실제 사용량 — 배포 상태 사실 기반 */
  readonly versionUsages: readonly VersionUsage[];
  /** 수집 통계 — 식별자별 카운트 */
  readonly sourceStats?: {
    readonly totalRecords: number;
    readonly uniqueTraces: number;
    readonly uniqueSessions: number;
    readonly uniqueEventKeys: number;
    readonly traceIds: readonly string[];
    readonly sessionIds: readonly string[];
    readonly eventKeys: readonly string[];
    /** 실행 모드별 레코드 수 */
    readonly byExecutionMode: Record<string, number>;
    /** 실행 ID별 레코드 수 */
    readonly byExecutionId: Record<string, number>;
  };
}

// ═══════════════════════════════════════════════════════════════
//  수집 건전성 (Collection Health)
// ═══════════════════════════════════════════════════════════════

/** 고아 주소 — 카탈로그에 없는 prefix를 참조하는 레코드 */
export interface OrphanAddress {
  readonly prefixId: string;
  readonly serialized: string;
  readonly count: number;
  readonly reason: "unknown-prefix" | "unknown-version" | "decode-failed";
}

/** 구버전 사용 — 최신이 아닌 버전을 사용하는 레코드 */
export interface StaleVersionUsage {
  readonly prefixId: string;
  readonly usedVersion: string;
  readonly latestVersion: string;
  readonly count: number;
  readonly versionGap: number;
}

/** 수집 건전성 리포트 */
export interface CollectionHealthReport {
  /** 분석한 총 주소 수 */
  readonly totalAddresses: number;
  /** 정상 주소 수 */
  readonly validAddresses: number;
  /** 고아 주소 (카탈로그에 없는 prefix/version) */
  readonly orphans: readonly OrphanAddress[];
  /** 구버전 사용 (최신이 아닌 version) */
  readonly staleVersions: readonly StaleVersionUsage[];
  /** 건전성 비율 (0~1) */
  readonly healthRate: number;
  /** 요약 */
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════
//  심볼 비교
// ═══════════════════════════════════════════════════════════════

export interface AxisOverlap {
  readonly a: string;
  readonly b: string;
  readonly sharedEntries: readonly string[];
  readonly aOnly: readonly string[];
  readonly bOnly: readonly string[];
  readonly overlapRatio: number;
  readonly recommendation: "merge" | "alias" | "keep-separate" | "review";
  readonly reason: string;
}

export interface PrefixOverlap {
  readonly a: string;
  readonly b: string;
  readonly sharedAxes: readonly string[];
  readonly sharedRefs: readonly string[];
  readonly structuralSimilarity: number;
  readonly recommendation: "merge" | "split" | "keep-separate" | "review";
  readonly reason: string;
}

// ═══════════════════════════════════════════════════════════════
//  결정 비교
// ═══════════════════════════════════════════════════════════════

export interface DecisionConflict {
  readonly a: string;
  readonly b: string;
  readonly sharedTargets: readonly string[];
  readonly conflict: "contradictory" | "redundant" | "superseding" | "compatible";
  readonly resolution: string;
}

// ═══════════════════════════════════════════════════════════════
//  인과 발견
// ═══════════════════════════════════════════════════════════════

export interface CausalCandidate {
  readonly source: { readonly prefix: string; readonly entry: string };
  readonly target: { readonly prefix: string; readonly entry: string };
  readonly coOccurrenceRate: number;
  readonly observedCount: number;
  readonly confidence: "high" | "medium" | "low";
  readonly suggestion: "intent-link" | "constraint" | "observe-more";
}

// ═══════════════════════════════════════════════════════════════
//  최소 가짓수
// ═══════════════════════════════════════════════════════════════

export interface SimplificationCandidate {
  readonly prefix: string;
  readonly addressSpaceSize: number;
  readonly activeAddressCount: number;
  readonly utilizationRate: number;
  readonly singleValueDims: readonly { readonly dim: string; readonly value: string }[];
  readonly lowUsageEntries: readonly { readonly axis: string; readonly entry: string; readonly usageRate: number }[];
  readonly suggestions: readonly SimplificationSuggestion[];
}

export type SimplificationSuggestion =
  | { readonly kind: "remove-dim"; readonly dim: string; readonly reason: string }
  | { readonly kind: "deactivate-entry"; readonly axis: string; readonly entry: string; readonly reason: string }
  | { readonly kind: "split-prefix"; readonly newPrefixes: readonly string[]; readonly reason: string }
  | { readonly kind: "ok"; readonly reason: string };

// ═══════════════════════════════════════════════════════════════
//  경계 추천
// ═══════════════════════════════════════════════════════════════

export interface BoundaryRecommendation {
  readonly reason: string;
  readonly suggestedDomain: string | null;
  readonly suggestedDims: readonly string[];
  readonly relatedPrefixes: readonly {
    readonly id: string;
    readonly relation: "extends" | "splits-from" | "independent";
  }[];
  readonly estimatedCapacity: number;
  readonly confidence: "high" | "medium" | "low";
}
