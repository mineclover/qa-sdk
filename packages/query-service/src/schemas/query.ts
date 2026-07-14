// @def.boundary query-api-spec
// @def.doc query-api-spec

import { z } from 'zod';
import { coordConstraintSchema } from './policy-rule.js';

export const conflictStrategySchema = z.enum([
  'most-specific',
  'priority',
  'collect',
  'first-match',
]);

const entityIdSchema = z.union([z.string().min(1), z.number().finite()]);

const entityConstraintSchema = entityIdSchema.or(z.null());
const coordSchema = z.array(z.number().int().positive()).min(1);
const shapeSchema = z.array(z.number().int().positive()).min(1);
const rulePatternSchema = z.array(coordConstraintSchema).min(1);
const gateModeSchema = z.enum(['encodable', 'decodable', 'active']);

export const resolvePolicyRuleSchema = z.object({
  id: z.string().min(1),
  pattern: rulePatternSchema,
  value: z.unknown(),
  priority: z.number().int().optional(),
});

export const resolvePolicyRequestSchema = z
  .object({
    indexId: z.string().min(1).optional(),
    versionId: z.string().min(1).optional(),
    coord: coordSchema,
    rules: z.array(resolvePolicyRuleSchema),
    shape: shapeSchema,
    strategy: conflictStrategySchema.optional(),
    withGate: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.withGate && (!value.indexId || !value.versionId)) {
      if (!value.indexId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['indexId'],
          message: 'indexId is required when withGate=true',
        });
      }

      if (!value.versionId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['versionId'],
          message: 'versionId is required when withGate=true',
        });
      }
    }
  });

export const matchRangesRequestSchema = z.object({
  indexId: z.string().min(1),
  versionId: z.string().min(1),
  partial: z.record(entityConstraintSchema),
  gateMode: gateModeSchema.nullable().optional(),
});

export const composeQueryRequestSchema = z.object({
  source: z.object({
    indexId: z.string().min(1),
    versionId: z.string().min(1),
  }),
  through: z.string().min(1),
  targetConstraint: z.record(entityConstraintSchema),
});

export const queryAcrossVersionsRequestSchema = z.object({
  indexId: z.string().min(1),
  versionIds: z.array(z.string().min(1)).min(1),
  constraint: z.record(entityConstraintSchema),
});

const relationInstanceRulesSchema = z.object({
  indexId: z.string().min(1),
  versionId: z.string().min(1),
  rules: z.array(resolvePolicyRuleSchema),
  strategy: conflictStrategySchema.optional(),
});

export const relationTypeRuleSchema = z.object({
  id: z.string().min(1),
  pattern: rulePatternSchema,
  effect: z.unknown(),
  instanceRules: relationInstanceRulesSchema.optional(),
  priority: z.number().int().optional(),
});

export const resolveRelationRequestSchema = z.object({
  relTypeCoord: coordSchema,
  relShape: shapeSchema,
  typeRules: z.array(relationTypeRuleSchema),
  typeStrategy: conflictStrategySchema.optional(),
  instanceCoord: coordSchema.optional(),
});
