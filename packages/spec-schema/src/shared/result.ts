// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/** 성공/실패를 명시적으로 표현하는 Result 타입 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
