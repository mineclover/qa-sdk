import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from "index-meta";
import { createApp } from "../app.js";
import { InMemoryPrefixOwnerStore } from "../stores/in-memory-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "../stores/in-memory-draft-lock-store.js";
import { InMemoryCatalogStore } from "../stores/in-memory-catalog-store.js";
import pino from "pino";
import type { Hono } from "hono";

function buildApp() {
  const catalogStore = new InMemoryCatalogStore();
  const app = createApp({
    prefixRegistry: new InMemoryPrefixRegistry(),
    versionStore: new InMemoryVersionLifecycleStore(),
    ownerStore: new InMemoryPrefixOwnerStore(),
    lockStore: new InMemoryDraftLockStore(),
    catalogStore,
    logger: pino({ level: "silent" }),
  });
  return { app, catalogStore };
}

const SAMPLE_CATALOG = JSON.stringify({
  id: "demo",
  name: "쇼핑 데모",
  axes: {},
  prefixes: {
    permission: { id: "permission", name: "권한", labels: ["role", "action"], dims: {}, versions: [] },
    service: { id: "service", name: "서비스", labels: ["env"], dims: {}, versions: [] },
  },
});

async function registerCatalog(app: Hono, id: string, name: string, data = SAMPLE_CATALOG) {
  return app.request("/catalogs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, data }),
  });
}

describe("Catalog Routes", () => {
  let app: Hono;

  beforeEach(() => {
    ({ app } = buildApp());
  });

  it("POST /catalogs → 201 등록", async () => {
    const res = await registerCatalog(app, "demo", "쇼핑 데모");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("demo");
    expect(body.name).toBe("쇼핑 데모");
  });

  it("POST /catalogs 중복 → 409", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await registerCatalog(app, "demo", "쇼핑 데모 v2");
    expect(res.status).toBe(409);
  });

  it("POST /catalogs 필수 필드 누락 → 400", async () => {
    const res = await app.request("/catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /catalogs → 목록 조회", async () => {
    await registerCatalog(app, "a", "A");
    await registerCatalog(app, "b", "B");
    const res = await app.request("/catalogs");
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(2);
    expect(list[0]).toHaveProperty("id");
    expect(list[0]).toHaveProperty("name");
    expect(list[0]).toHaveProperty("updatedAt");
    // data는 목록에서 제외
    expect(list[0]).not.toHaveProperty("data");
  });

  it("GET /catalogs/:id → 단건 조회", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await app.request("/catalogs/demo");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("demo");
    expect(body.data).toBe(SAMPLE_CATALOG);
  });

  it("GET /catalogs/:id 없는 ID → 404", async () => {
    const res = await app.request("/catalogs/nope");
    expect(res.status).toBe(404);
  });

  it("PUT /catalogs/:id → 업데이트", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await app.request("/catalogs/demo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "쇼핑 데모 v2" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("쇼핑 데모 v2");
  });

  it("PUT /catalogs/:id 없는 ID → 404", async () => {
    const res = await app.request("/catalogs/nope", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE /catalogs/:id → 삭제", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await app.request("/catalogs/demo", { method: "DELETE" });
    expect(res.status).toBe(200);
    // 삭제 후 조회 시 404
    const get = await app.request("/catalogs/demo");
    expect(get.status).toBe(404);
  });

  it("DELETE /catalogs/:id 없는 ID → 404", async () => {
    const res = await app.request("/catalogs/nope", { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("GET /catalogs/:id/prefixes → prefix 목록", async () => {
    await registerCatalog(app, "demo", "쇼핑 데모");
    const res = await app.request("/catalogs/demo/prefixes");
    expect(res.status).toBe(200);
    const prefixes = await res.json();
    expect(prefixes).toHaveLength(2);
    expect(prefixes[0]).toHaveProperty("id");
    expect(prefixes[0]).toHaveProperty("name");
    expect(prefixes[0]).toHaveProperty("dims");
  });

  it("GET /catalogs/:id/prefixes 없는 카탈로그 → 404", async () => {
    const res = await app.request("/catalogs/nope/prefixes");
    expect(res.status).toBe(404);
  });

  it("CRUD 라운드트립", async () => {
    // Create
    await registerCatalog(app, "test", "테스트");
    // Read
    let res = await app.request("/catalogs/test");
    expect(res.status).toBe(200);
    // Update
    await app.request("/catalogs/test", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "테스트 v2", data: '{"id":"test","name":"v2","axes":{},"prefixes":{}}' }),
    });
    res = await app.request("/catalogs/test");
    expect((await res.json()).name).toBe("테스트 v2");
    // Delete
    await app.request("/catalogs/test", { method: "DELETE" });
    res = await app.request("/catalogs/test");
    expect(res.status).toBe(404);
  });
});
