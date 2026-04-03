/**
 * 테스트 이름 생성 — 구조화된 메타데이터에서 describe/it 문자열 파생.
 *
 * 테스트 로직은 건드리지 않음 — 이름만 생성.
 * test.md 시나리오 ID와 자동 매칭 가능.
 */

// ── 카테고리 (고정 7종) ─────────────────────────────

export const TEST_CATEGORIES = [
  "정상", "엣지", "소비", "체인", "충돌", "연동", "직렬화",
] as const;

export type TestCategory = typeof TEST_CATEGORIES[number];

// ── 메타데이터 ──────────────────────────────────────

export interface TestNameInput {
  /** 소스 모듈 (예: "pipe-lineage") */
  module: string;
  /** 대상 함수 (예: "deriveStaticLineage") */
  fn: string;
  /** 패싯 (예: "기여추적") — 선택 */
  facet?: string;
  /** 카테고리 */
  category: TestCategory | string;
  /** 입력 서술 (예: "a+b") */
  input: string;
  /** 해결된 것 / 출력 (예: "c") */
  resolved: string;
  /** 기대 서술 (예: "양쪽 기여") */
  expect: string;
  /** 검증 방법 (예: "lineage-sources") — 선택 */
  verify?: string;
}

export interface TestNameResult {
  /** describe에 사용 */
  describe: string;
  /** it에 사용 */
  it: string;
  /** 매칭용 고유 ID */
  id: string;
  /** 원본 메타데이터 */
  meta: TestNameInput;
}

// ── 이름 생성 ───────────────────────────────────────

export function testName(input: TestNameInput): TestNameResult {
  const facetSuffix = input.facet ? ` [${input.facet}]` : "";
  const describeName = `${input.module} > ${input.fn}${facetSuffix}`;
  const itName = `${input.category}: ${input.input} → ${input.resolved} — ${input.expect}`;
  const facetTag = input.facet ? `[${input.facet}]` : "";
  const id = `${input.module} > ${input.fn}${facetTag} > ${input.category}: ${input.input} → ${input.resolved}`;

  return { describe: describeName, it: itName, id, meta: input };
}

// ── 배치 생성 ───────────────────────────────────────

export interface TestGroupInput {
  module: string;
  fn: string;
  facet?: string;
  cases: Omit<TestNameInput, "module" | "fn" | "facet">[];
}

export interface TestGroupResult {
  describe: string;
  cases: TestNameResult[];
}

export function testGroup(input: TestGroupInput): TestGroupResult {
  const base = { module: input.module, fn: input.fn, facet: input.facet };
  const facetSuffix = input.facet ? ` [${input.facet}]` : "";
  const describeName = `${input.module} > ${input.fn}${facetSuffix}`;

  return {
    describe: describeName,
    cases: input.cases.map(c => testName({ ...base, ...c })),
  };
}
