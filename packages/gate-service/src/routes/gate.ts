// @def.boundary gate-system
// @def.doc gate-system

import { Hono } from "hono";
import type { GateLookupService } from "../lib/gate-service.js";
import {
  gateFilterRangesRequestSchema,
  gateLookupRequestSchema,
  gateRecomputeRequestSchema,
} from "../schemas/gate.js";

export interface GateRoutesDeps {
  gateService: GateLookupService;
}

export function createGateRoutes(deps: GateRoutesDeps) {
  const app = new Hono();

  app.post("/gate/check", async (c) => {
    const body = await c.req.json();
    const req = gateLookupRequestSchema.parse(body);

    const result = await deps.gateService.checkGate(
      req.prefix,
      req.versionId,
      req.address,
    );

    return c.json(result);
  });

  app.post("/gate/classify", async (c) => {
    const body = await c.req.json();
    const req = gateLookupRequestSchema.parse(body);

    const state = await deps.gateService.classifyAddress(
      req.prefix,
      req.versionId,
      req.address,
    );

    return c.json(state);
  });

  app.post("/gate/recompute", async (c) => {
    const body = await c.req.json();
    const req = gateRecomputeRequestSchema.parse(body);

    await deps.gateService.recompute(req.prefix, req.versionId);
    return c.body(null, 204);
  });

  app.post("/gate/cascade-recompute", async (c) => {
    const body = await c.req.json();
    const req = gateRecomputeRequestSchema.parse(body);

    await deps.gateService.cascadeRecompute(req.prefix, req.versionId);
    return c.body(null, 204);
  });

  app.post("/gate/filter-ranges", async (c) => {
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

  app.get("/gate/state/:prefix/:version", async (c) => {
    const prefix = c.req.param("prefix");
    const versionId = c.req.param("version");
    const record = await deps.gateService.getStateRanges(prefix, versionId);
    return c.json(record);
  });

  return app;
}
