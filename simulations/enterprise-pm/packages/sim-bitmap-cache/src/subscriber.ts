// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * BitmapInvalidationSubscriber — Redis pub/sub의 listen측.
 *
 * bitmap-pipeline 스펙 §5 정확 매칭:
 *   "각 서버의 listener가 L1 LRU 제거"
 *
 * 동작:
 *   start() → subscribe(INVALIDATION_CHANNEL) → message handler 등록
 *   각 메시지: parseMessage → scope 별 cache.invalidate*
 *   parse/schema 실패 → warn 로그, cache 변경 없음 (fail-safe)
 */

import type { Redis } from 'ioredis';
import { BitmapLruCache } from './lru-cache.js';
import { INVALIDATION_CHANNEL, parseMessage, type InvalidationMessage } from './message.js';

export interface SubscriberLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
}

export interface BitmapInvalidationSubscriberOptions {
  /** ioredis 클라이언트 — 본 인스턴스는 subscribe 모드 dedicated. publisher와 분리 필수. */
  redis: Redis;
  cache: BitmapLruCache;
  logger: SubscriberLogger;
}

export class BitmapInvalidationSubscriber {
  private started = false;
  private boundHandler?: (channel: string, message: string) => void;

  constructor(private readonly opts: BitmapInvalidationSubscriberOptions) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.boundHandler = (channel, message): void => {
      if (channel !== INVALIDATION_CHANNEL) return;
      this.handleMessage(message);
    };
    this.opts.redis.on('message', this.boundHandler);
    await this.opts.redis.subscribe(INVALIDATION_CHANNEL);
    this.started = true;
    this.opts.logger.info({ channel: INVALIDATION_CHANNEL }, 'BitmapInvalidationSubscriber 시작');
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    if (this.boundHandler) {
      this.opts.redis.off('message', this.boundHandler);
    }
    await this.opts.redis.unsubscribe(INVALIDATION_CHANNEL);
    this.started = false;
  }

  private handleMessage(raw: string): void {
    let msg: InvalidationMessage;
    try {
      msg = parseMessage(raw);
    } catch (err) {
      this.opts.logger.warn(
        { err: (err as Error).message, raw },
        'InvalidationMessage parse 실패 — TTL+version-check가 회복 보장 (spec 04 §3.2)',
      );
      return;
    }

    // spec 04 §3.3 — subscriber는 evict trigger. 회복은 §3.2 TTL+version-check.
    const recovery = 'fallthrough-trigger' as const;

    switch (msg.scope) {
      case 'user': {
        const removed = this.opts.cache.invalidateUser(msg.target);
        this.opts.logger.info(
          {
            scope: 'user',
            target: msg.target,
            removed,
            reason: msg.reason,
            recovery,
          },
          'cache evicted (latency 최적화 trigger; 정합성은 §3.2 보장)',
        );
        break;
      }
      case 'role': {
        if (!msg.affectedUserIds || msg.affectedUserIds.length === 0) {
          this.opts.logger.warn(
            { roleId: msg.target },
            'role scope이지만 affectedUserIds 누락 — 정합성은 §3.2 TTL+version-check 보장',
          );
          return;
        }
        const removed = this.opts.cache.invalidateUsers(msg.affectedUserIds);
        this.opts.logger.info(
          {
            scope: 'role',
            target: msg.target,
            removed,
            reason: msg.reason,
            recovery,
          },
          'cache evicted (latency 최적화 trigger; 정합성은 §3.2 보장)',
        );
        break;
      }
      case 'prefix': {
        const removed = this.opts.cache.invalidatePrefix(msg.target);
        this.opts.logger.info(
          {
            scope: 'prefix',
            target: msg.target,
            removed,
            reason: msg.reason,
            recovery,
          },
          'cache evicted (latency 최적화 trigger; 정합성은 §3.2 보장)',
        );
        break;
      }
    }
  }
}
