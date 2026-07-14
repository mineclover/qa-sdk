// @def.boundary convergence-layer-group
/**
 * Entry 관측 커버리지 — catalog 정의 vs 실 트래픽 대조.
 *
 * 3가지 상태를 식별한다:
 * 1. observed  — 정의되어 있고 실 트래픽에서 관측됨
 * 2. dormant   — 정의되어 있지만 한 번도 관측 안 됨
 * 3. phantom   — 정의에 없지만 트래픽에서 관측됨 (코드 불일치)
 *
 * @layer 측정 (Measurement)
 */

import type { Catalog } from '@qa-sdk/core';
import type { EntryUsage, AddressUsage } from './convergence.types.js';

// ═══════════════════════════════════════════════════════════════
//  Error-path entries — 건강한 시스템에서 관측되지 않는 것이 정상
// ═══════════════════════════════════════════════════════════════

/** 오류/장애 시에만 발생하는 entry. coverage 분모에서 제외. */
export const ERROR_PATH_ENTRIES: Readonly<Record<string, readonly string[]>> = {
  build_result: ['failure', 'type-error'],
  test_result: ['failed', 'error', 'skipped', 'timeout'],
  health_status: ['unhealthy', 'maintenance'],
  verdict_result: ['fail', 'degraded', 'unknown'],
  flow_step: ['failure', 'timeout'],
  anomaly_severity: ['critical'],
};

function isErrorPath(axisId: string, entry: string): boolean {
  return ERROR_PATH_ENTRIES[axisId]?.includes(entry) ?? false;
}

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface EntryState {
  readonly axisId: string;
  readonly entry: string;
  readonly status: 'observed' | 'dormant' | 'phantom';
  /** observed일 때: 관측 횟수 */
  readonly count: number;
  /** observed일 때: 마지막 관측 시각 */
  readonly lastSeen?: string;
  /** 이 entry를 사용하는 prefix 목록 */
  readonly usedByPrefixes: readonly string[];
}

export interface PrefixCoverage {
  readonly prefixId: string;
  /** 이 prefix의 고정 차원별 entry 커버리지 */
  readonly dims: Record<string, DimCoverage>;
  /** 전체 관측 커버리지율 (observed / (observed + dormant)) */
  readonly coverageRate: number;
  /** 요약 */
  readonly summary: string;
}

export interface DimCoverage {
  readonly axisId: string;
  readonly defined: number;
  readonly observed: number;
  readonly dormant: number;
  readonly phantom: number;
  readonly entries: readonly EntryState[];
}

export interface CoverageReport {
  /** prefix별 커버리지 */
  readonly prefixes: readonly PrefixCoverage[];
  /** 전체 entry 상태 목록 (중복 제거) */
  readonly allEntries: readonly EntryState[];
  /** 전체 관측 커버리지율 */
  readonly overallCoverageRate: number;
  /** dormant entries — 정의됐지만 관측 안 됨 */
  readonly dormantCount: number;
  /** phantom entries — 정의 없이 관측됨 */
  readonly phantomCount: number;
  /** error-path entries — 오류 시에만 발생. dormant가 정상 */
  readonly errorPathCount: number;
  /** 실질 커버리지율 — error-path 제외 기준: observed / (observed + dormant - errorPath) */
  readonly adjustedCoverageRate: number;
  /** 요약 */
  readonly summary: string;
}

// ═══════════════════════════════════════════════════════════════
//  Analysis
// ═══════════════════════════════════════════════════════════════

/**
 * catalog의 모든 prefix에 대해 entry 관측 커버리지를 분석한다.
 *
 * @param catalog - DEMO_CATALOG
 * @param entryUsages - aggregateUsageData에서 나온 EntryUsage[]
 * @param addressUsages - aggregateUsageData에서 나온 AddressUsage[]
 */
export function analyzeEntryCoverage(
  catalog: Catalog,
  entryUsages: readonly EntryUsage[],
  addressUsages: readonly AddressUsage[],
): CoverageReport {
  // entryUsage를 axisId:entry → usage 맵으로
  const usageMap = new Map<string, EntryUsage>();
  for (const u of entryUsages) {
    usageMap.set(`${u.axisId}:${u.entry}`, u);
  }

  // 어떤 prefix가 어떤 주소를 사용했는지
  const prefixUsed = new Set<string>();
  for (const a of addressUsages) {
    prefixUsed.add(a.prefix);
  }

  const allEntries: EntryState[] = [];
  const prefixCoverages: PrefixCoverage[] = [];

  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    const latestVersion = prefix.versions[prefix.versions.length - 1];
    const dims: Record<string, DimCoverage> = {};
    let totalDefined = 0;
    let totalObserved = 0;

    for (const label of prefix.labels) {
      const dimRef = prefix.dims[label];
      if (dimRef.kind !== 'axis') continue; // prefix_ref, table_ref는 건너뜀

      const axisId = dimRef.axisId;
      const axis = catalog.axes[axisId];
      if (!axis) continue;

      const axisVersion = latestVersion.axisVersions[label];
      if (!axisVersion) continue;

      const snap = axis.versions[axisVersion];
      if (!snap) continue;

      const entries: EntryState[] = [];

      // catalog에 정의된 entries
      for (const entry of snap.entries) {
        const usage = usageMap.get(`${label}:${entry}`) ?? usageMap.get(`${axisId}:${entry}`);
        const isObserved = usage !== undefined && usage.count > 0;

        entries.push({
          axisId: label,
          entry,
          status: isObserved ? 'observed' : 'dormant',
          count: usage?.count ?? 0,
          lastSeen: usage?.lastSeen,
          usedByPrefixes: isObserved ? [prefixId] : [],
        });
      }

      const defined = entries.length;
      const observed = entries.filter((e) => e.status === 'observed').length;
      const dormant = entries.filter((e) => e.status === 'dormant').length;

      dims[label] = { axisId, defined, observed, dormant, phantom: 0, entries };
      totalDefined += defined;
      totalObserved += observed;
      allEntries.push(...entries);
    }

    const coverageRate = totalDefined > 0 ? totalObserved / totalDefined : 1;
    const dormantDims = Object.values(dims).filter((d) => d.dormant > 0);
    const summaryParts: string[] = [];
    if (dormantDims.length > 0) {
      for (const d of dormantDims) {
        const dormantEntries = d.entries.filter((e) => e.status === 'dormant').map((e) => e.entry);
        summaryParts.push(`${d.axisId}: [${dormantEntries.join(',')}] 미관측`);
      }
    }

    prefixCoverages.push({
      prefixId,
      dims,
      coverageRate,
      summary:
        summaryParts.length > 0
          ? `커버리지 ${(coverageRate * 100).toFixed(0)}% — ${summaryParts.join('; ')}`
          : `커버리지 100%`,
    });
  }

  // phantom 감지: entryUsage에 있지만 catalog에 없는 entry
  const definedEntryKeys = new Set<string>();
  for (const [, axis] of Object.entries(catalog.axes)) {
    for (const [, snap] of Object.entries(axis.versions)) {
      for (const entry of (snap as { entries: readonly string[] }).entries) {
        definedEntryKeys.add(entry);
      }
    }
  }

  for (const u of entryUsages) {
    if (
      !definedEntryKeys.has(u.entry) &&
      !u.entry.startsWith('(reserved:') &&
      isNaN(Number(u.entry))
    ) {
      allEntries.push({
        axisId: u.axisId,
        entry: u.entry,
        status: 'phantom',
        count: u.count,
        lastSeen: u.lastSeen,
        usedByPrefixes: [],
      });
    }
  }

  // 중복 제거
  const uniqueEntries = deduplicateEntries(allEntries);
  const totalDefined = uniqueEntries.filter((e) => e.status !== 'phantom').length;
  const totalObserved = uniqueEntries.filter((e) => e.status === 'observed').length;
  const dormantCount = uniqueEntries.filter((e) => e.status === 'dormant').length;
  const phantomCount = uniqueEntries.filter((e) => e.status === 'phantom').length;
  const overallCoverageRate = totalDefined > 0 ? totalObserved / totalDefined : 1;

  // error-path: dormant이면서 error-path에 해당하는 entry
  const errorPathCount = uniqueEntries.filter(
    (e) => e.status === 'dormant' && isErrorPath(e.axisId, e.entry),
  ).length;

  // 실질 커버리지: error-path 제외
  const adjustedDenominator = totalDefined - errorPathCount;
  const adjustedCoverageRate = adjustedDenominator > 0 ? totalObserved / adjustedDenominator : 1;

  return {
    prefixes: prefixCoverages,
    allEntries: uniqueEntries,
    overallCoverageRate,
    dormantCount,
    phantomCount,
    errorPathCount,
    adjustedCoverageRate,
    summary: `전체 커버리지 ${(overallCoverageRate * 100).toFixed(0)}% (실질 ${(adjustedCoverageRate * 100).toFixed(0)}%: error-path ${errorPathCount}개 제외) — observed=${totalObserved} dormant=${dormantCount} phantom=${phantomCount}`,
  };
}

function deduplicateEntries(entries: EntryState[]): EntryState[] {
  const map = new Map<string, EntryState>();
  for (const e of entries) {
    const key = `${e.axisId}:${e.entry}`;
    const existing = map.get(key);
    if (!existing || e.count > existing.count) {
      map.set(key, e);
    }
  }
  return [...map.values()];
}
