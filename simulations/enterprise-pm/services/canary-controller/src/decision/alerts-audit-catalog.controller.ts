// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 4~6 + §3 InternalIpGuard.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.1
//
// 3 query endpoint:
//   GET /v1/alerts/count?kind=...&since=ISO  → ring buffer countAlerts
//   GET /v1/audit/trace?cycleId=...          → ring buffer trace + sim-decision-view 변환
//   GET /v1/catalog/states?prefix=...        → catalog getCurrentTopology

import { Controller, Get, Inject, NotFoundException, Query, UseGuards } from '@nestjs/common';
import { InternalIpGuard } from 'sim-internal-network';
import { toAuditTraceView, type AuditTraceView } from 'sim-decision-view';
import { DecisionRingBuffer } from './decision-ring-buffer.js';

/**
 * controller-side wrapper port for sim-service-catalog `getCurrentTopology`.
 *
 * sim-service-catalog 의 `getCurrentTopology(catalog, options)` 는 sync 시그니처지만
 * controller 는 다중 prefix 카탈로그를 비동기로 조회 (catalog HTTP endpoint 또는
 * 메모리 lookup) 할 수 있어야 하므로 async port 로 추상화한다. 본 port 는 spec §6
 * `/v1/catalog/states` 응답 shape `{ stable, candidate, retired }` 만 노출한다.
 */
export interface SimServiceCatalogPort {
  getCurrentTopology(prefix: string): Promise<{
    stable: { value: number };
    candidate: { value: number } | null;
    retired: { value: number }[];
  }>;
}

export const SIM_SERVICE_CATALOG_TOKEN = Symbol('SIM_SERVICE_CATALOG');

@Controller('v1')
@UseGuards(InternalIpGuard)
export class AlertsAuditCatalogController {
  // vitest 환경은 emitDecoratorMetadata 를 무시하므로 @Inject 토큰을 명시한다.
  constructor(
    @Inject(DecisionRingBuffer) private readonly ring: DecisionRingBuffer,
    @Inject(SIM_SERVICE_CATALOG_TOKEN)
    private readonly catalog: SimServiceCatalogPort,
  ) {}

  @Get('/alerts/count')
  countAlerts(
    @Query('kind') kind: string,
    @Query('since') since?: string,
  ): { count: number; kind: string } {
    return { count: this.ring.countAlerts({ kind, since }), kind };
  }

  @Get('/audit/trace')
  trace(@Query('cycleId') cycleId: string): { trace: AuditTraceView } {
    const t = this.ring.trace(cycleId);
    if (t === null) {
      throw new NotFoundException({
        type: 'https://qa-sdk.dev/errors/not-found',
        title: 'trace not found',
        status: 404,
        instance: cycleId,
      });
    }
    return {
      trace: toAuditTraceView({
        cycleId: t.cycleId,
        cycleAt: t.cycleAt,
        safety: t.safety,
        resource: t.resource,
        events: t.events,
      }),
    };
  }

  @Get('/catalog/states')
  catalogStates(@Query('prefix') prefix: string): Promise<{
    stable: { value: number };
    candidate: { value: number } | null;
    retired: { value: number }[];
  }> {
    return this.catalog.getCurrentTopology(prefix);
  }
}
