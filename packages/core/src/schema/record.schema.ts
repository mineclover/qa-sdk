import { z } from "zod";

export const recordKindSchema = z.enum(["log", "span", "metric"]);

export const spanStatusCodeSchema = z.enum(["ok", "error", "unset"]);

export const metricTypeSchema = z.enum(["counter", "gauge", "histogram", "summary"]);

export const payloadFormatSchema = z.enum([
  "json",
  "rpc",
  "protobuf",
  "text",
  "binary",
  "stream",
]);

export const payloadEncodingSchema = z.enum(["raw", "base64", "gzip+base64", "protobuf"]);

export const eventRecordSchema = z.object({
  log_id: z.string().min(1),
  timestamp: z.string().datetime(),
  record_kind: recordKindSchema,

  trace_id: z.string().min(1),
  span_id: z.string().min(1),
  parent_span_id: z.string().optional(),

  event_key: z.string().min(1),
  event_version: z.string().regex(/^\d{3}$/),

  span_name: z.string().optional(),
  start_time: z.string().datetime().optional(),
  end_time: z.string().datetime().optional(),
  status_code: spanStatusCodeSchema.optional(),

  payload_format: payloadFormatSchema,
  payload_encoding: payloadEncodingSchema,
  payload_masking_applied: z.boolean(),
  payload_masked_fields: z.array(z.string()),
  payload: z.unknown(),

  qa_session_id: z.string().optional(),

  // Address context
  address_context: z.record(z.string(), z.string()).optional(),

  // Metric (when record_kind === "metric")
  metric_type: metricTypeSchema.optional(),
  metric_name: z.string().optional(),
  metric_value: z.number().optional(),
  metric_unit: z.string().optional(),
  metric_labels: z.record(z.string(), z.string()).optional(),
  metric_buckets: z.array(z.number()).optional(),
  metric_quantiles: z.array(z.number()).optional(),

  actor_id: z.string().optional(),
  user_id: z.string().optional(),
  user_attributes: z.record(z.string()).optional(),
});
