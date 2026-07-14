// @def.boundary registry-system
// @def.doc registry-system

import { z } from 'zod';

export const createDraftSchema = z.object({
  versionId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[^:]+$/, "versionId must not contain ':'"),
  baseVersionId: z.string().max(64).nullable().default(null),
  capacity: z.number().int().nonnegative(),
  deactivationMode: z.enum(['strict', 'flexible']).optional(),
  refs: z
    .array(
      z.object({
        prefix: z.string().min(1),
        versionId: z.string().min(1),
      }),
    )
    .optional(),
});

export type CreateDraftInput = z.infer<typeof createDraftSchema>;

export const patchDraftSchema = z.object({
  capacity: z.number().int().positive().optional(),
  refs: z
    .array(
      z.object({
        prefix: z.string().min(1),
        versionId: z.string().min(1),
      }),
    )
    .optional(),
});

export type PatchDraftInput = z.infer<typeof patchDraftSchema>;

export const listVersionsQuerySchema = z.object({
  status: z.enum(['draft', 'locked', 'released', 'active', 'deprecated']).optional(),
});
