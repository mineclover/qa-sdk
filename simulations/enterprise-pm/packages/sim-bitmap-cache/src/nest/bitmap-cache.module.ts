// @def.boundary sim-bitmap-cache
// @def.doc authorization-ontology-bitmap-pipeline

import {
  type DynamicModule,
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import Redis from "ioredis";
import { BitmapCacheService } from "../cache-service.js";
import type { SubscriberLogger } from "../subscriber.js";

export interface BitmapCacheModuleOptions {
  /** Redis URL (예: "redis://sim-redis:6379"). */
  redisUrl: string;
  /** Publisher 활성화 (sim-auth-api). */
  publisherEnabled: boolean;
  /** Listener 활성화 (모든 비즈니스 서비스). */
  listenerEnabled: boolean;
  /** publisher 식별자 (InvalidationMessage.publisher 필드). */
  publisherName: string;
  /** LRU max entries. */
  lruMax?: number;
  /** Subscriber 로거 주입. 미주입 시 noop fallback. */
  logger?: SubscriberLogger;
}

/**
 * NestJS 동적 모듈. `BitmapCacheService`를 global provider로 제공하고,
 * OnModuleInit/Destroy에서 subscriber lifecycle을 관리한다.
 */
@Injectable()
class BitmapCacheLifecycle implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(BitmapCacheService) private readonly svc: BitmapCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.svc.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.svc.stop();
  }
}

@Module({})
export class BitmapCacheModule {
  static forRoot(opts: BitmapCacheModuleOptions): DynamicModule {
    const provider = {
      provide: BitmapCacheService,
      useFactory: (): BitmapCacheService => {
        const publisherRedis = opts.publisherEnabled
          ? new Redis(opts.redisUrl)
          : undefined;
        const subscriberRedis = opts.listenerEnabled
          ? new Redis(opts.redisUrl)
          : undefined;
        return new BitmapCacheService({
          publisherRedis,
          subscriberRedis,
          publisherName: opts.publisherName,
          cache: { max: opts.lruMax ?? 10_000 },
          logger: opts.logger ?? defaultLogger(),
        });
      },
    };
    return {
      module: BitmapCacheModule,
      providers: [provider, BitmapCacheLifecycle],
      exports: [BitmapCacheService],
      global: true,
    };
  }
}

function defaultLogger(): SubscriberLogger {
  // CLAUDE.md: 라이브러리는 console 금지. 호출자가 logger 주입 강력 권장.
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}
