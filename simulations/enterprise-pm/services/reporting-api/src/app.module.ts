// @def.boundary sim-reporting-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { ReportingDbModule } from "./reporting/reporting-db.module.js";
import { ReportModule } from "./reporting/report/report.module.js";
import { MetricModule } from "./reporting/metric/metric.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

@Module({
  imports: [
    HealthModule,
    ReportingDbModule.forRoot(),
    ReportModule,
    MetricModule,
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
