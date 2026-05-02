// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * 공유 검증 유틸리티
 *
 * WeightedIndex, LabelRegistry, PrefixCodec에서 공통으로 쓰는
 * 검증 함수들을 모아 중복 제거.
 */

import { SerializeError, ShapeError } from "./errors.js";

/**
 * 에러 메시지용: Iterable 항목들을 ", " 로 연결해 목록 문자열 생성.
 * @example formatList(["a", "b", "c"]) // "a, b, c"
 */
export function formatList(items: Iterable<string>): string {
  return [...items].join(", ");
}

/**
 * 직렬화 구분자 ":" 포함 여부 검증.
 * 버전 식별자와 prefix 이름에 적용.
 */
export function assertNoColon(value: string, context: string): void {
  if (!value) {
    throw new SerializeError(`${context} must be non-empty`);
  }
  if (value.includes(":")) {
    throw new SerializeError(
      `${context} cannot contain ":" (used as serialize separator): "${value}"`
    );
  }
}

/**
 * 양의 정수 검증.
 * shape 차원값, max값 등에 적용.
 */
export function assertPositiveInt(value: number, context: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new ShapeError(`${context} must be a positive integer, got ${value}`);
  }
}

/**
 * 배열이 비어 있지 않음을 검증.
 */
export function assertNonEmptyArray(arr: readonly unknown[], context: string): void {
  if (arr.length === 0) {
    throw new ShapeError(`${context} must have at least one element`);
  }
}
