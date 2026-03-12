import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { healthRoutes } from "../routes/health.js";
import type { Db } from "../db/client.js";

function createMockDb(resolves = true): Db {
  return {
    execute: vi.fn().mockImplementation(() =>
      resolves
        ? Promise.resolve([{ "?column?": 1 }])
        : Promise.reject(new Error("connection refused")),
    ),
  } as unknown as Db;
}

describe("GET /health", () => {
  it("returns ok true", async () => {
    const app = new Hono();
    app.route("/", healthRoutes(createMockDb()));

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("GET /ready", () => {
  it("returns 200 when db is reachable", async () => {
    const app = new Hono();
    app.route("/", healthRoutes(createMockDb(true)));

    const response = await app.request("/ready");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 503 when db is unreachable", async () => {
    const app = new Hono();
    app.route("/", healthRoutes(createMockDb(false)));

    const response = await app.request("/ready");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
