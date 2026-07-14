// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 테스트 추적 — 패싯별 수집 + 검증 루프 + 품질 지표 + drift 감지
 */

import type {
  TestCase,
  TestSuite,
  TestResult,
  TestPhase,
  FacetQualityMetrics,
  PipeQualityMetrics,
  PhaseQualityMetrics,
} from '../types/test-tracking.js';
import { TEST_PHASES } from '../types/test-tracking.js';
import type { PipeSpec } from '../types/pipe-spec.js';
import { compareTimestamps } from '../lib/clock.js';
import type { SimulationResult } from './pipe-simulate.js';
import { matchHappyPath } from './pipe-simulate.js';
import type { HappyPathSpec, HappyPathMatch } from './pipe-simulate.js';
import { countPipePaths } from './pipe-path.js';

/** 관측 대상 패싯 5종 */
const KNOWN_FACETS = ['생산', '소비', '정의', '관리', '저장'] as const;

// ── TestCase 주소 생성 ───────────────────────────────

/** 테스트 케이스 주소 생성 (phase 포함) */
export function buildTestAddress(
  scopeIndex: number,
  aspectIndex: number,
  facet: string,
  phase: TestPhase | undefined,
  seq: number,
): string {
  if (phase) {
    return `test:${scopeIndex}:${aspectIndex}:${facet}:${phase}:${seq}`;
  }
  return `test:${scopeIndex}:${aspectIndex}:${facet}:${seq}`;
}

/** 테스트 주소 파싱 (4세그먼트 하위 호환 + 5세그먼트 phase 포함) */
export function parseTestAddress(address: string): {
  scopeIndex: number;
  aspectIndex: number;
  facet: string;
  phase?: TestPhase;
  seq: number;
} | null {
  // test:scope:aspect:facet[:phase]:seq — phase는 선택
  const m = address.match(/^test:(\d+):(\d+):([^:]+):(?:([^:]+):)?(\d+)$/);
  if (!m) return null;

  const rawPhase = m[4]; // undefined if 4-segment
  return {
    scopeIndex: Number(m[1]),
    aspectIndex: Number(m[2]),
    facet: m[3],
    phase:
      rawPhase && (TEST_PHASES as readonly string[]).includes(rawPhase)
        ? (rawPhase as TestPhase)
        : undefined,
    seq: Number(m[5]),
  };
}

// ── TestRegistry — 테스트 케이스 + 결과 수집 ─────────

export class TestRegistry {
  private readonly cases: Map<string, TestCase> = new Map();
  private readonly suites: Map<string, TestSuite> = new Map();
  private readonly results: TestResult[] = [];
  /** testId → 최신 결과 캐시 (recordResult 시 O(1) 갱신) */
  private readonly latestResults: Map<string, TestResult> = new Map();

  // ── 테스트 케이스 ──────────────────────────────

  registerCase(tc: TestCase): void {
    this.cases.set(tc.testId, tc);
  }

  getCase(testId: string): TestCase | null {
    return this.cases.get(testId) ?? null;
  }

  getCasesBySpec(specId: string): TestCase[] {
    return [...this.cases.values()].filter((tc) => tc.target.specId === specId);
  }

  getCasesByFacet(facet: string): TestCase[] {
    return [...this.cases.values()].filter((tc) => tc.facet === facet);
  }

  getCasesByPhase(phase: TestPhase): TestCase[] {
    return [...this.cases.values()].filter((tc) => tc.phase === phase);
  }

  listCases(): TestCase[] {
    return [...this.cases.values()];
  }

  // ── 테스트 스위트 ─────────────────────────────

  registerSuite(suite: TestSuite): void {
    this.suites.set(suite.suiteId, suite);
    for (const tc of suite.cases) {
      this.registerCase(tc);
    }
  }

  getSuite(suiteId: string): TestSuite | null {
    return this.suites.get(suiteId) ?? null;
  }

  getSuitesByFacet(facet: string): TestSuite[] {
    return [...this.suites.values()].filter((s) => s.facet === facet);
  }

  getSuitesByPhase(phase: TestPhase): TestSuite[] {
    return [...this.suites.values()].filter(
      (s) => s.phases?.includes(phase) || s.cases.some((c) => c.phase === phase),
    );
  }

  listSuites(): TestSuite[] {
    return [...this.suites.values()];
  }

  // ── 결과 수집 ─────────────────────────────────

  recordResult(result: TestResult): void {
    this.results.push(result);
    this.latestResults.set(result.testId, result);
  }

  recordResults(results: TestResult[]): void {
    for (const r of results) {
      this.results.push(r);
      this.latestResults.set(r.testId, r);
    }
  }

  getLatestResult(testId: string): TestResult | null {
    return this.latestResults.get(testId) ?? null;
  }

  getResultsByAddress(address: string): TestResult[] {
    return this.results.filter((r) => r.address === address);
  }

  getFailures(): TestResult[] {
    return [...this.latestResults.values()].filter((r) => r.status === 'fail');
  }

  // ── 품질 지표 ─────────────────────────────────

  /** 공통 지표 수집 — facet/phase 양쪽에서 사용 */
  private gatherStats(
    cases: TestCase[],
    schemaUpdatedAt?: string,
  ): {
    passed: number;
    lastExecuted?: string;
    hasDrift: boolean;
    resultCache: Map<string, TestResult | null>;
  } {
    let passed = 0;
    let lastExecuted: string | undefined;
    let hasDrift = false;
    const resultCache = new Map<string, TestResult | null>();

    for (const tc of cases) {
      const result = this.getLatestResult(tc.testId);
      resultCache.set(tc.testId, result ?? null);
      if (result) {
        if (result.status === 'pass') passed++;
        if (!lastExecuted || compareTimestamps(result.executedAt, lastExecuted) > 0) {
          lastExecuted = result.executedAt;
        }
        if (schemaUpdatedAt && compareTimestamps(result.executedAt, schemaUpdatedAt) < 0) {
          hasDrift = true;
        }
      } else {
        hasDrift = true;
      }
    }

    return { passed, lastExecuted, hasDrift, resultCache };
  }

  computeFacetMetrics(facet: string, schemaUpdatedAt?: string): FacetQualityMetrics {
    const cases = this.getCasesByFacet(facet);
    const { passed, lastExecuted, hasDrift, resultCache } = this.gatherStats(
      cases,
      schemaUpdatedAt,
    );
    const total = cases.length;

    const contractCases = cases.filter((tc) => tc.contractRef);
    const contractPassed = contractCases.filter(
      (tc) => resultCache.get(tc.testId)?.status === 'pass',
    ).length;

    return {
      facet,
      totalTests: total,
      passedTests: passed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      hasCoverage: total > 0,
      contractVerifiedRate:
        contractCases.length > 0 ? Math.round((contractPassed / contractCases.length) * 100) : 0,
      lastExecuted,
      hasDrift,
    };
  }

  computePhaseMetrics(phase: TestPhase, schemaUpdatedAt?: string): PhaseQualityMetrics {
    const cases = this.getCasesByPhase(phase);
    const { passed, lastExecuted, hasDrift } = this.gatherStats(cases, schemaUpdatedAt);
    const total = cases.length;

    return {
      phase,
      totalTests: total,
      passedTests: passed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      hasCoverage: total > 0,
      lastExecuted,
      hasDrift,
    };
  }

  computePipeMetrics(pipe: PipeSpec): PipeQualityMetrics {
    const totalPaths = countPipePaths(pipe.flow);
    const pipeCases = [...this.cases.values()].filter(
      (tc) => tc.target.specId === pipe.pipeId || tc.tags?.includes(pipe.pipeId),
    );

    // 패싯별 분포
    const facetDistribution: Record<string, number> = {};
    const coveredFacets = new Set<string>();
    // 단계별 분포
    const phaseDistribution: Record<string, number> = {};
    const coveredPhases = new Set<string>();

    for (const tc of pipeCases) {
      if (tc.facet) {
        facetDistribution[tc.facet] = (facetDistribution[tc.facet] ?? 0) + 1;
        const result = this.getLatestResult(tc.testId);
        if (result?.status === 'pass') coveredFacets.add(tc.facet);
      }
      if (tc.phase) {
        phaseDistribution[tc.phase] = (phaseDistribution[tc.phase] ?? 0) + 1;
        const result = this.getLatestResult(tc.testId);
        if (result?.status === 'pass') coveredPhases.add(tc.phase);
      }
    }

    const allFacets = KNOWN_FACETS;
    const uncoveredFacets = allFacets.filter((f) => !coveredFacets.has(f));
    const uncoveredPhases = (TEST_PHASES as readonly string[]).filter((p) => !coveredPhases.has(p));

    return {
      pipeId: pipe.pipeId,
      totalPaths,
      testedPaths: pipeCases.length,
      pathCoverage: totalPaths > 0 ? Math.round((pipeCases.length / totalPaths) * 100) : 0,
      facetDistribution,
      uncoveredFacets,
      phaseDistribution,
      uncoveredPhases,
    };
  }

  // ── 시뮬레이션 비교 ────────────────────────────

  /**
   * 시뮬레이션 결과를 등록된 happy path와 비교하여 드리프트를 감지한다.
   *
   * @param scenarioId 시나리오(happy path) 식별자
   * @param spec 의도된 경로 선언
   * @param result 시뮬레이션 결과
   * @returns 매칭 결과 + 드리프트 여부
   */
  compareWithSimulation(
    scenarioId: string,
    spec: HappyPathSpec,
    result: SimulationResult,
  ): { scenarioId: string; match: HappyPathMatch; drift: boolean } {
    const match = matchHappyPath(result, spec);
    return { scenarioId, match, drift: !match.match };
  }

  // ── 전체 현황 ─────────────────────────────────

  getOverallStatus(): {
    totalCases: number;
    totalSuites: number;
    totalResults: number;
    passRate: number;
    failures: number;
  } {
    const totalCases = this.cases.size;
    const totalSuites = this.suites.size;
    const totalResults = this.results.length;

    const passed = [...this.latestResults.values()].filter((r) => r.status === 'pass').length;
    const failures = [...this.latestResults.values()].filter((r) => r.status === 'fail').length;
    const tested = this.latestResults.size;

    return {
      totalCases,
      totalSuites,
      totalResults,
      passRate: tested > 0 ? Math.round((passed / tested) * 100) : 0,
      failures,
    };
  }
}
