// @def.boundary shared-utility-group
// @def.doc shared-utility-group

import { getRequiredServicePort } from "@qa-sdk/core";
import type { EnvDiscoveryClient } from "./types.js";
import { configToEnvVars } from "./env-bridge.js";

/** 모든 서비스가 기본으로 필요로 하는 core 서비스 */
const CORE_SERVICE_IDS = new Set(["ingest-server", "registry-service"]);

export type PgDomain =
  | "auth"
  | "audit"
  | "ingest"
  | "decision"
  | "definition"
  | "admin";

export interface EnvFileOptions {
  serviceId: string;
  env: string;
  includeAll?: boolean;
  pgDomain?: PgDomain;
  pgHost?: string;
  envDockerPath?: string;
}

interface PgSecrets {
  qaSdkAuthPassword?: string;
  qaSdkAuditPassword?: string;
  qaSdkIngestPassword?: string;
  qaSdkDecisionPassword?: string;
  qaSdkDefinitionPassword?: string;
  qaSdkAdminPassword?: string;
}

async function readEnvDockerSecrets(envDockerPath: string): Promise<PgSecrets> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(envDockerPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const vars = Object.fromEntries(
    lines
      .filter((line) => !line.trim().startsWith("#"))
      .map((line) => {
        const idx = line.indexOf("=");
        return idx === -1
          ? [line, ""]
          : [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      }),
  );
  return {
    qaSdkAuthPassword: vars.QA_SDK_AUTH_PASSWORD,
    qaSdkAuditPassword: vars.QA_SDK_AUDIT_PASSWORD,
    qaSdkIngestPassword: vars.QA_SDK_INGEST_PASSWORD,
    qaSdkDecisionPassword: vars.QA_SDK_DECISION_PASSWORD,
    qaSdkDefinitionPassword: vars.QA_SDK_DEFINITION_PASSWORD,
    qaSdkAdminPassword: vars.QA_SDK_ADMIN_PASSWORD,
  };
}

function buildPgEnvVars(options: {
  domain: PgDomain;
  host: string;
  secrets: PgSecrets;
}): Record<string, string> {
  const passwordByDomain: Record<PgDomain, string | undefined> = {
    auth: options.secrets.qaSdkAuthPassword,
    audit: options.secrets.qaSdkAuditPassword,
    ingest: options.secrets.qaSdkIngestPassword,
    decision: options.secrets.qaSdkDecisionPassword,
    definition: options.secrets.qaSdkDefinitionPassword,
    admin: options.secrets.qaSdkAdminPassword,
  };

  const userByDomain: Record<PgDomain, string> = {
    auth: "auth_app",
    audit: "audit_app",
    ingest: "ingest_app",
    decision: "decision_app",
    definition: "definition_app",
    admin: "qa_admin",
  };

  const databaseByDomain: Record<PgDomain, string> = {
    auth: "qa_sdk",
    audit: "qa_sdk",
    ingest: "qa_sdk",
    decision: "qa_sdk",
    definition: "qa_sdk",
    admin: "postgres",
  };

  const password = passwordByDomain[options.domain];
  if (!password) {
    throw new Error(`PG 비밀번호를 찾을 수 없습니다: ${options.domain}`);
  }

  const user = userByDomain[options.domain];
  const database = databaseByDomain[options.domain];
  const port = "5434";
  const host = options.host;
  const url = `postgresql://${user}:${password}@${host}:${port}/${database}`;

  return {
    TRACE_DATABASE_URL: url,
    DATABASE_URL: url,
    PGHOST: host,
    PGPORT: port,
    PGDATABASE: database,
    PGUSER: user,
    PGPASSWORD: password,
  };
}

export async function generateEnvFile(
  discovery: EnvDiscoveryClient,
  options: EnvFileOptions,
  serviceConfig?: Record<string, unknown>,
): Promise<string> {
  const [urls, svc, allServices] = await Promise.all([
    discovery.resolveAll(options.env),
    discovery.resolve(options.serviceId, options.env),
    discovery.listServices(),
  ]);

  const configVars = serviceConfig ? configToEnvVars(serviceConfig) : {};

  const lines: string[] = [
    `# 자동 생성 — ${options.serviceId} (${options.env})`,
    `# 생성 시각: ${new Date().toISOString()}`,
    `# 수정 금지 — infra-env-kit export로 재생성`,
    ``,
    `NODE_ENV=${options.env === "prod" ? "production" : "development"}`,
  ];

  if (configVars.PORT) {
    lines.push(`PORT=${configVars.PORT}`);
  } else if (svc) {
    const port = extractPort(svc.url) || String(getRequiredServicePort(options.serviceId));
    lines.push(`PORT=${port}`);
  }

  const configEntries = Object.entries(configVars)
    .filter(([key]) => key !== "PORT")
    .toSorted(([left], [right]) => left.localeCompare(right));

  if (configEntries.length > 0) {
    lines.push(``, `# 서비스 설정`);
    for (const [key, value] of configEntries) {
      lines.push(`${key}=${value}`);
    }
  }

  if (options.pgDomain) {
    if (!options.envDockerPath) {
      throw new Error("pgDomain 지정 시 envDockerPath 필수");
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

  lines.push(``, `# 서비스 연결`);

  const sortedEntries = Object.entries(urls).toSorted(([left], [right]) =>
    left.localeCompare(right),
  );

  if (options.includeAll) {
    for (const [id, url] of sortedEntries) {
      if (id !== options.serviceId) {
        const envKey = toEnvKey(id);
        if (!configVars[envKey]) {
          lines.push(`${envKey}=${url}`);
        }
      }
    }
  } else {
    const neededServiceIds = new Set<string>(CORE_SERVICE_IDS);

    if (svc) {
      const consumed = new Set(svc.consumedPrefixes ?? []);
      for (const service of allServices) {
        if (service.ownedPrefixes?.some((prefix) => consumed.has(prefix))) {
          neededServiceIds.add(service.serviceId);
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
