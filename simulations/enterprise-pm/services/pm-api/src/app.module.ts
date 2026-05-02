// @def.boundary sim-pm-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import {
  PmDbModule,
  PM_DB_INSTANCE,
  PM_REPOSITORY,
  type PmDbInstanceHandle,
} from "./pm/pm-db.module.js";
import { PM_SLICE_MODULES } from "./pm/pm-slices.registry.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";
import type { PmRepository } from "./pm/shared/port.js";

@Module({
  imports: [
    HealthModule,
    PmDbModule.forRoot(),
    AccessCheckerModule.forRootAsync({
      inject: [PM_DB_INSTANCE, PM_REPOSITORY],
      useFactory: (...args: unknown[]) => {
        const handle = args[0] as PmDbInstanceHandle;
        const repo = args[1] as PmRepository;
        return { dialect: handle.dialect, db: handle.db, repo };
      },
    }),
    ...PM_SLICE_MODULES,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-pm-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-pm-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
