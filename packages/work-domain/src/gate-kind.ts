/**
 * 품질 게이트 유형 (Gate Kind) 택소노미
 *
 * "이 검증은 무엇을 어떤 범위에서 확인하는가"를 정의한다.
 *
 * 분류 기준:
 *   scope — 검증 범위 (static → unit → integration → system → build → audit)
 *   각 scope 안에서 검증 목적이 다른 kind를 구분한다.
 *
 * 예: typecheck과 lint는 둘 다 코드를 실행하지 않지만,
 *     typecheck은 타입 정합성, lint는 스타일/규칙을 검증한다.
 */

// ─── 검증 범위 ──────────────────────────────────────────

/**
 * 검증 범위 — 게이트가 무엇을 대상으로 하는가
 *
 * | scope       | 대상                     | 실행 비용 |
 * |-------------|--------------------------|----------|
 * | static      | 소스 코드 텍스트          | 최저     |
 * | unit        | 단일 함수/클래스          | 낮음     |
 * | integration | 모듈 간 결합             | 중간     |
 * | system      | 전체 시스템/브라우저       | 높음     |
 * | build       | 빌드 산출물              | 중간     |
 * | audit       | 프로젝트/의존성 메타데이터  | 낮음     |
 * | ai          | AI 모델 출력             | 가변     |
 */
export type GateScope =
  | "static"       // 코드를 실행하지 않고 검증
  | "unit"         // 격리된 단일 단위
  | "integration"  // 여러 단위 결합
  | "system"       // 전체 시스템
  | "build"        // 빌드 산출물
  | "audit"        // 프로젝트 메타 검증
  | "ai";          // AI 특화 검증

// ─── 게이트 유형 ID ─────────────────────────────────────

/**
 * 품질 게이트 유형 식별자
 *
 * 단일 품질 게이트로 쪼갤 수 있는 최소 검증 단위를 열거한다.
 */
export type GateKindId =
  // ── 정적 분석 (코드를 실행하지 않고 검증) ──
  | "typecheck"         // 타입 정합성 — tsc --noEmit
  | "lint"              // 코드 스타일/규칙 — eslint, biome, oxlint
  | "static-analysis"   // 심층 정적 분석 — sonar, codeql, semgrep

  // ── 단위 검증 (격리된 단일 함수/클래스) ──
  | "unit-test"         // 단일 함수 단위 테스트 — vitest, jest
  | "snapshot-test"     // 스냅샷 비교 테스트 — toMatchSnapshot

  // ── 연동 검증 (모듈 간 결합) ──
  | "integration-test"  // 모듈 간 연동 테스트 — 서비스 + DB
  | "transaction-test"  // 트랜잭션 단위 테스트 — DB 롤백 검증
  | "api-contract"      // API 계약 테스트 — supertest, pact

  // ── 시스템 검증 (전체 흐름) ──
  | "e2e-test"          // 브라우저/시스템 E2E — playwright, cypress
  | "visual-check"      // 시각 회귀/확인 — 브라우저, 스토리북
  | "perf-benchmark"    // 성능 벤치마크 — lighthouse, k6

  // ── 빌드 검증 ──
  | "build"             // 단일 패키지 빌드 성공
  | "build-affected"    // 영향 범위 빌드 (monorepo --filter ...[base])

  // ── 품질 감사 ──
  | "security-audit"    // 보안 취약점 감사 — npm audit, snyk
  | "a11y-check"        // 접근성 검증 — axe-core, lighthouse a11y
  | "doc-build"         // 문서 빌드/린트 — markdown-lint, typedoc
  | "license-check"     // 라이선스 호환성 — license-checker

  // ── AI 특화 ──
  | "eval-benchmark"    // AI 모델 평가 — retrieval precision, BLEU
  | "cost-track";       // AI 비용 추적 — token usage, cost per query

// ─── 게이트 유형 정의 ──────────────────────────────────

/** 품질 게이트 유형 전체 정의 */
export interface GateKindDef {
  /** 유형 ID */
  readonly id: GateKindId;
  /** 영문 이름 */
  readonly name: string;
  /** 한글 이름 */
  readonly nameKo: string;
  /** 검증 범위 */
  readonly scope: GateScope;
  /** 설명 */
  readonly description: string;
  /** 대표적 도구/명령 예시 */
  readonly toolExamples: readonly string[];
}

// ─── 게이트 유형 레지스트리 ──────────────────────────────

export const GATE_KINDS: readonly GateKindDef[] = [
  // ── 정적 분석 ──
  {
    id: "typecheck",
    name: "Type Check",
    nameKo: "타입 검사",
    scope: "static",
    description: "소스 코드의 타입 정합성을 컴파일러로 검증한다. 런타임 실행 없이 타입 오류를 발견.",
    toolExamples: ["tsc --noEmit", "mypy", "pyright"],
  },
  {
    id: "lint",
    name: "Lint",
    nameKo: "린트",
    scope: "static",
    description: "코드 스타일, 규칙 위반, 잠재적 버그를 정적으로 검출한다.",
    toolExamples: ["eslint", "biome", "oxlint", "ruff"],
  },
  {
    id: "static-analysis",
    name: "Static Analysis",
    nameKo: "심층 정적 분석",
    scope: "static",
    description: "보안 취약점, 복잡도, 코드 냄새를 심층 분석한다. lint보다 범위가 넓고 느림.",
    toolExamples: ["sonarqube", "codeql", "semgrep"],
  },

  // ── 단위 검증 ──
  {
    id: "unit-test",
    name: "Unit Test",
    nameKo: "단위 테스트",
    scope: "unit",
    description: "단일 함수 또는 클래스를 격리하여 입출력 정합성을 검증한다. 외부 의존을 mock/stub.",
    toolExamples: ["vitest", "jest", "mocha"],
  },
  {
    id: "snapshot-test",
    name: "Snapshot Test",
    nameKo: "스냅샷 테스트",
    scope: "unit",
    description: "출력물을 이전 스냅샷과 비교하여 의도치 않은 변경을 감지한다.",
    toolExamples: ["toMatchSnapshot()", "toMatchInlineSnapshot()"],
  },

  // ── 연동 검증 ──
  {
    id: "integration-test",
    name: "Integration Test",
    nameKo: "통합 테스트",
    scope: "integration",
    description: "여러 모듈/서비스가 결합된 상태에서 동작을 검증한다. 실제 DB, 실제 HTTP 포함 가능.",
    toolExamples: ["vitest + real DB", "supertest", "testcontainers"],
  },
  {
    id: "transaction-test",
    name: "Transaction Test",
    nameKo: "트랜잭션 테스트",
    scope: "integration",
    description: "DB 트랜잭션의 커밋/롤백, 격리 수준, 동시성을 검증한다.",
    toolExamples: ["drizzle + sqlite :memory:", "pg-mem", "rollback assertion"],
  },
  {
    id: "api-contract",
    name: "API Contract Test",
    nameKo: "API 계약 테스트",
    scope: "integration",
    description: "API 엔드포인트의 요청/응답 스키마가 계약(OpenAPI, Zod)에 부합하는지 검증한다.",
    toolExamples: ["supertest", "pact", "dredd", "schemathesis"],
  },

  // ── 시스템 검증 ──
  {
    id: "e2e-test",
    name: "E2E Test",
    nameKo: "E2E 테스트",
    scope: "system",
    description: "실제 브라우저 또는 전체 시스템 스택에서 사용자 시나리오를 재현하여 검증한다.",
    toolExamples: ["playwright", "cypress", "selenoid"],
  },
  {
    id: "visual-check",
    name: "Visual Check",
    nameKo: "시각 검증",
    scope: "system",
    description: "브라우저에서 UI를 렌더링하여 시각적 회귀를 확인한다. 자동화 또는 수동.",
    toolExamples: ["dev-browser 확인", "storybook", "chromatic", "percy"],
  },
  {
    id: "perf-benchmark",
    name: "Performance Benchmark",
    nameKo: "성능 벤치마크",
    scope: "system",
    description: "지연, 처리량, 번들 크기 등 성능 지표를 측정하고 임계치와 비교한다.",
    toolExamples: ["lighthouse", "k6", "autocannon", "vitest bench"],
  },

  // ── 빌드 검증 ──
  {
    id: "build",
    name: "Build",
    nameKo: "빌드",
    scope: "build",
    description: "단일 패키지가 정상적으로 빌드되는지 검증한다. ESM/CJS/DTS 출력 포함.",
    toolExamples: ["tsup", "tsc", "vite build", "esbuild"],
  },
  {
    id: "build-affected",
    name: "Build Affected",
    nameKo: "영향 범위 빌드",
    scope: "build",
    description: "변경된 패키지와 그 의존자 전체가 빌드되는지 검증한다. 모노레포 전용.",
    toolExamples: ["pnpm --filter ...[origin/main] build", "turbo run build --filter=..."],
  },

  // ── 품질 감사 ──
  {
    id: "security-audit",
    name: "Security Audit",
    nameKo: "보안 감사",
    scope: "audit",
    description: "의존성의 알려진 보안 취약점(CVE)을 검사한다.",
    toolExamples: ["pnpm audit", "npm audit", "snyk test"],
  },
  {
    id: "a11y-check",
    name: "Accessibility Check",
    nameKo: "접근성 검증",
    scope: "audit",
    description: "WCAG 기준으로 접근성 위반(ARIA, 명암비, 키보드 내비게이션)을 검사한다.",
    toolExamples: ["axe-core", "lighthouse accessibility", "pa11y"],
  },
  {
    id: "doc-build",
    name: "Document Build",
    nameKo: "문서 빌드",
    scope: "audit",
    description: "문서가 정상적으로 빌드/린트되는지 검증한다.",
    toolExamples: ["markdown-lint", "typedoc", "build:docs"],
  },
  {
    id: "license-check",
    name: "License Check",
    nameKo: "라이선스 검증",
    scope: "audit",
    description: "의존성 라이선스가 프로젝트 정책과 호환되는지 검사한다.",
    toolExamples: ["license-checker", "license-checker-rspack-plugin"],
  },

  // ── AI 특화 ──
  {
    id: "eval-benchmark",
    name: "Eval Benchmark",
    nameKo: "AI 평가 벤치마크",
    scope: "ai",
    description: "AI 모델/파이프라인의 정확도, 재현율, 비용 등을 평가한다.",
    toolExamples: ["retrieval-precision-test", "BLEU score", "eval suite"],
  },
  {
    id: "cost-track",
    name: "Cost Tracking",
    nameKo: "AI 비용 추적",
    scope: "ai",
    description: "AI API 호출의 토큰 사용량과 비용을 추적하여 예산 초과를 방지한다.",
    toolExamples: ["cost-tracker", "token-counter", "usage-report"],
  },
];

// ─── 조회 유틸 ──────────────────────────────────────────

/** 모든 GateKindId 목록 */
export const ALL_GATE_KIND_IDS: readonly GateKindId[] = GATE_KINDS.map((k) => k.id);

/** ID로 게이트 유형 정의 조회 */
export function getGateKindDef(id: GateKindId): GateKindDef {
  const found = GATE_KINDS.find((k) => k.id === id);
  if (!found) throw new Error(`알 수 없는 Gate Kind: ${id}`);
  return found;
}

/** scope로 게이트 유형 필터 */
export function getGateKindsByScope(scope: GateScope): readonly GateKindDef[] {
  return GATE_KINDS.filter((k) => k.scope === scope);
}

/** scope별 게이트 유형 수 (커버리지 파악용) */
export function countByScope(): Record<GateScope, number> {
  const counts: Record<string, number> = {};
  for (const kind of GATE_KINDS) {
    counts[kind.scope] = (counts[kind.scope] ?? 0) + 1;
  }
  return counts as Record<GateScope, number>;
}
