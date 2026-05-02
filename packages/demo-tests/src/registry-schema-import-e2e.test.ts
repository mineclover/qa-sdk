// @def.boundary validation-layer-group
// @def.doc validation-layer-group

// DEPRECATED: Hono createApp → NestJS 전환으로 비활성화. registry-service 자체 테스트(25파일, 212건)로 대체.

/**
 * Registry Schema Import E2E — qa-sdk-git 프리셋 import → resolve 전체 워크플로우
 *
 * 1. qa-sdk-git 프리셋을 SchemaSnapshot으로 변환
 * 2. POST /schema/import → leaf/composite 등록 + draft 생성
 * 3. lock → release → activate → resolve/active
 * 4. GET /schema/export → 라운드트립 검증
 */

import { describe, it, expect } from "vitest";
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from "index-meta";
import type { Hono } from "hono";
import { createApp, InMemoryPrefixOwnerStore, InMemoryDraftLockStore } from "@qa-sdk/registry-service";
import pino from "pino";

// ── qa-sdk-git 프리셋 (registry-ui/src/store.ts와 동일) ──

const QA_SDK_GIT_SNAPSHOT = {
  id: "qa-sdk-git",
  axes: [
    { id: "pkg", entries: [
      "weighted-index", "bit-index", "index-meta", "permission-engine",
      "core", "engine", "sdk", "store", "registry-client", "event-catalog", "pino",
      "ingest-server", "registry-service", "decode-service", "gate-service", "query-service",
      "platform-demo", "browser-sdk", "viz-web", "demo-snapshot",
    ], capacity: 67108864 },
    { id: "semver", entries: ["0.1.0", "0.2.0"], capacity: 32768 },
    { id: "cc_type", entries: ["feat", "fix", "refactor", "docs", "test", "chore"], capacity: 1024 },
    { id: "tier", entries: ["foundation", "platform", "service", "app", "data"], capacity: 8192 },
    { id: "runtime", entries: ["library", "server", "browser"], capacity: 64 },
  ],
  composites: [
    { id: "change_map", dims: ["pkg", "semver", "cc_type"], owner: "registry" },
    { id: "pkg_class", dims: ["pkg", "tier", "runtime"], owner: "registry" },
  ],
};

// ── helpers ─────────────────────────────────────────────────

function buildApp() {
  const prefixRegistry = new InMemoryPrefixRegistry();
  const versionStore = new InMemoryVersionLifecycleStore();
  const ownerStore = new InMemoryPrefixOwnerStore();
  const lockStore = new InMemoryDraftLockStore();
  const logger = pino({ level: "silent" });
  const app = createApp({ prefixRegistry, versionStore, ownerStore, lockStore, logger });
  return { app, prefixRegistry, versionStore, ownerStore, lockStore };
}

async function json(res: Response) {
  return res.json();
}

async function post(app: Hono, path: string, body?: object) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ══════════════════════════════════════════════════════════════
// §1. Schema Import — qa-sdk-git 프리셋
// ══════════════════════════════════════════════════════════════

describe.skip("Schema Import E2E — qa-sdk-git", () => {
  it("import → 전체 prefix/composite 등록 + analyze 결과 반환", async () => {
    const { app } = buildApp();

    const res = await post(app, "/schema/import", {
      snapshot: QA_SDK_GIT_SNAPSHOT,
      versionId: "v1",
    });
    expect(res.status).toBe(201);
    const body = await json(res);

    // imported 요약
    expect(body.imported.axes).toBe(5);
    expect(body.imported.composites).toBe(2);
    expect(body.imported.versionId).toBe("v1");

    // analysis 결과
    expect(body.analysis.drafts).toHaveLength(7); // 5 axes + 2 composites
    expect(body.analysis.ready).toBe(true);
  });

  it("import → lock-all → release-all → activate → resolve", async () => {
    const { app } = buildApp();

    // 1. Import
    await post(app, "/schema/import", {
      snapshot: QA_SDK_GIT_SNAPSHOT,
      versionId: "v1",
    });

    // 2. Verify composite capacities
    const changeMap = await json(await app.request("/prefixes/change_map/versions/v1"));
    expect(changeMap.capacity).toBe(67108864 * 32768 * 1024); // pkg × semver × cc_type
    expect(changeMap.shape).toEqual([67108864, 32768, 1024]);

    const pkgClass = await json(await app.request("/prefixes/pkg_class/versions/v1"));
    expect(pkgClass.capacity).toBe(67108864 * 8192 * 64); // pkg × tier × runtime
    expect(pkgClass.shape).toEqual([67108864, 8192, 64]);

    // 3. Lock all
    const lockRes = await post(app, "/workspace/lock-all");
    const lockBody = await json(lockRes);
    expect(lockBody.locked).toHaveLength(7);

    // 4. Release all
    const releaseRes = await post(app, "/workspace/release-all");
    const releaseBody = await json(releaseRes);
    expect(releaseBody.released).toHaveLength(7);

    // 5. Activate all
    const allPrefixes = [
      "pkg", "semver", "cc_type", "tier", "runtime",
      "change_map", "pkg_class",
    ];
    for (const p of allPrefixes) {
      const r = await post(app, `/prefixes/${p}/versions/v1/activate`);
      expect(r.status).toBe(200);
    }

    // 6. Resolve active
    const resolved = await json(await app.request("/resolve/active"));
    expect(Object.keys(resolved)).toHaveLength(7);

    // change_map composite 검증
    expect(resolved.change_map.versionId).toBe("v1");
    expect(resolved.change_map.shape).toEqual([67108864, 32768, 1024]);

    // pkg_class composite 검증
    expect(resolved.pkg_class.versionId).toBe("v1");
    expect(resolved.pkg_class.shape).toEqual([67108864, 8192, 64]);
  });

  it("import idempotent — 동일 versionId 재import 시 에러 없음", async () => {
    const { app } = buildApp();

    // 첫 번째 import
    const res1 = await post(app, "/schema/import", {
      snapshot: QA_SDK_GIT_SNAPSHOT,
      versionId: "v1",
    });
    expect(res1.status).toBe(201);

    // 두 번째 import (동일 versionId) — idempotent
    const res2 = await post(app, "/schema/import", {
      snapshot: QA_SDK_GIT_SNAPSHOT,
      versionId: "v1",
    });
    expect(res2.status).toBe(201);
  });

  // ══════════════════════════════════════════════════════════
  // §2. Schema Export — 라운드트립
  // ══════════════════════════════════════════════════════════

  it("export → import한 구조가 보존됨", async () => {
    const { app } = buildApp();

    // Import
    await post(app, "/schema/import", {
      snapshot: QA_SDK_GIT_SNAPSHOT,
      versionId: "v1",
    });

    // Export (특정 versionId)
    const exported = await json(await app.request("/schema/export?versionId=v1"));

    expect(exported.id).toBe("v1");
    expect(exported.axes).toHaveLength(5);
    expect(exported.composites).toHaveLength(2);

    // axis IDs 보존
    const axisIds = exported.axes.map((a: any) => a.id).toSorted();
    expect(axisIds).toEqual(["cc_type", "pkg", "runtime", "semver", "tier"]);

    // composite IDs 보존
    const compIds = exported.composites.map((c: any) => c.id).toSorted();
    expect(compIds).toEqual(["change_map", "pkg_class"]);

    // composite dims 보존
    const changeMap = exported.composites.find((c: any) => c.id === "change_map");
    expect(changeMap.dims).toEqual(["pkg", "semver", "cc_type"]);

    const pkgClass = exported.composites.find((c: any) => c.id === "pkg_class");
    expect(pkgClass.dims).toEqual(["pkg", "tier", "runtime"]);
  });

  it("export active — activate 후 export", async () => {
    const { app } = buildApp();

    // Import + release + activate
    await post(app, "/schema/import", {
      snapshot: QA_SDK_GIT_SNAPSHOT,
      versionId: "v1",
    });
    await post(app, "/workspace/lock-all");
    await post(app, "/workspace/release-all");

    const allPrefixes = ["pkg", "semver", "cc_type", "tier", "runtime", "change_map", "pkg_class"];
    for (const p of allPrefixes) {
      await post(app, `/prefixes/${p}/versions/v1/activate`);
    }

    // Export without versionId → active 기준
    const exported = await json(await app.request("/schema/export"));
    expect(exported.id).toBe("active");
    expect(exported.axes).toHaveLength(5);
    expect(exported.composites).toHaveLength(2);
  });
});
