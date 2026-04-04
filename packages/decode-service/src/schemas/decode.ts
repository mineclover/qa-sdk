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
});

/**
 * POST /decode/big 요청.
 * BigInt index 전용. input은 bigint를 나타내는 문자열.
 */
export const decodeBigRequestSchema = z.object({
  /** bigint를 나타내는 문자열 (예: "12345678901234567890") */
  input: z.string(),
  prefix: z.string(),
  version: z.string(),
});

/**
 * POST /decode/big/batch 요청.
 * BigInt index 전용.
 */
export const decodeBigBatchRequestSchema = z.object({
  prefix: z.string(),
  version: z.string(),
  inputs: z.array(z.string()).min(1).max(10_000),
});

/**
 * POST /decode/big/deep 요청.
 * BigInt index 전용.
 */
export const decodeBigDeepRequestSchema = z.object({
  input: z.string(),
  prefix: z.string(),
  version: z.string(),
});

export type DecodeRequest = z.infer<typeof decodeRequestSchema>;
export type DecodeBatchRequest = z.infer<typeof decodeBatchRequestSchema>;
export type DecodeDeepRequest = z.infer<typeof decodeDeepRequestSchema>;
export type DecodeBigRequest = z.infer<typeof decodeBigRequestSchema>;
export type DecodeBigBatchRequest = z.infer<typeof decodeBigBatchRequestSchema>;
export type DecodeBigDeepRequest = z.infer<typeof decodeBigDeepRequestSchema>;
