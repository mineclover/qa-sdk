// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

/**
 * grammar #12 idempotency key 합성을 위한 aggregateId 정규화.
 *
 * spec 03 §2.12 — buildIdempotencyKey 의 aggregateId 는 `^[a-z][a-z0-9-]+$` 형식.
 * 도메인 entity id 가 underscore 또는 mixed-case 형태(예: `doc_001`)로 운영되고 있어
 * idempotency key 합성 직전에 본 함수로 canonical 형태로 변환한다.
 *
 * - underscore → hyphen
 * - 대문자 → 소문자
 * - grammar 외 문자(공백·특수문자) → hyphen
 * - 첫 글자가 숫자/하이픈일 경우 'x-' prefix
 * - 결과가 빈 문자열일 경우 throw — 정상 entity id 라면 도달 불가
 *
 * 본 함수는 raw 보간이 아니라 *정규화* 다 — fallback approximation 이 아니라
 * grammar 가 요구하는 정규화 규칙의 명시적 구현.
 */
export function toGrammarSafeAggregateId(rawId: string): string {
  if (typeof rawId !== 'string' || rawId.length === 0) {
    throw new Error(`toGrammarSafeAggregateId: empty id`);
  }
  let s = rawId.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  // 연속 hyphen 정리.
  s = s.replace(/-+/g, '-');
  // 첫 글자 보정 — grammar 는 [a-z] 로 시작.
  if (!/^[a-z]/.test(s)) s = `x-${s}`;
  // trailing hyphen 정리.
  s = s.replace(/-+$/, '');
  if (s.length < 2) {
    throw new Error(`toGrammarSafeAggregateId: id too short after normalization: ${rawId}`);
  }
  return s;
}
