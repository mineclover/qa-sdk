// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 작업 도메인 분류 체계 — 핵심 타입
 *
 * AI 에이전트가 수행하는 작업을 10 대분류(Work Domain)로 분류하고,
 * 각 분류에 맞는 품질 게이트를 자동 매핑하기 위한 타입 정의.
 *
 * 기존 definition-catalog의 scope(문서 분류)와 직교하는 개념:
 *   scope = "이 문서는 무엇에 대한 것인가"
 *   workDomain = "이 작업은 어떤 종류의 엔지니어링인가"
 */

import type { GateKindId } from "./gate-kind.js";

// ─── 작업 도메인 ID (대분류 10종) ────────────────────────

/** 작업 도메인 식별자 — Ralph TUI Atomic Story Master Guide v2.1 기준 */
export type WorkDomainId =
  | "data-infra"          // 1. 데이터 인프라
  | "backend-logic"       // 2. 백엔드 로직
  | "ui-component"        // 3. UI 컴포넌트
  | "frontend-app"        // 4. 프론트엔드 앱
  | "ai-engineering"      // 5. AI 엔지니어링
  | "observability"       // 6. 관측 가능성
  | "global-inclusion"    // 7. 글로벌/포용성
  | "security-guardrail"  // 8. 보안 가드레일
  | "productivity"        // 9. 생산성/성장
  | "tech-docs";          // 10. 기술 문서화

// ─── 중분류 (Sub-Domain) ────────────────────────────────

/** 중분류 — 대분류 내 기능 영역 */
export interface SubDomain {
  /** kebab-case 식별자 */
  readonly id: string;
  /** 영문 이름 */
  readonly name: string;
  /** 한글 이름 */
  readonly nameKo: string;
  /** 소분류 예시 (아토믹 태스크) — reference only */
  readonly atomicTasks: readonly string[];
}

// ─── 품질 게이트 ────────────────────────────────────────

/** 품질 게이트 — 작업 완료를 검증하는 명령 */
export interface QualityGate {
  /** 고유 식별자 */
  readonly id: string;
  /** 게이트 유형 — 어떤 종류의 검증인가 (gate-kind.ts 참조) */
  readonly kind: GateKindId;
  /** 실행할 검증 명령 */
  readonly command: string;
  /** 검증 대상 설명 (한국어) */
  readonly description: string;
}

/**
 * 품질 게이트 문서 스펙.
 *
 * QualityGate가 "도메인 기본 템플릿"이라면,
 * QualityGateSpec은 "실제로 실행 가능한 단일 게이트 문서"를 표현한다.
 */
export interface QualityGateSpec {
  /** 게이트 유형 */
  readonly kind: GateKindId;
  /** 이 게이트가 속한 작업 도메인 */
  readonly workDomain: WorkDomainId;
  /** 중분류 ID (registry.ts의 subDomain.id와 대응, optional) */
  readonly subDomainId?: string;
  /** 연결된 스토리/작업 식별자 (예: US-002) */
  readonly storyId?: string;
  /** 대상 패키지 또는 서비스 */
  readonly package?: string;
  /** 실제 실행 명령 */
  readonly command: string;
  /** 성공 판정 힌트 (예: exit_code=0, stdout contains "...") */
  readonly successPattern?: string;
  /** 참고할 관련 문서/URL/명령 */
  readonly references?: readonly string[];
  /** 성공 시 다음으로 추천할 gate/doc ID */
  readonly suggestOnPass?: readonly string[];
  /** 실패 시 다음으로 추천할 gate/doc ID */
  readonly suggestOnFail?: readonly string[];
}

// ─── 작업 도메인 정의 ──────────────────────────────────

/** 작업 도메인 전체 정의 */
export interface WorkDomainDef {
  /** 대분류 ID */
  readonly id: WorkDomainId;
  /** 영문 이름 */
  readonly name: string;
  /** 한글 이름 */
  readonly nameKo: string;
  /** 중분류 목록 */
  readonly subDomains: readonly SubDomain[];
  /** 도메인 기본 품질 게이트 */
  readonly qualityGates: readonly QualityGate[];
}

// ─── 분류 결과 ──────────────────────────────────────────

/** classifyUserStory() 반환 타입 */
export interface ClassificationResult {
  /** 추론된 작업 도메인 */
  readonly domain: WorkDomainId;
  /** 신뢰도 (0~1) */
  readonly confidence: number;
  /** 매칭된 신호 키워드 */
  readonly signals: readonly string[];
}
