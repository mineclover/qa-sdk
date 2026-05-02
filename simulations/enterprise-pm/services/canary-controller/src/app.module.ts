// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthModule } from "./health/health.module.js";
import { AdvisoryLockModule } from "./lock/advisory-lock.module.js";
import { MetricsScrapeModule } from "./metrics/metrics-scrape.module.js";
import { DecisionModule } from "./decision/decision.module.js";
import { ActionModule } from "./action/action.module.js";
import { CycleModule } from "./cycle/cycle.module.js";
import { FaultModule } from "./fault/fault.module.js";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HealthModule,
    AdvisoryLockModule,
    MetricsScrapeModule,
    DecisionModule,
    ActionModule,
    CycleModule,
    FaultModule,
  ],
})
export class AppModule {}
