// @def.boundary sim-reporting-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { ReportingDbModule } from "./reporting/reporting-db.module.js";
import { ReportModule } from "./reporting/report/report.module.js";
import { MetricModule } from "./reporting/metric/metric.module.js";
import { DensityModule } from "./density/density.module.js";
import { createInMemoryKeyObservationStore } from "./density/ingest-store.factory.js";
import { createSimPrefixCatalog } from "./density/prefix-catalog.js";
import type {
  DensityServiceLogger,
  MarginalDensityServiceOptions,
} from "./density/density.service.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger, type Logger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

/**
 * pino Logger를 DensityServiceLogger 인터페이스로 어댑팅.
 *
 * pino의 (obj, msg?) 시그니처는 DensityServiceLogger와 호환이지만
 * TS structural 타입 호환을 위해 명시적 wrapper로 감싼다.
 */
function adaptLogger(logger: Logger): DensityServiceLogger {
  return {
    info: (obj, msg) => logger.info(obj, msg),
    warn: (obj, msg) => logger.warn(obj, msg),
    error: (obj, msg) => logger.error(obj, msg),
  };
}

/**
 * DensityModule default binding — in-memory KeyObservationStore.
 *
 * PG ingest.key_observations 직접 조회는 Plan 14b 통합 smoke에서 검증.
 * 기본 부팅은 endpoint가 응답 가능함을 보장하며, 실 환경에서는 override 예정.
 * no fallback approximation — 데이터 없는 상태에서는 0-density로 정확 응답.
 */
function defaultDensityOptions(): MarginalDensityServiceOptions {
  return {
    keyObservationStore: createInMemoryKeyObservationStore(),
    prefixCatalog: createSimPrefixCatalog(),
    thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
    logger: adaptLogger(createLogger("sim-reporting-api.density")),
  };
}

@Module({
  imports: [
    HealthModule,
    ReportingDbModule.forRoot(),
    ReportModule,
    MetricModule,
    DensityModule.register({
      useFactory: () => defaultDensityOptions(),
    }),
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-reporting-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-reporting-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
