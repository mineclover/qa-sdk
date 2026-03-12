import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createHealthRoutes } from "../routes/health.js";

describe("createHealthRoutes", () => {
  it("returns detailed readiness info from GET /health", async () => {
    const checkDbHealth = vi.fn().mockResolvedValue({
      connected: true,
      latencyMs: 4,
    });
    const app = new Hono();

    app.route(
      "/",
      createHealthRoutes({
        checkDbHealth,
        getUptimeSeconds: () => 24,
        version: "2.0.0",
      }),
    );

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: "2.0.0",
      uptime_seconds: 24,
      db: {
        connected: true,
        latency_ms: 4,
      },
    });
    expect(checkDbHealth).toHaveBeenCalledTimes(1);
  });

  it("returns 503 from GET /health/ready when db is unavailable", async () => {
    const checkDbHealth = vi.fn().mockResolvedValue({
      connected: false,
      latencyMs: 11,
    });
    const app = new Hono();

    app.route(
      "/",
      createHealthRoutes({
        checkDbHealth,
        getUptimeSeconds: () => 24,
        version: "2.0.0",
      }),
    );

    const response = await app.request("/health/ready");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      version: "2.0.0",
      uptime_seconds: 24,
      db: {
        connected: false,
        latency_ms: 11,
      },
    });
    expect(checkDbHealth).toHaveBeenCalledTimes(1);
  });

  it("returns a simple liveness response without a db check", async () => {
    const checkDbHealth = vi.fn();
    const app = new Hono();

    app.route(
      "/",
      createHealthRoutes({
        checkDbHealth,
      }),
    );

    const response = await app.request("/health/live");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(checkDbHealth).not.toHaveBeenCalled();
  });
});
