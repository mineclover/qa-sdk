// @def.doc definition-service

import { z } from "zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { getRequiredServicePort, getServiceDevUrl } from "@qa-sdk/core";

/** 모노레포 루트 자동 탐지 — pnpm-workspace.yaml 기준 */
function detectRoot(from: string): string {
  let dir = resolve(from);
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return from; // fallback
}

/** SERVICE_PORTS SSOT에서 기본 포트 파생 */
const DEFAULT_PORT = getRequiredServicePort("definition-service");
const DEFAULT_REGISTRY_URL = getServiceDevUrl("registry-service") ?? "http://localhost:3300";

export const envSchema = z.object({
  PORT: z.coerce.number().int().default(DEFAULT_PORT),
  SQLITE_PATH: z.string().default("data/definition-service.sqlite"),
  /** 모노레포 루트 경로 (docs/가 여기 아래에 있어야 함) */
  ROOT_DIR: z.string().default(detectRoot(process.cwd())),
  /** docs 디렉토리 (ROOT_DIR 기준 상대 경로) */
  DOCS_DIR: z.string().default("docs"),
  /** registry-service URL — prefix 공급 소스 (SERVICE_PORTS에서 파생) */
  REGISTRY_URL: z.string().default(DEFAULT_REGISTRY_URL),
  /** 카탈로그 ID (registry-service에서 조회할 대상) */
  CATALOG_ID: z.string().default("demo"),
  CORS_ORIGIN: z.string().default("*"),
  SYNC_ON_START: z.preprocess(
    (v) => v ?? "true",
    z.enum(["true", "false"]).transform((v) => v === "true"),
  ),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
