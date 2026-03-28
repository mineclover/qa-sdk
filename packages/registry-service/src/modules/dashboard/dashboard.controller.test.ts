import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

const TEST_DKG_PATH = "/tmp/registry-service-dashboard-test.sqlite";
const originalDashboardEnabled = process.env.DEV_DASHBOARD_ENABLED;
const originalDashboardPath = process.env.DEV_DASHBOARD_DKG_PATH;

const apps: NestFastifyApplication[] = [];

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
  if (originalDashboardEnabled === undefined) {
    delete process.env.DEV_DASHBOARD_ENABLED;
  } else {
    process.env.DEV_DASHBOARD_ENABLED = originalDashboardEnabled;
  }
  if (originalDashboardPath === undefined) {
    delete process.env.DEV_DASHBOARD_DKG_PATH;
  } else {
    process.env.DEV_DASHBOARD_DKG_PATH = originalDashboardPath;
  }
});

describe("DashboardModule (Nest)", () => {
  it("serves diagrams and dashboard endpoints through Nest controllers", async () => {
    vi.resetModules();
    process.env.DEV_DASHBOARD_ENABLED = "true";
    process.env.DEV_DASHBOARD_DKG_PATH = TEST_DKG_PATH;

    const { AppModule } = await import("../../app.module.js");
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    const diagramListResponse = await request(app, "GET", "/api/diagrams");
    expect(diagramListResponse.statusCode).toBe(200);
    expect(json<Record<string, unknown[]>>(diagramListResponse)).toEqual(
      expect.objectContaining({
        "intent-links": expect.any(Array),
        domain: expect.any(Array),
      }),
    );

    const overviewResponse = await request(app, "GET", "/api/dashboard/overview");
    expect(overviewResponse.statusCode).toBe(200);
    expect(json<{
      nodes: Record<string, number>;
      observations: { total: number; unresolved: number };
    }>(overviewResponse)).toEqual(expect.objectContaining({
      nodes: expect.objectContaining({
        axis: expect.any(Number),
        prefix: expect.any(Number),
      }),
      observations: expect.objectContaining({
        total: expect.any(Number),
        unresolved: expect.any(Number),
      }),
    }));

    const htmlResponse = await request(app, "GET", "/dev");
    expect(htmlResponse.statusCode).toBe(200);
    expect(String(htmlResponse.headers["content-type"])).toContain("text/html");
    expect(htmlResponse.payload).toContain("/dev/ws");

    const refreshResponse = await request(app, "POST", "/dev/api/refresh");
    expect(refreshResponse.statusCode).toBe(200);
    expect(json(refreshResponse)).toEqual({
      ok: true,
      message: "Cache invalidated. Next request will re-bootstrap.",
    });
  });
});
