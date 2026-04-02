import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { ManifestModule } from "./manifest.module.js";
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
