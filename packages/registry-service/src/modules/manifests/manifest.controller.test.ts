import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { ManifestModule } from "./manifest.module.js";
import type { ServiceComponentVersionStore } from "../../stores/service-component-version-store.js";
import { ServiceComponentStore } from "../services/service-component-store.js";
import { SERVICE_COMPONENT_VERSION_STORE } from "../services/service-component.service.js";
import { createNestTestApp, request, json } from "../../test/nest-helpers.js";

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

async function buildApp() {
  const app = await createNestTestApp({ imports: [ManifestModule] });
  apps.push(app);
  return app;
}

async function seedAssemblyComponents(app: NestFastifyApplication, serviceId: string) {
  const componentStore = app.get<ServiceComponentVersionStore>(SERVICE_COMPONENT_VERSION_STORE);
  const components = new ServiceComponentStore(componentStore);
  await components.upsert("demo", {
    kind: "service-unit",
    serviceId,
    version: "su-1",
    state: "published",
    value: {
      serviceId,
      namespace: "shop",
      name: "order",
    },
  });
  await components.upsert("demo", {
    kind: "ownership",
    serviceId,
    version: "own-1",
    state: "published",
    value: {
      serviceId,
      ownedPrefixes: ["tracking"],
    },
  });
  await components.upsert("demo", {
    kind: "exposure",
    serviceId,
    version: "exp-1",
    state: "published",
    value: {
      serviceId,
      gatewayPath: "/api",
      stripPrefix: true,
    },
  });
  await components.upsert("demo", {
    kind: "deployment-binding",
    serviceId,
    version: "dep-1",
    state: "published",
    value: {
      deploymentVersion: "dep-1",
      address: {
        serviceId,
        runtime: {
          serviceId,
          namespace: "shop",
          name: "order",
          env: "prod",
          region: "asia",
        },
        provider: "pulumi",
        project: "core",
        stack: "prod",
        resourceKey: "api",
      },
      observedAt: "2026-04-03T00:00:00.000Z",
      url: "https://order.example.com",
    },
  });
}

describe("ManifestController", () => {
  // ── Prefix 라이프사이클 ────────────────────────────────

  it("POST /manifests/prefixes — prefix 등록", async () => {
    const app = await buildApp();
    const res = await request(app, "POST", "/manifests/prefixes", {
      prefixId: "tracking",
      version: "v1",
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({ prefixId: "tracking", version: "v1", state: "draft" });
  });

  it("POST /manifests/prefixes — 중복 등록 409", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    const res = await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    expect(res.statusCode).toBe(409);
  });

  it("GET /manifests/prefixes/:id/:ver — prefix 조회", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    const res = await request(app, "GET", "/manifests/prefixes/tracking/v1");
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ prefixId: "tracking", state: "draft" });
  });

  it("GET /manifests/prefixes/:id/:ver — 없으면 404", async () => {
    const app = await buildApp();
    const res = await request(app, "GET", "/manifests/prefixes/unknown/v1");
    expect(res.statusCode).toBe(404);
  });

  it("GET /manifests/prefixes/:id/active — active 조회", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", { state: "released" });
    await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", { state: "active" });
    const res = await request(app, "GET", "/manifests/prefixes/tracking/active");
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ state: "active" });
  });

  it("POST /manifests/prefixes/:id/:ver/transition — draft → released", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    const res = await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", {
      state: "released",
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({ state: "released" });
  });

  it("POST /manifests/prefixes/:id/:ver/transition — 무효 전이 409", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    const res = await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", {
      state: "active",
    });
    expect(res.statusCode).toBe(409);
  });

  // ── Service Manifest 라이프사이클 ─────────────────────

  it("POST /manifests — manifest 생성", async () => {
    const app = await buildApp();
    const res = await request(app, "POST", "/manifests", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: { tracking: "v1" },
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({ serviceId: "order-svc", state: "draft" });
  });

  it("POST /manifests/assemble — child version과 runtimeAddress를 포함한 manifest를 생성한다", async () => {
    const app = await buildApp();
    await seedAssemblyComponents(app, "order-svc");
    const res = await request(app, "POST", "/manifests/assemble", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      exposureVersion: "exp-1",
      deploymentVersion: "dep-1",
      runtimeAddress: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
      prefixes: { tracking: "v1" },
      changelog: "assembled",
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      exposureVersion: "exp-1",
      deploymentVersion: "dep-1",
      runtimeAddress: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
      changelog: "assembled",
      state: "draft",
    });

    const detail = await request(app, "GET", "/manifests/order-svc/1.0.0");
    expect(detail.statusCode).toBe(200);
    expect(json(detail)).toMatchObject({
      serviceUnitVersion: "su-1",
      ownershipVersion: "own-1",
      deploymentVersion: "dep-1",
      runtimeAddress: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    });
  });

  it("POST /manifests/assemble — runtimeAddress.serviceId mismatch면 400", async () => {
    const app = await buildApp();
    await seedAssemblyComponents(app, "order-svc");
    const res = await request(app, "POST", "/manifests/assemble", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      runtimeAddress: {
        serviceId: "other-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
      prefixes: { tracking: "v1" },
    });
    expect(res.statusCode).toBe(400);
    expect(json(res)).toMatchObject({
      error: {
        code: "INVALID_INPUT",
        message: 'runtimeAddress.serviceId "other-svc" != manifest serviceId "order-svc"',
      },
    });
  });

  it("GET /manifests/:serviceId — 목록 조회", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: {},
    });
    await request(app, "POST", "/manifests", {
      serviceId: "order-svc",
      manifestVersion: "2.0.0",
      prefixes: {},
    });
    const res = await request(app, "GET", "/manifests/order-svc");
    expect(res.statusCode).toBe(200);
    expect(json<unknown[]>(res)).toHaveLength(2);
  });

  it("GET /manifests/:serviceId/:version — 단건 조회", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: {},
      changelog: "초기 릴리스",
    });
    const res = await request(app, "GET", "/manifests/order-svc/1.0.0");
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ manifestVersion: "1.0.0", changelog: "초기 릴리스" });
  });

  it("GET /manifests/:serviceId/:version — 없으면 404", async () => {
    const app = await buildApp();
    const res = await request(app, "GET", "/manifests/unknown-svc/1.0.0");
    expect(res.statusCode).toBe(404);
  });

  it("POST /manifests/:serviceId/:version/transition — draft → published (prefix released)", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", { state: "released" });
    await request(app, "POST", "/manifests", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: { tracking: "v1" },
    });
    const res = await request(app, "POST", "/manifests/order-svc/1.0.0/transition", {
      state: "published",
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({ state: "published" });
  });

  it("GET /manifests/:serviceId/active — active manifest 조회", async () => {
    const app = await buildApp();
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", { state: "released" });
    await request(app, "POST", "/manifests", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      prefixes: { tracking: "v1" },
    });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "published" });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "active" });
    const res = await request(app, "GET", "/manifests/order-svc/active");
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ manifestVersion: "1.0.0", state: "active" });
  });
});
