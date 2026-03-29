/**
 * SQL 통합 테스트 — NodeSqliteDriver(:memory:) 기반.
 *
 * InMemory 스토어 대신 실제 SQL 스토어를 사용하여
 * DDL, CRUD, lifecycle, DAG, workspace, resolve 전체 경로를 검증한다.
 */

import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";
import { createNestTestApp, wrapNestApp, type CompatApp } from "./test/nest-helpers.js";

// ── Helper ───────────────────────────────────────────

const nestApps: Array<Awaited<ReturnType<typeof createNestTestApp>>> = [];

async function buildSqlApp() {
  const nestApp = await createNestTestApp({ imports: [AppModule] });
  nestApps.push(nestApp);
  return { app: wrapNestApp(nestApp) };
}

async function json(res: { json(): Promise<unknown> }): Promise<any> {
  return res.json();
}

async function registerPrefix(
  app: CompatApp, prefix: string,
  opts?: { owner?: string; kind?: string; numberType?: string },
) {
  return app.request("/prefixes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix,
      owner: opts?.owner ?? "test",
      kind: opts?.kind ?? "leaf",
      numberType: opts?.numberType ?? "number",
    }),
  });
}

async function createDraft(
  app: CompatApp, prefix: string, versionId: string, capacity: number,
  opts?: { refs?: { prefix: string; versionId: string }[] },
) {
  return app.request(`/prefixes/${prefix}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versionId, capacity, baseVersionId: null, ...opts }),
  });
}

afterEach(async () => {
  while (nestApps.length > 0) {
    await nestApps.pop()!.close();
  }
});

// ══════════════════════════════════════════════════════
//  SQL 통합 테스트
// ══════════════════════════════════════════════════════

describe("SQL Integration — Prefix CRUD", () => {
  it("등록, 조회, 목록, 삭제", async () => {
    const { app } = await buildSqlApp();

    // 등록
    const res1 = await registerPrefix(app, "env");
    expect(res1.status).toBe(201);

    // 조회
    const res2 = await app.request("/prefixes/env");
    expect(res2.status).toBe(200);
    const body2 = await json(res2);
    expect(body2.prefix).toBe("env");

    // 중복 등록 실패
    const res3 = await registerPrefix(app, "env");
    expect(res3.status).toBe(409);

    // 목록
    await registerPrefix(app, "region");
    const res4 = await app.request("/prefixes");
    const body4 = await json(res4);
    expect(body4).toHaveLength(2);

    // 삭제 (버전 없으므로 가능)
    const res5 = await app.request("/prefixes/region", { method: "DELETE" });
    expect(res5.status).toBe(200);

    const res6 = await app.request("/prefixes");
    const body6 = await json(res6);
    expect(body6).toHaveLength(1);
  });
});

describe("SQL Integration — Version Lifecycle", () => {
  it("draft → lock → release → activate → deprecate", async () => {
    const { app } = await buildSqlApp();

    await registerPrefix(app, "role");
    await createDraft(app, "role", "v1", 8);

    // draft 조회
    const res1 = await app.request("/prefixes/role/versions/v1");
    expect(res1.status).toBe(200);
    const v1 = await json(res1);
    expect(v1.capacity).toBe(8);
    expect(v1.status).toBe("draft");

    // lock
    const res2 = await app.request("/prefixes/role/versions/v1/lock", { method: "POST" });
    expect(res2.status).toBe(200);

    // lock 후 getVersion → status=locked
    const res2b = await app.request("/prefixes/role/versions/v1");
    const locked = await json(res2b);
    expect(locked.status).toBe("locked");

    // release
    const res3 = await app.request("/prefixes/role/versions/v1/release", { method: "POST" });
    expect(res3.status).toBe(200);

    // activate
    const res4 = await app.request("/prefixes/role/versions/v1/activate", { method: "POST" });
    expect(res4.status).toBe(200);

    // resolve active
    const res5 = await app.request("/resolve/active/role");
    expect(res5.status).toBe(200);
    const active = await json(res5);
    expect(active.versionId).toBe("v1");

    // deprecate
    const res6 = await app.request("/prefixes/role/versions/v1/deprecate", { method: "POST" });
    expect(res6.status).toBe(200);
  });
});

describe("SQL Integration — Composite DAG + Workspace", () => {
  it("leaf 등록 → composite 생성 → simulate → analyze → release-all", async () => {
    const { app } = await buildSqlApp();

    // leaf 등록
    await registerPrefix(app, "svc", { kind: "leaf" });
    await registerPrefix(app, "role", { kind: "leaf" });
    await registerPrefix(app, "perm", { kind: "composite" });

    // leaf draft
    await createDraft(app, "svc", "v1", 10);
    await createDraft(app, "role", "v1", 5);

    // composite draft (refs → leaf)
    const compRes = await createDraft(app, "perm", "v1", 0, {
      refs: [{ prefix: "svc", versionId: "v1" }, { prefix: "role", versionId: "v1" }],
    });
    expect(compRes.status).toBe(201);
    const comp = await json(compRes);
    expect(comp.capacity).toBe(50); // 10 × 5
    expect(comp.shape).toEqual([10, 5]);
    expect(comp.stride).toEqual([5, 1]);

    // DAG 조회
    const depsRes = await app.request("/dag/perm/v1/deps");
    const deps = await json(depsRes);
    expect(deps).toHaveLength(2);
    expect(deps.map((d: any) => d.prefix).toSorted()).toEqual(["role", "svc"]);

    // simulate: role 5→8
    const simRes = await app.request("/workspace/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes: { role: { capacity: 8 } } }),
    });
    expect(simRes.status).toBe(200);
    const sim = await json(simRes);
    expect(sim.impact.length).toBeGreaterThan(0);
    const permImpact = sim.impact.find((i: any) => i.prefix === "perm");
    expect(permImpact.newShape).toEqual([10, 8]);
    expect(permImpact.newProduct).toBe(80);

    // analyze
    const analyzeRes = await app.request("/workspace/analyze", { method: "POST" });
    expect(analyzeRes.status).toBe(200);
    const analysis = await json(analyzeRes);
    expect(analysis.ready).toBe(true);
    expect(analysis.drafts.length).toBe(3);

    // lock-all → release-all
    const lockRes = await app.request("/workspace/lock-all", { method: "POST" });
    expect(lockRes.status).toBe(200);

    const releaseRes = await app.request("/workspace/release-all", { method: "POST" });
    expect(releaseRes.status).toBe(200);
  });
});

describe("SQL Integration — Schema Import/Export", () => {
  it("import → export roundtrip", async () => {
    const { app } = await buildSqlApp();

    const snapshot = {
      id: "test-schema",
      axes: [
        { id: "env", entries: ["dev", "staging", "prod"], capacity: 4 },
        { id: "region", entries: ["us", "eu"], capacity: 4 },
      ],
      composites: [
        { id: "infra", dims: ["env", "region"], owner: "platform" },
      ],
    };

    // import
    const importRes = await app.request("/schema/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, versionId: "v1" }),
    });
    expect(importRes.status).toBe(201);
    const importBody = await json(importRes);
    expect(importBody.imported.axes).toBe(2);
    expect(importBody.imported.composites).toBe(1);

    // export
    const exportRes = await app.request("/schema/export?versionId=v1");
    expect(exportRes.status).toBe(200);
    const exported = await json(exportRes);
    expect(exported.axes).toHaveLength(2);
    expect(exported.composites).toHaveLength(1);
    expect(exported.composites[0].dims).toEqual(["env", "region"]);
  });
});

describe("SQL Integration — Lock 동시성", () => {
  it("lock 상태에서 patch 차단", async () => {
    const { app } = await buildSqlApp();

    await registerPrefix(app, "role");
    await createDraft(app, "role", "v1", 8);

    // lock
    await app.request("/prefixes/role/versions/v1/lock", { method: "POST" });

    // patch 시도 → 차단
    const patchRes = await app.request("/prefixes/role/versions/v1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 16 }),
    });
    expect(patchRes.status).toBe(409);

    // unlock → patch 가능
    await app.request("/prefixes/role/versions/v1/unlock", { method: "POST" });

    const patchRes2 = await app.request("/prefixes/role/versions/v1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 16 }),
    });
    expect(patchRes2.status).toBe(200);
    const patched = await json(patchRes2);
    expect(patched.capacity).toBe(16);
  });
});

describe("SQL Integration — Capacity SSOT 정합성", () => {
  it("prefixRegistry capacity가 versionStore와 동기화됨", async () => {
    const { app } = await buildSqlApp();

    await registerPrefix(app, "tag");
    await createDraft(app, "tag", "v1", 16);

    // patch로 capacity 변경
    await app.request("/prefixes/tag/versions/v1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capacity: 32 }),
    });

    // getVersion이 정확한 capacity를 반환하는지 확인
    const res = await app.request("/prefixes/tag/versions/v1");
    const ver = await json(res);
    expect(ver.capacity).toBe(32);
  });
});
