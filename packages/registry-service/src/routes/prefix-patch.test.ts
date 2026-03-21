import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from "index-meta";
import { createApp } from "../app.js";
import { InMemoryPrefixOwnerStore } from "../stores/in-memory-prefix-owner-store.js";
import { InMemoryDraftLockStore } from "../stores/in-memory-draft-lock-store.js";
import pino from "pino";
import type { Hono } from "hono";

function buildApp() {
  const app = createApp({
    prefixRegistry: new InMemoryPrefixRegistry(),
    versionStore: new InMemoryVersionLifecycleStore(),
    ownerStore: new InMemoryPrefixOwnerStore(),
    lockStore: new InMemoryDraftLockStore(),
    logger: pino({ level: "silent" }),
  });
  return app;
}

async function registerPrefix(app: Hono, prefix: string) {
  return app.request("/prefixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, owner: "test", kind: "leaf", numberType: "number" }),
  });
}

describe("Prefix PATCH Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = buildApp();
  });

  it("PATCH /prefixes/:id name + category 동시 업데이트", async () => {
    await registerPrefix(app, "permission");
    // name은 meta가 있을 때만 meta.name으로 저장됨 → category와 함께 보내야 함
    const res = await app.request("/prefixes/permission", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "권한 관리", category: "policy" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.name).toBe("권한 관리");
    expect(body.meta.category).toBe("policy");
  });

  it("PATCH /prefixes/:id labels 업데이트", async () => {
    await registerPrefix(app, "permission");
    const res = await app.request("/prefixes/permission", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labels: ["role", "action", "resource"] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.labels).toEqual(["role", "action", "resource"]);
  });

  it("PATCH /prefixes/:id category + meta 병합", async () => {
    await registerPrefix(app, "permission");
    const res = await app.request("/prefixes/permission", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "policy", meta: { layer: 1, visualShape: "thin-bar" } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.category).toBe("policy");
    expect(body.meta.layer).toBe(1);
    expect(body.meta.visualShape).toBe("thin-bar");
  });

  it("PATCH /prefixes/:id 없는 prefix → 에러", async () => {
    const res = await app.request("/prefixes/nope", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });
    // RegistryService가 AppError를 throw → error handler가 처리
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("POST + GET + PATCH + DELETE 라운드트립", async () => {
    // Create
    const createRes = await registerPrefix(app, "service");
    expect(createRes.status).toBe(201);

    // Read
    let res = await app.request("/prefixes/service");
    expect(res.status).toBe(200);
    expect((await res.json()).prefix).toBe("service");

    // Patch
    await app.request("/prefixes/service", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "서비스 주소", category: "entity" }),
    });
    res = await app.request("/prefixes/service");
    const patched = await res.json();
    expect(patched.meta.name).toBe("서비스 주소");
    expect(patched.meta.category).toBe("entity");

    // List
    res = await app.request("/prefixes");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);

    // Delete (version 없이 등록만 했으므로 삭제 가능)
    res = await app.request("/prefixes/service", { method: "DELETE" });
    expect(res.status).toBe(200);

    // 삭제 후 목록 빈 배열
    res = await app.request("/prefixes");
    expect(await res.json()).toHaveLength(0);
  });
});
