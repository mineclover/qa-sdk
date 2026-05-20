import { z } from "zod";

const EntrySchema = z.union([
  z.string().min(1),
  z.object({
    id: z.string().min(1),
    address: z.number().int().nonnegative().optional(),
    label: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
]);

const AxisSchema = z.object({
  description: z.string().optional(),
  entries: z.array(EntrySchema).min(1, "entries는 최소 1개 필요"),
  capacity: z.number().int().positive().optional(),
  version: z.number().int().positive().optional(),
});

const RelationSchema = z.object({
  from: z.union([z.string(), z.array(z.string()).min(1)]),
  to: z.union([z.string(), z.array(z.string()).min(1)]),
  kind: z.enum(["contains", "parent-of", "depends-on", "binds", "projects-to"]),
  rules: z.array(z.record(z.string(), z.string())).default([]),
});

const ConstraintSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["capacity", "structural", "ref", "custom"]),
  rule: z.string().min(1),
  severity: z.enum(["error", "warning", "info"]).default("error"),
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
  axes: z.record(z.string(), AxisSchema).refine(
    (axes) => Object.keys(axes).length >= 1,
    "axes는 최소 1개 필요"
  ),
  relations: z.record(z.string(), RelationSchema).default({}),
  constraints: z.array(ConstraintSchema).default([]),
});

export type TaxonomyDoc = z.infer<typeof TaxonomyDocSchema>;
