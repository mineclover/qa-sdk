/**
 * self-check-analyzer — self-check의 순수 분석 로직.
 *
 * CLI의 dkg self-check에서 추출한 Layer 2 (FAST).
 * execSync 없음. Store 의존 없음. 순수 함수.
 *
 * 컨벤션:
 *   - 입력: SelfCheckResult[] (빌드/테스트 결과) + DemoCatalog
 *   - 출력: SelfCheckAnalysis (좌표 인코딩 + convergence + invariant)
 *   - CI에서 결과를 JSON으로 저장 → 이 모듈로 분석 → CLI/테스트에서 소비
 *
 * @layer 측정 (Measurement)
 */

import type { DemoCatalog } from "demo-snapshot";
import { encodePrefixByValue } from "demo-snapshot";
import { aggregateUsageData, analyzeCollectionHealth } from "./usage-aggregator.js";
import { analyzeEntryCoverage } from "./entry-coverage.js";
import type { UsageData, CollectionHealthReport, CoverageReport } from "./convergence.types.js";
import type { AddressContextRecord } from "./usage-aggregator.js";

/** prefix의 최신 version ID를 반환 */
function latestPrefixVersion(catalog: DemoCatalog, prefixId: string): string {
  const prefix = (catalog as any).prefixes?.[prefixId];
  if (!prefix?.versions?.length) return "v1";
  return prefix.versions[prefix.versions.length - 1].version;
}

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
//  비즈니스 시뮬레이션 정의
// ═══════════════════════════════════════════════════════════════

/** 비즈니스 시뮬레이션 — version은 latestPrefixVersion으로 동적 결정 */
const BIZ_PREFIXES = [
  { prefix: "endpoint", dims: { resource_type: "api", http_method: "POST", api_version: "v1" }, refDim: "svc_ref" },
  { prefix: "endpoint", dims: { resource_type: "api", http_method: "GET", api_version: "v1" }, refDim: "svc_ref" },
  { prefix: "permission", dims: { role: "admin" }, refDim: "perm_svc" },
  { prefix: "permission", dims: { role: "developer" }, refDim: "perm_svc" },
  { prefix: "event", dims: { event_name: "user.login", initiator: "web" }, refDim: "evt_svc" },
  { prefix: "event", dims: { event_name: "order.created", initiator: "web" }, refDim: "evt_svc" },
] as const;

// ═══════════════════════════════════════════════════════════════
//  SELF_CHECK_PKGS — 패키지 빌드/테스트 가능 여부 (CLI과 동일)
// ═══════════════════════════════════════════════════════════════

export const SELF_CHECK_PKG_NAMES = [
  "spec-core", "cli", "sdk", "demo-snapshot", "weighted-index",
  "bit-index", "permission-engine", "index-meta", "platform-demo",
  "ingest-server", "registry-service", "e2e",
  "core", "engine", "store",
  "gate-service", "query-service", "decode-service",
  "registry-server", "registry-client",
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
  catalog: DemoCatalog,
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

  // ── 2. 비즈니스 시뮬레이션 ──
  let bizRecords = 0;
  for (const bp of BIZ_PREFIXES) {
    try {
      const ver = latestPrefixVersion(catalog, bp.prefix);
      const prefixDef = (catalog as any).prefixes?.[bp.prefix];
      const verDef = prefixDef?.versions?.find((v: any) => v.version === ver);
      const refVal = verDef?.refEntries?.[bp.refDim]?.values?.[0];
      const dims = refVal !== undefined ? { [bp.refDim]: refVal, ...bp.dims } : { ...bp.dims };
      const address = encodePrefixByValue(catalog, bp.prefix, ver, dims);
      records.push({
        address_context: { [bp.prefix]: `${bp.prefix}:${ver}:${address}` },
        timestamp: now,
        session_id: runId,
        event_key: `biz:${bp.prefix}`,
        execution_mode: "synthetic",
        execution_id: runId,
      });
      bizRecords++;
    } catch { /* 건너뜀 */ }
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
