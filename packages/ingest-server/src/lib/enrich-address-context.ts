// @def.boundary ingest-system
// @def.doc ingest-system

import type { Catalog, TransmissionEnvelope, EventRecord } from '@qa-sdk/core';
import { latestPrefixVersion, parseSerializedAddress } from '@qa-sdk/core';

/**
 * envelope.infra_context를 각 record의 address_context에 머지한다.
 * record의 address_context가 우선 (override).
 *
 * zero-allocation 최적화:
 * - infra_context 없으면 즉시 반환
 * - record에 address_context 없으면 참조 공유 (복사 없음)
 */
export function enrichAddressContext(
  envelope: TransmissionEnvelope,
  records: EventRecord[],
): EventRecord[] {
  const infraCtx = envelope.infra_context;
  if (!infraCtx) return records;

  for (const record of records) {
    if (!record.address_context) {
      record.address_context = infraCtx;
    } else {
      record.address_context = { ...infraCtx, ...record.address_context };
    }
  }

  return records;
}

// ── 수집 건전성 검증 ──────────────────────────────────────

export interface AddressHealthResult {
  readonly totalAddresses: number;
  readonly validAddresses: number;
  readonly orphanPrefixes: readonly string[];
  readonly staleVersions: readonly { prefix: string; version: string; latest: string }[];
  readonly healthRate: number;
}

/**
 * address_context의 건전성을 간이 검증한다.
 *
 * 전체 catalog 기반 검증(analyzeCollectionHealth)의 경량 버전.
 * ingest 경로에서 호출되므로 성능에 민감.
 *
 * @param knownPrefixes - catalog prefix ID 목록
 * @param latestVersions - prefix별 최신 version 맵
 */
export function checkAddressHealth(
  records: EventRecord[],
  knownPrefixes: ReadonlySet<string>,
  latestVersions: ReadonlyMap<string, string>,
): AddressHealthResult {
  let totalAddresses = 0;
  let validAddresses = 0;
  const orphanSet = new Set<string>();
  const staleMap = new Map<string, { prefix: string; version: string; latest: string }>();

  for (const record of records) {
    const ctx = record.address_context;
    if (!ctx) continue;

    for (const [prefixId, serialized] of Object.entries(ctx)) {
      totalAddresses++;

      if (!knownPrefixes.has(prefixId)) {
        orphanSet.add(prefixId);
        continue;
      }

      let parsed;
      try {
        parsed = parseSerializedAddress(serialized);
      } catch {
        continue;
      }

      const version = parsed.version;
      validAddresses++;

      const latest = latestVersions.get(prefixId);
      if (latest && version !== latest) {
        const key = `${prefixId}:${version}`;
        if (!staleMap.has(key)) {
          staleMap.set(key, { prefix: prefixId, version, latest });
        }
      }
    }
  }

  return {
    totalAddresses,
    validAddresses,
    orphanPrefixes: [...orphanSet],
    staleVersions: [...staleMap.values()],
    healthRate: totalAddresses > 0 ? validAddresses / totalAddresses : 1,
  };
}

/** checkAddressHealth 입력 — catalog에서 파생한 prefix 집합과 prefix별 최신 version */
export interface AddressHealthIndex {
  readonly knownPrefixes: ReadonlySet<string>;
  readonly latestVersions: ReadonlyMap<string, string>;
}

/** catalog → AddressHealthIndex. version은 latestPrefixVersion(SSOT)으로 조회한다 */
export function buildAddressHealthIndex(catalog: Catalog): AddressHealthIndex {
  const prefixIds = Object.keys(catalog.prefixes);
  return {
    knownPrefixes: new Set(prefixIds),
    latestVersions: new Map(prefixIds.map((id) => [id, latestPrefixVersion(catalog, id)])),
  };
}
