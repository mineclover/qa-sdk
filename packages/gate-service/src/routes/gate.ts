// @def.boundary gate-system
// @def.doc gate-system

import { Hono } from 'hono';
import { AppError } from '../lib/errors.js';
import type { GateLookupService } from '../lib/gate-service.js';
import {
  gateFilterRangesRequestSchema,
  gateLookupRequestSchema,
  gateRecomputeRequestSchema,
} from '../schemas/gate.js';

export interface GateRoutesDeps {
  gateService: GateLookupService;
}

/**
 * GateEngine이 없으면 재계산할 수 없다 — 204로 성공을 가장하지 않고 501로 알린다.
 * 엔진 구성 여부는 `/health`의 `gate_engine_configured`로도 노출된다.
 */
export function assertEngineConfigured(gateService: GateLookupService): void {
  if (!gateService.engine) {
    throw new AppError(
      'GATE_ENGINE_NOT_CONFIGURED',
      'GateEngine이 구성되지 않아 주소 상태를 재계산할 수 없습니다',
      501,
    );
  }
}

export function createGateRoutes(deps: GateRoutesDeps) {
  const app = new Hono();

  app.post('/gate/check', async (c) => {
    const body = await c.req.json();
    const req = gateLookupRequestSchema.parse(body);

    const result = await deps.gateService.checkGate(req.prefix, req.versionId, req.address);

    return c.json(result);
  });

  app.post('/gate/classify', async (c) => {
    const body = await c.req.json();
    const req = gateLookupRequestSchema.parse(body);

    const state = await deps.gateService.classifyAddress(req.prefix, req.versionId, req.address);

    return c.json(state);
  });

  app.post('/gate/recompute', async (c) => {
    assertEngineConfigured(deps.gateService);
    const body = await c.req.json();
    const req = gateRecomputeRequestSchema.parse(body);

    await deps.gateService.recompute(req.prefix, req.versionId);
    return c.body(null, 204);
  });

  app.post('/gate/cascade-recompute', async (c) => {
    assertEngineConfigured(deps.gateService);
    const body = await c.req.json();
    const req = gateRecomputeRequestSchema.parse(body);

    await deps.gateService.cascadeRecompute(req.prefix, req.versionId);
    return c.body(null, 204);
  });

  app.post('/gate/filter-ranges', async (c) => {
    const body = await c.req.json();
    const req = gateFilterRangesRequestSchema.parse(body);

    const filteredRanges = await deps.gateService.filterRanges(
      req.prefix,
      req.versionId,
      req.ranges,
      req.mode,
    );

    return c.json(filteredRanges);
  });

  app.get('/gate/state/:prefix/:version', async (c) => {
    const prefix = c.req.param('prefix');
    const versionId = c.req.param('version');
    const record = await deps.gateService.getStateRanges(prefix, versionId);
    return c.json(record);
  });

  return app;
}
