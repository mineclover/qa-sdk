// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// spec 2026-05-02 §3·§6·§7·§8 — Stage 1a + Stage 1b 통합 wiring.
//
// - InternalIpGuard 를 global guard 로 등록 — 모든 /v1/* /admin/* 외부 IP 차단.
// - AlertsAuditCatalogController 추가 + DecisionRingBuffer 와 SimServiceCatalogPort 의존.
// - AdminModule 추가 (compose-proxy + scale 4 endpoint).
// - FaultModule wiring 은 6 kind (4 기존 + 2 신규).
// - DecisionModule CategoryVerdictService factory 가 PerfWarnFault 를 wrap (perf-warn 효과).
// - ActionExecutorService 가 SimServiceCatalogPort + PortRegistryPort + serviceName +
//   ScalePinService + DecisionRingBuffer 의존 (RoutingPushSchema + pin-aware scale).
// - CatalogModule 이 SIM_SERVICE_CATALOG / PORT_REGISTRY / SIM_TARGET_SERVICE token 의
//   단일 진입 — ActionModule + AppModule(controller) 양쪽이 import.

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { InternalIpGuard } from 'sim-internal-network';
import { HealthModule } from './health/health.module.js';
import { AdvisoryLockModule } from './lock/advisory-lock.module.js';
import { MetricsScrapeModule } from './metrics/metrics-scrape.module.js';
import { DecisionModule } from './decision/decision.module.js';
import { DecisionQueryModule } from './decision/decision-query.module.js';
import { ActionModule } from './action/action.module.js';
import { CycleModule } from './cycle/cycle.module.js';
import { FaultModule } from './fault/fault.module.js';
import { AdminModule } from './admin/admin.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { AlertsAuditCatalogController } from './decision/alerts-audit-catalog.controller.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    HealthModule,
    AdvisoryLockModule,
    MetricsScrapeModule,
    CatalogModule,
    DecisionModule,
    DecisionQueryModule,
    ActionModule,
    CycleModule,
    FaultModule,
    AdminModule,
  ],
  controllers: [AlertsAuditCatalogController],
  providers: [
    // global guard — controller / admin 모든 endpoint 외부 IP 차단.
    {
      provide: APP_GUARD,
      useClass: InternalIpGuard,
    },
  ],
})
export class AppModule {}
