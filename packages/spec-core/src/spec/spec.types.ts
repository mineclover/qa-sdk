// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * 설계 근거 문서 타입 정의.
 *
 * c4-doc의 문서 타입 체계에서 좌표계에 필요한 것만 추출.
 * prefix의 존재 이유, 차원 선택의 근거, 좌표 간 관계를 정의.
 */

/** 스펙 문서 유형 */
export type SpecType =
  | 'req' // 요구사항 — 왜 이 prefix가 필요한가
  | 'feat' // 기능 — 이 prefix가 무엇을 하는가
  | 'uc' // 유즈케이스 — 이 prefix가 어떻게 쓰이는가
  | 'evt' // 이벤트 — 이 prefix가 어떤 이벤트를 나타내는가
  | 'ls' // 로직 스펙 — 이 prefix의 행위 규칙
  | 'adr'; // 아키텍처 결정 — 이 prefix 설계에 대한 결정 기록

/**
 * 스펙 문서 식별자.
 * 계층적 구조: "FEAT-003", "FEAT-003-LS-01", "FEAT-003-LS-01-TC-01"
 */
export type SpecId = string;

/** 스펙 문서 생명주기 */
export type SpecLifecycle = 'draft' | 'active' | 'deprecated';

/** 스펙 문서 간 관계 */
export interface SpecRelation {
  from: SpecId;
  to: SpecId;
  type:
    | 'satisfies' // 요구사항을 충족
    | 'implements' // 기능을 구현
    | 'tests' // 로직을 검증
    | 'traces-to' // 추적 연결
    | 'depends-on'; // 의존
}

/** 스펙 문서 */
export interface SpecDocument {
  id: SpecId;
  type: SpecType;
  title: string;
  lifecycle: SpecLifecycle;
  rationale?: string;
  relations?: readonly SpecRelation[];
}
