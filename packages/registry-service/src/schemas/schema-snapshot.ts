import { z } from "zod";

export const axisSchema = z.object({
  id: z.string().min(1),
  entries: z.array(z.string()),
  capacity: z.number().int().positive(),
});

const snapshotSupplySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("axis"), capacity: z.number().int().positive() }),
  z.object({ type: z.literal("envelope") }),
  z.object({ type: z.literal("context") }),
  z.object({ type: z.literal("implicit") }),
]);

export const compositeSchema = z.object({
  id: z.string().min(1),
  dims: z.array(z.string().min(1)).min(1),
  owner: z.string().min(1),
  snapshotSupply: snapshotSupplySchema.optional(),
});

export const schemaSnapshotSchema = z.object({
  id: z.string().min(1),
  axes: z.array(axisSchema),
  composites: z.array(compositeSchema),
});

export type SchemaSnapshot = z.infer<typeof schemaSnapshotSchema>;

export const importSchema = z.object({
  snapshot: schemaSnapshotSchema,
  versionId: z.string().min(1).max(64),
});

export type ImportInput = z.infer<typeof importSchema>;

export const exportQuerySchema = z.object({
  versionId: z.string().min(1).max(64).optional(),
});

export const diffQuerySchema = z.object({
  from: z.string().min(1).max(64),
  to: z.string().min(1).max(64),
});
