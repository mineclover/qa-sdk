// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// pg-env-builder 단위 테스트 — Plan 04d Task 1
// 도메인별 (role, schema, password) 매핑과 SERVICE_PORTS 동적 조회 검증

import { describe, it, expect } from "vitest";
import { buildPgEnvVars, type PgEnvBuilderInput } from "./pg-env-builder.js";

describe("buildPgEnvVars", () => {
  const SECRETS: Record<string, string> = {
    QA_SDK_AUTH_PASSWORD: "auth-pw",
    QA_SDK_AUDIT_PASSWORD: "audit-pw",
    QA_SDK_INGEST_PASSWORD: "ingest-pw",
    QA_SDK_DECISION_PASSWORD: "decision-pw",
    QA_SDK_DEFINITION_PASSWORD: "definition-pw",
    QA_SDK_ADMIN_PASSWORD: "admin-pw",
  };

  it("auth 도메인 서비스 — auth_app role + auth schema", () => {
    const input: PgEnvBuilderInput = { domain: "auth", host: "localhost", secrets: SECRETS };
    const env = buildPgEnvVars(input);
    expect(env).toMatchObject({
      QA_DB_DIALECT: "pg",
      QA_PG_HOST: "localhost",
      QA_PG_PORT: "5434",
      QA_PG_DATABASE: "qa_sdk",
      QA_PG_USER: "auth_app",
      QA_PG_PASSWORD: "auth-pw",
      QA_PG_SCHEMA: "auth",
    });
  });

  it("admin 도메인 — qa_admin role + 모든 schema 접근 (search_path 미지정)", () => {
    const env = buildPgEnvVars({ domain: "admin", host: "localhost", secrets: SECRETS });
    expect(env.QA_PG_USER).toBe("qa_admin");
    expect(env.QA_PG_PASSWORD).toBe("admin-pw");
    expect(env.QA_PG_SCHEMA).toBeUndefined();
  });

  it("알 수 없는 도메인 → 에러", () => {
    expect(() => buildPgEnvVars({
      domain: "unknown" as never, host: "localhost", secrets: SECRETS,
    })).toThrow(/unknown.*domain/i);
  });

  it("비밀번호 누락 → 에러", () => {
    const partialSecrets = { ...SECRETS };
    delete partialSecrets.QA_SDK_AUTH_PASSWORD;
    expect(() => buildPgEnvVars({
      domain: "auth", host: "localhost", secrets: partialSecrets,
    })).toThrow(/QA_SDK_AUTH_PASSWORD/);
  });

  it("SERVICE_PORTS에서 qa-sdk-postgres 포트 동적 조회", () => {
    // 포트는 SSOT(SERVICE_PORTS)에서 도출, 본 모듈이 하드코드 안 함
    // 간접 검증: input에 host만 있고 port는 SERVICE_PORTS lookup 결과
    const env = buildPgEnvVars({ domain: "auth", host: "h", secrets: SECRETS });
    expect(env.QA_PG_PORT).toBe("5434");
  });
});
