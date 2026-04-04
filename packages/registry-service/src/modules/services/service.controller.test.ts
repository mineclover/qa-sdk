import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { SqlDriver } from "index-meta";
import { AppModule } from "../../app.module.js";
import { DATABASE } from "../../database.module.js";
import { DatabaseModule } from "../../database.module.js";
import { SqlConfigStore } from "../../stores/sql-config-store.js";
import { SqlServiceEndpointStore } from "../../stores/sql-service-endpoint-store.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";
import { ServiceModule } from "./service.module.js";

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
    const app = await createNestTestApp({ imports: [DatabaseModule, ServiceModule] });
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

  it("PUT/GET /api/services/:serviceId/components/:kind/:version stores versioned child components", async () => {
    const app = await createNestTestApp({ imports: [DatabaseModule, ServiceModule] });
    apps.push(app);

    await request(
      app,
      "PUT",
      "/api/services/gateway/components/service-unit/su-v1?catalog=demo",
      {
        serviceId: "gateway",
        namespace: "shop",
        name: "Gateway",
        tier: "system",
      },
    );
    await request(
      app,
      "PUT",
      "/api/services/gateway/components/ownership/own-v1?catalog=demo",
      {
        serviceId: "gateway",
        ownedPrefixes: ["endpoint"],
      },
    );

    const putResponse = await request(
      app,
      "PUT",
      "/api/services/gateway/components/runtime-address/ra-v1?catalog=demo",
      {
        serviceId: "gateway",
        namespace: "shop",
        name: "Gateway",
        env: "prod",
        region: "asia",
      },
    );
    expect(putResponse.statusCode).toBe(200);
    expect(json(putResponse)).toEqual({
      ok: true,
      kind: "runtime-address",
      serviceId: "gateway",
      version: "ra-v1",
      state: "draft",
    });

    const detailResponse = await request(
      app,
      "GET",
      "/api/services/gateway/components/runtime-address/ra-v1?catalog=demo",
    );
    expect(detailResponse.statusCode).toBe(200);
    expect(json(detailResponse)).toMatchObject({
      kind: "runtime-address",
      serviceId: "gateway",
      version: "ra-v1",
      state: "draft",
      value: {
        serviceId: "gateway",
        namespace: "shop",
        name: "Gateway",
        env: "prod",
        region: "asia",
      },
    });

    const listResponse = await request(
      app,
      "GET",
      "/api/services/gateway/components/runtime-address?catalog=demo",
    );
    expect(listResponse.statusCode).toBe(200);
    expect(json<Array<{ version: string }>>(listResponse)).toMatchObject([
      { version: "ra-v1", state: "draft" },
    ]);

    const transitionResponse = await request(
      app,
      "POST",
      "/api/services/gateway/components/runtime-address/ra-v1/transition?catalog=demo",
      { state: "published" },
    );
    expect(transitionResponse.statusCode).toBe(201);
    expect(json(transitionResponse)).toMatchObject({
      state: "published",
    });

    await request(
      app,
      "POST",
      "/api/services/gateway/components/service-unit/su-v1/transition?catalog=demo",
      { state: "published" },
    );
    await request(
      app,
      "POST",
      "/api/services/gateway/components/ownership/own-v1/transition?catalog=demo",
      { state: "published" },
    );

    const publishedResponse = await request(
      app,
      "GET",
      "/api/services/gateway/components/runtime-address/published?catalog=demo",
    );
    expect(publishedResponse.statusCode).toBe(200);
    expect(json<Array<{ version: string; state: string }>>(publishedResponse)).toMatchObject([
      { version: "ra-v1", state: "published" },
    ]);

    const candidatesResponse = await request(
      app,
      "GET",
      "/api/services/gateway/assembly-candidates?catalog=demo",
    );
    expect(candidatesResponse.statusCode).toBe(200);
    expect(json(candidatesResponse)).toMatchObject({
      serviceId: "gateway",
      required: {
        "service-unit": {
          published: [{ version: "su-v1", state: "published" }],
        },
        "ownership": {
          published: [{ version: "own-v1", state: "published" }],
        },
        "runtime-address": {
          published: [{ version: "ra-v1", state: "published" }],
        },
      },
      readiness: {
        ready: true,
        missingRequired: [],
      },
      summary: {
        published: {
          required: 3,
          optional: 0,
        },
      },
    });
  });

  it("GET /api/services/:serviceId/ownership/topology compares ownership component with topology declarations", async () => {
    const app = await createNestTestApp({ imports: [DatabaseModule, ServiceModule] });
    apps.push(app);
    const { configStore } = createStores(app);

    await configStore.set("demo", "services", JSON.stringify([
      {
        serviceId: "order-svc",
        name: "Order",
        ownedPrefixes: ["tracking"],
        consumedPrefixes: ["service"],
      },
      {
        serviceId: "report-svc",
        name: "Report",
        ownedPrefixes: ["report"],
        consumedPrefixes: ["tracking"],
      },
    ]));

    await request(
      app,
      "PUT",
      "/api/services/order-svc/components/ownership/own-v2?catalog=demo",
      {
        serviceId: "order-svc",
        ownedPrefixes: ["tracking", "endpoint"],
        consumedPrefixes: ["service", "permission"],
      },
    );
    await request(
      app,
      "POST",
      "/api/services/order-svc/components/ownership/own-v2/transition?catalog=demo",
      { state: "published" },
    );

    const response = await request(
      app,
      "GET",
      "/api/services/order-svc/ownership/topology?catalog=demo&version=own-v2",
    );
    expect(response.statusCode).toBe(200);
    expect(json(response)).toMatchObject({
      serviceId: "order-svc",
      topology: {
        ownedPrefixes: ["tracking"],
        consumedPrefixes: ["service"],
      },
      ownershipComponent: {
        version: "own-v2",
        state: "published",
        ownedPrefixes: ["tracking", "endpoint"],
        consumedPrefixes: ["service", "permission"],
      },
      alignment: {
        status: "drifted",
        ownedPrefixes: {
          matching: ["tracking"],
          onlyInComponent: ["endpoint"],
          onlyInTopology: [],
        },
        consumedPrefixes: {
          matching: ["service"],
          onlyInComponent: ["permission"],
          onlyInTopology: [],
        },
        ownedPrefixConsumers: [
          {
            prefixId: "tracking",
            consumers: ["report-svc"],
          },
          {
            prefixId: "endpoint",
            consumers: [],
          },
        ],
        consumedPrefixOwners: [
          {
            prefixId: "service",
            ownerServiceId: null,
          },
          {
            prefixId: "permission",
            ownerServiceId: null,
          },
        ],
      },
    });
  });

  it("POST /api/services/:serviceId/deployments/sync stores deployment-binding via convenience write surface", async () => {
    const app = await createNestTestApp({ imports: [DatabaseModule, ServiceModule] });
    apps.push(app);

    const syncResponse = await request(
      app,
      "POST",
      "/api/services/order-svc/deployments/sync?catalog=demo",
      {
        deploymentVersion: "dep-sync-v1",
        runtime: {
          namespace: "shop",
          name: "order",
          env: "prod",
          region: "asia",
        },
        provider: "pulumi",
        project: "core",
        stack: "prod",
        resourceKey: "api",
        url: "https://order.example.com",
        urn: "urn:pulumi:prod::core::api",
        outputs: { healthUrl: "https://order.example.com/health" },
      },
    );
    expect(syncResponse.statusCode).toBe(201);
    expect(json(syncResponse)).toMatchObject({
      ok: true,
      kind: "deployment-binding",
      serviceId: "order-svc",
      version: "dep-sync-v1",
      state: "draft",
      synced: true,
      manifestImpact: {
        status: "no-active-manifest",
        activeManifestVersion: null,
        action: "optional-republish",
      },
    });

    const detail = await request(
      app,
      "GET",
      "/api/services/order-svc/components/deployment-binding/dep-sync-v1?catalog=demo",
    );
    expect(detail.statusCode).toBe(200);
    expect(json(detail)).toMatchObject({
      kind: "deployment-binding",
      serviceId: "order-svc",
      version: "dep-sync-v1",
      value: {
        deploymentVersion: "dep-sync-v1",
        address: {
          serviceId: "order-svc",
          runtime: {
            serviceId: "order-svc",
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
        url: "https://order.example.com",
        urn: "urn:pulumi:prod::core::api",
        outputs: {
          healthUrl: "https://order.example.com/health",
        },
      },
    });
  });

  it("POST /api/services/:serviceId/runtime-addresses/sync stores runtime-address via convenience write surface", async () => {
    const app = await createNestTestApp({ imports: [DatabaseModule, ServiceModule] });
    apps.push(app);

    const syncResponse = await request(
      app,
      "POST",
      "/api/services/order-svc/runtime-addresses/sync?catalog=demo",
      {
        runtimeAddressVersion: "ra-sync-v1",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    );
    expect(syncResponse.statusCode).toBe(201);
    expect(json(syncResponse)).toMatchObject({
      ok: true,
      kind: "runtime-address",
      serviceId: "order-svc",
      version: "ra-sync-v1",
      state: "draft",
      synced: true,
      manifestImpact: {
        status: "no-active-manifest",
        activeManifestVersion: null,
        action: "optional-republish",
      },
    });

    const detail = await request(
      app,
      "GET",
      "/api/services/order-svc/components/runtime-address/ra-sync-v1?catalog=demo",
    );
    expect(detail.statusCode).toBe(200);
    expect(json(detail)).toMatchObject({
      kind: "runtime-address",
      serviceId: "order-svc",
      version: "ra-sync-v1",
      value: {
        serviceId: "order-svc",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    });
  });

  it("runtime-addresses/sync reports republish impact when active manifest pins another runtimeAddress version", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

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
    await request(app, "PUT", "/api/services/order-svc/components/runtime-address/ra-old?catalog=demo", {
      serviceId: "order-svc",
      namespace: "shop",
      name: "order",
      env: "prod",
      region: "asia",
    });
    await request(app, "POST", "/api/services/order-svc/components/service-unit/su-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/ownership/own-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/runtime-address/ra-old/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", { state: "released" });
    await request(app, "POST", "/manifests/assemble?catalog=demo", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      runtimeAddressVersion: "ra-old",
      serviceUnitVersion: "su-v1",
      ownershipVersion: "own-v1",
      prefixes: { tracking: "v1" },
    });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "published" });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "active" });

    const syncResponse = await request(
      app,
      "POST",
      "/api/services/order-svc/runtime-addresses/sync?catalog=demo",
      {
        runtimeAddressVersion: "ra-new",
        namespace: "shop",
        name: "order",
        env: "prod",
        region: "asia",
      },
    );
    expect(syncResponse.statusCode).toBe(201);
    expect(json(syncResponse)).toMatchObject({
      manifestImpact: {
        status: "republish-recommended",
        activeManifestVersion: "1.0.0",
        pinnedRuntimeAddressVersion: "ra-old",
        action: "review-and-republish",
      },
    });
  });

  it("deployments/sync reports republish impact when active manifest pins another deployment version", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

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
    await request(app, "PUT", "/api/services/order-svc/components/deployment-binding/dep-old?catalog=demo", {
      serviceId: "order-svc",
      deploymentVersion: "dep-old",
      address: {
        serviceId: "order-svc",
        runtime: {
          serviceId: "order-svc",
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
      observedAt: "2026-04-04T00:00:00.000Z",
      url: "https://old.example.com",
    });
    await request(app, "POST", "/api/services/order-svc/components/service-unit/su-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/ownership/own-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/runtime-address/ra-v1/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/api/services/order-svc/components/deployment-binding/dep-old/transition?catalog=demo", { state: "published" });
    await request(app, "POST", "/manifests/prefixes", { prefixId: "tracking", version: "v1" });
    await request(app, "POST", "/manifests/prefixes/tracking/v1/transition", { state: "released" });
    await request(app, "POST", "/manifests/assemble?catalog=demo", {
      serviceId: "order-svc",
      manifestVersion: "1.0.0",
      runtimeAddressVersion: "ra-v1",
      serviceUnitVersion: "su-v1",
      ownershipVersion: "own-v1",
      deploymentVersion: "dep-old",
      prefixes: { tracking: "v1" },
    });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "published" });
    await request(app, "POST", "/manifests/order-svc/1.0.0/transition", { state: "active" });

    const syncResponse = await request(
      app,
      "POST",
      "/api/services/order-svc/deployments/sync?catalog=demo",
      {
        deploymentVersion: "dep-new",
        runtime: {
          namespace: "shop",
          name: "order",
          env: "prod",
          region: "asia",
        },
        provider: "pulumi",
        project: "core",
        stack: "prod",
        resourceKey: "api",
        url: "https://new.example.com",
      },
    );
    expect(syncResponse.statusCode).toBe(201);
    expect(json(syncResponse)).toMatchObject({
      manifestImpact: {
        status: "republish-recommended",
        activeManifestVersion: "1.0.0",
        pinnedDeploymentVersion: "dep-old",
        action: "review-and-republish",
      },
    });
  });

  it("GET /api/endpoints, /resolve, /:ns/:svc matches endpoint lookup semantics", async () => {
    const app = await createNestTestApp({ imports: [DatabaseModule, ServiceModule] });
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
    const app = await createNestTestApp({ imports: [DatabaseModule, ServiceModule] });
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
