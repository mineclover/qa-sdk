/**
 * Layer 2 스키마 시스템 타입 정의.
 *
 * 6 기본 카테고리 + SchemaAxis + Fragment + Constraint.
 * 도메인 개념이 아니라 "구조 역할(role of structure)" 중심 분류.
 *
 * 참조: docs/specs/indexing/schema-layer.md
 */

/** 구조 카테고리 6종 */
export type SchemaCategory =
  | "entity"       // 정체성을 가진 것
  | "event"        // 발생한 것
  | "relation"     // 둘 이상의 객체 간 연결
  | "state"        // 상태 스냅샷
  | "policy"       // 권한/적용 범위/판정 구조
  | "observation"; // 관측/로깅/추적

/** 축의 값 유형 */
export type SchemaValueType = "vocabulary" | "ref" | "literal" | "coordinate";

/** 스키마의 각 축(slot) 정의 */
export interface SchemaAxis {
  /** 축 ID */
  axisId: string;

  /** 필수 여부 */
  required: boolean;

  /** 복수 값 허용 여부 */
  multi: boolean;

  /** 값 유형 */
  valueType: SchemaValueType;

  /** vocabulary 축 참조 (valueType이 "vocabulary"일 때) */
  vocabularyRef?: string;

  /** 기본값 */
  defaultValue?: string | number;
}

/** 스키마 정의 */
export interface SchemaDef {
  /** 스키마 식별자. 형식: "{category}.{name}" */
  id: string;

  /** 버전 */
  version: string;

  /** 구조 카테고리 */
  category: SchemaCategory;

  /** 축 정의 */
  axes: Record<string, SchemaAxis>;

  /** Fragment 참조 (조합, 상속이 아님) */
  use?: readonly string[];

  /** 구조적 제약 */
  constraints?: readonly SchemaConstraint[];
}

/** Fragment: 공통 구조를 추출하여 조합 */
export interface SchemaFragment {
  /** fragment 식별자 */
  id: string;

  /** 축 정의 (스키마에 합성됨) */
  axes: Record<string, SchemaAxis>;
}

/** 구조적 제약. 의미적 규칙(Layer 3)은 여기에 넣지 않는다. */
export interface SchemaConstraint {
  /** 제약 종류 */
  rule: "maxCount" | "minCount" | "requiredIf" | "exclusive";

  /** 대상 축 */
  axis: string;

  /** 값 (maxCount/minCount에 사용) */
  value?: number;

  /** 조건 (requiredIf에 사용) */
  condition?: { axis: string; value: string };
}
