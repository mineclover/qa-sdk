// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 작업 도메인 레지스트리
 *
 * Ralph TUI Atomic Story Master Guide v2.1 기준
 * 10 대분류 × 20 중분류 × 소분류(아토믹 태스크) + 품질 게이트
 */

import type { WorkDomainDef, WorkDomainId } from "./types.js";

// ─── 10 대분류 레지스트리 ───────────────────────────────

export const WORK_DOMAINS: readonly WorkDomainDef[] = [
  // ── 1. 데이터 인프라 ──
  {
    id: "data-infra",
    name: "Data Infrastructure",
    nameKo: "데이터 인프라",
    subDomains: [
      {
        id: "db-schema",
        name: "DB & Schema",
        nameKo: "DB 및 스키마",
        atomicTasks: [
          "테이블 생성",
          "인덱스 설정",
          "스냅샷 캡처",
          "실시간 변경분 스트리밍 반영",
        ],
      },
      {
        id: "data-type",
        name: "Data Types",
        nameKo: "데이터 타입",
        atomicTasks: [
          "Interface 정의",
          "DTO 생성",
          "전역 Enum 설정",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
    ],
  },

  // ── 2. 백엔드 로직 ──
  {
    id: "backend-logic",
    name: "Backend Logic",
    nameKo: "백엔드 로직",
    subDomains: [
      {
        id: "api-interface",
        name: "API Interface",
        nameKo: "API 인터페이스",
        atomicTasks: [
          "엔드포인트 정의",
          "Zod/Joi 페이로드 스키마 검증",
        ],
      },
      {
        id: "auth-security",
        name: "Auth & Security",
        nameKo: "권한 및 보안",
        atomicTasks: [
          "JWT 미들웨어",
          "RBAC 접근 제어",
          "NHI 자격 증명 거버넌스",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
      { id: "api-test", kind: "api-contract", command: "pnpm --filter <pkg> test -- --grep 'e2e\\|integration'", description: "API 통합 테스트" },
    ],
  },

  // ── 3. UI 컴포넌트 ──
  {
    id: "ui-component",
    name: "UI Components",
    nameKo: "UI 컴포넌트",
    subDomains: [
      {
        id: "base-element",
        name: "Base Elements",
        nameKo: "기초 요소",
        atomicTasks: [
          "단일 마크업",
          "테마 스타일링",
          "포커스 인디케이터 시각화",
        ],
      },
      {
        id: "interaction",
        name: "Interaction",
        nameKo: "인터랙션",
        atomicTasks: [
          "핸들러 구현",
          "로컬 상태 관리",
          "키보드 탭 순서 최적화",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "browser-check", kind: "visual-check", command: "dev-browser 확인", description: "브라우저 시각 검증" },
    ],
  },

  // ── 4. 프론트엔드 앱 ──
  {
    id: "frontend-app",
    name: "Frontend App",
    nameKo: "프론트엔드 앱",
    subDomains: [
      {
        id: "page-flow",
        name: "Page & Flow",
        nameKo: "페이지/플로우",
        atomicTasks: [
          "라우팅 설정",
          "가드 구현",
          "뷰포트별 반응형 레이아웃 조정",
        ],
      },
      {
        id: "data-comm",
        name: "Data Communication",
        nameKo: "데이터 통신",
        atomicTasks: [
          "API 클라이언트 연동",
          "낙관적 업데이트",
          "에러 바운더리 처리",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "e2e", kind: "e2e-test", command: "pnpm --filter <pkg> test:e2e", description: "E2E 테스트" },
      { id: "browser-check", kind: "visual-check", command: "dev-browser 확인", description: "브라우저 시각 검증" },
    ],
  },

  // ── 5. AI 엔지니어링 ──
  {
    id: "ai-engineering",
    name: "AI Engineering",
    nameKo: "AI 엔지니어링",
    subDomains: [
      {
        id: "rag-pipeline",
        name: "RAG Pipeline",
        nameKo: "RAG 파이프라인",
        atomicTasks: [
          "아토믹 Q&A 청킹 전략",
          "지식 베이스 임베딩 생성",
          "의미론적 검색 로직",
        ],
      },
      {
        id: "prompt-tuning",
        name: "Prompt Tuning",
        nameKo: "프롬프트 튜닝",
        atomicTasks: [
          "페르소나 정의",
          "퓨샷 예시 설계",
          "출력 형식(Strict JSON) 강제",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "eval", kind: "eval-benchmark", command: "pnpm --filter <pkg> test -- --grep eval", description: "평가 벤치마크" },
    ],
  },

  // ── 6. 관측 가능성 ──
  {
    id: "observability",
    name: "Observability",
    nameKo: "관측 가능성",
    subDomains: [
      {
        id: "telemetry",
        name: "Telemetry",
        nameKo: "텔레메트리",
        atomicTasks: [
          "골든 시그널 계측(지연, 오류, 트래픽, 포화)",
          "분산 트레이싱(Span ID) 설정",
        ],
      },
      {
        id: "alerting",
        name: "Alerting",
        nameKo: "경보 시스템",
        atomicTasks: [
          "SLO/SLI 기반 임계치 설정",
          "알림 라우팅 및 중복 제거 구현",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
      { id: "log-check", kind: "integration-test", command: "pnpm --filter <pkg> test -- --grep log", description: "로그 존재 검증" },
    ],
  },

  // ── 7. 글로벌/포용성 ──
  {
    id: "global-inclusion",
    name: "Global & Inclusion",
    nameKo: "글로벌/포용성",
    subDomains: [
      {
        id: "i18n",
        name: "Internationalization",
        nameKo: "국제화 (i18n)",
        atomicTasks: [
          "문자열 리소스 외부화",
          "로케일별 날짜/통화 포맷팅",
          "RTL 레이아웃 지원",
        ],
      },
      {
        id: "a11y",
        name: "Accessibility",
        nameKo: "접근성 (A11y)",
        atomicTasks: [
          "ARIA 랜드마크 삽입",
          "대체 텍스트(alt) 규정 준수",
          "명암 대비(4.5:1) 확인",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "browser-check", kind: "visual-check", command: "dev-browser 확인", description: "브라우저 시각 검증" },
    ],
  },

  // ── 8. 보안 가드레일 ──
  {
    id: "security-guardrail",
    name: "Security Guardrails",
    nameKo: "보안 가드레일",
    subDomains: [
      {
        id: "autonomous-safety",
        name: "Autonomous Safety",
        nameKo: "자율형 안전장치",
        atomicTasks: [
          "프롬프트 주입 필터",
          "출력값 유해성 차단",
          "민감 정보(PII) 마스킹 로직",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build", kind: "build", command: "pnpm --filter <pkg> build", description: "빌드 성공" },
      { id: "test", kind: "unit-test", command: "pnpm --filter <pkg> test", description: "테스트 통과" },
      { id: "audit", kind: "security-audit", command: "pnpm audit --audit-level=high", description: "보안 감사" },
    ],
  },

  // ── 9. 생산성/성장 ──
  {
    id: "productivity",
    name: "Productivity & Growth",
    nameKo: "생산성/성장",
    subDomains: [
      {
        id: "refactoring",
        name: "Tech Debt & Refactoring",
        nameKo: "기술 부채/리팩터링",
        atomicTasks: [
          "사장된 코드 삭제(Dead Code Removal)",
          "순환 복잡도 개선",
          "API 버전 마이그레이션",
        ],
      },
      {
        id: "growth-infra",
        name: "Growth Infrastructure",
        nameKo: "성장 인프라",
        atomicTasks: [
          "XML 사이트맵 자동 생성",
          "시맨틱 태그 구조화",
          "이벤트 분석 로그 설계",
        ],
      },
    ],
    qualityGates: [
      { id: "typecheck", kind: "typecheck", command: "pnpm typecheck", description: "타입 검사" },
      { id: "build-all", kind: "build-affected", command: "pnpm --filter ...[origin/main] build", description: "영향 범위 빌드" },
      { id: "test-all", kind: "integration-test", command: "pnpm --filter ...[origin/main] test", description: "영향 범위 테스트" },
    ],
  },

  // ── 10. 기술 문서화 ──
  {
    id: "tech-docs",
    name: "Technical Documentation",
    nameKo: "기술 문서화",
    subDomains: [
      {
        id: "system-guide",
        name: "System Guide",
        nameKo: "시스템 가이드",
        atomicTasks: [
          "Swagger 업데이트",
          "README 아키텍처 다이어그램(Mermaid) 작성",
        ],
      },
    ],
    qualityGates: [
      { id: "lint-md", kind: "lint", command: "pnpm markdown-lint", description: "마크다운 린트" },
      { id: "build-docs", kind: "doc-build", command: "pnpm build:docs", description: "문서 빌드" },
    ],
  },
] as const satisfies readonly WorkDomainDef[];

// ─── 조회 유틸 ──────────────────────────────────────────

/** 모든 WorkDomainId 목록 */
export const ALL_DOMAIN_IDS: readonly WorkDomainId[] = WORK_DOMAINS.map((d) => d.id);

/** ID로 도메인 정의 조회 */
export function getDomainDef(id: WorkDomainId): WorkDomainDef {
  const found = WORK_DOMAINS.find((d) => d.id === id);
  if (!found) throw new Error(`알 수 없는 Work Domain: ${id}`);
  return found;
}

/** ID로 서브도메인 조회 */
export function getSubDomain(domainId: WorkDomainId, subDomainId: string) {
  const domain = getDomainDef(domainId);
  return domain.subDomains.find((s) => s.id === subDomainId);
}
