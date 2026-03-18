import { Hono } from "hono";
import type { RuleService } from "../lib/rule-service.js";
import {
  policyRulePayloadSchema,
  ruleIdParamSchema,
  ruleListQuerySchema,
  ruleMutationQuerySchema,
} from "../schemas/policy-rule.js";

export interface RuleRouteDeps {
  ruleService: RuleService;
}

export function createRuleRoutes(deps: RuleRouteDeps) {
  const app = new Hono();

  app.post("/rules", async (c) => {
    const body = await c.req.json();
    const payload = policyRulePayloadSchema.parse(body);
    const query = ruleMutationQuerySchema.parse(c.req.query());

    const result = await deps.ruleService.createRule(payload, query.force);
    return c.json(result, 201);
  });

  app.get("/rules", async (c) => {
    const query = ruleListQuerySchema.parse(c.req.query());
    const rules = await deps.ruleService.listRules(query.indexId, query.versionId);
    return c.json(rules);
  });

  app.get("/rules/:id", async (c) => {
    const params = ruleIdParamSchema.parse(c.req.param());
    const rule = await deps.ruleService.getRule(params.id);
    return c.json(rule);
  });

  app.put("/rules/:id", async (c) => {
    const params = ruleIdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const payload = policyRulePayloadSchema.parse(body);
    const query = ruleMutationQuerySchema.parse(c.req.query());

    const result = await deps.ruleService.updateRule(params.id, payload, query.force);
    return c.json(result);
  });

  app.delete("/rules/:id", async (c) => {
    const params = ruleIdParamSchema.parse(c.req.param());
    await deps.ruleService.deleteRule(params.id);
    return c.body(null, 204);
  });

  return app;
}
