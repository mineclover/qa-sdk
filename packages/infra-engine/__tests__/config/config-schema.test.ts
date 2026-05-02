import { describe, it, expect } from "vitest";
import { configSchema } from "../../src/config/config-schema.js";

describe("configSchema", () => {
  it("유효한 설정 파싱", () => {
    const valid = {
      global: { region: "ap-northeast-2" },
      services: {
        "ingest-server": { port: 3200, store_driver: "memory" },
      },
      connections: {
        "ingest-server": { endpoint: "http://localhost:3200" },
      },
    };
    expect(() => configSchema.parse(valid)).not.toThrow();
  });

  it("global.region 누락 → 에러", () => {
    const invalid = {
      global: {},
      services: {},
      connections: {},
    };
    expect(() => configSchema.parse(invalid)).toThrow();
  });

  it("monitoring 선택 필드", () => {
    const withMonitoring = {
      global: { region: "local" },
      services: {},
      connections: {},
      monitoring: { interval: 30, webhooks: [{ url: "https://hook", events: ["OutOfSync"] }] },
    };
    const result = configSchema.parse(withMonitoring);
    expect(result.monitoring?.interval).toBe(30);
  });

  it("monitoring.recovery 선택 필드", () => {
    const withRecovery = {
      global: { region: "local" },
      services: {},
      connections: {},
      monitoring: {
        interval: 30,
        recovery: {
          enabled: true,
          maxRetries: 5,
          cooldownSec: 120,
        },
      },
    };
    const result = configSchema.parse(withRecovery);
    expect(result.monitoring?.recovery?.enabled).toBe(true);
    expect(result.monitoring?.recovery?.maxRetries).toBe(5);
    expect(result.monitoring?.recovery?.cooldownSec).toBe(120);
  });
});
