// @def.boundary sim-outbox-view
// @def.doc server-side-admin-endpoints
//
// Stage 4 §4.7 — approval-api outbox admin endpoint 응답 shape SSOT.
// producer (sim-approval-api OutboxAdminController) 와 consumer (sim-handles outbox-client)
// 모두 본 패키지에서 schema/type 을 import — drift 시 typecheck/zod parse 가 검출.
//
// spec: docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md §9.

import { z } from "zod";

export const OutboxInsertResponseSchema = z.object({
  inserted: z.number().int().nonnegative(),
  idempotencyKeys: z.array(z.string()),
  ids: z.array(z.string()),
});
export type OutboxInsertResponse = z.infer<typeof OutboxInsertResponseSchema>;

export const OutboxDispatchResponseSchema = z.object({
  byReplica: z.array(
    z.object({
      replicaId: z.string(),
      dispatchedEventIds: z.array(z.string()),
    }),
  ),
  totalDispatched: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type OutboxDispatchResponse = z.infer<typeof OutboxDispatchResponseSchema>;
