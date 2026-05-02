// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * format.ts — 숫자·텍스트 포매팅 유틸리티.
 */

export { formatLargeNumber } from "weighted-index";

/** N hex chars 필드의 미리보기 문자열. 0x + padStart(chars, "0") 형식. */
export function hexPreview(chars: number, val: number): string {
  if (chars <= 0) return "—";
  const max = 16 ** chars - 1;
  return "0x" + Math.min(val, max).toString(16).toUpperCase().padStart(chars, "0");
}

/** 숫자를 유니코드 첨자로 변환. 1 → ₁, 123 → ₁₂₃ */
export function subscript(n: number): string {
  return String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]);
}

/** Excel 스타일 컬럼 레터. 0→A, 1→B, ..., 25→Z, 26→AA */
export function colLetter(idx: number): string {
  let result = "";
  let n = idx;
  do {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}
