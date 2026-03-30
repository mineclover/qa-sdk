/**
 * 시간축 분석 — 트래픽 트렌드, 시간대별 분기 변화, SLA 위반 감지.
 *
 * records를 시간 윈도우로 슬라이스하여:
 * 1. 윈도우별 분기 분포 추적 (시간에 따라 success 비율이 떨어지는가?)
 * 2. 이상 윈도우 감지 (평균 대비 급격한 변화)
 * 3. SLA 기준 위반 (특정 분기 비율이 임계값 초과/미달)
 *
 * @layer 측정 (Measurement)
 */

import { type Catalog, compareTimestamps } from "@qa-sdk/core";
import { aggregateUsageData, type AddressContextRecord } from "./usage-aggregator.js";

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface TimeWindow {
  readonly from: string;
  readonly to: string;
  readonly recordCount: number;
  /** 분기 축별 분포 */
  readonly branches: Record<string, Record<string, number>>;
}

export interface TrendPoint {
  readonly windowIndex: number;
  readonly from: string;
  readonly axisId: string;
  readonly entry: string;
  readonly count: number;
  readonly ratio: number;
}

export interface Anomaly {
  readonly windowIndex: number;
  readonly from: string;
  readonly axisId: string;
  readonly entry: string;
  readonly ratio: number;
  readonly avgRatio: number;
  readonly deviation: number;
  readonly severity: "warning" | "critical";
}

export interface SlaViolation {
  readonly windowIndex: number;
  readonly from: string;
  readonly rule: string;
  readonly actual: number;
  readonly threshold: number;
}

export interface TemporalReport {
  readonly windows: readonly TimeWindow[];
  readonly trends: readonly TrendPoint[];
  readonly anomalies: readonly Anomaly[];
  readonly slaViolations: readonly SlaViolation[];
  readonly summary: string;
}

export interface SlaRule {
  readonly axisId: string;
  readonly entry: string;
  /** 최소 비율 (예: success >= 0.95) */
  readonly minRatio?: number;
  /** 최대 비율 (예: failure <= 0.05) */
  readonly maxRatio?: number;
}

// ═══════════════════════════════════════════════════════════════
//  Analysis
// ═══════════════════════════════════════════════════════════════

const BRANCH_AXES = new Set([
  "flow_step", "flow_variant", "deploy_action", "health_status",
  "verdict_result", "constraint_op", "migration_pattern",
  "mask_mode", "validation_mode", "pipeline_phase",
  "cart_action", "auth_action", "order_action",
  "http_method", "resource_type",
]);

/**
 * records를 시간 윈도우로 슬라이스하여 트렌드/이상/SLA 위반을 분석한다.
 */
export function analyzeTemporalTrends(
  catalog: Catalog,
  records: readonly AddressContextRecord[],
  options?: {
    windowMinutes?: number;
    slaRules?: readonly SlaRule[];
    anomalyThreshold?: number;
  },
): TemporalReport {
  const windowMs = (options?.windowMinutes ?? 10) * 60 * 1000;
  const anomalyThreshold = options?.anomalyThreshold ?? 2.0;
  const slaRules = options?.slaRules ?? [];

  // 시간순 정렬
  const sorted = [...records].toSorted((a, b) => compareTimestamps(a.timestamp, b.timestamp));
  if (sorted.length === 0) {
    return { windows: [], trends: [], anomalies: [], slaViolations: [], summary: "레코드 없음" };
  }

  // 윈도우 분할
  const startTime = new Date(sorted[0].timestamp).getTime();
  const endTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const windowCount = Math.max(1, Math.ceil((endTime - startTime) / windowMs));

  const windowBuckets: AddressContextRecord[][] = Array.from({ length: windowCount }, () => []);
  for (const r of sorted) {
    const t = new Date(r.timestamp).getTime();
    const idx = Math.min(Math.floor((t - startTime) / windowMs), windowCount - 1);
    windowBuckets[idx].push(r);
  }

  // 윈도우별 집계
  const windows: TimeWindow[] = [];
  const allTrends: TrendPoint[] = [];

  for (let i = 0; i < windowBuckets.length; i++) {
    const bucket = windowBuckets[i];
    if (bucket.length === 0) {
      windows.push({
        from: new Date(startTime + i * windowMs).toISOString(),
        to: new Date(startTime + (i + 1) * windowMs).toISOString(),
        recordCount: 0,
        branches: {},
      });
      continue;
    }

    const usage = aggregateUsageData(catalog, bucket);
    const branches: Record<string, Record<string, number>> = {};

    for (const u of usage.entryUsages) {
      if (!BRANCH_AXES.has(u.axisId)) continue;
      if (!branches[u.axisId]) branches[u.axisId] = {};
      branches[u.axisId][u.entry] = u.count;
    }

    const from = new Date(startTime + i * windowMs).toISOString();
    windows.push({
      from,
      to: new Date(startTime + (i + 1) * windowMs).toISOString(),
      recordCount: bucket.length,
      branches,
    });

    // trend points
    for (const [axisId, entries] of Object.entries(branches)) {
      const axisTotal = Object.values(entries).reduce((s, c) => s + c, 0);
      for (const [entry, count] of Object.entries(entries)) {
        allTrends.push({
          windowIndex: i,
          from,
          axisId,
          entry,
          count,
          ratio: axisTotal > 0 ? count / axisTotal : 0,
        });
      }
    }
  }

  // 이상 감지: entry별 평균 ratio 대비 편차
  const anomalies: Anomaly[] = [];
  const ratiosByKey = new Map<string, number[]>();
  for (const t of allTrends) {
    const key = `${t.axisId}:${t.entry}`;
    const list = ratiosByKey.get(key) ?? [];
    list.push(t.ratio);
    ratiosByKey.set(key, list);
  }

  for (const t of allTrends) {
    const key = `${t.axisId}:${t.entry}`;
    const ratios = ratiosByKey.get(key) ?? [];
    if (ratios.length < 2) continue;
    const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    const stddev = Math.sqrt(ratios.reduce((s, r) => s + (r - avg) ** 2, 0) / ratios.length);
    if (stddev === 0) continue;
    const deviation = Math.abs(t.ratio - avg) / stddev;
    if (deviation >= anomalyThreshold) {
      anomalies.push({
        windowIndex: t.windowIndex,
        from: t.from,
        axisId: t.axisId,
        entry: t.entry,
        ratio: t.ratio,
        avgRatio: avg,
        deviation,
        severity: deviation >= 3 ? "critical" : "warning",
      });
    }
  }

  // SLA 위반
  const slaViolations: SlaViolation[] = [];
  for (const w of windows) {
    if (w.recordCount === 0) continue;
    for (const rule of slaRules) {
      const entries = w.branches[rule.axisId];
      if (!entries) continue;
      const total = Object.values(entries).reduce((s, c) => s + c, 0);
      const count = entries[rule.entry] ?? 0;
      const ratio = total > 0 ? count / total : 0;

      if (rule.minRatio !== undefined && ratio < rule.minRatio) {
        slaViolations.push({
          windowIndex: windows.indexOf(w),
          from: w.from,
          rule: `${rule.axisId}.${rule.entry} >= ${(rule.minRatio * 100).toFixed(0)}%`,
          actual: ratio,
          threshold: rule.minRatio,
        });
      }
      if (rule.maxRatio !== undefined && ratio > rule.maxRatio) {
        slaViolations.push({
          windowIndex: windows.indexOf(w),
          from: w.from,
          rule: `${rule.axisId}.${rule.entry} <= ${(rule.maxRatio * 100).toFixed(0)}%`,
          actual: ratio,
          threshold: rule.maxRatio,
        });
      }
    }
  }

  return {
    windows,
    trends: allTrends,
    anomalies: anomalies.toSorted((a, b) => b.deviation - a.deviation),
    slaViolations,
    summary: `${windows.length} windows, ${anomalies.length} anomalies, ${slaViolations.length} SLA violations`,
  };
}
