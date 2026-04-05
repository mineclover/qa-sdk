import { z } from "zod";
import { getServicePort } from "@qa-sdk/core";

const DEFAULT_PORT = getServicePort("motion-workspace-service") ?? 3710;

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  SQLITE_PATH: z.string().default("data/motion-workspace-service.sqlite"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
