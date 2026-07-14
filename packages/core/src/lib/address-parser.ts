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

/**
 * 직렬화된 주소를 파싱.
 *
 * - 3파트 "prefix:ver:addr" → 기본 카탈로그
 * - 4파트 "catalogId:prefix:ver:addr" → 명시적 카탈로그
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
    const addr = Number(parts[2]);
    if (isNaN(addr)) {
      throw new Error(`Invalid address number: "${parts[2]}" in "${serialized}"`);
    }
    return { prefix: parts[0], version: parts[1], address: addr };
  }
  if (parts.length === 4) {
    const addr = Number(parts[3]);
    if (isNaN(addr)) {
      throw new Error(`Invalid address number: "${parts[3]}" in "${serialized}"`);
    }
    // knownCatalogIds가 있으면 첫 파트가 등록된 카탈로그인지 확인
    if (knownCatalogIds && !knownCatalogIds.has(parts[0])) {
      throw new Error(
        `Unknown catalog '${parts[0]}' in "${serialized}". ` +
          `Known catalogs: ${[...knownCatalogIds].join(', ')}`,
      );
    }
    return { catalogId: parts[0], prefix: parts[1], version: parts[2], address: addr };
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
