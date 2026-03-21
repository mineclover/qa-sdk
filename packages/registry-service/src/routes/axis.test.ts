import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from "index-meta";
import { createApp } from "../app.js";
import { InMemoryPrefixOwnerStore } from "../stores/in-memory-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "../stores/in-memory-draft-lock-store.js";
import { InMemoryAxisProfileStore } from "../stores/in-memory-axis-profile-store.js";
import pino from "pino";
import type { Hono } from "hono";

function buildApp() {
  const axisStore = new InMemoryAxisProfileStore();
  const app = createApp({
    prefixRegistry: new InMemoryPrefixRegistry(),
    versionStore: new InMemoryVersionLifecycleStore(),
    ownerStore: new InMemoryPrefixOwnerStore(),
    lockStore: new InMemoryDraftLockStore(),
    axisStore,
    logger: pino({ level: "silent" }),
  });
  return { app, axisStore };
}

const CID = "demo";

async function registerAxis(app: Hono, id: string, name: string, opts?: { capacity?: number; entryCount?: number }) {
  return app.request(`/catalogs/${CID}/axes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name, ...opts }),
  });
}

// ── Axis CRUD ───────────────────────────────────────────

describe("Axis Routes", () => {
  let app: Hono;

  beforeEach(() => {
    ({ app } = buildApp());
  });

  // ── POST (등록) ─────────────────────────────────────

  it("POST /catalogs/:cid/axes → 201 등록", async () => {
    const res = await registerAxis(app, "env", "환경");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("env");
    expect(body.name).toBe("환경");
    expect(body.capacity).toBe(32); // 기본값
    expect(body.entryCount).toBe(0);
    expect(body.currentVersion).toBe("v1");
    expect(body.catalogId).toBe(CID);
  });

  it("POST 커스텀 capacity 지정", async () => {
    const res = await registerAxis(app, "role", "역할", { capacity: 64 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.capacity).toBe(64);
  });

  it("POST 중복 → 409", async () => {
    await registerAxis(app, "env", "환경");
    const res = await registerAxis(app, "env", "환경 v2");
    expect(res.status).toBe(409);
  });

  it("POST 필수 필드 누락 → 400", async () => {
    const res = await app.request(`/catalogs/${CID}/axes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  // ── GET (조회) ──────────────────────────────────────

  it("GET /catalogs/:cid/axes → 목록", async () => {
    await registerAxis(app, "env", "환경");
    await registerAxis(app, "region", "리전");
    const res = await app.request(`/catalogs/${CID}/axes`);
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(2);
    const ids = list.map((a: any) => a.id).sort();
    expect(ids).toEqual(["env", "region"]);
  });

  it("GET /catalogs/:cid/axes 빈 카탈로그 → 빈 배열", async () => {
    const res = await app.request(`/catalogs/${CID}/axes`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("GET /catalogs/:cid/axes/:id → 단건", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("env");
    expect(body.name).toBe("환경");
  });

  it("GET /catalogs/:cid/axes/:id 없는 ID → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope`);
    expect(res.status).toBe(404);
  });

  // ── PATCH (수정) ────────────────────────────────────

  it("PATCH capacity 업데이트", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 64 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capacity).toBe(64);
  });

  it("PATCH name 업데이트", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "배포 환경" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("배포 환경");
  });

  it("PATCH meta 병합", async () => {
    await registerAxis(app, "env", "환경");
    await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { source: "demo" } }),
    });
    const res = await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { layer: 0 } }),
    });
    const body = await res.json();
    expect(body.meta.source).toBe("demo");
    expect(body.meta.layer).toBe(0);
  });

  it("PATCH 없는 ID → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 64 }),
    });
    expect(res.status).toBe(404);
  });

  // ── DELETE (삭제) ───────────────────────────────────

  it("DELETE 성공", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    // 삭제 후 조회 시 404
    const get = await app.request(`/catalogs/${CID}/axes/env`);
    expect(get.status).toBe(404);
  });

  it("DELETE 없는 ID → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  // ── Entry 추가 + Headroom ──────────────────────────

  it("POST entries → entry 추가 + headroom 반환", async () => {
    await registerAxis(app, "env", "환경", { capacity: 8 });
    const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry: "dev" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.entry).toBe("dev");
    expect(body.entryCount).toBe(1);
    expect(body.headroom).toBe(7); // 8 - 0 - 1
  });

  it("POST entries 연속 추가 → headroom 감소", async () => {
    await registerAxis(app, "env", "환경", { capacity: 4 });

    for (const entry of ["dev", "stage", "prod"]) {
      const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      });
      expect(res.status).toBe(200);
    }

    // 3개 추가 후 headroom = 4 - 3 = 1
    const get = await app.request(`/catalogs/${CID}/axes/env`);
    expect((await get.json()).entryCount).toBe(3);
  });

  it("POST entries headroom 소진 → 409", async () => {
    await registerAxis(app, "env", "환경", { capacity: 2, entryCount: 2 });
    const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry: "local" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.headroom).toBe(0);
  });

  it("POST entries 없는 axis → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST entries entry 누락 → 400", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  // ── 카탈로그 격리 ──────────────────────────────────

  it("다른 카탈로그의 axis는 조회 안 됨", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request("/catalogs/other/axes/env");
    expect(res.status).toBe(404);
  });

  // ── CRUD 라운드트립 ────────────────────────────────

  it("CRUD 라운드트립", async () => {
    // Create
    await registerAxis(app, "role", "역할", { capacity: 16 });
    // Read
    let res = await app.request(`/catalogs/${CID}/axes/role`);
    expect(res.status).toBe(200);
    expect((await res.json()).capacity).toBe(16);
    // Update
    await app.request(`/catalogs/${CID}/axes/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 32, name: "사용자 역할" }),
    });
    res = await app.request(`/catalogs/${CID}/axes/role`);
    const patched = await res.json();
    expect(patched.capacity).toBe(32);
    expect(patched.name).toBe("사용자 역할");
    // Add entry
    await app.request(`/catalogs/${CID}/axes/role/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry: "admin" }),
    });
    res = await app.request(`/catalogs/${CID}/axes/role`);
    expect((await res.json()).entryCount).toBe(1);
    // Delete
    await app.request(`/catalogs/${CID}/axes/role`, { method: "DELETE" });
    res = await app.request(`/catalogs/${CID}/axes/role`);
    expect(res.status).toBe(404);
  });
});
