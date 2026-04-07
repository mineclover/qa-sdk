import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { SqlDriver } from "index-meta";
import { AppModule } from "../../app.module.js";
import { DATABASE } from "../../database.module.js";
import { SqlConfigStore } from "../../stores/sql-config-store.js";
import { SqlEventSchemaStore } from "../../stores/sql-event-schema-store.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

function createStores(app: NestFastifyApplication) {
  const db = app.get<SqlDriver>(DATABASE);
  return {
    configStore: new SqlConfigStore(db),
    eventSchemaStore: new SqlEventSchemaStore(db),
  };
}

const apps: NestFastifyApplication[] = [];

afterEach(async () => {
  while (apps.length > 0) {
    await apps.pop()!.close();
  }
});

describe("EventModule (Nest)", () => {
  it("GET/PUT/DELETE /api/event-schemas preserves catalog and CRUD semantics", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);
    const { eventSchemaStore } = createStores(app);

    await eventSchemaStore.upsert({
      catalogId: "demo",
      serviceId: "api",
      eventKey: "click",
      eventVersion: "001",
      displayName: "Click",
      description: "seed",
      recordKind: "log",
      status: "active",
      createdAt: "2026-03-27T00:00:00.000Z",
      updatedAt: "2026-03-27T00:00:00.000Z",
    });

    const listResponse = await request(app, "GET", "/api/event-schemas?catalog=demo&service=api");
    expect(listResponse.statusCode).toBe(200);
    expect(json<Array<{ serviceId: string; eventKey: string }>>(listResponse)).toEqual([
      expect.objectContaining({
        serviceId: "api",
        eventKey: "click",
        eventVersion: "001",
      }),
    ]);

    const createResponse = await request(app, "PUT", "/api/event-schemas/api/page_view/001?catalog=demo", {
      displayName: "Page View",
      recordKind: "both",
      status: "active",
    });
    expect(createResponse.statusCode).toBe(200);
    expect(json(createResponse)).toEqual({
      ok: true,
      action: "created",
    });

    const detailResponse = await request(app, "GET", "/api/event-schemas/api/page_view/001?catalog=demo");
    expect(detailResponse.statusCode).toBe(200);
    expect(json(detailResponse)).toEqual(
      expect.objectContaining({
        catalogId: "demo",
        serviceId: "api",
        eventKey: "page_view",
        eventVersion: "001",
        displayName: "Page View",
        recordKind: "both",
      }),
    );

    const versionsResponse = await request(app, "GET", "/api/event-schemas/api/page_view?catalog=demo");
    expect(versionsResponse.statusCode).toBe(200);
    expect(json(versionsResponse)).toEqual({
      serviceId: "api",
      eventKey: "page_view",
      versions: [
        expect.objectContaining({
          eventVersion: "001",
        }),
      ],
    });

    const deleteResponse = await request(app, "DELETE", "/api/event-schemas/api/page_view/001?catalog=demo");
    expect(deleteResponse.statusCode).toBe(200);
    expect(json(deleteResponse)).toEqual({ ok: true });

    const missingResponse = await request(app, "GET", "/api/event-schemas/api/page_view/001?catalog=demo");
    expect(missingResponse.statusCode).toBe(404);
    expect(json(missingResponse)).toEqual({
      error: "Event schema not found",
    });
  });

  it("GET /api/event-catalog serves static catalog data through Nest", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);
    const { configStore } = createStores(app);

    await configStore.set("demo", "event-adoption", JSON.stringify([
      { serviceId: "shopping-web", eventPacks: [{ packId: "shop-pack", version: "v1" }] },
    ]));

    const summaryResponse = await request(app, "GET", "/api/event-catalog");
    expect(summaryResponse.statusCode).toBe(200);
    expect(json<{
      totalEvents: number;
      mappingPacks: number;
      prefixMappings: number;
      categories: Record<string, number>;
    }>(summaryResponse)).toEqual(expect.objectContaining({
      totalEvents: expect.any(Number),
      mappingPacks: expect.any(Number),
      prefixMappings: expect.any(Number),
      categories: expect.any(Object),
    }));

    const detailResponse = await request(app, "GET", "/api/event-catalog/events/click");
    expect(detailResponse.statusCode).toBe(200);
    expect(json<{
      event: { event_key: string; category: string };
    }>(detailResponse)).toEqual(expect.objectContaining({
      event: expect.objectContaining({
        event_key: "click",
        category: "interaction",
      }),
    }));

    const packsResponse = await request(app, "GET", "/api/event-catalog/packs");
    expect(packsResponse.statusCode).toBe(200);
    expect(json<Array<{ packId: string; owner: string }>>(packsResponse)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packId: "shop-pack",
          owner: "shopping-web",
        }),
      ]),
    );

    const packDetailResponse = await request(app, "GET", "/api/event-catalog/packs/shop-pack");
    expect(packDetailResponse.statusCode).toBe(200);
    expect(json<{ packId: string; owner: string }>(packDetailResponse)).toEqual(
      expect.objectContaining({
        packId: "shop-pack",
        owner: "shopping-web",
      }),
    );

    const adoptionsResponse = await request(app, "GET", "/api/event-catalog/adoptions?catalog=demo");
    expect(adoptionsResponse.statusCode).toBe(200);
    expect(json<Array<{ serviceId: string }>>(adoptionsResponse)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ serviceId: "shopping-web" }),
      ]),
    );

    const catalogCheckResponse = await request(app, "GET", "/api/event-catalog/taxonomy/check?catalog=demo");
    expect(catalogCheckResponse.statusCode).toBe(200);
    expect(json<{ ok: boolean; serviceCount: number; failingServiceCount: number }>(catalogCheckResponse)).toEqual(
      expect.objectContaining({
        ok: true,
        serviceCount: expect.any(Number),
        failingServiceCount: 0,
      }),
    );

    const adoptionDetailResponse = await request(app, "GET", "/api/event-catalog/adoptions/shopping-web?catalog=demo");
    expect(adoptionDetailResponse.statusCode).toBe(200);
    expect(json<{ serviceId: string; eventPacks: Array<{ packId: string; version: string }> }>(adoptionDetailResponse)).toEqual(
      expect.objectContaining({
        serviceId: "shopping-web",
        eventPacks: [{ packId: "shop-pack", version: "v1" }],
      }),
    );

    const adoptionUpsertResponse = await request(app, "PUT", "/api/event-catalog/adoptions/shopping-web?catalog=demo", {
      eventPacks: [{ packId: "shop-pack", version: "v1" }, { packId: "sdk-pack" }],
      allowedCategories: ["navigation", "interaction"],
    });
    expect(adoptionUpsertResponse.statusCode).toBe(200);
    expect(json(adoptionUpsertResponse)).toEqual({
      ok: true,
      serviceId: "shopping-web",
      action: "updated",
    });

    const updatedAdoptionResponse = await request(app, "GET", "/api/event-catalog/adoptions/shopping-web?catalog=demo");
    expect(updatedAdoptionResponse.statusCode).toBe(200);
    expect(json<{ serviceId: string; eventPacks: Array<{ packId: string; version: string }> }>(updatedAdoptionResponse)).toEqual(
      expect.objectContaining({
        serviceId: "shopping-web",
        eventPacks: [
          { packId: "shop-pack", version: "v1" },
          { packId: "sdk-pack", version: "v1" },
        ],
      }),
    );

    const taxonomyResponse = await request(app, "GET", "/api/event-catalog/services/shopping-web/taxonomy?catalog=demo");
    expect(taxonomyResponse.statusCode).toBe(200);
    expect(json<{
      serviceId: string;
      adoption: { serviceId: string } | null;
      ownership: { ownedPrefixes: string[] };
      materialized: { count: number };
      drift: { adoptionMissing: boolean; stalePackVersions: unknown[] };
    }>(taxonomyResponse)).toEqual(
      expect.objectContaining({
        serviceId: "shopping-web",
        adoption: expect.objectContaining({ serviceId: "shopping-web" }),
        ownership: expect.objectContaining({
          ownedPrefixes: expect.any(Array),
        }),
        materialized: expect.objectContaining({
          count: expect.any(Number),
        }),
        drift: expect.objectContaining({
          adoptionMissing: false,
          stalePackVersions: [],
        }),
      }),
    );

    const checkResponse = await request(app, "GET", "/api/event-catalog/services/shopping-web/taxonomy/check?catalog=demo");
    expect(checkResponse.statusCode).toBe(200);
    expect(json<{
      serviceId: string;
      ok: boolean;
      issueCount: number;
      issues: Array<{ code: string }>;
    }>(checkResponse)).toEqual(
      expect.objectContaining({
        serviceId: "shopping-web",
        ok: true,
        issueCount: 0,
        issues: [],
      }),
    );

    const assertResponse = await request(app, "POST", "/api/event-catalog/services/shopping-web/taxonomy/assert?catalog=demo");
    expect(assertResponse.statusCode).toBe(201);
    expect(json(assertResponse)).toEqual({
      ok: true,
      serviceId: "shopping-web",
      issueCount: 0,
      issues: [],
    });

    const catalogAssertResponse = await request(app, "POST", "/api/event-catalog/taxonomy/assert?catalog=demo");
    expect(catalogAssertResponse.statusCode).toBe(201);
    expect(json<{ ok: boolean; failingServiceCount: number }>(catalogAssertResponse)).toEqual(
      expect.objectContaining({
        ok: true,
        failingServiceCount: 0,
      }),
    );

    const adoptionDeleteResponse = await request(app, "DELETE", "/api/event-catalog/adoptions/shopping-web?catalog=demo");
    expect(adoptionDeleteResponse.statusCode).toBe(200);
    expect(json(adoptionDeleteResponse)).toEqual({
      ok: true,
      serviceId: "shopping-web",
    });
  });

  it("adoption write surface는 legacy string pack ref를 거부한다", async () => {
    const app = await createNestTestApp({ imports: [AppModule] });
    apps.push(app);

    const response = await request(app, "PUT", "/api/event-catalog/adoptions/shopping-web?catalog=demo", {
      eventPacks: ["shop-pack"],
    });
    expect(response.statusCode).toBe(400);
    expect(json(response)).toEqual({
      error: "eventPacks는 { packId, version? }[] 이어야 함",
    });
  });
});
