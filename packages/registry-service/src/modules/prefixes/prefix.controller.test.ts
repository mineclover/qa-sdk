// @def.boundary registry-system
// @def.doc registry-system

import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../../app.module.js";
import { REGISTRY_SERVICE } from "../../registry-core.module.js";
import type { RegistryService } from "../../lib/registry-service.js";
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

async function buildApp() {
  const app = await createNestTestApp({ imports: [AppModule] });
  apps.push(app);
  const registry = app.get<RegistryService>(REGISTRY_SERVICE);
  return { app, registry };
}

describe("PrefixController (Nest)", () => {
  it("POST /prefixes returns the same record shape as Hono", async () => {
    const { app } = await buildApp();

    const response = await request(app, "POST", "/prefixes", {
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });

    expect(response.statusCode).toBe(201);
    expect(json(response)).toMatchObject({
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });
  });

  it("POST duplicate /prefixes returns Hono-compatible error payload", async () => {
    const { app } = await buildApp();

    await request(app, "POST", "/prefixes", {
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });

    const response = await request(app, "POST", "/prefixes", {
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });

    expect(response.statusCode).toBe(409);
    expect(json(response)).toEqual({
      error: {
        code: "DUPLICATE_PREFIX",
        message: "prefix 'role' already registered",
      },
    });
  });

  it("GET /prefixes lists all registered prefixes", async () => {
    const { app } = await buildApp();

    await request(app, "POST", "/prefixes", {
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });
    await request(app, "POST", "/prefixes", {
      prefix: "action",
      owner: "service-b",
      kind: "leaf",
      numberType: "number",
    });

    const response = await request(app, "GET", "/prefixes");

    expect(response.statusCode).toBe(200);
    expect(json<unknown[]>(response)).toHaveLength(2);
  });

  it("GET /prefixes/:prefix returns the prefix with versions", async () => {
    const { app, registry } = await buildApp();

    await registry.registerPrefix({
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });
    await registry.createDraft({
      prefix: "role",
      versionId: "v1",
      baseVersionId: null,
      capacity: 10,
    });

    const response = await request(app, "GET", "/prefixes/role");
    const body = json<{
      prefix: string;
      versions: Array<{ versionId: string; status: string; capacity: number }>;
    }>(response);

    expect(response.statusCode).toBe(200);
    expect(body.prefix).toBe("role");
    expect(body.versions).toEqual([
      expect.objectContaining({
        versionId: "v1",
        status: "draft",
        capacity: 10,
      }),
    ]);
  });

  it("PATCH /prefixes/:prefix matches Hono patch response semantics", async () => {
    const { app } = await buildApp();

    await request(app, "POST", "/prefixes", {
      prefix: "permission",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });

    const response = await request(app, "PATCH", "/prefixes/permission", {
      name: "권한 관리",
      category: "policy",
      meta: { layer: 1 },
      labels: ["role", "action"],
    });

    expect(response.statusCode).toBe(200);
    expect(json(response)).toMatchObject({
      prefix: "permission",
      labels: ["role", "action"],
      meta: {
        name: "권한 관리",
        category: "policy",
        layer: 1,
      },
    });
  });

  it("DELETE /prefixes/:prefix blocks dependent versions", async () => {
    const { app, registry } = await buildApp();

    await registry.registerPrefix({
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });
    await registry.registerPrefix({
      prefix: "perm",
      owner: "service-a",
      kind: "composite",
      numberType: "number",
    });
    await registry.createDraft({
      prefix: "role",
      versionId: "v1",
      baseVersionId: null,
      capacity: 10,
    });
    await registry.release("role", "v1");
    await registry.activate("role", "v1");
    await registry.deprecate("role", "v1");
    await registry.createDraft({
      prefix: "perm",
      versionId: "v1",
      baseVersionId: null,
      capacity: 0,
      refs: [{ prefix: "role", versionId: "v1" }],
    });

    const response = await request(app, "DELETE", "/prefixes/role");

    expect(response.statusCode).toBe(409);
    expect(json(response)).toEqual({
      error: {
        code: "INVALID_TRANSITION",
        message: "Cannot delete prefix 'role': referenced by 1 dependent version(s)",
      },
    });
  });

  it("DELETE /prefixes/:prefix returns { ok: true } when deletable", async () => {
    const { app } = await buildApp();

    await request(app, "POST", "/prefixes", {
      prefix: "service",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });

    const response = await request(app, "DELETE", "/prefixes/service");

    expect(response.statusCode).toBe(200);
    expect(json(response)).toEqual({ ok: true });
  });
});
