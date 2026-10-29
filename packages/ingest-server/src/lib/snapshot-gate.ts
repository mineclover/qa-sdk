// @def.boundary ingest-system
// @def.doc ingest-system

/**
 * snapshot gate — envelope의 catalog_snapshot 문맥으로 좌표 주소를 해석해도 되는지 판정한다 (ADR-010).
 *
 * - missing: 문맥이 없는 envelope (구버전 SDK) — 허용
 * - degraded: registry 조회 실패 등 판정 불가 — fail-open 허용
 * - violation: 판정이 확정된 계약 위반 (CatalogMismatch, MigrationRequired, …) — enforce 모드에서만 거부
 */
import {
  isCodecContractError,
  parseSerializedAddress,
  resolveDecodeLayout,
  toSnapshotIdentity,
  type CatalogSnapshot,
  type CodecErrorCode,
  type TransmissionEnvelope,
} from '@qa-sdk/core';

export type SnapshotGateMode = 'off' | 'warn' | 'enforce';

export type SnapshotGateResult =
  | { readonly status: 'ok'; readonly digest: string; readonly checkedLayouts: number }
  | { readonly status: 'missing' }
  | { readonly status: 'degraded'; readonly reason: string }
  | { readonly status: 'violation'; readonly code: CodecErrorCode; readonly message: string };

export interface SnapshotGateOptions {
  mode: Exclude<SnapshotGateMode, 'off'>;
  /** catalog의 현재(decode 기준) snapshot */
  loadTarget: (catalogId: string) => Promise<CatalogSnapshot | undefined>;
  /** digest로 발행된 snapshot 조회 (불변) */
  loadSnapshot: (catalogId: string, digest: string) => Promise<CatalogSnapshot | undefined>;
}

export interface SnapshotGate {
  readonly mode: Exclude<SnapshotGateMode, 'off'>;
  check(envelope: TransmissionEnvelope): Promise<SnapshotGateResult>;
}

/** envelope이 사용한 prefix@version 목록 (infra_context + record address_context) */
function collectPrefixVersions(
  envelope: TransmissionEnvelope,
): { prefixId: string; version: string }[] {
  const seen = new Map<string, { prefixId: string; version: string }>();
  const contexts = [envelope.infra_context, ...envelope.records.map((r) => r.address_context)];
  for (const context of contexts) {
    for (const serialized of Object.values(context ?? {})) {
      let parsed;
      try {
        parsed = parseSerializedAddress(serialized);
      } catch {
        continue; // 형식이 깨진 주소는 스키마 검증(AddressContextV1)이 이미 거부한다
      }
      seen.set(`${parsed.prefix}@${parsed.version}`, {
        prefixId: parsed.prefix,
        version: parsed.version,
      });
    }
  }
  return [...seen.values()];
}

export function createSnapshotGate(options: SnapshotGateOptions): SnapshotGate {
  return {
    mode: options.mode,
    async check(envelope) {
      const wire = envelope.catalog_snapshot;
      if (!wire) return { status: 'missing' };

      let target: CatalogSnapshot | undefined;
      let producer: CatalogSnapshot | undefined;
      try {
        target = await options.loadTarget(wire.catalog_id);
        if (target && wire.digest !== target.digest)
          producer = await options.loadSnapshot(wire.catalog_id, wire.digest);
      } catch (error) {
        return {
          status: 'degraded',
          reason: error instanceof Error ? error.message : String(error),
        };
      }
      if (!target)
        return { status: 'degraded', reason: `catalog ${wire.catalog_id}의 snapshot 없음` };

      const ref = toSnapshotIdentity(wire);
      const lookup = (digest: string) => (producer?.digest === digest ? producer : undefined);
      const pairs = collectPrefixVersions(envelope);
      try {
        for (const { prefixId, version } of pairs) {
          resolveDecodeLayout({ ref, prefixId, version }, target, lookup);
        }
      } catch (error) {
        if (isCodecContractError(error)) {
          return { status: 'violation', code: error.code, message: error.message };
        }
        throw error;
      }
      return { status: 'ok', digest: target.digest, checkedLayouts: pairs.length };
    },
  };
}
