// @def.boundary persistence-system-root
// @def.doc persistence-system-root

/* ------------------------------------------------------------------ */
/*  address-index 핵심 타입                                             */
/*                                                                      */
/*  address_context 문자열 "tracking:v2:1200"을 정규화하여               */
/*  { prefixId, version, address } 튜플로 분해 + 역색인                 */
/* ------------------------------------------------------------------ */

/** address_context 값 파싱 결과 ("tracking:v2:1200" → 구조체) */
export interface ParsedAddress {
  prefixId: string;
  version: string;
  address: number;
}

/** 인덱스에 저장되는 하나의 엔트리 */
export interface AddressEntry {
  /** 원본 레코드 ID (log_id) */
  recordId: string;
  /** prefix ID */
  prefixId: string;
  /** prefix version */
  version: string;
  /** 1D 인코딩된 주소 (정수) */
  address: number;
  /** 레코드 타임스탬프 ISO-8601 */
  timestamp: string;
}

/** 주소 기반 조회 쿼리 */
export interface AddressQuery {
  /** 대상 prefix */
  prefixId: string;
  /** prefix version (생략 시 전체) */
  version?: string;
  /** 정확한 주소 매치 */
  address?: number;
  /** 주소 범위 [from, to] (inclusive) */
  addressRange?: { from: number; to: number };
  /** 시간 범위 */
  timeRange?: { from?: string; to?: string };
  /** 최대 결과 수 (기본 100) */
  limit?: number;
  /** 오프셋 */
  offset?: number;
}

/** 다중 prefix 교차 쿼리 — "prefix A에서 범위 X AND prefix B에서 범위 Y" */
export interface CrossPrefixQuery {
  /** 각 prefix별 조건 (AND 결합) */
  constraints: AddressQuery[];
  /** 시간 범위 (전체 적용) */
  timeRange?: { from?: string; to?: string };
  limit?: number;
  offset?: number;
}

/** 검색 결과 한 건 */
export interface AddressHit {
  recordId: string;
  /** 매치된 prefix별 주소 */
  addresses: Record<string, { version: string; address: number }>;
  timestamp: string;
}

/** prefix별 통계 */
export interface AddressStats {
  prefixId: string;
  /** 인덱싱된 레코드 수 */
  recordCount: number;
  /** 고유 주소 수 */
  uniqueAddresses: number;
  /** 주소 범위 */
  addressRange: { min: number; max: number } | null;
}

/* ---- 파서 ---- */

/**
 * address_context 값 파싱: "tracking:v2:1200" → { prefixId, version, address }
 * 실패 시 null 반환 (fail-open)
 */
export function parseAddressValue(raw: string): ParsedAddress | null {
  const parts = raw.split(':');
  if (parts.length < 3) return null;

  const address = Number(parts[parts.length - 1]);
  if (!Number.isFinite(address) || address < 0) return null;

  const version = parts[parts.length - 2];
  const prefixId = parts.slice(0, parts.length - 2).join(':');

  if (!prefixId || !version) return null;

  return { prefixId, version, address };
}

/**
 * address_context 객체 전체 파싱
 * { "tracking": "tracking:v2:1200", "content": "content:v1:42" }
 * → ParsedAddress[]
 */
export function parseAddressContext(ctx: Record<string, string>): ParsedAddress[] {
  const results: ParsedAddress[] = [];
  for (const value of Object.values(ctx)) {
    const parsed = parseAddressValue(value);
    if (parsed) results.push(parsed);
  }
  return results;
}
