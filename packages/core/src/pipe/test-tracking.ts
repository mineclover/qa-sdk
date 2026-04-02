/**
 * 테스트 추적 — 패싯별 수집 + 검증 루프 + 품질 지표 + drift 감지
 */

import type {
  TestCase, TestSuite, TestResult,
  FacetQualityMetrics, PipeQualityMetrics,
} from "../types/test-tracking.js";
import type { PipeSpec } from "../types/pipe-spec.js";
import type { SimulationResult } from "./pipe-simulate.js";
import { matchHappyPath } from "./pipe-simulate.js";
import type { HappyPathSpec, HappyPathMatch } from "./pipe-simulate.js";
import { countPipePaths } from "./pipe-path.js";

// ── TestCase 주소 생성 ───────────────────────────────

/** 테스트 케이스 주소 생성 */
export function buildTestAddress(
  scopeIndex: number,
  aspectIndex: number,
  facet: string,
  seq: number,
): string {
  return `test:${scopeIndex}:${aspectIndex}:${facet}:${seq}`;
}

/** 테스트 주소 파싱 */
export function parseTestAddress(address: string): {
  scopeIndex: number;
  aspectIndex: number;
  facet: string;
  seq: number;
} | null {
  const match = address.match(/^test:(\d+):(\d+):([^:]+):(\d+)$/);
  if (!match) return null;
  return {
    scopeIndex: Number(match[1]),
    aspectIndex: Number(match[2]),
    facet: match[3],
    seq: Number(match[4]),
  };
}

// ── TestRegistry — 테스트 케이스 + 결과 수집 ─────────

export class TestRegistry {
  private readonly cases: Map<string, TestCase> = new Map();
  private readonly suites: Map<string, TestSuite> = new Map();
  private readonly results: TestResult[] = [];

  // ── 테스트 케이스 ──────────────────────────────

  registerCase(tc: TestCase): void {
    this.cases.set(tc.testId, tc);
  }

  getCase(testId: string): TestCase | null {
    return this.cases.get(testId) ?? null;
  }

  getCasesBySpec(specId: string): TestCase[] {
    return [...this.cases.values()].filter(tc => tc.target.specId === specId);
  }

  getCasesByFacet(facet: string): TestCase[] {
    return [...this.cases.values()].filter(tc => tc.facet === facet);
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
    return [...this.suites.values()].filter(s => s.facet === facet);
  }

  listSuites(): TestSuite[] {
    return [...this.suites.values()];
  }

  // ── 결과 수집 ─────────────────────────────────

  recordResult(result: TestResult): void {
    this.results.push(result);
  }

  recordResults(results: TestResult[]): void {
    for (const r of results) this.results.push(r);
  }

  getLatestResult(testId: string): TestResult | null {
    const filtered = this.results.filter(r => r.testId === testId);
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }

  getResultsByAddress(address: string): TestResult[] {
    return this.results.filter(r => r.address === address);
  }

  getFailures(): TestResult[] {
    // 각 testId의 최신 결과만 보고 fail인 것
    const latest = new Map<string, TestResult>();
    for (const r of this.results) {
      latest.set(r.testId, r);
    }
    return [...latest.values()].filter(r => r.status === "fail");
  }

  // ── 품질 지표 ─────────────────────────────────

  computeFacetMetrics(
    facet: string,
    schemaUpdatedAt?: string,
  ): FacetQualityMetrics {
    const cases = this.getCasesByFacet(facet);
    let passed = 0;
    let lastExecuted: string | undefined;
    let hasDrift = false;

    for (const tc of cases) {
      const result = this.getLatestResult(tc.testId);
      if (result) {
        if (result.status === "pass") passed++;
        if (!lastExecuted || result.executedAt > lastExecuted) {
          lastExecuted = result.executedAt;
        }
        // drift: 스키마 변경 후 테스트 미실행
        if (schemaUpdatedAt && result.executedAt < schemaUpdatedAt) {
          hasDrift = true;
        }
      } else {
        hasDrift = true; // 미실행
      }
    }

    const total = cases.length;
    // contractVerifiedRate: contractRef가 있는 케이스 중 pass 비율
    const contractCases = cases.filter(tc => tc.contractRef);
    const contractPassed = contractCases.filter(tc => {
      const r = this.getLatestResult(tc.testId);
      return r?.status === "pass";
    }).length;

    return {
      facet,
      totalTests: total,
      passedTests: passed,
      passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
      hasCoverage: total > 0,
      contractVerifiedRate: contractCases.length > 0
        ? Math.round((contractPassed / contractCases.length) * 100) : 0,
      lastExecuted,
      hasDrift,
    };
  }

  computePipeMetrics(pipe: PipeSpec): PipeQualityMetrics {
    const totalPaths = countPipePaths(pipe.flow);
    const pipeCases = [...this.cases.values()].filter(
      tc => tc.target.specId === pipe.pipeId || tc.tags?.includes(pipe.pipeId),
    );

    // 패싯별 분포
    const facetDistribution: Record<string, number> = {};
    const coveredFacets = new Set<string>();
    for (const tc of pipeCases) {
      if (tc.facet) {
        facetDistribution[tc.facet] = (facetDistribution[tc.facet] ?? 0) + 1;
        const result = this.getLatestResult(tc.testId);
        if (result?.status === "pass") coveredFacets.add(tc.facet);
      }
    }

    const allFacets = ["생산", "소비", "정의", "관리", "저장"];
    const uncoveredFacets = allFacets.filter(f => !coveredFacets.has(f));

    return {
      pipeId: pipe.pipeId,
      totalPaths,
      testedPaths: pipeCases.length,
      pathCoverage: totalPaths > 0 ? Math.round((pipeCases.length / totalPaths) * 100) : 0,
      facetDistribution,
      uncoveredFacets,
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

    const latest = new Map<string, TestResult>();
    for (const r of this.results) latest.set(r.testId, r);
    const passed = [...latest.values()].filter(r => r.status === "pass").length;
    const failures = [...latest.values()].filter(r => r.status === "fail").length;
    const tested = latest.size;

    return {
      totalCases,
      totalSuites,
      totalResults,
      passRate: tested > 0 ? Math.round((passed / tested) * 100) : 0,
      failures,
    };
  }
}
