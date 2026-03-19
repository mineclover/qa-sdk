/**
 * Codegen 중간 표현(IR) — 언어 중립적 데이터 모델.
 *
 * 데이터 원천(DEMO_CATALOG, PrefixSpec)에서 IR을 생성하고,
 * 각 언어 generator가 IR을 소비하여 코드를 출력한다.
 *
 * IR → TypeScript (.ts)
 * IR → Protobuf (.proto)
 * IR → JSON Schema (.json)
 * IR → Go / Rust / ... (확장 가능)
 */

/** enum 하나: axis entries 등 유한 집합 */
export interface IREnum {
  /** 원본 ID (예: "role", "cart_action") */
  id: string;
  /** 설명 */
  description?: string;
  /** capacity (headroom 포함) */
  capacity?: number;
  /** 항목 목록 (순서 보장) */
  values: readonly IREnumValue[];
}

export interface IREnumValue {
  /** 원본 entry 문자열 (예: "admin") */
  name: string;
  /** 0-based position */
  index: number;
  /** 한국어 등 번역 */
  label?: string;
}

/** 구조체 하나: export surface 등 */
export interface IRStruct {
  /** 원본 ID (예: "permission") */
  id: string;
  /** 설명 (예: export pattern) */
  description?: string;
  /** 필드 목록 */
  fields: readonly IRField[];
}

export interface IRField {
  /** 필드 이름 (dim label) */
  name: string;
  /** 타입 참조: enum ID → 해당 enum 타입, null → string */
  enumRef: string | null;
  /** 원본 dim kind */
  dimKind: "axis" | "prefix_ref" | "table_ref";
}

/** codegen 전체 입력 */
export interface IRModule {
  /** 모듈 이름/설명 */
  name?: string;
  /** enum 목록 */
  enums: readonly IREnum[];
  /** struct 목록 */
  structs: readonly IRStruct[];
}
