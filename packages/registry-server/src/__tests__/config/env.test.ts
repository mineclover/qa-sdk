import { afterEach, describe, expect, it, vi } from "vitest";

describe("parseEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("parses required DATABASE_URL and defaults PORT", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgres://postgres:postgres@localhost:5432/qa_sdk",
    );

    const { parseEnv } = await import("../../config/env.js");
    const env = parseEnv({
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/qa_sdk",
    });

    expect(env.DATABASE_URL).toBe(
      "postgres://postgres:postgres@localhost:5432/qa_sdk",
    );
    expect(env.PORT).toBe(3100);
  });
});
