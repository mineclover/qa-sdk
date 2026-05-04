// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
//
// HealthyMetricsFault wrap — DecisionModule 의 PerfWarnAware 패턴과 동일.
// fault disabled (기본) → passthrough. enabled → scrape() 결과를 PASS 합성으로 wrap.
// 시뮬 환경의 외부 metrics endpoint 가 미연결/오류 응답일 때 scenario 9 진입점 역할.

import { Module } from "@nestjs/common";
import {
  MetricsScrapeService,
  type ScrapeResult,
} from "./metrics-scrape.service.js";
import { HealthyMetricsFault } from "../fault/healthy-metrics.js";
import { FaultModule } from "../fault/fault.module.js";
import { env } from "../config/env.js";

/**
 * HealthyMetricsFault aware wrapper — scrape 결과를 fault 가 enabled 시 wrap.
 * applyTo 는 fault 가 disabled 면 passthrough 이므로 비용 없음.
 */
class HealthyMetricsAwareScrapeService extends MetricsScrapeService {
  constructor(
    cfg: ConstructorParameters<typeof MetricsScrapeService>[0],
    private readonly healthy: HealthyMetricsFault,
  ) {
    super(cfg);
  }
  override async scrape(): Promise<ScrapeResult> {
    const result = await super.scrape();
    return this.healthy.applyTo(result);
  }
}

@Module({
  imports: [FaultModule],
  providers: [
    {
      provide: MetricsScrapeService,
      useFactory: (healthy: HealthyMetricsFault) =>
        new HealthyMetricsAwareScrapeService(
          {
            metricsUrl: env.SIM_METRICS_COLLECTOR_URL,
            ingestUrl: env.QA_INGEST_URL,
            auditUrl: env.SIM_AUDIT_RECORDER_URL,
          },
          healthy,
        ),
      inject: [HealthyMetricsFault],
    },
  ],
  exports: [MetricsScrapeService],
})
export class MetricsScrapeModule {}
