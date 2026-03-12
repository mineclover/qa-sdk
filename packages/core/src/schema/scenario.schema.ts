import { z } from "zod";

export const constraintOpSchema = z.enum([
  "eq",
  "neq",
  "exists",
  "gt",
  "lt",
  "contains",
  "masked",
]);

export const stepConstraintSchema = z.object({
  field: z.string().min(1),
  op: constraintOpSchema,
  value: z.unknown().optional(),
});

export const entryConditionSchema = z.object({
  field: z.string().min(1),
  op: z.enum(["eq", "neq", "exists", "gt", "lt", "contains"]),
  value: z.unknown().optional(),
});

export const branchDefSchema = z.object({
  condition: stepConstraintSchema,
  next: z.array(z.string().min(1)),
});

export const stepKindSchema = z.enum(["sequence", "optional", "branch"]);

export const scenarioStepSchema = z.object({
  id: z.string().min(1),
  event_key: z.string().min(1),
  event_version: z.string().regex(/^\d{3}$/).optional(),
  source: z.string().optional(),
  record_kind: z.enum(["log", "span"]).optional(),
  required: z.boolean(),
  kind: stepKindSchema,
  constraints: z.array(stepConstraintSchema).optional(),
  timeout_ms: z.number().int().positive().optional(),
  next: z.array(z.string().min(1)).optional(),
  branches: z.array(branchDefSchema).optional(),
});

export const scenarioSpecSchema = z.object({
  scenario_id: z.string().min(1),
  version: z.string().min(1),
  domain: z.string().min(1),
  description: z.string().optional(),
  entry_conditions: z.array(entryConditionSchema).optional(),
  steps: z.array(scenarioStepSchema).min(1),
});
