import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { detectEnvironment } from "../../src/commands/env-manager.js";

describe("detectEnvironment", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.PULUMI_BACKEND_URL;
    delete process.env.INFRA_AWS_ENDPOINT;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("preferredBackend=file이면 MinIO 감지를 건너뛴다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true }),
    );

    const result = await detectEnvironment("file");
    expect(result).toBe("file");
    expect(process.env.PULUMI_BACKEND_URL).toBeUndefined();
  });

  it("이미 설정된 PULUMI_BACKEND_URL은 그대로 존중한다", async () => {
    process.env.PULUMI_BACKEND_URL = "file://~/.pulumi-local";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true }),
    );

    const result = await detectEnvironment("minio");
    expect(result).toBe("file");
    expect(process.env.PULUMI_BACKEND_URL).toBe("file://~/.pulumi-local");
  });
});
