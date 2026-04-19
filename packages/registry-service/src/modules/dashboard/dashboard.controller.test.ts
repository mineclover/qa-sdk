// @def.boundary registry-system
// @def.doc registry-system

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

    await request(app, "PUT", "/api/services/order-svc/components/service-unit/su-v1?catalog=demo", {
      serviceId: "order-svc",
      namespace: "shop",
      name: "order",
      tier: "backend",
    });
    await request(app, "PUT", "/api/services/order-svc/components/ownership/own-v1?catalog=demo", {
      serviceId: "order-svc",
      ownedPrefixes: ["tracking"],
    });
    await request(app, "PUT", "/api/services/order-svc/components/runtime-address/ra-v1?catalog=demo", {
      serviceId: "order-svc",
      namespace: "shop",
      name: "order",
      env: "prod",
      region: "asia",
    });
    await request(app, "PUT", "/api/services/order-svc/components/exposure/exp-v1?catalog=demo", {
      serviceId: "order-svc",
      gatewayPath: "/orders",
      stripPrefix: true,
    });
    await request(app, "POST", "/api/services/order-svc/components/service-unit/su-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/ownership/own-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/runtime-address/ra-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", { state: "released" });
    await request(app, "POST", "/manifests/assemble?catalog=demo", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      runtimeAddressVersion: "ra-v1",
      serviceUnitVersion: "su-v1",
      ownershipVersion: "own-v1",
      exposureVersion: "exp-v1",
      prefixes: { tracking: "v1" },
    });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "published" });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "active" });
    await request(app, "POST", "/api/services/order-svc/components/exposure/exp-v1/transition?catalog=demo", { state: "deprecated" });

    const candidatesResponse = await request(app, "GET", "/api/dashboard/service-control-plane/order-svc/candidates?catalog=demo");
    expect(candidatesResponse.statusCode).toBe(200);
    expect(json(candidatesResponse)).toMatchObject({
      serviceId: "order-svc",
      required: expect.objectContaining({
        "service-unit": expect.objectContaining({
          published: expect.any(Array),
          excluded: expect.any(Array),
        }),
        "ownership": expect.objectContaining({
          published: expect.any(Array),
        }),
        "runtime-address": expect.objectContaining({
          published: expect.any(Array),
        }),
      }),
      readiness: expect.objectContaining({
        ready: true,
      }),
      summary: expect.objectContaining({
        published: expect.any(Object),
        excluded: expect.any(Object),
      }),
    });

    const warningsResponse = await request(app, "GET", "/api/dashboard/service-control-plane/order-svc/warnings?catalog=demo");
    expect(warningsResponse.statusCode).toBe(200);
    expect(json(warningsResponse)).toMatchObject({
      serviceId: "order-svc",
      summary: {
        total: 1,
        deprecatedReferences: 1,
        byKind: {
          exposure: 1,
        },
      },
      warnings: [
        expect.objectContaining({
          code: "DEPRECATED_COMPONENT_REFERENCE",
          kind: "exposure",
          severity: "warning",
        }),
      ],
    });

    const cleanupPlanResponse = await request(app, "GET", "/api/dashboard/service-control-plane/order-svc/cleanup-plan?catalog=demo");
    expect(cleanupPlanResponse.statusCode).toBe(200);
    expect(json(cleanupPlanResponse)).toMatchObject({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      items: [
        expect.objectContaining({
          kind: "exposure",
          currentVersion: "exp-v1",
          status: "blocked",
        }),
      ],
    });
  });
});
