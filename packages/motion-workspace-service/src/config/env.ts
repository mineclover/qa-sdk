import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(3710),
  SQLITE_PATH: z.string().default("data/motion-workspace-service.sqlite"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
