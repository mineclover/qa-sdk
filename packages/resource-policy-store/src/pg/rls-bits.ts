// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-rls-enforcement

/**
 * RLS 정책이 참조하는 타입-레벨 bitmap bit address SSOT.
 *
 * SQL 정책 DDL 에 숫자 리터럴로 하드코딩되므로 값 변경은 마이그레이션 동반 필수.
 * 본 파일이 유일한 source — application (bitmap 발급자) 은 본 상수를 import.
 *
 * 숫자 할당 규칙:
 *   - 10~19: resource_policies 관련 (read / write / delete)
 *   - 20~29: audit 관련 (read / admin_scope)
 *   - 30~39: ingest 관련 (key_observations / event_records read)
 *   - 40+ : 후속 도메인 예약
 */

export const RP_READ_BIT = 10;
export const RP_WRITE_BIT = 11;
export const RP_DELETE_BIT = 12;

export const AUDIT_READ_BIT = 20;

export const INGEST_READ_BIT = 30;
export const EVENT_READ_BIT = 31;

/** 테스트·문서에서 전체 목록을 순회해야 할 때 사용. */
export const RLS_BIT_CATALOG = Object.freeze({
  RP_READ_BIT,
  RP_WRITE_BIT,
  RP_DELETE_BIT,
  AUDIT_READ_BIT,
  INGEST_READ_BIT,
  EVENT_READ_BIT,
} as const);

export type RlsBitName = keyof typeof RLS_BIT_CATALOG;
