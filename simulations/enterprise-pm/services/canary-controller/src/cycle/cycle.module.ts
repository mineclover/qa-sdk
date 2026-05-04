// @def.boundary sim-canary-controller
// @def.doc canary-controller-config

import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { CycleSchedulerService } from "./cycle-scheduler.service.js";
import { AdvisoryLockModule } from "../lock/advisory-lock.module.js";
import { MetricsScrapeModule } from "../metrics/metrics-scrape.module.js";
import { DecisionModule } from "../decision/decision.module.js";
import { ActionModule } from "../action/action.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { FaultModule } from "../fault/fault.module.js";
import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js";

@Module({
  imports: [
    // SchedulerRegistry 가 본 모듈 컴파일 단위에서 resolve 가능하도록 ScheduleModule import.
    // AppModule 도 forRoot 호출하지만 sub-module 단독 smoke test 호환성 + DI 명시성.
    ScheduleModule.forRoot(),
    AdvisoryLockModule,
    MetricsScrapeModule,
    DecisionModule,
    ActionModule,
    // catalog promote (weight=100 도달 시 candidate→stable 전이) 와 healthy-metrics
    // fault 자동 enable 위해 CatalogModule + FaultModule 의존.
    CatalogModule,
    FaultModule,
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
