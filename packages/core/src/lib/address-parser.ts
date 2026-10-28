// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 주소 파싱/직렬화 유틸리티.
 *
 * 기존 3파트 형식 "prefix:version:address"와
 * 4파트 형식 "catalogId:prefix:version:address"를 양립.
 */

export interface ParsedAddress {
  /** 카탈로그 ID. undefined면 기본 카탈로그. */
  readonly catalogId?: string;
  /** prefix 식별자 (예: "permission", "order_event") */
  readonly prefix: string;
  /** 버전 (예: "v1") */
  readonly version: string;
  /** 1D 정수 주소 */
  readonly address: number;
}

/** 정규 주소 숫자: 0 또는 선행 0 없는 10진 정수 (부호·소수·지수·16진·공백 불허) */
const CANONICAL_ADDRESS_RE = /^(0|[1-9]\d*)$/;

function parseAddressNumber(raw: string, serialized: string): number {
  if (!CANONICAL_ADDRESS_RE.test(raw)) {
    throw new Error(`Invalid address number: "${raw}" in "${serialized}"`);
  }
  const address = Number(raw);
  if (!Number.isSafeInteger(address)) {
    throw new Error(
      `Address exceeds Number.MAX_SAFE_INTEGER: "${raw}" in "${serialized}" — BigInt codec 사용`,
    );
  }
  return address;
}

function requireSegment(value: string, name: string, serialized: string): string {
  if (value.length === 0) {
    throw new Error(`Empty ${name} in "${serialized}"`);
  }
  return value;
}

/**
 * 직렬화된 주소를 파싱. 이 함수가 core의 정규 파서다 (parsePackedAddress는 위임).
 *
 * - 3파트 "prefix:ver:addr" → 기본 카탈로그
 * - 4파트 "catalogId:prefix:ver:addr" → 명시적 카탈로그
 * - address는 0 이상 안전한 정수의 정규 10진 표기만 허용
 *
 * @param serialized 직렬화된 주소 문자열
 * @param knownCatalogIds 알려진 카탈로그 ID 집합 (4파트 판별에 사용)
 */
export function parseSerializedAddress(
  serialized: string,
  knownCatalogIds?: ReadonlySet<string>,
): ParsedAddress {
  const parts = serialized.split(':');
  if (parts.length === 3) {
    return {
      prefix: requireSegment(parts[0], 'prefix', serialized),
      version: requireSegment(parts[1], 'version', serialized),
      address: parseAddressNumber(parts[2], serialized),
    };
  }
  if (parts.length === 4) {
    const catalogId = requireSegment(parts[0], 'catalogId', serialized);
    // knownCatalogIds가 있으면 첫 파트가 등록된 카탈로그인지 확인
    if (knownCatalogIds && !knownCatalogIds.has(catalogId)) {
      throw new Error(
        `Unknown catalog '${catalogId}' in "${serialized}". ` +
          `Known catalogs: ${[...knownCatalogIds].join(', ')}`,
      );
    }
    return {
      catalogId,
      prefix: requireSegment(parts[1], 'prefix', serialized),
      version: requireSegment(parts[2], 'version', serialized),
      address: parseAddressNumber(parts[3], serialized),
    };
  }
  throw new Error(
    `Invalid address format: "${serialized}". ` +
      `Expected "prefix:version:address" or "catalogId:prefix:version:address"`,
  );
}

/**
 * ParsedAddress → 문자열 직렬화.
 * catalogId가 있으면 4파트, 없으면 3파트.
 */
export function serializeAddress(parsed: ParsedAddress): string {
  const base = `${parsed.prefix}:${parsed.version}:${parsed.address}`;
  return parsed.catalogId ? `${parsed.catalogId}:${base}` : base;
}
