import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("sim-audit-browser-api env", () => {
  it("PORT는 SERVICE_PORTS sim-audit-browser-api 기본값(5100)을 파생", () => {
    const env = parseEnv({});
    expect(env.PORT).toBe(5100);
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

  it("graph retention scheduler env는 optional", () => {
    const env = parseEnv({});
    expect(env.SIM_GRAPH_RETENTION_KEEP_LATEST).toBeUndefined();
    expect(env.SIM_GRAPH_RETENTION_INTERVAL_MS).toBeUndefined();
    expect(env.SIM_GRAPH_RETENTION_RUN_ON_BOOT).toBe(true);
  });

  it("graph retention scheduler env를 number/bool로 파싱", () => {
    const env = parseEnv({
      SIM_GRAPH_RETENTION_KEEP_LATEST: "2",
      SIM_GRAPH_RETENTION_INTERVAL_MS: "60000",
      SIM_GRAPH_RETENTION_RUN_ON_BOOT: "false",
    });
    expect(env.SIM_GRAPH_RETENTION_KEEP_LATEST).toBe(2);
    expect(env.SIM_GRAPH_RETENTION_INTERVAL_MS).toBe(60000);
    expect(env.SIM_GRAPH_RETENTION_RUN_ON_BOOT).toBe(false);
  });
});
