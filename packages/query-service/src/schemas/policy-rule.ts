import { z } from "zod";

const coordConstraintInputSchema = z.union([
  z.string().min(1),
  z.number().int().positive(),
  z.null(),
]);

const forceQueryValueSchema = z.preprocess((value) => {
  if (value === undefined) return false;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
}, z.boolean());

export const coordConstraintSchema = coordConstraintInputSchema.transform((value) =>
  value === null ? null : String(value),
);

export const policyPatternSchema = z.array(coordConstraintSchema).min(1);

export const policyRulePayloadSchema = z.object({
  indexId: z.string().min(1),
  versionId: z.string().min(1),
  pattern: policyPatternSchema,
  value: z.unknown(),
  priority: z.number().int().optional(),
  ruleSetId: z.string().min(1).optional(),
});

export const storedPolicyRuleSchema = policyRulePayloadSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const ruleListQuerySchema = z.object({
  indexId: z.string().min(1),
  versionId: z.string().min(1),
});

export const ruleMutationQuerySchema = z.object({
  force: forceQueryValueSchema,
});

export const ruleIdParamSchema = z.object({
  id: z.string().min(1),
});

export const ruleMigrationPayloadSchema = z.object({
  indexId: z.string().min(1),
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
});

export type PolicyRulePayload = z.infer<typeof policyRulePayloadSchema>;
export type RuleMigrationPayload = z.infer<typeof ruleMigrationPayloadSchema>;
