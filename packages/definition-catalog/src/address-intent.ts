/**
 * 주소 의도 + 소비율 (Address Intent & Consumption)
 *
 * prefix 내 개별 주소가 아닌 **차원 값 슬라이스** 단위로 의도를 저장한다.
 * 개별 주소(정수)에 의도를 붙이면 수백만 건이 되지만,
 * 차원 값 조합으로 잡으면 의미 있는 단위로 관리할 수 있다.
 *
 * 예: page_view prefix에서
 *   { page: "checkout" } → "결제 흐름 전환율 관측"
 *   { page: "checkout", locale: "ko" } → "한국어 결제 UX 품질 지표"
 *
 * 소비율은 전체 주소 공간 중 실제 관측된 주소의 비율.
 * prefix/차원/값 단위로 집계한다.
 */

// ─── 주소 슬라이스 의도 ──────────────────────────────────

/**
 * 차원 값 슬라이스.
 *
 * prefix의 차원 중 일부를 고정하고 나머지는 와일드카드로 둔다.
 * 고정된 차원이 많을수록 더 좁은 주소 범위를 지정한다.
 *
 * 예:
 *   {} → prefix 전체 (가장 넓음)
 *   { page: "checkout" } → page=checkout인 모든 주소
 *   { page: "checkout", locale: "ko" } → page=checkout ∧ locale=ko (더 좁음)
 */
export type DimSlice = Record<string, string>;

/**
 * 슬라이스 의도 1건.
 *
 * 특정 차원 값 조합에 대한 의도/목적/관측 목표.
 * 코드에서 파생할 수 없는 "왜 이 주소 범위를 관측하는가"를 기록한다.
 */
export interface SliceIntent {
  /** 대상 prefix ID */
  readonly prefixId: string;
  /** 차원 값 필터 — 지정한 차원만 고정, 나머지는 와일드카드 */
  readonly slice: DimSlice;
  /** 이 주소 범위의 의도 */
  readonly intent: string;
  /** 관측 목적 (선택) — 어떤 지표/판단을 위해 관측하는가 */
  readonly observationGoal?: string;
  /** 비즈니스 소유자 (선택) — 누가 이 관측을 요청했는가 */
  readonly owner?: string;
}

/**
 * 슬라이스 깊이 = 고정된 차원 수.
 * 0이면 prefix 전체, dims.length이면 단일 주소.
 */
export function sliceDepth(slice: DimSlice): number {
  return Object.keys(slice).length;
}

/**
 * 슬라이스 A가 슬라이스 B를 포함하는지 (A가 더 넓은 범위인지).
 *
 * A={page:"checkout"}는 B={page:"checkout", locale:"ko"}를 포함한다.
 * 포함 관계가 있으면 의도가 상속된다 (넓은 의도 → 좁은 의도로 구체화).
 */
export function sliceContains(broader: DimSlice, narrower: DimSlice): boolean {
  for (const [dim, value] of Object.entries(broader)) {
    if (narrower[dim] !== value) return false;
  }
  return true;
}

/**
 * 특정 주소(차원 값 전체 지정)에 적용되는 의도 목록을 찾는다.
 * 넓은 슬라이스부터 좁은 슬라이스 순으로 반환한다 (상속 체인).
 */
export function resolveIntents(
  address: DimSlice,
  intents: readonly SliceIntent[],
): readonly SliceIntent[] {
  return intents
    .filter(i => sliceContains(i.slice, address))
    .toSorted((a, b) => sliceDepth(a.slice) - sliceDepth(b.slice));
}

// ─── 주소 소비율 ────────────────────────────────────────

/**
 * 차원별 소비 통계.
 */
export interface DimConsumption {
  /** 축 ID */
  readonly axisId: string;
  /** 축 전체 entries 수 */
  readonly totalEntries: number;
  /** 관측된 유니크 entry 수 */
  readonly observedEntries: number;
  /** 소비율 (observed / total) */
  readonly rate: number;
  /** 가장 많이 관측된 entry 상위 N개 (선택) */
  readonly topEntries?: readonly { readonly entry: string; readonly count: number }[];
}

/**
 * prefix 주소 소비 통계.
 *
 * 전체 주소 공간 중 실제 관측된 주소의 비율.
 * 소비율이 낮으면 주소 공간이 과도하게 크거나 prefix 설계를 재검토할 필요가 있다.
 * 소비율이 높으면 headroom 부족 → capacity 확장을 검토해야 한다.
 */
export interface PrefixConsumption {
  /** prefix ID */
  readonly prefixId: string;
  /** prefix 버전 */
  readonly version: string;
  /** 수집 시점 (ISO-8601) */
  readonly collectedAt: string;
  /** 전체 주소 공간 크기 */
  readonly totalSpace: number;
  /** 관측된 유니크 주소 수 */
  readonly observedAddresses: number;
  /** 전체 소비율 (observed / total) */
  readonly consumptionRate: number;
  /** 차원별 소비 */
  readonly byDimension: Record<string, DimConsumption>;
}

/**
 * 소비율을 계산한다.
 *
 * @param totalSpace 전체 주소 공간 크기
 * @param observedAddresses 관측된 유니크 주소 수
 * @param dimStats 차원별 { axisId, totalEntries, observedEntries, topEntries? }
 */
export function computeConsumption(
  prefixId: string,
  version: string,
  totalSpace: number,
  observedAddresses: number,
  dimStats: readonly { axisId: string; totalEntries: number; observedEntries: number; topEntries?: readonly { entry: string; count: number }[] }[],
): PrefixConsumption {
  const byDimension: Record<string, DimConsumption> = {};
  for (const d of dimStats) {
    byDimension[d.axisId] = {
      axisId: d.axisId,
      totalEntries: d.totalEntries,
      observedEntries: d.observedEntries,
      rate: d.totalEntries > 0 ? d.observedEntries / d.totalEntries : 0,
      topEntries: d.topEntries,
    };
  }

  return {
    prefixId,
    version,
    collectedAt: new Date().toISOString(),
    totalSpace,
    observedAddresses,
    consumptionRate: totalSpace > 0 ? observedAddresses / totalSpace : 0,
    byDimension,
  };
}

// ─── 소비율 진단 ────────────────────────────────────────

/** 소비율 진단 수준 */
export type ConsumptionSeverity = "healthy" | "underused" | "crowded" | "critical";

/** 소비율 진단 결과 */
export interface ConsumptionDiagnosis {
  readonly prefixId: string;
  readonly severity: ConsumptionSeverity;
  readonly message: string;
  /** 문제 있는 차원 (있으면) */
  readonly flaggedDims: readonly string[];
}

/**
 * 소비율을 진단한다.
 *
 * - < 1%: underused — 주소 공간이 과도하게 크거나 prefix가 거의 사용되지 않음
 * - 1~70%: healthy — 정상 운영
 * - 70~90%: crowded — headroom 부족 경고
 * - > 90%: critical — capacity 확장 필요
 *
 * 차원별로도 진단: 특정 차원만 90% 이상이면 해당 축 확장 필요.
 */
export function diagnoseConsumption(consumption: PrefixConsumption): ConsumptionDiagnosis {
  const rate = consumption.consumptionRate;
  const flaggedDims: string[] = [];

  // 차원별 진단
  for (const [dimName, dim] of Object.entries(consumption.byDimension)) {
    if (dim.rate > 0.9) flaggedDims.push(dimName);
  }

  if (rate > 0.9 || flaggedDims.length > 0) {
    return {
      prefixId: consumption.prefixId,
      severity: "critical",
      message: rate > 0.9
        ? `전체 소비율 ${(rate * 100).toFixed(1)}% — capacity 확장 필요`
        : `차원 ${flaggedDims.join(", ")} 소비율 90% 초과 — 해당 축 확장 필요`,
      flaggedDims,
    };
  }

  if (rate > 0.7) {
    return {
      prefixId: consumption.prefixId,
      severity: "crowded",
      message: `소비율 ${(rate * 100).toFixed(1)}% — headroom 부족 경고`,
      flaggedDims,
    };
  }

  if (rate < 0.01 && consumption.observedAddresses > 0) {
    return {
      prefixId: consumption.prefixId,
      severity: "underused",
      message: `소비율 ${(rate * 100).toFixed(2)}% — 주소 공간 과잉 또는 사용 미달`,
      flaggedDims,
    };
  }

  return {
    prefixId: consumption.prefixId,
    severity: "healthy",
    message: `소비율 ${(rate * 100).toFixed(1)}% — 정상`,
    flaggedDims,
  };
}
