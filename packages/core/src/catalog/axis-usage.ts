/**
 * collectAxisUsage — 카탈로그 전체에서 축이 사용되는 경로를 수집한다.
 *
 * 수집 경로:
 *   1. prefix.dims — 좌표 인코딩 (kind === "axis")
 *   2. transitionSpecs — 상태 해석 (match/input/output에서 축 참조)
 *   3. scenarioSpecs — 시나리오 검증 (constraint에서 축 참조)
 *   4. 확장 가능: additionalAxes로 임의 축 목록 주입
 *
 * 결과의 usageSource로 "어디서 사용하는가"를 구분할 수 있다.
 */

import type { Catalog } from "./catalog.types.js";

export interface AxisUsageEntry {
  readonly axisId: string;
  readonly source: "prefix-dim" | "transition-match" | "transition-input" | "transition-output" | "scenario" | "additional";
  /** 사용처 ID (prefix ID, transition name, scenario ID 등) */
  readonly context: string;
}

export interface AxisUsageSummary {
  readonly axisId: string;
  readonly totalCount: number;
  readonly sources: Record<string, number>;
  readonly contexts: readonly string[];
}

export interface CollectAxisUsageOptions {
  /** TransitionSpec에서 추출한 축 참조 배열. spec-core에 의존하지 않도록 외부에서 주입. */
  transitionAxes?: readonly { transition: string; matchAxes: readonly string[]; inputAxes: readonly string[]; outputAxes: readonly string[] }[];
  /** ScenarioSpec constraint에서 참조하는 축 배열 */
  scenarioAxes?: readonly { scenarioId: string; axes: readonly string[] }[];
  /** 기타 소스에서 사용하는 축 배열 */
  additionalAxes?: readonly { source: string; context: string; axes: readonly string[] }[];
}

/** 카탈로그 + 부가 소스에서 축 사용을 수집한다. */
export function collectAxisUsage(
  catalog: Catalog,
  options: CollectAxisUsageOptions = {},
): AxisUsageEntry[] {
  const entries: AxisUsageEntry[] = [];

  // 1. prefix.dims
  const prefixes = (catalog as any).prefixes as Record<string, any> | undefined;
  if (prefixes) {
    for (const [prefixId, prefixDef] of Object.entries(prefixes)) {
      const dims = prefixDef.dims as Record<string, { kind: string; axisId?: string }> | undefined;
      if (!dims) continue;
      for (const [, dimRef] of Object.entries(dims)) {
        if (dimRef.kind === "axis" && dimRef.axisId) {
          entries.push({ axisId: dimRef.axisId, source: "prefix-dim", context: prefixId });
        }
      }
    }
  }

  // 2. transitionSpecs
  if (options.transitionAxes) {
    for (const t of options.transitionAxes) {
      for (const a of t.matchAxes) entries.push({ axisId: a, source: "transition-match", context: t.transition });
      for (const a of t.inputAxes) entries.push({ axisId: a, source: "transition-input", context: t.transition });
      for (const a of t.outputAxes) entries.push({ axisId: a, source: "transition-output", context: t.transition });
    }
  }

  // 3. scenarioSpecs
  if (options.scenarioAxes) {
    for (const s of options.scenarioAxes) {
      for (const a of s.axes) entries.push({ axisId: a, source: "scenario", context: s.scenarioId });
    }
  }

  // 4. additional
  if (options.additionalAxes) {
    for (const item of options.additionalAxes) {
      for (const a of item.axes) entries.push({ axisId: a, source: "additional", context: item.context });
    }
  }

  return entries;
}

/** 축별 사용 요약을 생성한다. */
export function summarizeAxisUsage(entries: readonly AxisUsageEntry[]): AxisUsageSummary[] {
  const map = new Map<string, { sources: Record<string, number>; contexts: Set<string> }>();

  for (const e of entries) {
    let record = map.get(e.axisId);
    if (!record) {
      record = { sources: {}, contexts: new Set() };
      map.set(e.axisId, record);
    }
    record.sources[e.source] = (record.sources[e.source] || 0) + 1;
    record.contexts.add(e.context);
  }

  return [...map.entries()]
    .map(([axisId, r]) => ({
      axisId,
      totalCount: Object.values(r.sources).reduce((a, b) => a + b, 0),
      sources: r.sources,
      contexts: [...r.contexts].sort(),
    }))
    .sort((a, b) => b.totalCount - a.totalCount);
}

/** 카탈로그에 정의되어 있지만 어디서도 사용하지 않는 축을 찾는다. */
export function findUnusedAxes(catalog: Catalog, entries: readonly AxisUsageEntry[]): string[] {
  const allAxes = Object.keys((catalog as any).axes ?? {});
  const used = new Set(entries.map(e => e.axisId));
  return allAxes.filter(a => !used.has(a));
}
