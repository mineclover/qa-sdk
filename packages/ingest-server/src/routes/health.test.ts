// @def.boundary ingest-system
// @def.doc ingest-system

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createHealthRoutes } from "./health.js";

describe("createHealthRoutes", () => {
  it("returns detailed readiness info from GET /health", async () => {
    const checkDbHealth = vi.fn().mockResolvedValue({
      connected: true,
      latencyMs: 7,
    });
    const app = new Hono();

    app.route(
      "/",
      createHealthRoutes({
        checkDbHealth,
        getUptimeSeconds: () => 42,
        version: "1.2.3",
      }),
    );

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: "1.2.3",
      uptime_seconds: 42,
      db: {
        connected: true,
        latency_ms: 7,
      },
    });
    expect(checkDbHealth).toHaveBeenCalledTimes(1);
  });

  it("returns 503 from GET /health/ready when db is unavailable", async () => {
    const checkDbHealth = vi.fn().mockResolvedValue({
      connected: false,
      latencyMs: 19,
    });
    const app = new Hono();

    app.route(
      "/",
      createHealthRoutes({
        checkDbHealth,
        getUptimeSeconds: () => 12.5,
        version: "1.2.3",
      }),
    );

    const response = await app.request("/health/ready");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      version: "1.2.3",
      uptime_seconds: 12.5,
      db: {
        connected: false,
        latency_ms: 19,
      },
    });
    expect(checkDbHealth).toHaveBeenCalledTimes(1);
  });

  it("returns a simple liveness response without touching the db", async () => {
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
