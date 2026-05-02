// @def.boundary decision-service-spec
// @def.doc decision-service-spec

import { z } from "zod";
import { getRequiredServicePort, getServiceDevUrl } from "@qa-sdk/core";

const DEFAULT_PORT = getRequiredServicePort("decision-service");
const DEFAULT_DEFINITION_URL = getServiceDevUrl("definition-service") ?? "http://localhost:3700";

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  SQLITE_PATH: z.string().default("data/decision-service.sqlite"),
  /** definition-service URL — 문서 존재 확인 + 컨텍스트 조회 */
  DEFINITION_SERVICE_URL: z.string().default(DEFAULT_DEFINITION_URL),
  CORS_ORIGIN: z.string().default("*"),
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
