// @def.boundary sim-auth-api
// spec §9 Stage 3 — AdminBitmapVersionController integration tests
// (NestJS Test + Fastify inject로 InternalIpGuard 함께 검증).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { BitmapVersionService } from "./bitmap-version.service.js";
import { AdminBitmapVersionController } from "./admin-bitmap-version.controller.js";

const INTERNAL_IP = "127.0.0.1";
const EXTERNAL_IP = "8.8.8.8";

describe("AdminBitmapVersionController (spec §9 Stage 3)", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      controllers: [AdminBitmapVersionController],
      providers: [BitmapVersionService],
    }).compile();
    app = m.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const inj = (opts: Parameters<typeof app.inject>[0]) =>
    app.inject({ remoteAddress: INTERNAL_IP, ...opts });

  it("GET version (no query) → default sim.bitmap v1", async () => {
    const r = await inj({ method: "GET", url: "/admin/bitmap/version" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ prefix: "sim.bitmap", version: "v1" });
  });

  it("GET ?prefix=sim.role-bitmap → lazy v1", async () => {
    const r = await inj({
      method: "GET",
      url: "/admin/bitmap/version?prefix=sim.role-bitmap",
    });
    expect(r.json()).toEqual({ prefix: "sim.role-bitmap", version: "v1" });
  });

  it("POST bump (empty body) → 201, v1→v2; 후속 GET 반영", async () => {
    const post = await inj({
      method: "POST",
      url: "/admin/bitmap/bump-version",
      payload: {},
      headers: { "content-type": "application/json" },
    });
    expect(post.statusCode).toBe(201);
    expect(post.json()).toMatchObject({
      prefix: "sim.bitmap",
      oldVersion: "v1",
      newVersion: "v2",
    });
    const get = await inj({ method: "GET", url: "/admin/bitmap/version" });
    expect(get.json()).toEqual({ prefix: "sim.bitmap", version: "v2" });
  });

  it("POST body 위반 (prefix='') → 400 + RFC 7807 (spec §11)", async () => {
    const r = await inj({
      method: "POST",
      url: "/admin/bitmap/bump-version",
      payload: { prefix: "" },
      headers: { "content-type": "application/json" },
    });
    expect(r.statusCode).toBe(400);
    const body = r.json() as Record<string, unknown>;
    expect(body).toMatchObject({ status: 400 });
    expect(String(body.type)).toContain("validation");
  });

  it("외부 IP → 404 silent (spec §3)", async () => {
    const r = await app.inject({
      method: "GET",
      url: "/admin/bitmap/version",
      remoteAddress: EXTERNAL_IP,
    });
    expect(r.statusCode).toBe(404);
  });
});
