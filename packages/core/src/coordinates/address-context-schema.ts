// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * AddressContextV1 — event_records.address_context의 1급 타입 계약.
 *
 * 포맷:
 *   3-part: "prefixId:version:address"
 *   4-part: "catalogId:prefixId:version:address"
 *
 * version은 문자열의 일부로 인코딩되어 있으나 본 모듈은 이를 구조화된 객체로
 * 노출해 SDK·ingest·decode 사이의 계약을 강제한다.
 *
 * 본 스키마는 coordinate-storage.rule §1.2 (range-distance 비음수 + version 동봉) 충족.
 */

import { z } from 'zod';
import { parseSerializedAddress } from '../lib/address-parser.js';

export interface ParsedPackedAddress {
  catalogId?: string;
  prefix: string;
  version: string;
  address: number;
}

/** 정규 파서(parseSerializedAddress)에 위임하고 실패를 null로 돌려준다 — 형식 규칙은 한 곳에서만 정의 */
export function parsePackedAddress(value: string): ParsedPackedAddress | null {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = parseSerializedAddress(value);
    return parsed.catalogId
      ? {
          catalogId: parsed.catalogId,
          prefix: parsed.prefix,
          version: parsed.version,
          address: parsed.address,
        }
      : { prefix: parsed.prefix, version: parsed.version, address: parsed.address };
  } catch {
    return null;
  }
}

export function serializePackedAddress(p: ParsedPackedAddress): string {
  return p.catalogId
    ? `${p.catalogId}:${p.prefix}:${p.version}:${p.address}`
    : `${p.prefix}:${p.version}:${p.address}`;
}

const PackedKeySchema = z.string().refine((v) => parsePackedAddress(v) !== null, {
  message: "packed key 포맷 위반: 'prefix:version:address' 또는 'catalogId:prefix:version:address'",
});

/**
 * address_context 전체 계약. key는 prefix(또는 catalogId:prefix), value는 packed key.
 */
export const AddressContextV1Schema = z.record(z.string(), PackedKeySchema);

export type AddressContextV1 = z.infer<typeof AddressContextV1Schema>;
