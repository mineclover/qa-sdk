// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * BitmapInvalidationPublisher — Redis pub/sub의 publish측.
 *
 * bitmap-pipeline 스펙 §5 (Invalidation):
 *   "각 서버의 listener가 L1 LRU 제거"
 *
 * sim-auth-api의 RoleAssignmentService / RoleService가 권한 변경 후 본 publisher
 * 호출. pub/sub 채널 = INVALIDATION_CHANNEL ("bitmap:invalidate").
 */

import type { Redis } from "ioredis";
import {
  INVALIDATION_CHANNEL,
  serializeMessage,
  type InvalidationMessage,
  type Reason,
} from "./message.js";

export interface BitmapInvalidationPublisherOptions {
  redis: Redis;
  publisherName: string;
}

export class BitmapInvalidationPublisher {
  constructor(private readonly opts: BitmapInvalidationPublisherOptions) {}

  /** raw API — 메시지를 그대로 publish. */
  async publish(msg: InvalidationMessage): Promise<number> {
    const json = serializeMessage(msg);
    return this.opts.redis.publish(INVALIDATION_CHANNEL, json);
  }

  /** scope=user (단일 사용자 권한 변경). */
  async publishUserChange(userId: string, reason: Reason): Promise<number> {
    return this.publish({
      scope: "user",
      target: userId,
      reason,
      issuedAt: new Date().toISOString(),
      publisher: this.opts.publisherName,
    });
  }

  /** scope=role (역할 정의 변경 — 영향받는 user 목록을 함께 전달). */
  async publishRoleChange(
    roleId: string,
    reason: Reason,
    affectedUserIds: readonly string[],
  ): Promise<number> {
    return this.publish({
      scope: "role",
      target: roleId,
      reason,
      issuedAt: new Date().toISOString(),
      publisher: this.opts.publisherName,
      affectedUserIds: [...affectedUserIds],
    });
  }

  /** scope=prefix (shape/version 변경 — 전체 cache flush). */
  async publishPrefixBump(prefix: string, reason: Reason): Promise<number> {
    return this.publish({
      scope: "prefix",
      target: prefix,
      reason,
      issuedAt: new Date().toISOString(),
      publisher: this.opts.publisherName,
    });
  }
}
