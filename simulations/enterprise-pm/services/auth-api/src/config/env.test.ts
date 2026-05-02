import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("sim-auth-api env", () => {
  it("PORT는 SERVICE_PORTS sim-auth-api 기본값(4400)을 파생", () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(4400);
  });

  it("PORT 환경변수가 우선", () => {
    const env = parseEnv({ PORT: "5000" });
    expect(env.PORT).toBe(5000);
  });

  it("OTEL_ENABLED 기본값은 true", () => {
    const env = parseEnv({});
    expect(env.OTEL_ENABLED).toBe(true);
  });

  it("OTEL_ENABLED=false도 허용", () => {
    const env = parseEnv({ OTEL_ENABLED: "false" });
    expect(env.OTEL_ENABLED).toBe(false);
  });

  it("QA_INGEST_URL은 optional", () => {
    const env = parseEnv({});
    expect(env.QA_INGEST_URL).toBeUndefined();
  });

  it("QA_DB_DIALECT 기본값은 sqlite (db-bootstrap)", () => {
    const env = parseEnv({});
    expect(env.QA_DB_DIALECT).toBe("sqlite");
  });
});
