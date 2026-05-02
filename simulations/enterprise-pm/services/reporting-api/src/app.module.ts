// @def.boundary sim-reporting-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import {
  ReportingDbModule,
  REPORTING_DB_INSTANCE,
  type ReportingDbInstanceHandle,
} from "./reporting/reporting-db.module.js";
import { REPORTING_SLICE_MODULES } from "./reporting/reporting-slices.registry.js";
import {
  DensitySliceModule,
  type DensitySliceDeps,
} from "./density/density.module.js";
import {
  createKeyObservationQueryAdapter,
  createInMemoryKeyObservationAdapter,
} from "./density/infrastructure/read-model/key-observation.adapter.js";
import { createSimPrefixCatalogAdapter } from "./density/infrastructure/read-model/sim-prefix-catalog.adapter.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * DensitySliceModule default factory binding.
 *
 * - pg: ingest.key_observations 를 직접 조회 (cross-domain query port)
 * - sqlite: ingest-store 분리 미구현이므로 in-memory fallback
 *
 * threshold 는 §5 §3.4 기본값 (underutilized < 0.1, saturated > 0.9).
 */
function defaultDensitySliceDeps(
  handle: ReportingDbInstanceHandle,
): DensitySliceDeps {
  const observations =
    handle.dialect === "pg"
      ? createKeyObservationQueryAdapter({
          dialect: "pg",
          db: handle.db as PostgresJsDatabase,
        })
      : createInMemoryKeyObservationAdapter();
  return {
    observations,
    catalog: createSimPrefixCatalogAdapter(),
    thresholds: { underutilizedBelow: 0.1, saturatedAbove: 0.9 },
  };
}

@Module({
  imports: [
    HealthModule,
    ReportingDbModule.forRoot(),
    ...REPORTING_SLICE_MODULES,
    DensitySliceModule.register({
      inject: [REPORTING_DB_INSTANCE],
      useFactory: (...args: unknown[]) =>
        defaultDensitySliceDeps(args[0] as ReportingDbInstanceHandle),
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
