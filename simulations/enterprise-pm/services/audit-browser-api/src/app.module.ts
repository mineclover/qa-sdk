// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";
import { AUDIT_BROWSER_SLICE_MODULES } from "./audit-browser-slices.registry.js";
import { RecorderWriteModule } from "./recorder-write/recorder-write.module.js";

@Module({
  imports: [
    HealthModule,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-audit-browser-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-audit-browser-api.bitmap-cache")),
    }),
    RecorderWriteModule,
    ...AUDIT_BROWSER_SLICE_MODULES,
  ],
})
export class AppModule {}
