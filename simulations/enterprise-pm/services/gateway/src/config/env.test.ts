import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

const JWT = { JWT_SECRET: "a".repeat(32) };

describe("sim-gateway env", () => {
  it("PORT 기본값 8888 (SERVICE_PORTS sim-gateway)", () => {
    expect(parseEnv(JWT).PORT).toBe(8888);
  });
  it("AUTH_API_URL 기본값은 sim-auth-api (4400) 파생", () => {
    expect(parseEnv(JWT).AUTH_API_URL).toContain("4400");
  });
  it("PM_API_URL 기본값은 sim-pm-api (4500) 파생", () => {
    expect(parseEnv(JWT).PM_API_URL).toContain("4500");
  });
  it("환경변수 override 동작", () => {
    expect(parseEnv({ ...JWT, AUTH_API_URL: "http://custom:9999" }).AUTH_API_URL).toBe("http://custom:9999");
  });
  it("OTEL_ENABLED 기본 true", () => {
    expect(parseEnv(JWT).OTEL_ENABLED).toBe(true);
  });
});

describe("sim-gateway env — Plan 12a 신규 field", () => {
  it("JWT_SECRET 미주입 시 throw", () => {
    expect(() => parseEnv({})).toThrow(/JWT_SECRET/);
  });
  it("JWT_SECRET 32바이트 미만 시 throw", () => {
    expect(() => parseEnv({ JWT_SECRET: "short" })).toThrow();
  });
  it("JWT_SECRET 충족 시 통과 + 기본값 확인", () => {
    const env = parseEnv({ JWT_SECRET: "a".repeat(32) });
    expect(env.JWT_TTL_SECONDS).toBe(300);
    expect(env.BITMAP_PREFIX).toBe("sim.bitmap");
    expect(env.PROXY_TIMEOUT_MS).toBe(5_000);
    expect(env.BITMAP_VERSION).toBe("v1");
  });
  it("env override 동작", () => {
    const env = parseEnv({
      JWT_SECRET: "x".repeat(32),
      JWT_TTL_SECONDS: "60",
      PROXY_TIMEOUT_MS: "2000",
      BITMAP_VERSION: "uv2",
    });
    expect(env.JWT_TTL_SECONDS).toBe(60);
    expect(env.PROXY_TIMEOUT_MS).toBe(2000);
    expect(env.BITMAP_VERSION).toBe("uv2");
  });
});
