import { Hono } from "hono";
import type { Logger } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createRequestLogger } from "../../middleware/logger.js";

describe("createRequestLogger", () => {
  it("logs method, path, status, and duration_ms for each request", async () => {
    const logger = {
      info: vi.fn(),
    } as unknown as Logger;
    const app = new Hono();

    app.use("*", createRequestLogger(logger));
    app.get("/health", (c) => c.json({ ok: true }));

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/health",
        status: 200,
        duration_ms: expect.any(Number),
      }),
      "request completed",
    );
  });
});
