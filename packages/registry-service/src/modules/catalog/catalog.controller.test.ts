import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../../app.module.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

const SAMPLE_CATALOG = JSON.stringify({
  id: "demo",
  name: "쇼핑 데모",
  axes: {},
  prefixes: {
    permission: { id: "permission", name: "권한", labels: ["role", "action"], dims: {}, versions: [] },
    service: { id: "service", name: "서비스", labels: ["env"], dims: {}, versions: [] },
  },
});

async function registerCatalog(
  app: NestFastifyApplication,
  id = "demo",
  name = "쇼핑 데모",
  data = SAMPLE_CATALOG,
) {
  return request(app, "POST", "/catalogs", { id, name, data });
}

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe("CatalogController (Nest)", () => {
  it("POST /catalogs returns the same record shape as Hono", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    const response = await registerCatalog(app);

    expect(response.statusCode).toBe(201);
    expect(json<{ id: string; name: string; createdAt: string }>(response)).toMatchObject({
      id: "demo",
      name: "쇼핑 데모",
    });
  });

  it("POST duplicate /catalogs returns Hono-compatible error payload", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await registerCatalog(app);
    const response = await registerCatalog(app, "demo", "쇼핑 데모 v2");

    expect(response.statusCode).toBe(409);
    expect(json(response)).toEqual({
      error: "Catalog 'demo' already exists",
    });
  });

  it("GET/PUT/DELETE /catalogs round-trip matches existing route semantics", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await registerCatalog(app, "alpha", "알파");

    const listResponse = await request(app, "GET", "/catalogs");
    expect(listResponse.statusCode).toBe(200);
    expect(json<Array<{ id: string; name: string; updatedAt: string }>>(listResponse)).toEqual([
      expect.objectContaining({
        id: "alpha",
        name: "알파",
      }),
    ]);

    const getResponse = await request(app, "GET", "/catalogs/alpha");
    expect(getResponse.statusCode).toBe(200);
    expect(json<{ id: string; data: string }>(getResponse)).toMatchObject({
      id: "alpha",
      data: SAMPLE_CATALOG,
    });

    const updateResponse = await request(app, "PUT", "/catalogs/alpha", {
      name: "알파 v2",
      data: JSON.stringify({ id: "alpha", name: "알파 v2", axes: {}, prefixes: {} }),
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(json<{ name: string }>(updateResponse).name).toBe("알파 v2");

    const deleteResponse = await request(app, "DELETE", "/catalogs/alpha");
    expect(deleteResponse.statusCode).toBe(200);
    expect(json(deleteResponse)).toEqual({ ok: true });

    const missingResponse = await request(app, "GET", "/catalogs/alpha");
    expect(missingResponse.statusCode).toBe(404);
    expect(json(missingResponse)).toEqual({
      error: "Catalog 'alpha' not found",
    });
  });

  it("GET /catalogs/:id/prefixes returns parsed prefix summaries", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await registerCatalog(app);
    const response = await request(app, "GET", "/catalogs/demo/prefixes");

    expect(response.statusCode).toBe(200);
    expect(json<Array<{ id: string; name: string; dims: number }>>(response)).toEqual([
      { id: "permission", name: "권한", dims: 2 },
      { id: "service", name: "서비스", dims: 1 },
    ]);
  });

  it("GET/PUT /catalogs/:id/config and /pattern-rules persist config records", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await registerCatalog(app);

    const dkgData = JSON.stringify({ gates: ["axis-definition"] });
    const patternRules = JSON.stringify([{ id: "rule-1", kind: "routine" }]);

    const setConfigResponse = await request(app, "PUT", "/catalogs/demo/config", { data: dkgData });
    expect(setConfigResponse.statusCode).toBe(200);
    expect(json(setConfigResponse)).toEqual({
      catalogId: "demo",
      ok: true,
    });

    const getConfigResponse = await request(app, "GET", "/catalogs/demo/config");
    expect(getConfigResponse.statusCode).toBe(200);
    expect(json(getConfigResponse)).toEqual({
      catalogId: "demo",
      data: dkgData,
    });

    const setPatternRulesResponse = await request(app, "PUT", "/catalogs/demo/pattern-rules", { data: patternRules });
    expect(setPatternRulesResponse.statusCode).toBe(200);
    expect(json(setPatternRulesResponse)).toEqual({
      catalogId: "demo",
      ok: true,
    });

    const getPatternRulesResponse = await request(app, "GET", "/catalogs/demo/pattern-rules");
    expect(getPatternRulesResponse.statusCode).toBe(200);
    expect(json(getPatternRulesResponse)).toEqual({
      catalogId: "demo",
      data: patternRules,
    });
  });

  it("GET /catalogs/:id/configs lists stored config types", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    await registerCatalog(app);
    await request(app, "PUT", "/catalogs/demo/config", { data: JSON.stringify({ gates: [] }) });
    await request(app, "PUT", "/catalogs/demo/pattern-rules", { data: JSON.stringify([{ id: "rule-1" }]) });

    const response = await request(app, "GET", "/catalogs/demo/configs");

    expect(response.statusCode).toBe(200);
    expect(json<Array<{ configType: string; updatedAt: string }>>(response)).toEqual([
      expect.objectContaining({ configType: "dkg-config" }),
      expect.objectContaining({ configType: "pattern-rules" }),
    ]);
  });

  it("PUT /catalogs/:id/config rejects missing catalogs", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    const response = await request(app, "PUT", "/catalogs/nope/config", {
      data: JSON.stringify({ gates: [] }),
    });

    expect(response.statusCode).toBe(404);
    expect(json(response)).toEqual({
      error: "Catalog 'nope' not found",
    });
  });
});
