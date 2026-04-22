// @def.boundary infra-engine
// @def.doc infra-engine

/**
 * SERVICE_PORTS + 비밀번호 시크릿에서 도메인별 PG env 변수 dict 생성.
 *
 * 도메인 → (role, schema) 매핑은 pg-migration-design.md §3과 동기.
 * admin은 cross-domain 분석용 (search_path 미지정 → 명시 schema-qualified 쿼리).
 */

import { getRequiredServicePort } from "@qa-sdk/core";

export type PgDomain = "auth" | "audit" | "ingest" | "decision" | "definition" | "admin";

export interface PgEnvBuilderInput {
  domain: PgDomain;
  host: string;
  secrets: Record<string, string>;
}

interface DomainMapping {
  user: string;
  schema?: string;
  passwordVar: string;
}

// 도메인 → (role, schema, password env var) 매핑.
// 도메인당 전용 role + schema. admin은 cross-domain이므로 schema 미지정.
const DOMAIN_MAP: Record<PgDomain, DomainMapping> = {
  auth:       { user: "auth_app",       schema: "auth",       passwordVar: "QA_SDK_AUTH_PASSWORD" },
  audit:      { user: "audit_app",      schema: "audit",      passwordVar: "QA_SDK_AUDIT_PASSWORD" },
  ingest:     { user: "ingest_app",     schema: "ingest",     passwordVar: "QA_SDK_INGEST_PASSWORD" },
  decision:   { user: "decision_app",   schema: "decision",   passwordVar: "QA_SDK_DECISION_PASSWORD" },
  definition: { user: "definition_app", schema: "definition", passwordVar: "QA_SDK_DEFINITION_PASSWORD" },
  admin:      { user: "qa_admin",       schema: undefined,    passwordVar: "QA_SDK_ADMIN_PASSWORD" },
};

export function buildPgEnvVars(input: PgEnvBuilderInput): Record<string, string> {
  const mapping = DOMAIN_MAP[input.domain];
  if (!mapping) {
    throw new Error(`unknown PG domain: ${input.domain}`);
  }

  const password = input.secrets[mapping.passwordVar];
  if (!password) {
    throw new Error(`PG 비밀번호 누락: ${mapping.passwordVar} (in .env.docker)`);
  }

  // SSOT: 포트는 SERVICE_PORTS(packages/core)에서 동적 조회. 하드코드 금지.
  const port = getRequiredServicePort("qa-sdk-postgres");

  const env: Record<string, string> = {
    QA_DB_DIALECT: "pg",
    QA_PG_HOST: input.host,
    QA_PG_PORT: String(port),
    QA_PG_DATABASE: "qa_sdk",
    QA_PG_USER: mapping.user,
    QA_PG_PASSWORD: password,
  };

  if (mapping.schema) {
    env.QA_PG_SCHEMA = mapping.schema;
  }

  return env;
}
