import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../../app.module.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe("AxisController (Nest)", () => {
  it("POST /catalogs/:catalogId/axes returns the same record shape as Hono", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    const response = await request(app, "POST", "/catalogs/demo/axes", {
      id: "env",
      name: "환경",
      capacity: 64,
      entryCount: 2,
    });

    expect(response.statusCode).toBe(201);
    expect(json<{
      id: string;
      catalogId: string;
      name: string;
      capacity: number;
      entryCount: number;
      currentVersion: string;
    }>(response)).toMatchObject({
      id: "env",
      catalogId: "demo",
      name: "환경",
      capacity: 64,
      entryCount: 2,
      currentVersion: "v1",
    });
  });

  it("GET /catalogs/:catalogId/axes and /:id list only the requested catalog", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await request(app, "POST", "/catalogs/demo/axes", { id: "env", name: "환경" });
    await request(app, "POST", "/catalogs/demo/axes", { id: "region", name: "리전" });
    await request(app, "POST", "/catalogs/other/axes", { id: "env", name: "다른 환경" });

    const listResponse = await request(app, "GET", "/catalogs/demo/axes");
    expect(listResponse.statusCode).toBe(200);
    expect(json<Array<{ id: string }>>(listResponse)).toEqual([
      expect.objectContaining({ id: "env" }),
      expect.objectContaining({ id: "region" }),
    ]);

    const getResponse = await request(app, "GET", "/catalogs/demo/axes/env");
    expect(getResponse.statusCode).toBe(200);
    expect(json<{ id: string; name: string; catalogId: string }>(getResponse)).toMatchObject({
      id: "env",
      name: "환경",
      catalogId: "demo",
    });
  });

  it("PATCH /catalogs/:catalogId/axes/:id updates name/capacity/entryCount/meta", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await request(app, "POST", "/catalogs/demo/axes", {
      id: "env",
      name: "환경",
      capacity: 32,
      entryCount: 1,
      meta: { source: "seed" },
    });

    const response = await request(app, "PATCH", "/catalogs/demo/axes/env", {
      name: "배포 환경",
      capacity: 128,
      entryCount: 3,
      meta: { layer: 0 },
    });

    expect(response.statusCode).toBe(200);
    expect(json<{
      name: string;
      capacity: number;
      entryCount: number;
      meta?: Record<string, unknown>;
    }>(response)).toMatchObject({
      name: "배포 환경",
      capacity: 128,
      entryCount: 3,
      meta: {
        source: "seed",
        layer: 0,
      },
    });
  });

  it("GET/PATCH/DELETE missing axis returns Hono-compatible errors", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    const getResponse = await request(app, "GET", "/catalogs/demo/axes/nope");
    expect(getResponse.statusCode).toBe(404);
    expect(json(getResponse)).toEqual({
      error: "Axis 'nope' not found",
    });

    const patchResponse = await request(app, "PATCH", "/catalogs/demo/axes/nope", { capacity: 64 });
    expect(patchResponse.statusCode).toBe(404);
    expect(json(patchResponse)).toEqual({
      error: "Axis 'nope' not found",
    });

    const deleteResponse = await request(app, "DELETE", "/catalogs/demo/axes/nope");
    expect(deleteResponse.statusCode).toBe(404);
    expect(json(deleteResponse)).toEqual({
      error: "Axis 'nope' not found",
    });
  });

  it("DELETE /catalogs/:catalogId/axes/:id completes the CRUD round-trip", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await request(app, "POST", "/catalogs/demo/axes", { id: "role", name: "역할", capacity: 16 });

    const deleteResponse = await request(app, "DELETE", "/catalogs/demo/axes/role");
    expect(deleteResponse.statusCode).toBe(200);
    expect(json(deleteResponse)).toEqual({ ok: true });

    const getResponse = await request(app, "GET", "/catalogs/demo/axes/role");
    expect(getResponse.statusCode).toBe(404);
    expect(json(getResponse)).toEqual({
      error: "Axis 'role' not found",
    });
  });
});
