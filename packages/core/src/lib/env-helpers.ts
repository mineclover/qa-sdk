// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 서비스 env.ts 공용 Zod 전처리기.
 *
 * 각 서비스의 envSchema에서 import하여 사용한다.
 */
import { z } from "zod";

/** 빈 문자열("")을 undefined으로 변환 — optional env에 사용 */
export const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

/** 빈 문자열이면 undefined, 아니면 URL 검증 */
export const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional(),
);

/** "true"/"false" 문자열 + boolean + 빈 문자열 → boolean (기본값 false) */
export const booleanWithDefaultFalse = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
      return undefined;
    }

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
}, z.boolean().default(false));
