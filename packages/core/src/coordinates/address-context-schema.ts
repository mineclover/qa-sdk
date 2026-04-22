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

import { z } from "zod";

export interface ParsedPackedAddress {
  catalogId?: string;
  prefix: string;
  version: string;
  address: number;
}

const PACKED_KEY_RE = /^(?:([^:]+):)?([^:]+):([^:]+):(\d+)$/;

export function parsePackedAddress(value: string): ParsedPackedAddress | null {
  if (!value || typeof value !== "string") return null;
  const m = PACKED_KEY_RE.exec(value);
  if (!m) return null;
  const [, catalogId, prefix, version, addrStr] = m;
  const address = Number(addrStr);
  if (!Number.isFinite(address) || address < 0) return null;
  if (!Number.isInteger(address)) return null;
  return catalogId
    ? { catalogId, prefix, version, address }
    : { prefix, version, address };
}

export function serializePackedAddress(p: ParsedPackedAddress): string {
  return p.catalogId
    ? `${p.catalogId}:${p.prefix}:${p.version}:${p.address}`
    : `${p.prefix}:${p.version}:${p.address}`;
}

const PackedKeySchema = z.string().refine(
  (v) => parsePackedAddress(v) !== null,
  { message: "packed key 포맷 위반: 'prefix:version:address' 또는 'catalogId:prefix:version:address'" },
);

/**
 * address_context 전체 계약. key는 prefix(또는 catalogId:prefix), value는 packed key.
 */
export const AddressContextV1Schema = z.record(z.string(), PackedKeySchema);

export type AddressContextV1 = z.infer<typeof AddressContextV1Schema>;
