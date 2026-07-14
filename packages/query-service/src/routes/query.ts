// @def.boundary query-api-spec
// @def.doc query-api-spec

import { Hono } from 'hono';
import type { QueryLookupService } from '../lib/query-service.js';
import {
  composeQueryRequestSchema,
  matchRangesRequestSchema,
  queryAcrossVersionsRequestSchema,
  resolvePolicyRequestSchema,
  resolveRelationRequestSchema,
} from '../schemas/query.js';

export interface QueryRouteDeps {
  queryService: QueryLookupService;
}

export function createQueryRoutes(deps: QueryRouteDeps) {
  const app = new Hono();

  app.post('/resolve', async (c) => {
    const body = resolvePolicyRequestSchema.parse(await c.req.json());
    const rules = body.rules.map((rule) => ({
      id: rule.id,
      pattern: rule.pattern,
      value: rule.value,
      priority: rule.priority,
    }));
    const result = await deps.queryService.resolvePolicy(
      body.coord,
      rules,
      body.shape,
      body.strategy,
      {
        indexId: body.indexId,
        versionId: body.versionId,
        withGate: body.withGate,
      },
    );
    return c.json(result);
  });

  app.post('/match-ranges', async (c) => {
    const body = matchRangesRequestSchema.parse(await c.req.json());
    const ranges = await deps.queryService.matchRanges(
      body.indexId,
      body.versionId,
      body.partial,
      body.gateMode,
    );
    return c.json(ranges);
  });

  app.post('/compose-query', async (c) => {
    const body = composeQueryRequestSchema.parse(await c.req.json());
    const ranges = deps.queryService.composeQuery(body.source, body.through, body.targetConstraint);
    return c.json(ranges);
  });

  app.post('/query-across-versions', async (c) => {
    const body = queryAcrossVersionsRequestSchema.parse(await c.req.json());
    const rangesByVersion = deps.queryService.queryAcrossVersions(
      body.indexId,
      body.versionIds,
      body.constraint,
    );
    return c.json(Object.fromEntries(rangesByVersion));
  });

  app.post('/resolve-relation', async (c) => {
    const body = resolveRelationRequestSchema.parse(await c.req.json());
    const typeRules = body.typeRules.map((rule) => ({
      id: rule.id,
      pattern: rule.pattern,
      effect: rule.effect,
      priority: rule.priority,
      instanceRules: rule.instanceRules
        ? {
            indexId: rule.instanceRules.indexId,
            versionId: rule.instanceRules.versionId,
            strategy: rule.instanceRules.strategy,
            rules: rule.instanceRules.rules.map((instanceRule) => ({
              id: instanceRule.id,
              pattern: instanceRule.pattern,
              value: instanceRule.value,
              priority: instanceRule.priority,
            })),
          }
        : undefined,
    }));
    const result = deps.queryService.resolveRelation(
      body.relTypeCoord,
      body.relShape,
      typeRules,
      body.typeStrategy,
      body.instanceCoord,
    );
    return c.json(result);
  });

  return app;
}
