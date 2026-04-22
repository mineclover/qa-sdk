// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// export/env-file.ts — .env 파일 생성기
import { getRequiredServicePort } from "@qa-sdk/core";
import type { DiscoveryClient } from "../discovery/client.js";
import { buildPgEnvVars, type PgDomain } from "./pg-env-builder.js";
import { readEnvDockerSecrets } from "./env-docker-reader.js";

/** 모든 서비스가 기본으로 필요로 하는 core 서비스 */
const CORE_SERVICE_IDS = new Set(["ingest-server", "registry-service"]);

/** infra-engine 내부 전용 키 — env vars로 변환하지 않음 */
const SKIP_KEYS = new Set(["depends_on", "gates", "health_path"]);

export interface EnvFileOptions {
  serviceId: string;
  env: string;
  /** true: 모든 서비스 URL 포함, false(기본): consumedPrefixes + core 서비스만 */
  includeAll?: boolean;
  /** PG 사용 시 도메인 지정 — auth/audit/ingest/decision/definition/admin */
  pgDomain?: PgDomain;
  /** PG host (기본 localhost) */
  pgHost?: string;
  /** .env.docker 파일 경로 (기본: packages/infra-engine/.env.docker) */
  envDockerPath?: string;
}

/** config JSON의 서비스 설정 객체를 env vars로 변환 */
export function configToEnvVars(
  config: Record<string, unknown>,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (SKIP_KEYS.has(key)) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      vars[key.toUpperCase()] = String(value);
    }
  }
  return vars;
}

/** 서비스용 .env 파일 내용 생성 */
export async function generateEnvFile(
  discovery: DiscoveryClient,
  options: EnvFileOptions,
  /** config JSON에서 직접 읽은 서비스 설정 */
  serviceConfig?: Record<string, unknown>,
): Promise<string> {
  const [urls, svc, allServices] = await Promise.all([
    discovery.resolveAll(options.env),
    discovery.resolve(options.serviceId, options.env),
    discovery.listServices(),
  ]);

  // config JSON → env vars 변환 (서비스 설정이 있으면)
  const configVars = serviceConfig ? configToEnvVars(serviceConfig) : {};

  const lines: string[] = [
    `# 자동 생성 — ${options.serviceId} (${options.env})`,
    `# 생성 시각: ${new Date().toISOString()}`,
    `# 수정 금지 — infra-engine export로 재생성`,
    ``,
    `NODE_ENV=${options.env === "prod" ? "production" : "development"}`,
  ];

  // PORT: config 값 우선, 없으면 discovery URL에서 추출
  if (configVars.PORT) {
    lines.push(`PORT=${configVars.PORT}`);
  } else if (svc) {
    const port = extractPort(svc.url) || String(getRequiredServicePort(options.serviceId));
    lines.push(`PORT=${port}`);
  }

  // 서비스별 설정 (PORT 제외 — 위에서 처리)
  const configEntries = Object.entries(configVars)
    .filter(([k]) => k !== "PORT")
    .sort(([a], [b]) => a.localeCompare(b));

  if (configEntries.length > 0) {
    lines.push(``, `# 서비스 설정`);
    for (const [key, value] of configEntries) {
      lines.push(`${key}=${value}`);
    }
  }

  // PG 변수 (pgDomain 지정 시) — Plan 04d
  if (options.pgDomain) {
    if (!options.envDockerPath) {
      throw new Error(
        "pgDomain 지정 시 envDockerPath 필수 (예: packages/infra-engine/.env.docker)",
      );
    }
    const secrets = await readEnvDockerSecrets(options.envDockerPath);
    const pgEnv = buildPgEnvVars({
      domain: options.pgDomain,
      host: options.pgHost ?? "localhost",
      secrets,
    });
    lines.push(``, `# PG 연결 (도메인: ${options.pgDomain})`);
    for (const [key, value] of Object.entries(pgEnv)) {
      lines.push(`${key}=${value}`);
    }
  }

  // 서비스 연결 URL
  lines.push(``, `# 서비스 연결`);

  const sortedEntries = Object.entries(urls).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  if (options.includeAll) {
    for (const [id, url] of sortedEntries) {
      if (id !== options.serviceId) {
        const envKey = toEnvKey(id);
        // config에서 이미 같은 키가 있으면 skip (config 우선)
        if (!configVars[envKey]) {
          lines.push(`${envKey}=${url}`);
        }
      }
    }
  } else {
    // consumedPrefixes 기반 필터링: 소비하는 prefix의 소유 서비스 + core 서비스
    const neededServiceIds = new Set<string>(CORE_SERVICE_IDS);

    if (svc) {
      const consumed = new Set(svc.consumedPrefixes ?? []);
      for (const s of allServices) {
        if (s.ownedPrefixes?.some((p) => consumed.has(p))) {
          neededServiceIds.add(s.serviceId);
        }
      }
    }

    for (const [id, url] of sortedEntries) {
      if (id !== options.serviceId && neededServiceIds.has(id)) {
        const envKey = toEnvKey(id);
        if (!configVars[envKey]) {
          lines.push(`${envKey}=${url}`);
        }
      }
    }
  }

  return lines.join("\n") + "\n";
}

function toEnvKey(serviceId: string): string {
  return serviceId.replace(/-/g, "_").toUpperCase() + "_URL";
}

function extractPort(url: string): string | null {
  const match = url.match(/:(\d+)$/);
  return match ? match[1] : null;
}
