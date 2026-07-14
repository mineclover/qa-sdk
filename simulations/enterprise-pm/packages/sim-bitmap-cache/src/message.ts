// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * InvalidationMessage — bitmap-pipeline 스펙 §5 (Invalidation) 메시지 스키마.
 *
 * Redis pub/sub 채널 "bitmap:invalidate"에 publish되는 JSON 페이로드.
 * 모든 Subscriber가 동일 schema로 parse하여 LRU cache에서 해당 entry 제거.
 */

import { z } from 'zod';

export const InvalidationScope = z.enum(['user', 'role', 'prefix']);
export const InvalidationReason = z.enum([
  'permission_change',
  'role_redefinition',
  'prefix_version_bump',
  'security_incident',
]);

export const invalidationMessageSchema = z.object({
  scope: InvalidationScope,
  /** scope=user → userId, scope=role → roleId, scope=prefix → prefix string. */
  target: z.string().min(1),
  reason: InvalidationReason,
  issuedAt: z.string().datetime(),
  publisher: z.string().min(1),
  /**
   * scope=role 또는 prefix일 때 영향받는 user 목록.
   * sim-auth-api가 role→user 매핑을 알고 있으므로 publish 시 함께 전송.
   * 누락 시 Subscriber는 fail-safe noop(role scope) 또는 prefix 전체 flush.
   */
  affectedUserIds: z.array(z.string()).optional(),
});

export type InvalidationMessage = z.infer<typeof invalidationMessageSchema>;
export type Scope = z.infer<typeof InvalidationScope>;
export type Reason = z.infer<typeof InvalidationReason>;

export const INVALIDATION_CHANNEL = 'bitmap:invalidate';

export function serializeMessage(msg: InvalidationMessage): string {
  return JSON.stringify(msg);
}

export function parseMessage(json: string): InvalidationMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (err) {
    throw new Error(`invalid JSON: ${(err as Error).message}`);
  }
  return invalidationMessageSchema.parse(raw);
}
