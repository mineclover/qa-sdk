// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 품질 게이트 유형 (Gate Kind) 택소노미
 */

export type GateScope =
  | "static" | "unit" | "integration" | "system" | "build" | "audit" | "ai";

export type GateKindId =
  | "typecheck" | "lint" | "static-analysis"
  | "unit-test" | "snapshot-test"
  | "integration-test" | "transaction-test" | "api-contract"
  | "e2e-test" | "visual-check" | "perf-benchmark"
  | "build" | "build-affected"
  | "security-audit" | "a11y-check" | "doc-build" | "license-check"
  | "eval-benchmark" | "cost-track";

export interface GateKindDef {
  readonly id: GateKindId;
  readonly name: string;
  readonly nameKo: string;
  readonly scope: GateScope;
  readonly description: string;
  readonly toolExamples: readonly string[];
}

export const GATE_KINDS: readonly GateKindDef[] = [
  { id: "typecheck", name: "Type Check", nameKo: "타입 검사", scope: "static", description: "타입 정합성 검증", toolExamples: ["tsc --noEmit"] },
  { id: "lint", name: "Lint", nameKo: "린트", scope: "static", description: "코드 스타일 및 규칙 검증", toolExamples: ["eslint", "oxlint"] },
  { id: "static-analysis", name: "Static Analysis", nameKo: "심층 정적 분석", scope: "static", description: "보안/복잡도 분석", toolExamples: ["sonarqube"] },
  { id: "unit-test", name: "Unit Test", nameKo: "단위 테스트", scope: "unit", description: "단일 함수/클래스 검증", toolExamples: ["vitest"] },
  { id: "snapshot-test", name: "Snapshot Test", nameKo: "스냅샷 테스트", scope: "unit", description: "출력 스냅샷 비교", toolExamples: ["toMatchSnapshot()"] },
  { id: "integration-test", name: "Integration Test", nameKo: "통합 테스트", scope: "integration", description: "모듈 간 연동 검증", toolExamples: ["vitest + real DB"] },
  { id: "transaction-test", name: "Transaction Test", nameKo: "트랜잭션 테스트", scope: "integration", description: "DB 트랜잭션 원자성 검증", toolExamples: ["drizzle"] },
  { id: "api-contract", name: "API Contract Test", nameKo: "API 계약 테스트", scope: "integration", description: "API 스키마 정합성 검증", toolExamples: ["supertest"] },
  { id: "e2e-test", name: "E2E Test", nameKo: "E2E 테스트", scope: "system", description: "전체 시스템 시나리오 검증", toolExamples: ["playwright"] },
  { id: "visual-check", name: "Visual Check", nameKo: "시각 검증", scope: "system", description: "UI 시각적 회귀 확인", toolExamples: ["dev-browser"] },
  { id: "perf-benchmark", name: "Performance Benchmark", nameKo: "성능 벤치마크", scope: "system", description: "성능 지표 측정", toolExamples: ["k6"] },
  { id: "build", name: "Build", nameKo: "빌드", scope: "build", description: "패키지 빌드 성공 여부", toolExamples: ["tsup"] },
  { id: "build-affected", name: "Build Affected", nameKo: "영향 범위 빌드", scope: "build", description: "변경 영향 패키지 빌드", toolExamples: ["turbo"] },
  { id: "security-audit", name: "Security Audit", nameKo: "보안 감사", scope: "audit", description: "의존성 보안 취약점 감사", toolExamples: ["npm audit"] },
  { id: "a11y-check", name: "Accessibility Check", nameKo: "접근성 검증", scope: "audit", description: "접근성 표준 준수 확인", toolExamples: ["axe-core"] },
  { id: "doc-build", name: "Document Build", nameKo: "문서 빌드", scope: "audit", description: "문서 빌드/린트", toolExamples: ["typedoc"] },
  { id: "license-check", name: "License Check", nameKo: "라이선스 검증", scope: "audit", description: "라이선스 호환성 검사", toolExamples: ["license-checker"] },
  { id: "eval-benchmark", name: "Eval Benchmark", nameKo: "AI 평가 벤치마크", scope: "ai", description: "AI 모델 정확도 평가", toolExamples: ["eval suite"] },
  { id: "cost-track", name: "Cost Tracking", nameKo: "AI 비용 추적", scope: "ai", description: "AI API 토큰 비용 추적", toolExamples: ["cost-tracker"] },
];

export const ALL_GATE_KIND_IDS: readonly GateKindId[] = GATE_KINDS.map((k) => k.id);

/** 작업 도메인 식별자 */
export type WorkDomainId =
  | "data-infra" | "backend-logic" | "ui-component" | "frontend-app" | "ai-engineering"
  | "observability" | "global-inclusion" | "security-guardrail" | "productivity" | "tech-docs";

export const ALL_DOMAIN_IDS: readonly WorkDomainId[] = [
  "data-infra", "backend-logic", "ui-component", "frontend-app", "ai-engineering",
  "observability", "global-inclusion", "security-guardrail", "productivity", "tech-docs",
];

/** 작업 도메인 전체 정의 */
export interface SubDomain {
  readonly id: string;
  readonly name: string;
  readonly nameKo: string;
  readonly atomicTasks: readonly string[];
}

export interface QualityGate {
  readonly id: string;
  readonly kind: GateKindId;
  readonly command: string;
  readonly description: string;
}

export interface WorkDomainDef {
  readonly id: WorkDomainId;
  readonly name: string;
  readonly nameKo: string;
  readonly subDomains: readonly SubDomain[];
  readonly qualityGates: readonly QualityGate[];
}

export const WORK_DOMAINS: readonly WorkDomainDef[] = [
  {
    id: "data-infra",
    name: "Data Infrastructure",
    nameKo: "데이터 인프라",
    subDomains: [
      { id: "db-schema", name: "DB & Schema", nameKo: "DB 및 스키마", atomicTasks: ["테이블 생성", "인덱스 설정", "스냅샷 캡처", "실시간 변경분 스트리밍 반영"] },
      { id: "data-type", name: "Data Types", nameKo: "데이터 타입", atomicTasks: ["Interface 정의", "DTO 생성", "전역 Enum 설정"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
    ],
  },
  {
    id: "backend-logic",
    name: "Backend Logic",
    nameKo: "백엔드 로직",
    subDomains: [
      { id: "api-interface", name: "API Interface", nameKo: "API 인터페이스", atomicTasks: ["엔드포인트 정의", "Zod/Joi 페이로드 스키마 검증"] },
      { id: "auth-security", name: "Auth & Security", nameKo: "권한 및 보안", atomicTasks: ["JWT 미들웨어", "RBAC 접근 제어", "NHI 자격 증명 거버넌스"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
      { id: "api-test", kind: "api-contract", command: "pnpm --filter <pkg> test -- --grep 'e2e\\|integration'", description: "API 통합 테스트" },
    ],
  },
  {
    id: "ui-component",
    name: "UI Components",
    nameKo: "UI 컴포넌트",
    subDomains: [
      { id: "base-element", name: "Base Elements", nameKo: "기초 요소", atomicTasks: ["단일 마크업", "테마 스타일링", "포커스 인디케이터 시각화"] },
      { id: "interaction", name: "Interaction", nameKo: "인터랙션", atomicTasks: ["핸들러 구현", "로컬 상태 관리", "키보드 탭 순서 최적화"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "browser-check", kind: "visual-check", command: "dev-browser 확인", description: "브라우저 시각 검증" },
    ],
  },
  {
    id: "frontend-app",
    name: "Frontend App",
    nameKo: "프론트엔드 앱",
    subDomains: [
      { id: "page-flow", name: "Page & Flow", nameKo: "페이지/플로우", atomicTasks: ["라우팅 설정", "가드 구현", "뷰포트별 반응형 레이아웃 조정"] },
      { id: "data-comm", name: "Data Communication", nameKo: "데이터 통신", atomicTasks: ["API 클라이언트 연동", "낙관적 업데이트", "에러 바운더리 처리"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "e2e", kind: "e2e-test", command: "pnpm --filter <pkg> test:e2e", description: "E2E 테스트" },
      { id: "browser-check", kind: "visual-check", command: "dev-browser 확인", description: "브라우저 시각 검증" },
    ],
  },
  {
    id: "ai-engineering",
    name: "AI Engineering",
    nameKo: "AI 엔지니어링",
    subDomains: [
      { id: "rag-pipeline", name: "RAG Pipeline", nameKo: "RAG 파이프라인", atomicTasks: ["아토믹 Q&A 청킹 전략", "지식 베이스 임베딩 생성", "의미론적 검색 로직"] },
      { id: "prompt-tuning", name: "Prompt Tuning", nameKo: "프롬프트 튜닝", atomicTasks: ["페르소나 정의", "퓨샷 예시 설계", "출력 형식(Strict JSON) 강제"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "eval", kind: "eval-benchmark", command: "pnpm --filter <pkg> test -- --grep eval", description: "평가 벤치마크" },
    ],
  },
  {
    id: "observability",
    name: "Observability",
    nameKo: "관측 가능성",
    subDomains: [
      { id: "telemetry", name: "Telemetry", nameKo: "텔레메트리", atomicTasks: ["골든 시그널 계측(지연, 오류, 트래픽, 포화)", "분산 트레이싱(Span ID) 설정"] },
      { id: "alerting", name: "Alerting", nameKo: "경보 시스템", atomicTasks: ["SLO/SLI 기반 임계치 설정", "알림 라우팅 및 중복 제거 구현"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
      { id: "log-check", kind: "integration-test", command: "pnpm --filter <pkg> test -- --grep log", description: "로그 존재 검증" },
    ],
  },
  {
    id: "global-inclusion",
    name: "Global & Inclusion",
    nameKo: "글로벌/포용성",
    subDomains: [
      { id: "i18n", name: "Internationalization", nameKo: "국제화 (i18n)", atomicTasks: ["문자열 리소스 외부화", "로케일별 날짜/통화 포맷팅", "RTL 레이아웃 지원"] },
      { id: "a11y", name: "Accessibility", nameKo: "접근성 (A11y)", atomicTasks: ["ARIA 랜드마크 삽입", "대체 텍스트(alt) 규정 준수", "명암 대비(4.5:1) 확인"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "browser-check", kind: "visual-check", command: "dev-browser 확인", description: "브라우저 시각 검증" },
    ],
  },
  {
    id: "security-guardrail",
    name: "Security Guardrails",
    nameKo: "보안 가드레일",
    subDomains: [
      { id: "autonomous-safety", name: "Autonomous Safety", nameKo: "자율형 안전장치", atomicTasks: ["프롬프트 주입 필터", "출력값 유해성 차단", "민감 정보(PII) 마스킹 로직"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
      { id: "audit", kind: "security-audit", command: "pnpm audit --audit-level=high", description: "보안 감사" },
    ],
  },
  {
    id: "productivity",
    name: "Productivity & Growth",
    nameKo: "생산성/성장",
    subDomains: [
      { id: "refactoring", name: "Tech Debt & Refactoring", nameKo: "기술 부채/리팩터링", atomicTasks: ["사장된 코드 삭제(Dead Code Removal)", "순환 복잡도 개선", "API 버전 마이그레이션"] },
      { id: "growth-infra", name: "Growth Infrastructure", nameKo: "성장 인프라", atomicTasks: ["XML 사이트맵 자동 생성", "시맨틱 태그 구조화", "이벤트 분석 로그 설계"] },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build-all", kind: "build-affected", command: "pnpm --filter ...[origin/main] build", description: "영향 범위 빌드" },
      { id: "test-all", kind: "integration-test", command: "pnpm --filter ...[origin/main] test", description: "영향 범위 테스트" },
    ],
  },
  {
    id: "tech-docs",
    name: "Technical Documentation",
    nameKo: "기술 문서화",
    subDomains: [
      { id: "system-guide", name: "System Guide", nameKo: "시스템 가이드", atomicTasks: ["Swagger 업데이트", "README 아키텍처 다이어그램(Mermaid) 작성"] },
    ],
    qualityGates: [
      { id: "lint-md", kind: "lint", command: "pnpm markdown-lint", description: "마크다운 린트" },
      { id: "build-docs", kind: "doc-build", command: "pnpm build:docs", description: "문서 빌드" },
    ],
  },
];

/** ID로 서브도메인 조회 */
export function getSubDomain(domainId: string, subDomainId: string): SubDomain | undefined {
  const domain = WORK_DOMAINS.find((d) => d.id === domainId);
  return domain?.subDomains.find((s) => s.id === subDomainId);
}
