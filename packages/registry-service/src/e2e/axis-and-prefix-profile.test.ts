// @def.boundary registry-system
// @def.doc registry-system

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../app.module.js";
import { createNestTestApp, wrapNestApp, type CompatApp } from "../test/nest-helpers.js";

const nestApps: Awaited<ReturnType<typeof createNestTestApp>>[] = [];
const CID = "demo";

async function buildApp() {
  const nestApp = await createNestTestApp({ imports: [AppModule] });
  nestApps.push(nestApp);
  return wrapNestApp(nestApp);
}

async function registerAxis(
  app: CompatApp,
  id: string,
  name: string,
  opts?: { capacity?: number; entryCount?: number },
) {
  return app.request(`/catalogs/${CID}/axes`, {
    method: "POST",
    body: JSON.stringify({ id, name, ...opts }),
  });
}

async function postAxis(
  app: CompatApp,
  catalogId: string,
  body: { id: string; name: string; capacity?: number; entryCount?: number },
) {
  return app.request(`/catalogs/${catalogId}/axes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function getAxis(app: CompatApp, catalogId: string, id: string) {
  return app.request(`/catalogs/${catalogId}/axes/${id}`);
}

async function getAxes(app: CompatApp, catalogId: string) {
  return app.request(`/catalogs/${catalogId}/axes`);
}

async function patchAxis(app: CompatApp, catalogId: string, id: string, body: Record<string, unknown>) {
  return app.request(`/catalogs/${catalogId}/axes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function addEntry(app: CompatApp, catalogId: string, axisId: string, entry: string) {
  return app.request(`/catalogs/${catalogId}/axes/${axisId}/entries`, {
    method: "POST",
    body: JSON.stringify({ entry }),
  });
}

async function deleteAxis(app: CompatApp, catalogId: string, id: string) {
  return app.request(`/catalogs/${catalogId}/axes/${id}`, { method: "DELETE" });
}

async function registerPrefix(
  app: CompatApp,
  body: { prefix: string; owner: string; kind: string; numberType?: string },
) {
  return app.request("/prefixes", {
    method: "POST",
    body: JSON.stringify({
      ...body,
      numberType: body.numberType ?? "number",
    }),
  });
}

async function patchPrefix(app: CompatApp, prefix: string, body: Record<string, unknown>) {
  return app.request(`/prefixes/${prefix}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  while (nestApps.length > 0) {
    await nestApps.pop()!.close();
  }
});

describe("Axis Routes (Nest)", () => {
  let app: CompatApp;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("POST /catalogs/:cid/axes → 201 등록", async () => {
    const res = await registerAxis(app, "env", "환경");
    expect(res.status).toBe(201);
    const body = await res.json<any>();
    expect(body.id).toBe("env");
    expect(body.name).toBe("환경");
    expect(body.capacity).toBe(32);
    expect(body.entryCount).toBe(0);
    expect(body.currentVersion).toBe("v1");
    expect(body.catalogId).toBe(CID);
  });

  it("POST 커스텀 capacity 지정", async () => {
    const res = await registerAxis(app, "role", "역할", { capacity: 64 });
    expect(res.status).toBe(201);
    expect((await res.json<any>()).capacity).toBe(64);
  });

  it("POST 중복 → 409", async () => {
    await registerAxis(app, "env", "환경");
    const res = await registerAxis(app, "env", "환경 v2");
    expect(res.status).toBe(409);
  });

  it("POST 필수 필드 누락 → 400", async () => {
    const res = await app.request(`/catalogs/${CID}/axes`, {
      method: "POST",
      body: JSON.stringify({ id: "x" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /catalogs/:cid/axes → 목록", async () => {
    await registerAxis(app, "env", "환경");
    await registerAxis(app, "region", "리전");
    const res = await app.request(`/catalogs/${CID}/axes`);
    expect(res.status).toBe(200);
    const list = await res.json<any[]>();
    expect(list).toHaveLength(2);
    expect(list.map((axis) => axis.id).toSorted()).toEqual(["env", "region"]);
  });

  it("GET /catalogs/:cid/axes 빈 카탈로그 → 빈 배열", async () => {
    const res = await app.request(`/catalogs/${CID}/axes`);
    expect(res.status).toBe(200);
    expect(await res.json<any[]>()).toEqual([]);
  });

  it("GET /catalogs/:cid/axes/:id → 단건", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`);
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.id).toBe("env");
    expect(body.name).toBe("환경");
  });

  it("GET /catalogs/:cid/axes/:id 없는 ID → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope`);
    expect(res.status).toBe(404);
  });

  it("PATCH capacity 업데이트", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      body: JSON.stringify({ capacity: 64 }),
    });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).capacity).toBe(64);
  });

  it("PATCH name 업데이트", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      body: JSON.stringify({ name: "배포 환경" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).name).toBe("배포 환경");
  });

  it("PATCH meta 병합", async () => {
    await registerAxis(app, "env", "환경");
    await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      body: JSON.stringify({ meta: { source: "demo" } }),
    });
    const res = await app.request(`/catalogs/${CID}/axes/env`, {
      method: "PATCH",
      body: JSON.stringify({ meta: { layer: 0 } }),
    });
    const body = await res.json<any>();
    expect(body.meta.source).toBe("demo");
    expect(body.meta.layer).toBe(0);
  });

  it("PATCH 없는 ID → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope`, {
      method: "PATCH",
      body: JSON.stringify({ capacity: 64 }),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE 성공", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json<any>()).toEqual({ ok: true });
    const get = await app.request(`/catalogs/${CID}/axes/env`);
    expect(get.status).toBe(404);
  });

  it("DELETE 없는 ID → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });

  it("POST entries → entry 추가 + headroom 반환", async () => {
    await registerAxis(app, "env", "환경", { capacity: 8 });
    const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
      method: "POST",
      body: JSON.stringify({ entry: "dev" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.ok).toBe(true);
    expect(body.entry).toBe("dev");
    expect(body.entryCount).toBe(1);
    expect(body.headroom).toBe(7);
  });

  it("POST entries 연속 추가 → headroom 감소", async () => {
    await registerAxis(app, "env", "환경", { capacity: 4 });
    for (const entry of ["dev", "stage", "prod"]) {
      const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
        method: "POST",
        body: JSON.stringify({ entry }),
      });
      expect(res.status).toBe(200);
    }

    const get = await app.request(`/catalogs/${CID}/axes/env`);
    expect((await get.json<any>()).entryCount).toBe(3);
  });

  it("POST entries headroom 소진 → 409", async () => {
    await registerAxis(app, "env", "환경", { capacity: 2, entryCount: 2 });
    const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
      method: "POST",
      body: JSON.stringify({ entry: "local" }),
    });
    expect(res.status).toBe(409);
    expect((await res.json<any>()).headroom).toBe(0);
  });

  it("POST entries 없는 axis → 404", async () => {
    const res = await app.request(`/catalogs/${CID}/axes/nope/entries`, {
      method: "POST",
      body: JSON.stringify({ entry: "x" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST entries entry 누락 → 400", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request(`/catalogs/${CID}/axes/env/entries`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("다른 카탈로그의 axis는 조회 안 됨", async () => {
    await registerAxis(app, "env", "환경");
    const res = await app.request("/catalogs/other/axes/env");
    expect(res.status).toBe(404);
  });

  it("CRUD 라운드트립", async () => {
    await registerAxis(app, "role", "역할", { capacity: 16 });
    let res = await app.request(`/catalogs/${CID}/axes/role`);
    expect(res.status).toBe(200);
    expect((await res.json<any>()).capacity).toBe(16);

    await app.request(`/catalogs/${CID}/axes/role`, {
      method: "PATCH",
      body: JSON.stringify({ capacity: 32, name: "사용자 역할" }),
    });
    res = await app.request(`/catalogs/${CID}/axes/role`);
    const patched = await res.json<any>();
    expect(patched.capacity).toBe(32);
    expect(patched.name).toBe("사용자 역할");

    await app.request(`/catalogs/${CID}/axes/role/entries`, {
      method: "POST",
      body: JSON.stringify({ entry: "admin" }),
    });
    res = await app.request(`/catalogs/${CID}/axes/role`);
    expect((await res.json<any>()).entryCount).toBe(1);

    await app.request(`/catalogs/${CID}/axes/role`, { method: "DELETE" });
    res = await app.request(`/catalogs/${CID}/axes/role`);
    expect(res.status).toBe(404);
  });
});

describe("Axis Profile API + Prefix PATCH (Nest)", () => {
  let app: CompatApp;

  beforeEach(async () => {
    app = await buildApp();
  });

  it("1. POST /catalogs/demo/axes → 201 등록", async () => {
    const res = await postAxis(app, "demo", { id: "role", name: "역할" });
    expect(res.status).toBe(201);
    const body = await res.json<any>();
    expect(body.id).toBe("role");
    expect(body.name).toBe("역할");
    expect(body.catalogId).toBe("demo");
    expect(body.currentVersion).toBe("v1");
    expect(body.capacity).toBe(32);
    expect(body.entryCount).toBe(0);
    expect(body.updatedAt).toBeDefined();
  });

  it("2. POST 중복 → 409", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });
    const res = await postAxis(app, "demo", { id: "role", name: "역할 v2" });
    expect(res.status).toBe(409);
  });

  it("3. POST 필수 필드 누락 → 400", async () => {
    const res1 = await app.request("/catalogs/demo/axes", {
      method: "POST",
      body: JSON.stringify({ name: "역할" }),
    });
    expect(res1.status).toBe(400);

    const res2 = await app.request("/catalogs/demo/axes", {
      method: "POST",
      body: JSON.stringify({ id: "role" }),
    });
    expect(res2.status).toBe(400);
  });

  it("4. GET /catalogs/demo/axes → 목록 조회", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });
    await postAxis(app, "demo", { id: "action", name: "행위" });

    const res = await getAxes(app, "demo");
    expect(res.status).toBe(200);
    const list = await res.json<any[]>();
    expect(list).toHaveLength(2);
    expect(list.map((axis) => axis.id).toSorted()).toEqual(["action", "role"]);
  });

  it("5. GET /catalogs/demo/axes/:id → 단건 조회", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할", capacity: 64 });
    const res = await getAxis(app, "demo", "role");
    expect(res.status).toBe(200);
    const body = await res.json<any>();
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
    const body = await res.json<any>();
    expect(body.capacity).toBe(128);
    expect(body.name).toBe("역할");

    const getRes = await getAxis(app, "demo", "role");
    expect((await getRes.json<any>()).capacity).toBe(128);
  });

  it("8. PATCH name → 업데이트 확인", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });
    const res = await patchAxis(app, "demo", "role", { name: "역할 v2" });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.name).toBe("역할 v2");
    expect(body.capacity).toBe(32);
  });

  it("9. PATCH 없는 축 → 404", async () => {
    const res = await patchAxis(app, "demo", "nonexistent", { capacity: 64 });
    expect(res.status).toBe(404);
  });

  it("10. POST entries → entryCount 증가 + headroom 감소", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할", capacity: 4 });

    const res1 = await addEntry(app, "demo", "role", "admin");
    expect(res1.status).toBe(200);
    const body1 = await res1.json<any>();
    expect(body1.ok).toBe(true);
    expect(body1.entry).toBe("admin");
    expect(body1.entryCount).toBe(1);
    expect(body1.headroom).toBe(3);

    const res2 = await addEntry(app, "demo", "role", "editor");
    expect((await res2.json<any>()).headroom).toBe(2);

    const res3 = await addEntry(app, "demo", "role", "viewer");
    expect((await res3.json<any>()).headroom).toBe(1);
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
    expect((await res.json<any>()).headroom).toBe(0);
  });

  it("12. DELETE → 삭제 확인", async () => {
    await postAxis(app, "demo", { id: "role", name: "역할" });
    const res = await deleteAxis(app, "demo", "role");
    expect(res.status).toBe(200);
    expect((await res.json<any>()).ok).toBe(true);

    const getRes = await getAxis(app, "demo", "role");
    expect(getRes.status).toBe(404);
  });

  it("13. PATCH category → meta.category 반영", async () => {
    await registerPrefix(app, {
      prefix: "game_event",
      owner: "team-a",
      kind: "leaf",
    });

    const res = await patchPrefix(app, "game_event", { category: "event" });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).meta.category).toBe("event");
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
    expect((await res.json<any>()).labels).toEqual(["actor", "scene", "outcome"]);
  });

  it("15. PATCH meta partial merge → 기존 meta 보존 + 신규 필드 추가", async () => {
    await registerPrefix(app, {
      prefix: "game_event",
      owner: "team-a",
      kind: "leaf",
    });

    await patchPrefix(app, "game_event", { category: "event" });
    const res = await patchPrefix(app, "game_event", {
      meta: { description: "게임 이벤트 추적" },
    });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.meta.category).toBe("event");
    expect(body.meta.description).toBe("게임 이벤트 추적");
  });

  it("16. Full workflow: 축 등록 → prefix 등록 → 패치 → entry 추가 → 최종 검증", async () => {
    const axes = [
      { id: "actor", name: "행위자", capacity: 16 },
      { id: "scene", name: "장면", capacity: 32 },
      { id: "outcome", name: "결과", capacity: 8 },
    ];

    for (const axis of axes) {
      const res = await postAxis(app, "demo", axis);
      expect(res.status).toBe(201);
    }

    const axisListRes = await getAxes(app, "demo");
    expect(await axisListRes.json<any[]>()).toHaveLength(3);

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

    const patchRes1 = await patchPrefix(app, "game_event", {
      category: "event",
      labels: ["actor", "scene", "outcome"],
    });
    expect(patchRes1.status).toBe(200);
    const patched1 = await patchRes1.json<any>();
    expect(patched1.meta.category).toBe("event");
    expect(patched1.labels).toEqual(["actor", "scene", "outcome"]);

    const patchRes2 = await patchPrefix(app, "game_state", {
      category: "event",
      labels: ["actor", "scene"],
    });
    expect(patchRes2.status).toBe(200);

    for (const entry of ["player", "npc", "system"]) {
      expect((await addEntry(app, "demo", "actor", entry)).status).toBe(200);
    }
    for (const entry of ["lobby", "battle", "shop", "inventory"]) {
      expect((await addEntry(app, "demo", "scene", entry)).status).toBe(200);
    }
    for (const entry of ["success", "failure"]) {
      expect((await addEntry(app, "demo", "outcome", entry)).status).toBe(200);
    }

    const actorRes = await getAxis(app, "demo", "actor");
    const actorBody = await actorRes.json<any>();
    expect(actorBody.entryCount).toBe(3);
    expect(actorBody.capacity).toBe(16);

    const sceneRes = await getAxis(app, "demo", "scene");
    const sceneBody = await sceneRes.json<any>();
    expect(sceneBody.entryCount).toBe(4);
    expect(sceneBody.capacity).toBe(32);

    const outcomeRes = await getAxis(app, "demo", "outcome");
    const outcomeBody = await outcomeRes.json<any>();
    expect(outcomeBody.entryCount).toBe(2);
    expect(outcomeBody.capacity).toBe(8);

    const gameEventRes = await app.request("/prefixes/game_event");
    expect(gameEventRes.status).toBe(200);
    const gameEvent = await gameEventRes.json<any>();
    expect(gameEvent.prefix).toBe("game_event");
    expect(gameEvent.owner).toBe("team-game");
    expect(gameEvent.meta.category).toBe("event");
    expect(gameEvent.labels).toEqual(["actor", "scene", "outcome"]);

    const gameStateRes = await app.request("/prefixes/game_state");
    expect(gameStateRes.status).toBe(200);
    expect((await gameStateRes.json<any>()).labels).toEqual(["actor", "scene"]);
  });

  it("PATCH /prefixes/:id name + category 동시 업데이트", async () => {
    await registerPrefix(app, { prefix: "permission", owner: "test", kind: "leaf" });
    const res = await app.request("/prefixes/permission", {
      method: "PATCH",
      body: JSON.stringify({ name: "권한 관리", category: "policy" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.meta.name).toBe("권한 관리");
    expect(body.meta.category).toBe("policy");
  });

  it("PATCH /prefixes/:id labels 업데이트", async () => {
    await registerPrefix(app, { prefix: "permission", owner: "test", kind: "leaf" });
    const res = await app.request("/prefixes/permission", {
      method: "PATCH",
      body: JSON.stringify({ labels: ["role", "action", "resource"] }),
    });
    expect(res.status).toBe(200);
    expect((await res.json<any>()).labels).toEqual(["role", "action", "resource"]);
  });

  it("PATCH /prefixes/:id category + meta 병합", async () => {
    await registerPrefix(app, { prefix: "permission", owner: "test", kind: "leaf" });
    const res = await app.request("/prefixes/permission", {
      method: "PATCH",
      body: JSON.stringify({ category: "policy", meta: { layer: 1, visualShape: "thin-bar" } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<any>();
    expect(body.meta.category).toBe("policy");
    expect(body.meta.layer).toBe(1);
    expect(body.meta.visualShape).toBe("thin-bar");
  });

  it("PATCH /prefixes/:id 없는 prefix → 에러", async () => {
    const res = await app.request("/prefixes/nope", {
      method: "PATCH",
      body: JSON.stringify({ name: "x" }),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("POST + GET + PATCH + DELETE 라운드트립", async () => {
    const createRes = await registerPrefix(app, { prefix: "service", owner: "test", kind: "leaf" });
    expect(createRes.status).toBe(201);

    let res = await app.request("/prefixes/service");
    expect(res.status).toBe(200);
    expect((await res.json<any>()).prefix).toBe("service");

    await app.request("/prefixes/service", {
      method: "PATCH",
      body: JSON.stringify({ name: "서비스 주소", category: "entity" }),
    });
    res = await app.request("/prefixes/service");
    const patched = await res.json<any>();
    expect(patched.meta.name).toBe("서비스 주소");
    expect(patched.meta.category).toBe("entity");

    res = await app.request("/prefixes");
    expect(await res.json<any[]>()).toHaveLength(1);

    res = await app.request("/prefixes/service", { method: "DELETE" });
    expect(res.status).toBe(200);

    res = await app.request("/prefixes");
    expect(await res.json<any[]>()).toHaveLength(0);
  });
});
