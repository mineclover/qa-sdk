import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional(),
);

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(3500),
  SQLITE_DRIVER: z.enum(["node", "better"]).default("node"),
  SQLITE_PATH: z.string().default("data/query-service.sqlite"),
  GATE_SERVICE_URL: optionalUrl,
  QUERY_DEFAULT_STRATEGY: z.enum([
    "most-specific",
    "priority",
    "collect",
    "first-match",
  ]).default("most-specific"),
  QUERY_GATE_FAILURE_MODE: z.enum(["fail-open", "fail-closed"]).default("fail-open"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
