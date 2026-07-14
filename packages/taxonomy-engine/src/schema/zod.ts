import { z } from 'zod';

const LifecycleSchema = z.enum(['draft', 'review', 'approved', 'deprecated', 'archived', 'tbd']);

const EntrySchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    address: z.number().int().nonnegative().optional(),
    label: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    lifecycle: LifecycleSchema.optional(),
    placeholderReason: z.string().min(1).optional(),
    decisionLink: z.string().min(1).optional(),
  }),
]);

const AxisSchema = z.object({
  description: z.string().optional(),
  entries: z.array(EntrySchema).min(1, 'entries는 최소 1개 필요'),
  capacity: z.number().int().positive().optional(),
  version: z.number().int().positive().optional(),
  lifecycle: LifecycleSchema.optional(),
});

const RelationSchema = z.object({
  from: z.union([z.string(), z.array(z.string()).min(1)]),
  to: z.union([z.string(), z.array(z.string()).min(1)]),
  kind: z.enum(['contains', 'parent-of', 'depends-on', 'binds', 'projects-to']),
  rules: z.array(z.record(z.string(), z.string())).default([]),
});

export const CapacityRuleSchema = z.object({
  axis: z.string().min(1),
  prop: z.enum(['entries.length', 'capacity']),
  op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
  value: z.number(),
});

export const RefRuleSchema = z.object({
  axis: z.string().min(1),
  mustExist: z.boolean(),
});

export const StructuralRuleSchema = z.object({
  relationKind: z.string().min(1),
  forbidden: z.object({
    field: z.string().min(1),
    value: z.string().min(1),
  }),
});

const ConstraintSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['capacity', 'structural', 'ref', 'custom']),
  rule: z.union([
    z.string().min(1), // legacy string (deprecated)
    z.record(z.string(), z.unknown()), // 구조화 객체 (kind별 schema는 evaluator에서 재검증)
  ]),
  severity: z.enum(['error', 'warning', 'info']).default('error'),
});

const ImportSchema = z.object({
  taxonomy: z.string().min(1),
  version: z.number().int().positive().optional(),
  as: z.string().min(1),
});

export const TaxonomyDocSchema = z.object({
  taxonomy: z.string().min(1),
  version: z.number().int().positive(),
  description: z.string().optional(),
  imports: z.array(ImportSchema).default([]),
  axes: z
    .record(z.string(), AxisSchema)
    .refine((axes) => Object.keys(axes).length >= 1, 'axes는 최소 1개 필요'),
  relations: z.record(z.string(), RelationSchema).default({}),
  constraints: z.array(ConstraintSchema).default([]),
});

export type TaxonomyDoc = z.infer<typeof TaxonomyDocSchema>;
