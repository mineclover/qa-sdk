// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * 품질 게이트 분류 및 스펙 타입
 *
 * demo-catalog의 quality_gate 관련 도메인을 정의하며,
 * core, work-domain, definition-catalog에서 공통으로 참조한다.
 */

// ─── 작업 도메인 ID (대분류 10종) ────────────────────────

import type { GateKindId, WorkDomainId } from './work-domain-data.js';

/** 품질 게이트 문서 스펙. */
export interface QualityGateSpec {
  /** 게이트 유형 */
  readonly kind: GateKindId;
  /** 이 게이트가 속한 작업 도메인 */
  readonly workDomain: WorkDomainId;
  /** 중분류 ID */
  readonly subDomainId?: string;
  /** 연결된 스토리/작업 식별자 */
  readonly storyId?: string;
  /** 대상 패키지 또는 서비스 */
  readonly package?: string;
  /** 실제 실행 명령 */
  readonly command: string;
  /** 성공 판정 힌트 */
  readonly successPattern?: string;
  /** 참고할 관련 문서/URL/명령 */
  readonly references?: readonly string[];
  /** 성공 시 다음으로 추천할 gate/doc ID */
  readonly suggestOnPass?: readonly string[];
  /** 실패 시 다음으로 추천할 gate/doc ID */
  readonly suggestOnFail?: readonly string[];
}
