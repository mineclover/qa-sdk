import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { SqlDriver } from "index-meta";
import { AppModule } from "../../app.module.js";
import { DATABASE } from "../../database.module.js";
import { SqlConfigStore } from "../../stores/sql-config-store.js";
import { SqlServiceEndpointStore } from "../../stores/sql-service-endpoint-store.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

function createStores(app: NestFastifyApplication) {
  const db = app.get<SqlDriver>(DATABASE);
  return {
    configStore: new SqlConfigStore(db),
    endpointStore: new SqlServiceEndpointStore(db),
  };
}

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe("ServiceModule (Nest)", () => {
  it("GET/POST/PATCH /api/services keeps topology CRUD semantics", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);
    const { configStore } = createStores(app);

    await configStore.set("demo", "services", JSON.stringify([
      {
        serviceId: "web",
        name: "Web",
        ownedPrefixes: ["page_view"],
      },
    ]));

    const listResponse = await request(app, "GET", "/api/services");
    expect(listResponse.statusCode).toBe(200);
    expect(json<Array<{ serviceId: string }>>(listResponse)).toEqual([
      { serviceId: "web", name: "Web", ownedPrefixes: ["page_view"] },
    ]);

    const createResponse = await request(app, "POST", "/api/services", {
      serviceId: "api",
      name: "API",
      ownedPrefixes: ["endpoint"],
      gatewayPath: "/v1/api",
    });
    expect(createResponse.statusCode).toBe(200);
    expect(json(createResponse)).toEqual({
      ok: true,
      serviceId: "api",
      action: "created",
    });

    const patchResponse = await request(app, "PATCH", "/api/services", {
      services: [
        {
          serviceId: "gate",
          name: "Gateway",
          ownedPrefixes: [],
          gatewayPath: "/v1",
          stripPrefix: true,
        },
      ],
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(json(patchResponse)).toEqual({
      ok: true,
      count: 1,
    });

    const detailResponse = await request(app, "GET", "/api/services/gate");
    expect(detailResponse.statusCode).toBe(200);
    expect(json(detailResponse)).toEqual({
      serviceId: "gate",
      name: "Gateway",
      ownedPrefixes: [],
      gatewayPath: "/v1",
      stripPrefix: true,
    });
  });

  it("GET /api/endpoints, /resolve, /:ns/:svc matches endpoint lookup semantics", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);
    const { endpointStore } = createStores(app);

    await endpointStore.upsert({
      catalogId: "demo",
      namespace: "shop",
      svcName: "api",
      env: "dev",
      region: "asia",
      url: "http://localhost:3200",
      updatedAt: "2026-03-27T00:00:00.000Z",
    });
    await endpointStore.upsert({
      catalogId: "demo",
      namespace: "shop",
      svcName: "api",
      env: "prod",
      region: "asia",
      url: "https://api.example.com",
      updatedAt: "2026-03-27T00:00:00.000Z",
    });

    const listResponse = await request(app, "GET", "/api/endpoints?catalog=demo");
    expect(listResponse.statusCode).toBe(200);
    expect(json<Array<{ namespace: string; svcName: string }>>(listResponse)).toEqual([
      expect.objectContaining({
        namespace: "shop",
        svcName: "api",
        env: "dev",
      }),
      expect.objectContaining({
        namespace: "shop",
        svcName: "api",
        env: "prod",
      }),
    ]);

    const resolveResponse = await request(
      app,
      "GET",
      "/api/endpoints/resolve?catalog=demo&namespace=shop&name=api&env=dev&region=asia",
    );
    expect(resolveResponse.statusCode).toBe(200);
    expect(json(resolveResponse)).toEqual({
      url: "http://localhost:3200",
    });

    const byServiceResponse = await request(app, "GET", "/api/endpoints/shop/api?catalog=demo");
    expect(byServiceResponse.statusCode).toBe(200);
    expect(json<Array<{ env: string; url: string }>>(byServiceResponse)).toEqual([
      expect.objectContaining({
        env: "dev",
        url: "http://localhost:3200",
      }),
      expect.objectContaining({
        env: "prod",
        url: "https://api.example.com",
      }),
    ]);
  });

  it("resolve returns Hono-compatible errors for missing inputs and missing records", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    const missingQueryResponse = await request(app, "GET", "/api/endpoints/resolve?catalog=demo");
    expect(missingQueryResponse.statusCode).toBe(400);
    expect(json(missingQueryResponse)).toEqual({
      error: "namespace, name, env, region 필수",
    });

    const missingRecordResponse = await request(
      app,
      "GET",
      "/api/endpoints/resolve?catalog=demo&namespace=shop&name=api&env=dev&region=asia",
    );
    expect(missingRecordResponse.statusCode).toBe(404);
    expect(json(missingRecordResponse)).toEqual({
      error: "Endpoint not found: shop/api@dev.asia",
    });
  });
});
