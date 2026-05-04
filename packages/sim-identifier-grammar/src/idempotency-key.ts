// @def.boundary sim-identifier-grammar
import { z } from "zod";

const AGGREGATE_ID_REGEX = /^[a-z][a-z0-9-]+$/;
// Task 2.6 (event-name)와 병렬 작성 우회: 3-tier kebab-case 형식만 검증한다.
const EVENT_NAME_REGEX =
  /^[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+$/;

export interface IdempotencyKeyInput {
  aggregateId: string;
  eventName: string;
  occurredAt: Date | number; // Date 또는 epoch ms
}

export interface IdempotencyKey {
  aggregateId: string;
  eventName: string;
  occurredAt: number; // epoch ms (정규화됨)
}

const NormalizedSchema = z.object({
  aggregateId: z.string().regex(AGGREGATE_ID_REGEX),
  eventName: z.string().regex(EVENT_NAME_REGEX),
  occurredAt: z.number().int().nonnegative(),
});

export const IdempotencyKeySchema = NormalizedSchema;

function normalize(input: IdempotencyKeyInput): IdempotencyKey {
  const epoch =
    input.occurredAt instanceof Date
      ? input.occurredAt.getTime()
      : input.occurredAt;
  return NormalizedSchema.parse({
    aggregateId: input.aggregateId,
    eventName: input.eventName,
    occurredAt: epoch,
  });
}

export function buildIdempotencyKey(input: IdempotencyKeyInput): string {
  const v = normalize(input);
  return `${v.aggregateId}:${v.eventName}:${v.occurredAt}`;
}

export function parseIdempotencyKey(s: string): IdempotencyKey {
  const m = s.match(
    /^([a-z][a-z0-9-]+):([a-z][a-z0-9-]+\.[a-z][a-z0-9-]+\.[a-z][a-z0-9-]+):(\d+)$/,
  );
  if (!m) throw new Error(`invalid idempotency key: ${s}`);
  return NormalizedSchema.parse({
    aggregateId: m[1],
    eventName: m[2],
    occurredAt: Number(m[3]),
  });
}
