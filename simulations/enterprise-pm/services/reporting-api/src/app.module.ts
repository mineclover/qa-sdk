// @def.boundary sim-reporting-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import {
  ReportingDbModule,
  REPORTING_DB_INSTANCE,
  type ReportingDbInstanceHandle,
} from "./reporting/reporting-db.module.js";
import { ReportModule } from "./reporting/report/report.module.js";
import { MetricModule } from "./reporting/metric/metric.module.js";
import { DensityModule } from "./density/density.module.js";
import {
  createInMemoryKeyObservationStore,
  createKeyObservationStore,
} from "./density/ingest-store.factory.js";
import { createSimPrefixCatalog } from "./density/prefix-catalog.js";
import type {
  DensityServiceLogger,
  MarginalDensityServiceOptions,
} from "./density/density.service.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger, type Logger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
 * DensityModule default binding.
 *
 * - pg: qa-sdk-db 의 ingest.key_observations 를 직접 조회
 * - sqlite: ingest-store 분리 미구현이므로 in-memory fallback
 */
function defaultDensityOptions(
  handle: ReportingDbInstanceHandle,
): MarginalDensityServiceOptions {
  return {
    keyObservationStore:
      handle.dialect === "pg"
        ? createKeyObservationStore({
            dialect: "pg",
            db: handle.db as PostgresJsDatabase,
          })
        : createInMemoryKeyObservationStore(),
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
      inject: [REPORTING_DB_INSTANCE],
      useFactory: (...args: unknown[]) =>
        defaultDensityOptions(args[0] as ReportingDbInstanceHandle),
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
