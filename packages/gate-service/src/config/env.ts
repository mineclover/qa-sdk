import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(3400),
  SQLITE_DRIVER: z.enum(["node", "better"]).default("node"),
  SQLITE_PATH: z.string().default("data/gate-service.sqlite"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
