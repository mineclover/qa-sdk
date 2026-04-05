// config/config-schema.ts — ResolvedConfig zod 스키마
import { z } from "zod";

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()),
});

const monitoringSchema = z.object({
  interval: z.number().positive().default(60),
  webhooks: z.array(webhookSchema).optional(),
});

const gateDefSchema = z.object({
  name: z.string(),
  type: z.literal("custom"),
  check: z.string(),
  expect_status: z.number(),
  required: z.boolean(),
});

const serviceConfigSchema = z.object({
  port: z.number(),
  depends_on: z.array(z.string()).optional(),
  gates: z.array(gateDefSchema).optional(),
}).passthrough();

const connectionConfigSchema = z.object({
  endpoint: z.string(),
  health_path: z.string().optional(),
}).passthrough();

const globalConfigSchema = z.object({
  region: z.string(),
}).passthrough();

export const configSchema = z.object({
  global: globalConfigSchema,
  services: z.record(serviceConfigSchema),
  connections: z.record(connectionConfigSchema),
  monitoring: monitoringSchema.optional(),
});

export type ParsedConfig = z.infer<typeof configSchema>;
