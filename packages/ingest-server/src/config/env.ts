import { z } from "zod";

const envSchema = z.object({
  TRACE_DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3200),
});

export const env = envSchema.parse(process.env);
