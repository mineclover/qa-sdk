import { beforeAll, afterAll, afterEach, describe, expect, it } from "vitest";
import { cleanupDb, closeTestDb, createTestApp, createTestDb } from "../helpers/setup.js";

describe("integration smoke", () => {
  beforeAll(async () => {
    await createTestDb();
  });

  afterEach(async () => {
    await cleanupDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("connects to PostgreSQL and ensures the schema exists", async () => {
    const db = await createTestDb();
    const [row] = await db.execute<{
      connection_ok: number;
      services_table: string | null;
      service_events_table: string | null;
    }>(
      `
        select
          1 as connection_ok,
          to_regclass('public.services')::text as services_table,
          to_regclass('public.service_events')::text as service_events_table
      `,
    );

    expect(row).toMatchObject({
      connection_ok: 1,
      services_table: "services",
      service_events_table: "service_events",
    });
  });

  it("returns 200 from GET /health on the real app", async () => {
    const app = await createTestApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 200 from GET /ready when db is connected", async () => {
    const app = await createTestApp();

    const response = await app.request("/ready");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
