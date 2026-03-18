import { z } from "zod";

const prefixVersionRequestSchema = z.object({
  prefix: z.string().min(1),
  versionId: z.string().min(1),
});

export const gateLookupRequestSchema = prefixVersionRequestSchema.extend({
  address: z.number().int().min(0),
});

export const gateRecomputeRequestSchema = prefixVersionRequestSchema;

const addressRangeSchema = z
  .tuple([z.number().int().min(0), z.number().int().min(0)])
  .refine(([from, to]) => from <= to, {
    message: "range start must be less than or equal to range end",
  });

export const gateFilterModeSchema = z.enum(["encodable", "decodable", "active"]);

export const gateFilterRangesRequestSchema = prefixVersionRequestSchema.extend({
  ranges: z.array(addressRangeSchema),
  mode: gateFilterModeSchema,
});

export type GateLookupRequest = z.infer<typeof gateLookupRequestSchema>;
export type GateRecomputeRequest = z.infer<typeof gateRecomputeRequestSchema>;
export type GateFilterRangesRequest = z.infer<typeof gateFilterRangesRequestSchema>;
