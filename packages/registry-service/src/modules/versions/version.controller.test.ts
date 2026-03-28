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

describe("VersionController (Nest)", () => {
  it("POST/GET /prefixes/:prefix/versions matches Hono draft semantics", async () => {
    const { app, registry } = await buildApp();

    await registry.registerPrefix({
      prefix: "role",
      owner: "service-a",
      kind: "leaf",
      numberType: "number",
    });

    const createResponse = await request(app, "POST", "/prefixes/role/versions", {
      versionId: "v1",
      baseVersionId: null,
      capacity: 10,
    });

    expect(createResponse.statusCode).toBe(201);
    expect(json(createResponse)).toMatchObject({
      prefix: "role",
      versionId: "v1",
      status: "draft",
      capacity: 10,
    });

    const listResponse = await request(app, "GET", "/prefixes/role/versions");
    expect(listResponse.statusCode).toBe(200);
    expect(json<Array<{ versionId: string; status: string }>>(listResponse)).toEqual([
      expect.objectContaining({
        versionId: "v1",
        status: "draft",
      }),
    ]);

    const lockResponse = await request(app, "POST", "/prefixes/role/versions/v1/lock");
    expect(lockResponse.statusCode).toBe(200);
    expect(json(lockResponse)).toEqual({ ok: true });

    const lockedListResponse = await request(app, "GET", "/prefixes/role/versions?status=locked");
    expect(lockedListResponse.statusCode).toBe(200);
    expect(json<Array<{ versionId: string; status: string; lockedAt: string }>>(lockedListResponse)).toEqual([
      expect.objectContaining({
        versionId: "v1",
        status: "locked",
        lockedAt: expect.any(String),
      }),
    ]);
  });

  it("PATCH blocks locked drafts and GET reconciles capacity from prefixRegistry", async () => {
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

    await request(app, "POST", "/prefixes/role/versions/v1/lock");

    const lockedPatchResponse = await request(app, "PATCH", "/prefixes/role/versions/v1", {
      capacity: 20,
    });
    expect(lockedPatchResponse.statusCode).toBe(409);
    expect(json(lockedPatchResponse)).toEqual({
      error: {
        code: "DRAFT_LOCKED",
        message: "draft 'role/v1' is locked",
      },
    });

    const unlockResponse = await request(app, "POST", "/prefixes/role/versions/v1/unlock");
    expect(unlockResponse.statusCode).toBe(200);
    expect(json(unlockResponse)).toEqual({ ok: true });

    const patchResponse = await request(app, "PATCH", "/prefixes/role/versions/v1", {
      capacity: 20,
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(json(patchResponse)).toMatchObject({
      prefix: "role",
      versionId: "v1",
      capacity: 20,
    });

    const getResponse = await request(app, "GET", "/prefixes/role/versions/v1");
    expect(getResponse.statusCode).toBe(200);
    expect(json(getResponse)).toMatchObject({
      prefix: "role",
      versionId: "v1",
      capacity: 20,
      status: "draft",
    });
  });

  it("release/activate/deprecate endpoints keep existing response shapes", async () => {
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

    const releaseResponse = await request(app, "POST", "/prefixes/role/versions/v1/release");
    expect(releaseResponse.statusCode).toBe(200);
    expect(json(releaseResponse)).toEqual({ ok: true });

    const activateResponse = await request(app, "POST", "/prefixes/role/versions/v1/activate");
    expect(activateResponse.statusCode).toBe(200);
    expect(json(activateResponse)).toEqual({
      ok: true,
      diagnostics: [],
    });

    const activeGetResponse = await request(app, "GET", "/prefixes/role/versions/v1");
    expect(activeGetResponse.statusCode).toBe(200);
    expect(json(activeGetResponse)).toMatchObject({
      prefix: "role",
      versionId: "v1",
      status: "active",
    });

    const deprecateResponse = await request(app, "POST", "/prefixes/role/versions/v1/deprecate");
    expect(deprecateResponse.statusCode).toBe(200);
    expect(json(deprecateResponse)).toEqual({ ok: true });

    const deprecatedGetResponse = await request(app, "GET", "/prefixes/role/versions/v1");
    expect(deprecatedGetResponse.statusCode).toBe(200);
    expect(json(deprecatedGetResponse)).toMatchObject({
      prefix: "role",
      versionId: "v1",
      status: "deprecated",
    });
  });
});
