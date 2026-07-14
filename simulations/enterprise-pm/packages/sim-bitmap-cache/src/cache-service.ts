// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import type { Redis } from 'ioredis';
import {
  BitmapLruCache,
  DEFAULT_BITMAP_TTL_MS,
  type BitmapCacheEntry,
  type BitmapLruCacheOptions,
} from './lru-cache.js';
import { recordBitmapCacheLookup } from './metrics.js';
import { BitmapInvalidationPublisher } from './publisher.js';
import { BitmapInvalidationSubscriber, type SubscriberLogger } from './subscriber.js';

/** spec 04 §3.2 — catalog 콜라보레이터. latestPrefixVersion 단일 진실. */
export interface BitmapCacheCatalog {
  getLatestPrefixVersion(prefix: string): Promise<string>;
}

/** spec 04 §3.2 — auth-api 콜라보레이터. */
export interface BitmapAuthApi {
  fetchBitmap(req: { key: string; prefix?: string }): Promise<{
    prefix: string;
    prefixVersion: string;
    mask: Uint8Array;
  }>;
}

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
  /** spec 04 §3.2 — getBitmap에서 latest prefix version 조회. */
  catalog?: BitmapCacheCatalog;
  /** spec 04 §3.2 — getBitmap refresh 경로. */
  authApi?: BitmapAuthApi;
  /** ttlMs 기본 (spec 04 §3.1 — 120_000). 호출자가 override 가능. */
  defaultTtlMs?: number;
}

/**
 * BitmapCacheService — LRU + Publisher + Subscriber 통합 + 3단계 검증 흐름.
 *
 * 사용 패턴:
 *   - sim-auth-api: publisherRedis만
 *   - 비즈니스 서비스: subscriberRedis + cache + (catalog,authApi)
 *   - 둘 다: 별도 redis 인스턴스 2개 주입
 */
export class BitmapCacheService {
  readonly cache: BitmapLruCache;
  readonly publisher?: BitmapInvalidationPublisher;
  readonly subscriber?: BitmapInvalidationSubscriber;

  private readonly catalog?: BitmapCacheCatalog;
  private readonly authApi?: BitmapAuthApi;
  private readonly defaultTtlMs: number;

  constructor(opts: BitmapCacheServiceOptions) {
    this.cache = new BitmapLruCache(opts.cache);
    this.catalog = opts.catalog;
    this.authApi = opts.authApi;
    this.defaultTtlMs = opts.defaultTtlMs ?? DEFAULT_BITMAP_TTL_MS;
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

  /** spec 04 §3.2 — 3단계 검증 흐름. */
  async getBitmap(key: string): Promise<Uint8Array> {
    if (!this.catalog || !this.authApi) {
      throw new Error('BitmapCacheService.getBitmap requires { catalog, authApi } 주입');
    }
    const cached = this.cache.getEntry(key);

    // (1) hit + valid TTL + version-check OK → 즉시 반환
    if (cached && Date.now() - cached.issuedAt < cached.ttlMs) {
      const currentVersion = await this.catalog.getLatestPrefixVersion(cached.prefix);
      if (currentVersion === cached.prefixVersion) {
        recordBitmapCacheLookup('hit');
        return cached.mask;
      }
      // version mismatch → fallthrough (회복 경로)
      recordBitmapCacheLookup('version_mismatch');
    } else {
      recordBitmapCacheLookup('miss');
    }

    // (2) miss / TTL 만료 / version mismatch → auth-api 에서 refresh
    const fresh = await this.authApi.fetchBitmap({
      key,
      prefix: cached?.prefix,
    });
    const entry: BitmapCacheEntry = {
      key,
      prefix: fresh.prefix,
      prefixVersion: fresh.prefixVersion,
      mask: fresh.mask,
      issuedAt: Date.now(),
      ttlMs: this.defaultTtlMs,
    };
    this.cache.setEntry(entry);
    return fresh.mask;
  }

  async start(): Promise<void> {
    if (this.subscriber) await this.subscriber.start();
  }

  async stop(): Promise<void> {
    if (this.subscriber) await this.subscriber.stop();
  }
}
