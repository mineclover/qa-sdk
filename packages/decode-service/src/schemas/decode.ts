import { z } from "zod";

/** POST /decode 요청 */
export const decodeRequestSchema = z.object({
  input: z.union([z.number(), z.string()]),
  prefix: z.string().optional(),
  version: z.string().optional(),
});

/** POST /decode/batch 요청 */
export const decodeBatchRequestSchema = z.object({
  prefix: z.string(),
  version: z.string(),
  inputs: z.array(z.union([z.number(), z.string()])).min(1).max(10_000),
});

/** POST /decode/deep 요청 */
export const decodeDeepRequestSchema = z.object({
  input: z.union([z.number(), z.string()]),
  prefix: z.string().optional(),
  version: z.string().optional(),
  maxDepth: z.number().int().min(1).max(16).optional(),
});

export type DecodeRequest = z.infer<typeof decodeRequestSchema>;
export type DecodeBatchRequest = z.infer<typeof decodeBatchRequestSchema>;
export type DecodeDeepRequest = z.infer<typeof decodeDeepRequestSchema>;
