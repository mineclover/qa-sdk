import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { SqlDriver } from "index-meta";
import { AppModule } from "../../app.module.js";
import { DATABASE } from "../../database.module.js";
import { SqlEventSchemaStore } from "../../stores/sql-event-schema-store.js";
import {
  createNestTestApp,
  request,
  json,
} from "../../test/nest-helpers.js";

function createStores(app: NestFastifyApplication) {
  const db = app.get<SqlDriver>(DATABASE);
  return {
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

    const summaryResponse = await request(app, "GET", "/api/event-catalog");
    expect(summaryResponse.statusCode).toBe(200);
    expect(json<{
      totalEvents: number;
      prefixMappings: number;
      categories: Record<string, number>;
    }>(summaryResponse)).toEqual(expect.objectContaining({
      totalEvents: expect.any(Number),
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
  });
});
