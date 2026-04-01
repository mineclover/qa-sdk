// ── TestCase — 좌표가 부여된 테스트 단위 ─────────────

export interface TestCase {
  testId: string;
  address: string;              // "test:scope:aspect:facet:seq"
  name: string;
  target: TestTarget;
  expected: TestExpectation;
  contractRef?: string;         // "spec-id#constraint-ref"
  scope?: string;
  aspect?: string;
  facet?: string;
  tags?: string[];
}

export interface TestTarget {
  /** 증명 대상 스펙 */
  specId: string;
  /** ^constraint 내 규칙 참조 */
  constraintRef?: string;
  /** 검증에 사용하는 방법 */
  verificationMethod?: string;
}

export interface TestExpectation {
  type: "pass" | "fail" | "value" | "range" | "contains";
  value?: unknown;
}

// ── TestSuite — 패싯 단위 그룹화 ─────────────────────

export interface TestSuite {
  suiteId: string;
  facet: string;
  scope?: string;
  aspect?: string;
  cases: TestCase[];
  pipeId?: string;
  schemaId?: string;
}

// ── TestResult — 실행 결과 ───────────────────────────

export interface TestResult {
  testId: string;
  address: string;
  status: "pass" | "fail" | "skip" | "error";
  duration: number;
  error?: string;
  executedAt: string;
  runner?: string;
  manifestVersion?: string;
}

// ── QualityMetrics ───────────────────────────────────

export interface FacetQualityMetrics {
  facet: string;
  scope?: string;
  aspect?: string;
  totalTests: number;
  passedTests: number;
  passRate: number;
  hasCoverage: boolean;
  contractVerifiedRate: number;
  lastExecuted?: string;
  hasDrift: boolean;
}

export interface PipeQualityMetrics {
  pipeId: string;
  totalPaths: number;
  testedPaths: number;
  pathCoverage: number;
  facetDistribution: Record<string, number>;
  uncoveredFacets: string[];
}
