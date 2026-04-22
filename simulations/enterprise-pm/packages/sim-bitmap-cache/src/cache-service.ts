// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import type { Redis } from "ioredis";
import { BitmapLruCache, type BitmapLruCacheOptions } from "./lru-cache.js";
import { BitmapInvalidationPublisher } from "./publisher.js";
import {
  BitmapInvalidationSubscriber,
  type SubscriberLogger,
} from "./subscriber.js";

export interface BitmapCacheServiceOptions {
  /** publish 클라이언트 (publisher 모드 활성화 시). */
  publisherRedis?: Redis;
  /** subscribe 클라이언트 (listener 모드 활성화 시). publisher와 별도 인스턴스 권장. */
  subscriberRedis?: Redis;
  /** 호출자 식별자 — InvalidationMessage.publisher 필드. */
  publisherName: string;
  /** LRU 옵션. */
  cache: BitmapLruCacheOptions;
  /** Subscriber 로깅 — pino-style. */
  logger: SubscriberLogger;
}

/**
 * BitmapCacheService — LRU + Publisher + Subscriber 통합.
 *
 * 사용 패턴:
 *   - sim-auth-api: publisherRedis만
 *   - 비즈니스 서비스: subscriberRedis + cache
 *   - 둘 다: 별도 redis 인스턴스 2개 주입
 */
export class BitmapCacheService {
  readonly cache: BitmapLruCache;
  readonly publisher?: BitmapInvalidationPublisher;
  readonly subscriber?: BitmapInvalidationSubscriber;

  constructor(opts: BitmapCacheServiceOptions) {
    this.cache = new BitmapLruCache(opts.cache);
    if (opts.publisherRedis) {
      this.publisher = new BitmapInvalidationPublisher({
        redis: opts.publisherRedis,
        publisherName: opts.publisherName,
      });
    }
    if (opts.subscriberRedis) {
      this.subscriber = new BitmapInvalidationSubscriber({
        redis: opts.subscriberRedis,
        cache: this.cache,
        logger: opts.logger,
      });
    }
  }

  async start(): Promise<void> {
    if (this.subscriber) await this.subscriber.start();
  }

  async stop(): Promise<void> {
    if (this.subscriber) await this.subscriber.stop();
  }
}
