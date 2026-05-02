// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { z } from "zod";
import { eventRecordSchema } from "./record.schema.js";

export const ownerTypeSchema = z.enum([
  "tenant",
  "workspace",
  "user",
  "agent",
]);

export const transmissionOwnerSchema = z.object({
  owner_type: ownerTypeSchema,
  owner_id: z.string().min(1),
});

export const transmissionSourceSchema = z.object({
  service_name: z.string().min(1),
  sdk_name: z.string().min(1),
  sdk_version: z.string().min(1),
});

export const transmissionRuntimeSchema = z.object({
  platform: z.string().min(1),
  device_ref: z.string().optional(),
  os_version: z.string().optional(),
  app_version: z.string().optional(),
});

export const buildEnvSchema = z.string().min(1);

export const transmissionBuildSchema = z.object({
  env: buildEnvSchema,
  build_ref: z.string().optional(),
  release_version: z.string().optional(),
});

export const transmissionEnvelopeSchema = z.object({
  transmission_id: z.string().min(1),
  sent_at: z.string().datetime(),
  owner: transmissionOwnerSchema,
  source: transmissionSourceSchema,
  runtime: transmissionRuntimeSchema,
  build: transmissionBuildSchema,
  infra_context: z.record(z.string(), z.string()).optional(),
  entry_snapshot: z.string().optional(),
  records: z.array(eventRecordSchema).min(1),
});
