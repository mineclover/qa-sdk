// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * decode-service HTTP 클라이언트.
 *
 * address_context의 1D 주소를 decode-service에 보내서 차원 값으로 해석.
 * DECODE_SERVICE_URL이 설정되지 않으면 null 반환 → 로컬 fallback.
 */

import { parsePackedAddress } from "../db/address-context-schema.js";

export interface DecodedAddress {
  prefix: string;
  version: string;
  address: number;
  entities: Record<string, string>;
}

/**
 * address_context 전체를 decode-service에 batch 디코딩 요청.
 *
 * @param baseUrl decode-service URL (예: http://localhost:3600)
 * @param addressContext { prefix: "prefix:version:address" } 형식
 * @returns 디코딩된 결과 맵 { prefix: { entities } } 또는 null (실패 시)
 */
export async function decodeAddressContext(
  baseUrl: string,
  addressContext: Record<string, string>,
): Promise<Record<string, DecodedAddress> | null> {
  try {
    const results: Record<string, DecodedAddress> = {};

    for (const [key, value] of Object.entries(addressContext)) {
      const parsed = parsePackedAddress(value);
      if (!parsed) continue;

      const res = await fetch(`${baseUrl}/decode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: parsed.address,
          prefix: parsed.prefix,
          version: parsed.version,
        }),
        signal: AbortSignal.timeout(3_000),
      });

      if (res.ok) {
        const body = (await res.json()) as { entities?: Record<string, string> };
        if (body.entities) {
          results[key] = {
            prefix: parsed.prefix,
            version: parsed.version,
            address: parsed.address,
            entities: body.entities,
          };
        }
      }
    }

    return Object.keys(results).length > 0 ? results : null;
  } catch {
    return null;
  }
}
