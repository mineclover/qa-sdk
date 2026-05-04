// @def.boundary sim-identifier-grammar
import { z } from "zod";
import { ulid, decodeTime } from "ulid";

export interface CycleId {
  controllerId: string; // 8 chars, [0-9A-Z]
  cycleAt: number;      // epoch ms
}

export const CycleIdInputSchema = z.object({
  controllerId: z.string().regex(/^[0-9A-Z]{8}$/),
  cycleAt: z.number().int().nonnegative().finite(),
});

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
export const CycleIdStringSchema = z.string().regex(ULID_PATTERN);

export function buildCycleId(input: CycleId): string {
  const v = CycleIdInputSchema.parse(input);
  // controllerId는 합성 문자열에 임베드하지 않고 원형 메타로만 보존 (spec drift §18 참조).
  return ulid(v.cycleAt);
}

export function parseCycleId(s: string): { cycleAt: number; randomness: string } {
  const id = CycleIdStringSchema.parse(s);
  return {
    cycleAt: decodeTime(id),
    randomness: id.slice(10), // ULID: 10-char timestamp + 16-char randomness
  };
}
