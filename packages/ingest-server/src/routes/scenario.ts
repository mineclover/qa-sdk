// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from 'hono';
import type { ScenarioSpecStore } from '@qa-sdk/core';
import { scenarioSpecSchema } from '@qa-sdk/core';
import { compileSpec } from '@qa-sdk/engine';
import { badRequest, scenarioNotFound } from '../lib/errors.js';
import { z } from 'zod';

const listQuerySchema = z.object({
  domain: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export interface ScenarioDeps {
  scenarioSpecStore: ScenarioSpecStore;
}

export function createScenarioRoutes(deps: ScenarioDeps) {
  const app = new Hono();

  app.post('/v1/scenarios', async (c) => {
    const body = await c.req.json();
    const spec = scenarioSpecSchema.parse(body);

    // 의미 검증: step 참조가 유효한지, 순환 참조가 없는지 확인
    try {
      compileSpec(spec);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid scenario spec';
      throw badRequest(`scenario compilation failed: ${message}`);
    }

    await deps.scenarioSpecStore.upsert(spec);

    return c.json({ accepted: true, scenario_id: spec.scenario_id }, 201);
  });

  app.get('/v1/scenarios', async (c) => {
    const query = listQuerySchema.parse(c.req.query());
    const limit = Math.min(query.limit ?? 100, 100);

    const specs = query.domain
      ? await deps.scenarioSpecStore.findByDomain(query.domain, limit)
      : await deps.scenarioSpecStore.findAll(limit);

    return c.json({ items: specs });
  });

  app.get('/v1/scenarios/:scenarioId', async (c) => {
    const scenarioId = c.req.param('scenarioId');
    const spec = await deps.scenarioSpecStore.findById(scenarioId);

    if (!spec) {
      throw scenarioNotFound(scenarioId);
    }

    return c.json(spec);
  });

  app.delete('/v1/scenarios/:scenarioId', async (c) => {
    const scenarioId = c.req.param('scenarioId');
    const removed = await deps.scenarioSpecStore.remove(scenarioId);

    if (!removed) {
      throw scenarioNotFound(scenarioId);
    }

    return c.json({ deleted: true, scenario_id: scenarioId });
  });

  return app;
}
