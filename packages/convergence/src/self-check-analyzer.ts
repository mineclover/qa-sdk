/**
 * self-check-analyzer — self-check의 순수 분석 로직.
 *
 * CLI의 dkg self-check에서 추출한 Layer 2 (FAST).
 * execSync 없음. Store 의존 없음. 순수 함수.
 *
 * 컨벤션:
 *   - 입력: SelfCheckResult[] (빌드/테스트 결과) + Catalog
 *   - 출력: SelfCheckAnalysis (좌표 인코딩 + convergence + invariant)
 *   - CI에서 결과를 JSON으로 저장 → 이 모듈로 분석 → CLI/테스트에서 소비
 *
 * @layer 측정 (Measurement)
 */

import type { Catalog } from "@qa-sdk/core";
import { encodePrefixByValue, latestPrefixVersion } from "@qa-sdk/core";
import { aggregateUsageData, analyzeCollectionHealth } from "./usage-aggregator.js";
import { analyzeEntryCoverage } from "./entry-coverage.js";
import type { UsageData, CollectionHealthReport, CoverageReport } from "./convergence.types.js";
import type { AddressContextRecord } from "./usage-aggregator.js";


// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

export interface SelfCheckResult {
  readonly pkg: string;
  readonly kind: "build" | "test";
  readonly result: string;
  readonly module?: string;
  readonly tests?: number;
  readonly passed?: number;
  readonly failed?: number;
  readonly durationMs?: number;
}

export interface InvariantViolation {
  readonly pkg: string;
  readonly message: string;
}

export interface SelfCheckAnalysis {
  readonly records: readonly AddressContextRecord[];
  readonly usage: UsageData;
  readonly health: CollectionHealthReport;
  readonly coverage: CoverageReport;
  readonly invariantViolations: readonly InvariantViolation[];
  readonly buildSummary: { success: number; failure: number; skipped: number; total: number };
  readonly testSummary: { passed: number; failed: number; tests: number; total: number };
  readonly bizRecords: number;
}

// ═══════════════════════════════════════════════════════════════
//  합성 이벤트 정의 — 도메인별 커버리지 확장
// ═══════════════════════════════════════════════════════════════

interface SyntheticEvent {
  readonly prefix: string;
  readonly dims: Record<string, string | number>;
  /** prefix_ref 차원 이름 (있을 경우 refEntries 첫 값을 자동 주입) */
  readonly refDims?: readonly string[];
}

/**
 * 카탈로그에서 합성 이벤트를 자동 생성한다.
 *
 * 각 prefix의 각 axis dim에서 모든 entry를 순회하여 최소 1회 관측되는 이벤트를 생성.
 * prefix_ref dim은 refEntries의 첫 번째 값을 자동 주입.
 * table_ref dim은 스킵 (인코딩 대상 아님).
 */
function generateSyntheticEvents(catalog: Catalog): readonly SyntheticEvent[] {
  const events: SyntheticEvent[] = [];
  const prefixes = (catalog as any).prefixes as Record<string, any> | undefined;
  const axes = (catalog as any).axes as Record<string, any> | undefined;
  if (!prefixes || !axes) return events;

  for (const [prefixId, prefixDef] of Object.entries(prefixes)) {
    const dims = prefixDef.dims as Record<string, { kind: string; axisId?: string }> | undefined;
    if (!dims) continue;

    // axis dim만 추출 (prefix_ref/table_ref 제외)
    const axisDims: Array<{ label: string; axisId: string; entries: readonly string[] }> = [];
    const refDimLabels: string[] = [];

    for (const [label, dimRef] of Object.entries(dims)) {
      if (dimRef.kind === "axis" && dimRef.axisId) {
        const axis = axes[dimRef.axisId];
        if (!axis) continue;
        const versions = Object.keys(axis.versions);
        const latest = axis.versions[versions[versions.length - 1]] as any;
        if (latest?.entries) {
          axisDims.push({ label, axisId: dimRef.axisId, entries: latest.entries });
        }
      } else if (dimRef.kind === "prefix_ref") {
        refDimLabels.push(label);
      }
    }

    if (axisDims.length === 0) continue;

    // 전략: 각 axis의 모든 entry를 최소 1회 관측하되, 조합 폭발을 방지
    // → 첫 번째 axis의 모든 entry를 순회하고, 나머지 axis는 첫 번째 entry 고정
    // → 그 다음 두 번째 axis의 나머지 entry를 순회 (첫 번째 axis는 첫 entry 고정)
    // 이렇게 하면 총 이벤트 수 = sum(entries.length) (곱이 아닌 합)
    const baseDims: Record<string, string> = {};
    for (const ad of axisDims) baseDims[ad.label] = ad.entries[0];

    for (const ad of axisDims) {
      for (const entry of ad.entries) {
        const dims = { ...baseDims, [ad.label]: entry };
        events.push({
          prefix: prefixId,
          dims,
          ...(refDimLabels.length > 0 ? { refDims: refDimLabels } : {}),
        });
      }
    }
  }

  return events;
}

/**
 * 하위 호환 + 추가 수동 이벤트.
 * 자동 생성으로 커버되지 않는 특수 조합이 있으면 여기에 추가.
 */
/**
 * 수동 보충 이벤트 — 자동 생성으로 커버되지 않는 특수 조합만 추가.
 * generateSyntheticEvents()가 모든 axis entry를 커버하므로 대부분의 경우 빈 배열.
 */
const MANUAL_SYNTHETIC_EVENTS: readonly SyntheticEvent[] = [
  // 자동 생성이 100% 커버하므로 수동 보충 불필요.
  // 특수 조합이 필요하면 여기에 추가.
];

// ═══════════════════════════════════════════════════════════════
//  SELF_CHECK_PKGS — 패키지 빌드/테스트 가능 여부 (CLI과 동일)
// ═══════════════════════════════════════════════════════════════

export const SELF_CHECK_PKG_NAMES = [
  "spec-core", "cli", "sdk", "demo-snapshot", "weighted-index",
  "bit-index", "permission-engine", "index-meta", "platform-demo",
  "ingest-server", "registry-service", "e2e",
  "core", "engine", "store",
  "gate-service", "query-service", "decode-service",
  "registry-client",
  "apm", "browser-sdk", "event-catalog", "pino",
  "viz-3d", "viz-web", "demo-tests", "weighted-wasm",
] as const;

// ═══════════════════════════════════════════════════════════════
//  분석 (Layer 2 — 순수 함수)
// ═══════════════════════════════════════════════════════════════

/**
 * self-check 결과를 분석한다. execSync 없음. Store 없음.
 *
 * @param results - 빌드/테스트 결과 (CI에서 수집하거나 mock)
 * @param catalog - DEMO_CATALOG
 * @param runId - 실행 식별자
 */
export function analyzeSelfCheck(
  results: readonly SelfCheckResult[],
  catalog: Catalog,
  runId: string = `analysis-${Date.now()}`,
): SelfCheckAnalysis {
  const now = new Date().toISOString();
  const records: AddressContextRecord[] = [];

  // ── 1. 결과 → AddressContextRecord 인코딩 ──
  for (const r of results) {
    const prefixId = r.kind === "build" ? "build_event" : "test_event";
    const resultAxis = r.kind === "build" ? "build_result" : "test_result";
    const qaModule = r.module ?? "_all";
    try {
      const ver = latestPrefixVersion(catalog, prefixId);
      const address = encodePrefixByValue(catalog, prefixId, ver, {
        qa_pkg: r.pkg,
        qa_module: qaModule,
        [resultAxis]: r.result,
      });
      records.push({
        address_context: { [prefixId]: `${prefixId}:${ver}:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `${r.kind}:${r.pkg}`,
        execution_mode: "live",
        execution_id: runId,
      });
    } catch {
      // entry가 축에 없으면 건너뜀
    }
  }

  // ── 2. 합성 이벤트 시뮬레이션 (자동 생성 + 수동 보충) ──
  let bizRecords = 0;
  const allSynthetic = [...generateSyntheticEvents(catalog), ...MANUAL_SYNTHETIC_EVENTS];
  for (const se of allSynthetic) {
    try {
      const ver = latestPrefixVersion(catalog, se.prefix);
      const prefixDef = (catalog as any).prefixes?.[se.prefix];
      const verDef = prefixDef?.versions?.find((v: any) => v.version === ver);

      // prefix_ref 차원의 refEntries 첫 번째 값을 자동 주입
      const dims: Record<string, string | number> = { ...se.dims };
      if (se.refDims) {
        for (const refDim of se.refDims) {
          const refVal = verDef?.refEntries?.[refDim]?.values?.[0];
          if (refVal !== undefined) dims[refDim] = refVal;
        }
      }

      const address = encodePrefixByValue(catalog, se.prefix, ver, dims);
      records.push({
        address_context: { [se.prefix]: `${se.prefix}:${ver}:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `synthetic:${se.prefix}`,
        execution_mode: "synthetic",
        execution_id: runId,
      });
      bizRecords++;
    } catch { /* 인코딩 실패 시 건너뜀 */ }
  }

  // ── 3. 집계 ──
  const usage = aggregateUsageData(catalog, records);

  // ── 4. convergence 분석 ──
  const health = analyzeCollectionHealth(catalog, records);
  const coverage = analyzeEntryCoverage(catalog, usage.entryUsages, usage.addressUsages);

  // ── 5. invariant 검증 ──
  const invariantViolations: InvariantViolation[] = [];

  // "빌드 실패 후 테스트 금지" (skipped 제외)
  for (const r of results) {
    if (r.kind !== "build" || r.result === "success" || r.result === "skipped") continue;
    const testRan = results.find(t => t.kind === "test" && t.pkg === r.pkg);
    if (testRan) {
      invariantViolations.push({ pkg: r.pkg, message: `빌드 ${r.result}인데 테스트 실행됨 (${testRan.result})` });
    }
  }

  // "테스트 실패 시 빌드 성공 선행" (hasBuild=false 제외)
  for (const r of results) {
    if (r.kind !== "test" || r.result === "passed") continue;
    const buildResult = results.find(b => b.kind === "build" && b.pkg === r.pkg);
    // hasBuild=false인 패키지는 빌드 결과가 없으므로 건너뜀
    if (!buildResult) continue;
    if (buildResult.result !== "success" && buildResult.result !== "skipped") {
      invariantViolations.push({ pkg: r.pkg, message: `테스트 ${r.result}인데 빌드 성공이 선행되지 않음` });
    }
  }

  // ── 6. 요약 ──
  const buildSummary = { success: 0, failure: 0, skipped: 0, total: 0 };
  const testSummary = { passed: 0, failed: 0, tests: 0, total: 0 };
  for (const r of results) {
    if (r.kind === "build") {
      buildSummary.total++;
      if (r.result === "success") buildSummary.success++;
      else if (r.result === "skipped") buildSummary.skipped++;
      else buildSummary.failure++;
    } else {
      testSummary.total++;
      testSummary.tests += r.tests ?? 0;
      testSummary.passed += r.passed ?? 0;
      testSummary.failed += r.failed ?? 0;
    }
  }

  return {
    records,
    usage,
    health,
    coverage,
    invariantViolations,
    buildSummary,
    testSummary,
    bizRecords,
  };
}
