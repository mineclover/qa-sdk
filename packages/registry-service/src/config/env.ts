import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(3300),
  SQLITE_PATH: z.string().default(":memory:"),
});

export function parseEnv(source: NodeJS.ProcessEnv) {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
