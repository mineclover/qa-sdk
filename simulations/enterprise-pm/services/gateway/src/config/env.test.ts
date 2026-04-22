import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("sim-gateway env", () => {
  it("PORT 기본값 8888 (SERVICE_PORTS sim-gateway)", () => {
    expect(parseEnv({}).PORT).toBe(8888);
  });
  it("AUTH_API_URL 기본값은 sim-auth-api (4400) 파생", () => {
    expect(parseEnv({}).AUTH_API_URL).toContain("4400");
  });
  it("PM_API_URL 기본값은 sim-pm-api (4500) 파생", () => {
    expect(parseEnv({}).PM_API_URL).toContain("4500");
  });
  it("환경변수 override 동작", () => {
    expect(parseEnv({ AUTH_API_URL: "http://custom:9999" }).AUTH_API_URL).toBe("http://custom:9999");
  });
  it("OTEL_ENABLED 기본 true", () => {
    expect(parseEnv({}).OTEL_ENABLED).toBe(true);
  });
});
