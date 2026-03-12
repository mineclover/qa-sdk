import { afterEach, describe, expect, it, vi } from "vitest";

describe("parseEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("treats blank optional vars as undefined", async () => {
    vi.stubEnv(
      "TRACE_DATABASE_URL",
      "postgres://postgres:postgres@localhost:5432/qa_sdk",
    );

    const { parseEnv } = await import("./env.js");
    const env = parseEnv({
      REGISTRY_URL: "   ",
      TRACE_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/qa_sdk",
    });

    expect(env.CLEANUP_CRON_ENABLED).toBe(false);
    expect(env.REGISTRY_URL).toBeUndefined();
  });

  it("parses CLEANUP_CRON_ENABLED from string booleans", async () => {
    vi.stubEnv(
      "TRACE_DATABASE_URL",
      "postgres://postgres:postgres@localhost:5432/qa_sdk",
    );

    const { parseEnv } = await import("./env.js");

    expect(
      parseEnv({
        CLEANUP_CRON_ENABLED: "true",
        TRACE_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/qa_sdk",
      }).CLEANUP_CRON_ENABLED,
    ).toBe(true);
    expect(
      parseEnv({
        CLEANUP_CRON_ENABLED: "false",
        TRACE_DATABASE_URL: "postgres://postgres:postgres@localhost:5432/qa_sdk",
      }).CLEANUP_CRON_ENABLED,
    ).toBe(false);
  });
});
