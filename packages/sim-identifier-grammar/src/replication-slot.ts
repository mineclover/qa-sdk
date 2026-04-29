import { z } from "zod";

export const REPLICATION_PURPOSES = ["read_replica", "audit_stream"] as const;
export type ReplicationPurpose = (typeof REPLICATION_PURPOSES)[number];

export interface ReplicationSlot {
  purpose: ReplicationPurpose;
}

export const ReplicationSlotSchema = z.object({
  purpose: z.enum(REPLICATION_PURPOSES),
});

// PG 식별자 규칙: 첫 글자 [a-z_], 이후 [a-z0-9_], 전체 ≤ 63자
const SLOT_PATTERN = /^sim_(read_replica|audit_stream)_slot$/;
const PG_MAX_LENGTH = 63;

export const ReplicationSlotNameSchema = z
  .string()
  .max(PG_MAX_LENGTH)
  .regex(SLOT_PATTERN);

export function buildReplicationSlot(input: ReplicationSlot): string {
  const v = ReplicationSlotSchema.parse(input);
  const out = `sim_${v.purpose}_slot`;
  return ReplicationSlotNameSchema.parse(out);
}

export function parseReplicationSlot(s: string): ReplicationSlot {
  const m = SLOT_PATTERN.exec(s);
  if (!m || s.length > PG_MAX_LENGTH) {
    throw new Error(`invalid replication slot name: ${s}`);
  }
  return { purpose: m[1] as ReplicationPurpose };
}
