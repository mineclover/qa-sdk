import type { TransmissionEnvelope, EventRecord } from "@qa-sdk/core";

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
