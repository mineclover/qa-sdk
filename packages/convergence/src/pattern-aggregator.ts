/**
 * 패턴 집계 — 분류 결과를 통계로 변환.
 *
 * @layer 집계 (Aggregation)
 */

import type {
  PatternClassification,
  PatternStats,
  PatternHealthReport,
  BehaviorPattern,
  IdentificationMode,
} from "@qa-sdk/core";

/**
 * 분류 결과 배열에서 패턴별 통계를 집계한다.
 */
export function aggregatePatternStats(
  classifications: readonly PatternClassification[],
): PatternStats[] {
  const total = classifications.length || 1;
  const groups = new Map<string, {
    pattern: BehaviorPattern;
    identificationMode: IdentificationMode;
    count: number;
    totalEvents: number;
    totalDuration: number;
    lastSeen: string;
  }>();

  for (const c of classifications) {
    const key = `${c.identificationMode}:${c.pattern}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.totalEvents += c.eventCount;
      existing.totalDuration += c.durationMs;
      if (c.classifiedAt > existing.lastSeen) existing.lastSeen = c.classifiedAt;
    } else {
      groups.set(key, {
        pattern: c.pattern,
        identificationMode: c.identificationMode,
        count: 1,
        totalEvents: c.eventCount,
        totalDuration: c.durationMs,
        lastSeen: c.classifiedAt,
      });
    }
  }

  return [...groups.values()]
    .map(g => ({
      pattern: g.pattern,
      identificationMode: g.identificationMode,
      count: g.count,
      percentage: g.count / total,
      avgEventCount: Math.round(g.totalEvents / g.count),
      avgDurationMs: Math.round(g.totalDuration / g.count),
      lastSeen: g.lastSeen,
    }))
    .toSorted((a, b) => b.count - a.count);
}

/**
 * 분류 결과 + 이상 감지 수로 건전성 보고서를 생성한다.
 */
export function buildPatternHealthReport(
  classifications: readonly PatternClassification[],
  anomalyCount: number = 0,
): PatternHealthReport {
  const stats = aggregatePatternStats(classifications);
  const total = classifications.length || 1;

  const unclassifiedCount = classifications.filter(c => c.pattern === "unclassified").length;
  const identifiedCount = classifications.filter(
    c => c.identificationMode === "identified" || c.identificationMode === "pseudonymized",
  ).length;

  return {
    totalSessions: classifications.length,
    stats,
    classificationRate: 1 - (unclassifiedCount / total),
    identifiedRate: identifiedCount / total,
    anomalyCount,
    generatedAt: new Date().toISOString(),
  };
}
