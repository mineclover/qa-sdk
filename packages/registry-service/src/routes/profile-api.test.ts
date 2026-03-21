import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from "index-meta";
import { createApp } from "../app.js";
import { InMemoryPrefixOwnerStore } from "../stores/in-memory-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "../stores/in-memory-draft-lock-store.js";
import { InMemoryCatalogStore } from "../stores/in-memory-catalog-store.js";
import { InMemoryAxisProfileStore } from "../stores/in-memory-axis-profile-store.js";
import pino from "pino";
import type { Hono } from "hono";
import type { AxisProfileStore } from "../stores/axis-profile-store.js";

function buildApp() {
  const axisStore = new InMemoryAxisProfileStore();
  const app = createApp({
    prefixRegistry: new InMemoryPrefixRegistry(),
    versionStore: new InMemoryVersionLifecycleStore(),
    ownerStore: new InMemoryPrefixOwnerStore(),
    lockStore: new InMemoryDraftLockStore(),
    catalogStore: new InMemoryCatalogStore(),
    axisStore,
    logger: pino({ level: "silent" }),
  });
  return { app, axisStore };
}

// ── helpers ──────────────────────────────────────────────────

async function postAxis(
  app: Hono,
  catalogId: string,
  body: { id: string; name: string; capacity?: number; entryCount?: number },
) {
  return app.request(`/catalogs/${catalogId}/axes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getAxes(app: Hono, catalogId: string) {
  return app.request(`/catalogs/${catalogId}/axes`);
}

async function getAxis(app: Hono, catalogId: string, id: string) {
  return app.request(`/catalogs/${catalogId}/axes/${id}`);
}

async function patchAxis(
  app: Hono,
  catalogId: string,
  id: string,
  body: Record<string, unknown>,
) {
  return app.request(`/catalogs/${catalogId}/axes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function addEntry(
  app: Hono,
  catalogId: string,
  axisId: string,
  entry: string,
) {
  return app.request(`/catalogs/${catalogId}/axes/${axisId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry }),
  });
}

async function deleteAxis(app: Hono, catalogId: string, id: string) {
  return app.request(`/catalogs/${catalogId}/axes/${id}`, {
    method: "DELETE",
  });
}

async function registerPrefix(
  app: Hono,
  body: { prefix: string; owner: string; kind: string; numberType?: string },
) {
  return app.request("/prefixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function patchPrefix(
  app: Hono,
  prefix: string,
  body: Record<string, unknown>,
) {
  return app.request(`/prefixes/${prefix}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Axis Profile API ─────────────────────────────────────────

describe("Axis Profile API", () => {
  let app: Hono;
  let axisStore: AxisProfileStore;

  beforeEach(() => {
    ({ app, axisStore } = buildApp());
  });

  it("1. POST /catalogs/demo/axes → 201 등록", async () => {
    const res = await postAxis(app, "demo", { id: "role", name: "역할" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("role");
    expect(body.name).toBe("역할");
    expect(body.catalogId).toBe("demo");
    expect(body.currentVersion).toBe("v1");
    expect(body.capacity).toBe(32); // 기본값
    expect(body.entryCount).toBe(0);
    expect(body.updatedAt).toBeDefined();
  });

  it("2. POST 중복 → 409", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });
    const res = await postAxis(app, "demo", { id: "role", name: "역할 v2" });
    expect(res.status).toBe(409);
  });

  it("3. POST 필수 필드 누락 → 400", async () => {
    // id 누락
    const res1 = await app.request("/catalogs/demo/axes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "역할" }),
    });
    expect(res1.status).toBe(400);

    // name 누락
    const res2 = await app.request("/catalogs/demo/axes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "role" }),
    });
    expect(res2.status).toBe(400);
  });

  it("4. GET /catalogs/demo/axes → 목록 조회", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });
    await postAxis(app, "demo", { id: "action", name: "행위" });

    const res = await getAxes(app, "demo");
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list).toHaveLength(2);
    expect(list.map((a: any) => a.id).sort()).toEqual(["action", "role"]);
  });

  it("5. GET /catalogs/demo/axes/:id → 단건 조회", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할", capacity: 64 });

    const res = await getAxis(app, "demo", "role");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("role");
    expect(body.name).toBe("역할");
    expect(body.capacity).toBe(64);
  });

  it("6. GET 없는 축 → 404", async () => {
    const res = await getAxis(app, "demo", "nonexistent");
    expect(res.status).toBe(404);
  });

  it("7. PATCH capacity → 업데이트 확인", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할", capacity: 32 });

    const res = await patchAxis(app, "demo", "role", { capacity: 128 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.capacity).toBe(128);
    expect(body.name).toBe("역할"); // 이름은 유지

    // GET으로 재확인
    const getRes = await getAxis(app, "demo", "role");
    const getBody = await getRes.json();
    expect(getBody.capacity).toBe(128);
  });

  it("8. PATCH name → 업데이트 확인", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });

    const res = await patchAxis(app, "demo", "role", { name: "역할 v2" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("역할 v2");
    expect(body.capacity).toBe(32); // capacity는 유지
  });

  it("9. PATCH 없는 축 → 404", async () => {
    const res = await patchAxis(app, "demo", "nonexistent", { capacity: 64 });
    expect(res.status).toBe(404);
  });

  it("10. POST entries → entryCount 증가 + headroom 감소", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할", capacity: 4 });

    const res1 = await addEntry(app, "demo", "role", "admin");
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.ok).toBe(true);
    expect(body1.entry).toBe("admin");
    expect(body1.entryCount).toBe(1);
    expect(body1.headroom).toBe(3); // capacity(4) - entryCount(1) = 3

    const res2 = await addEntry(app, "demo", "role", "editor");
    const body2 = await res2.json();
    expect(body2.entryCount).toBe(2);
    expect(body2.headroom).toBe(2);

    const res3 = await addEntry(app, "demo", "role", "viewer");
    const body3 = await res3.json();
    expect(body3.entryCount).toBe(3);
    expect(body3.headroom).toBe(1);
  });

  it("11. POST entries 꽉 찬 축 → 409", async () => {
    await postAxis(app, "demo", {
      id: "small",
      name: "작은 축",
      capacity: 2,
      entryCount: 2,
    });

    const res = await addEntry(app, "demo", "small", "overflow");
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.headroom).toBe(0);
  });

  it("12. DELETE → 삭제 확인", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });

    const res = await deleteAxis(app, "demo", "role");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // 삭제 후 조회 시 404
    const getRes = await getAxis(app, "demo", "role");
    expect(getRes.status).toBe(404);
  });
});

// ── Prefix Profile PATCH ─────────────────────────────────────

describe("Prefix Profile PATCH", () => {
  let app: Hono;

  beforeEach(() => {
    ({ app } = buildApp());
  });

  it("13. PATCH category → meta.category 반영", async () => {
    await registerPrefix(app, {
      prefix: "game_event",
      owner: "team-a",
      kind: "leaf",
    });

    const res = await patchPrefix(app, "game_event", { category: "game" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toBeDefined();
    expect(body.meta.category).toBe("game");
  });

  it("14. PATCH labels → labels 반영", async () => {
    await registerPrefix(app, {
      prefix: "game_event",
      owner: "team-a",
      kind: "leaf",
    });

    const res = await patchPrefix(app, "game_event", {
      labels: ["actor", "scene", "outcome"],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.labels).toEqual(["actor", "scene", "outcome"]);
  });

  it("15. PATCH meta partial merge → 기존 meta 보존 + 신규 필드 추가", async () => {
    await registerPrefix(app, {
      prefix: "game_event",
      owner: "team-a",
      kind: "leaf",
    });

    // 첫 번째 PATCH: category 설정
    await patchPrefix(app, "game_event", { category: "game" });

    // 두 번째 PATCH: description 추가 (category 보존 확인)
    const res = await patchPrefix(app, "game_event", {
      meta: { description: "게임 이벤트 추적" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.category).toBe("game");
    expect(body.meta.description).toBe("게임 이벤트 추적");
  });
});

// ── Demo 시나리오: 새 도메인 추가 ────────────────────────────

describe("Demo 시나리오: 새 도메인 추가", () => {
  let app: Hono;
  let axisStore: AxisProfileStore;

  beforeEach(() => {
    ({ app, axisStore } = buildApp());
  });

  it("16. Full workflow: 축 등록 → prefix 등록 → 패치 → entry 추가 → 최종 검증", async () => {
    // ── Step 1: 축 3개 등록 ──
    const axes = [
      { id: "actor", name: "행위자", capacity: 16 },
      { id: "scene", name: "장면", capacity: 32 },
      { id: "outcome", name: "결과", capacity: 8 },
    ];

    for (const axis of axes) {
      const res = await postAxis(app, "demo", axis);
      expect(res.status).toBe(201);
    }

    // 축 목록 확인
    const axisListRes = await getAxes(app, "demo");
    const axisList = await axisListRes.json();
    expect(axisList).toHaveLength(3);

    // ── Step 2: prefix 2개 등록 ──
    const prefixRes1 = await registerPrefix(app, {
      prefix: "game_event",
      owner: "team-game",
      kind: "leaf",
    });
    expect(prefixRes1.status).toBe(201);

    const prefixRes2 = await registerPrefix(app, {
      prefix: "game_state",
      owner: "team-game",
      kind: "leaf",
    });
    expect(prefixRes2.status).toBe(201);

    // ── Step 3: prefix category 패치 ──
    const patchRes1 = await patchPrefix(app, "game_event", {
      category: "game",
      labels: ["actor", "scene", "outcome"],
    });
    expect(patchRes1.status).toBe(200);
    const patched1 = await patchRes1.json();
    expect(patched1.meta.category).toBe("game");
    expect(patched1.labels).toEqual(["actor", "scene", "outcome"]);

    const patchRes2 = await patchPrefix(app, "game_state", {
      category: "game",
      labels: ["actor", "scene"],
    });
    expect(patchRes2.status).toBe(200);

    // ── Step 4: 각 축에 entry 추가 ──
    const actorEntries = ["player", "npc", "system"];
    for (const entry of actorEntries) {
      const res = await addEntry(app, "demo", "actor", entry);
      expect(res.status).toBe(200);
    }

    const sceneEntries = ["lobby", "battle", "shop", "inventory"];
    for (const entry of sceneEntries) {
      const res = await addEntry(app, "demo", "scene", entry);
      expect(res.status).toBe(200);
    }

    const outcomeEntries = ["success", "failure"];
    for (const entry of outcomeEntries) {
      const res = await addEntry(app, "demo", "outcome", entry);
      expect(res.status).toBe(200);
    }

    // ── Step 5: 최종 상태 검증 ──

    // 축 상태 확인
    const actorRes = await getAxis(app, "demo", "actor");
    const actorBody = await actorRes.json();
    expect(actorBody.entryCount).toBe(3);
    expect(actorBody.capacity).toBe(16);
    // headroom = 16 - 3 = 13

    const sceneRes = await getAxis(app, "demo", "scene");
    const sceneBody = await sceneRes.json();
    expect(sceneBody.entryCount).toBe(4);
    expect(sceneBody.capacity).toBe(32);

    const outcomeRes = await getAxis(app, "demo", "outcome");
    const outcomeBody = await outcomeRes.json();
    expect(outcomeBody.entryCount).toBe(2);
    expect(outcomeBody.capacity).toBe(8);

    // prefix 상태 확인
    const gameEventRes = await app.request("/prefixes/game_event");
    expect(gameEventRes.status).toBe(200);
    const gameEvent = await gameEventRes.json();
    expect(gameEvent.prefix).toBe("game_event");
    expect(gameEvent.owner).toBe("team-game");
    expect(gameEvent.meta.category).toBe("game");
    expect(gameEvent.labels).toEqual(["actor", "scene", "outcome"]);

    const gameStateRes = await app.request("/prefixes/game_state");
    expect(gameStateRes.status).toBe(200);
    const gameState = await gameStateRes.json();
    expect(gameState.prefix).toBe("game_state");
    expect(gameState.labels).toEqual(["actor", "scene"]);
  });
});
