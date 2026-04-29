// @def.boundary db-bootstrap
// @def.doc db-bootstrap

import { describe, it, expect } from "vitest";
import { dbEnvSchema, parseDbEnv, parsePgUrl } from "./env.js";

describe("dbEnvSchema", () => {
  it("기본값: dialect=sqlite", () => {
    const e = dbEnvSchema.parse({});
    expect(e.QA_DB_DIALECT).toBe("sqlite");
  });

  it("PG dialect — 필수 필드 모두 있어야 통과", () => {
    const e = dbEnvSchema.parse({
      QA_DB_DIALECT: "pg",
      QA_PG_HOST: "localhost",
      QA_PG_PORT: "5434",
      QA_PG_DATABASE: "qa_sdk",
      QA_PG_USER: "qa_admin",
      QA_PG_PASSWORD: "secret",
    });
    expect(e.QA_DB_DIALECT).toBe("pg");
    expect(e.QA_PG_PORT).toBe(5434);
  });

  it("PG dialect — 필수 필드 없으면 zod 통과(런타임 검증은 parseDbEnv가 별도)", () => {
    // schema는 모두 optional이라 parse는 통과; 의미 검증은 parseDbEnv에서
    expect(() => dbEnvSchema.parse({ QA_DB_DIALECT: "pg" })).not.toThrow();
  });

  it("잘못된 dialect 값 → ZodError", () => {
    expect(() => dbEnvSchema.parse({ QA_DB_DIALECT: "mongo" })).toThrow();
  });
});

describe("parseDbEnv — 의미 검증", () => {
  it("PG dialect인데 host/port 없음 → 에러", () => {
    expect(() => parseDbEnv({ QA_DB_DIALECT: "pg" })).toThrow(/QA_PG_HOST/);
  });

  it("SQLite dialect — 필드 없어도 통과 (:memory: 기본)", () => {
    const e = parseDbEnv({ QA_DB_DIALECT: "sqlite" });
    expect(e.dialect).toBe("sqlite");
    if (e.dialect === "sqlite") {
      expect(e.sqlitePath).toBeUndefined();
    }
  });

  it("PG dialect 정상 입력 → 구조화된 결과", () => {
    const e = parseDbEnv({
      QA_DB_DIALECT: "pg",
      QA_PG_HOST: "localhost",
      QA_PG_PORT: "5434",
      QA_PG_DATABASE: "qa_sdk",
      QA_PG_USER: "qa_admin",
      QA_PG_PASSWORD: "secret",
      QA_PG_SCHEMA: "auth",
    });
    expect(e.dialect).toBe("pg");
    if (e.dialect === "pg") {
      expect(e.pgHost).toBe("localhost");
      expect(e.pgPort).toBe(5434);
      expect(e.pgSchema).toBe("auth");
    }
  });
});

describe("parsePgUrl", () => {
  it("parses postgres://user:pw@host:5432/db", () => {
    expect(parsePgUrl("postgres://app:secret@localhost:5432/qa_sdk")).toEqual({
      pgHost: "localhost",
      pgPort: 5432,
      pgDatabase: "qa_sdk",
      pgUser: "app",
      pgPassword: "secret",
    });
  });

  it("defaults port to 5432 when missing", () => {
    expect(parsePgUrl("postgres://app:secret@localhost/qa_sdk").pgPort).toBe(5432);
  });
});
