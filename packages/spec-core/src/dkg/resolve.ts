/**
 * resolve — 주소 자동 마이그레이션.
 *
 * 문자열 식별자가 영구 고정이므로 migrator 불필요.
 * decode → re-encode로 항상 마이그레이션 가능.
 *
 * 이것이 DSL DB의 마이그레이션 전략.
 */

import type { DemoCatalog } from "demo-snapshot";
import { decodePrefix, encodePrefixByValue } from "demo-snapshot";

export interface ResolveResult {
  /** 최신 version의 주소 (prefix:version:address) */
  readonly address: string;
  /** decode된 값 */
  readonly values: Record<string, { position: number; value: string | number }>;
  /** 마이그레이션이 발생했는가 */
  readonly migrated: boolean;
  /** 원본 version (마이그레이션 전) */
  readonly originalVersion?: string;
}

/**
 * 주소를 최신 version으로 resolve한다.
 *
 * 구버전이면 자동 마이그레이션: decodeToValues(oldVersion) → encodeByValue(latestVersion)
 * 문자열이 고정이므로 항상 성공한다.
 *
 * @param catalog - DEMO_CATALOG
 * @param serialized - "prefix:version:address" 형식
 * @param latestVersion - 대상 최신 version (없으면 마지막 version 사용)
 */
export function resolve(
  catalog: DemoCatalog,
  serialized: string,
  latestVersion?: string,
): ResolveResult {
  const parts = serialized.split(":");
  if (parts.length !== 3) throw new Error(`Invalid address format: "${serialized}". Expected "prefix:version:address"`);

  const [prefixId, version, addrStr] = parts;
  const address = Number(addrStr);
  if (isNaN(address)) throw new Error(`Invalid address number: "${addrStr}"`);

  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: "${prefixId}"`);

  // latest version 결정
  const latest = latestVersion ?? prefix.versions[prefix.versions.length - 1].version;

  // decode
  const decoded = decodePrefix(catalog, prefixId, version, address);

  // 이미 최신이면 그대로
  if (version === latest) {
    return {
      address: serialized,
      values: decoded,
      migrated: false,
    };
  }

  // 구버전 → 문자열로 decode → 최신으로 re-encode
  const valueMap: Record<string, string | number> = {};
  for (const [label, dim] of Object.entries(decoded)) {
    valueMap[label] = dim.value;
  }

  const newAddress = encodePrefixByValue(catalog, prefixId, latest, valueMap);

  return {
    address: `${prefixId}:${latest}:${newAddress}`,
    values: decodePrefix(catalog, prefixId, latest, newAddress),
    migrated: true,
    originalVersion: version,
  };
}
