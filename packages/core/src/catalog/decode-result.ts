// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * decode-result.ts — 통일 디코딩 결과 타입.
 *
 * L계열(Catalog 기반)과 S계열(DecodeMap 기반) 모두
 * 같은 구조의 결과를 반환할 수 있도록 공통 인터페이스를 정의한다.
 *
 * 각 함수는 깊이에 따라 optional 필드를 채운다:
 *   L1/S1: position + value (기본)
 *   L2:    + ko + ref (재귀)
 *   L3/S2: + ref (1-level)
 */

// ── 차원 단위 ──────────────────────────────────────────────────

/** 디코딩된 단일 차원 */
export interface DecodedDim {
  /** dim label (예: "role", "perm_svc") */
  readonly label: string;
  /** dim 종류 */
  readonly kind: "axis" | "prefix_ref" | "table_ref";
  /** 0-based position within shape */
  readonly position: number;
  /** axis → entry string, prefix_ref → 참조 주소 (정수), table_ref → ref id */
  readonly value: string | number;
  /** 한국어 표시 이름 (axis only, catalog에서 제공) */
  readonly ko?: string;
  /** prefix_ref display label (예: "prod/asia/payment/shop") */
  readonly displayLabel?: string;
  /** prefix_ref 재귀 해석 결과 (deep decode 시에만 채워짐) */
  readonly ref?: DecodeResult;
}

// ── 전체 결과 ──────────────────────────────────────────────────

/** 통일 디코딩 결과 */
export interface DecodeResult {
  /** prefix ID */
  readonly prefix: string;
  /** version ID */
  readonly version: string;
  /** 1D 주소 */
  readonly address: number;
  /** 차원별 디코딩 결과 */
  readonly dims: Record<string, DecodedDim>;
}

// ── 변환 헬퍼 ──────────────────────────────────────────────────

/** S계열 flat entities → DecodeResult 변환 */
export function entitiesToDecodeResult(
  prefix: string,
  version: string,
  address: number,
  entities: Record<string, string | number>,
  dimKinds?: Record<string, "axis" | "prefix_ref" | "table_ref">,
): DecodeResult {
  const dims: Record<string, DecodedDim> = {};
  let pos = 0;
  for (const [label, value] of Object.entries(entities)) {
    dims[label] = {
      label,
      kind: dimKinds?.[label] ?? (typeof value === "number" ? "prefix_ref" : "axis"),
      position: pos++,
      value,
    };
  }
  return { prefix, version, address, dims };
}

/** DecodeResult → S계열 flat entities 변환 */
export function decodeResultToEntities(result: DecodeResult): Record<string, string | number> {
  const entities: Record<string, string | number> = {};
  for (const [label, dim] of Object.entries(result.dims)) {
    entities[label] = dim.value;
  }
  return entities;
}

/** DecodeResult → flat entities + refs (S2 형태) 변환 */
export function decodeResultToDeep(result: DecodeResult): {
  entities: Record<string, string | number>;
  refs: Record<string, Record<string, string | number>>;
} {
  const entities: Record<string, string | number> = {};
  const refs: Record<string, Record<string, string | number>> = {};

  for (const [label, dim] of Object.entries(result.dims)) {
    entities[label] = dim.value;
    if (dim.ref) {
      refs[label] = decodeResultToEntities(dim.ref);
    }
  }

  return { entities, refs };
}
