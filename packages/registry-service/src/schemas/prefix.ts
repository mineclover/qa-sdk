// @def.boundary registry-system
// @def.doc registry-system

import { z } from "zod";

export const registerPrefixSchema = z.object({
  prefix: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_]*$/),
  owner: z.string().min(1).max(128),
  kind: z.enum(["leaf", "composite"]),
  numberType: z.enum(["number", "bigint"]).default("number"),
});

export type RegisterPrefixInput = z.infer<typeof registerPrefixSchema>;
