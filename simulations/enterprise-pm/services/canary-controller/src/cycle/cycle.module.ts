// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Module } from "@nestjs/common";
import { CycleSchedulerService } from "./cycle-scheduler.service.js";
import { AdvisoryLockModule } from "../lock/advisory-lock.module.js";
import { MetricsScrapeModule } from "../metrics/metrics-scrape.module.js";
import { DecisionModule } from "../decision/decision.module.js";
import { ActionModule } from "../action/action.module.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";

@Module({
  imports: [
    AdvisoryLockModule,
    MetricsScrapeModule,
    DecisionModule,
    ActionModule,
  ],
  providers: [
    CycleSchedulerService,
    {
      provide: DecisionRingBuffer,
      useFactory: () =>
        new DecisionRingBuffer({
          maxSize: Number(process.env.SIM_CONTROLLER_RING_SIZE ?? "100"),
        }),
    },
  ],
  exports: [CycleSchedulerService, DecisionRingBuffer],
})
export class CycleModule {}
