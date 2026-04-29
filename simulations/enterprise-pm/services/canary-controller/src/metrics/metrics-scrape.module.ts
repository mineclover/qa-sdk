// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Module } from "@nestjs/common";
import { MetricsScrapeService } from "./metrics-scrape.service.js";
import { env } from "../config/env.js";

@Module({
  providers: [
    {
      provide: MetricsScrapeService,
      useFactory: () =>
        new MetricsScrapeService({
          metricsUrl: env.SIM_METRICS_COLLECTOR_URL,
          ingestUrl: env.QA_INGEST_URL,
          auditUrl: env.SIM_AUDIT_RECORDER_URL,
        }),
    },
  ],
  exports: [MetricsScrapeService],
})
export class MetricsScrapeModule {}
