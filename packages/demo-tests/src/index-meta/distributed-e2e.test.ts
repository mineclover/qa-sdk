/**
 * E2E: D1 분산 구조
 *
 * 구조:
 *   PrefixRegistry (중앙) — capacity 조회
 *   PrefixRouter          — prefix → D1 database 라우팅
 *   D1 인스턴스 A ("db-a") — role, action entry
 *   D1 인스턴스 B ("db-b") — content entry
 *   DistributedStoreClient — 라우팅 + 조회 통합
 *
 * composite(perm)는 중앙 registry에만 capacity 등록 — D1 entry 없음.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryPrefixRegistry,
  InMemoryPrefixRouter,
  InMemoryIndexMetaStore,
  DistributedStoreClient,
  applyEntryBatch,
  exportVersion,
  importVersion,
  ValidationError,
} from "index-meta";

// ── 분산 환경 셋업 ────────────────────────────────────────

function createDistributedEnv() {
  const registry = new InMemoryPrefixRegistry();
  const router   = new InMemoryPrefixRouter();

  // D1 인스턴스 2개 (지역별 분리 시뮬레이션)
  const dbA = new InMemoryIndexMetaStore(); // role, action
  const dbB = new InMemoryIndexMetaStore(); // content

  const stores = new Map([
    ["db-a", dbA],
    ["db-b", dbB],
  ]);

  const client = new DistributedStoreClient(registry, router, stores);

  return { registry, router, dbA, dbB, client };
}

// ── 픽스처 데이터 ─────────────────────────────────────────

const ROLE_PAYLOAD    = { capacity: 8,   entries: { "1": "guest", "2": "viewer", "3": "editor", "4": "admin", "5": "_" } };
const ACTION_PAYLOAD  = { capacity: 4,   entries: { "1": "read", "2": "write", "3": "delete", "4": "manage" } };
const CONTENT_PAYLOAD = { capacity: 100, entries: { "1": "article", "2": "video", "3": "~", "50": "podcast" } };

// ── 라우팅 ───────────────────────────────────────────────

describe("PrefixRouter — 라우팅", () => {
  it("prefix마다 다른 D1 인스턴스로 라우팅된다", async () => {
    const { router } = createDistributedEnv();
    await router.route("role",    "db-a");
    await router.route("action",  "db-a");
    await router.route("content", "db-b");

    expect(await router.getDatabase("role")).toBe("db-a");
    expect(await router.getDatabase("content")).toBe("db-b");
    expect(await router.getDatabase("unknown")).toBeNull();
  });

  it("listPrefixes로 D1 인스턴스별 담당 prefix를 조회한다", async () => {
    const { router } = createDistributedEnv();
    await router.route("role",    "db-a");
    await router.route("action",  "db-a");
    await router.route("content", "db-b");

    const dbAPrefixes = (await router.listPrefixes("db-a")).toSorted();
    expect(dbAPrefixes).toEqual(["action", "role"]);
    expect(await router.listPrefixes("db-b")).toEqual(["content"]);
  });

  it("라우팅 변경 시 새 D1로 이동된다", async () => {
    const { router } = createDistributedEnv();
    await router.route("role", "db-a");
    await router.route("role", "db-b"); // 변경

    expect(await router.getDatabase("role")).toBe("db-b");
  });
});

// ── DistributedStoreClient ────────────────────────────────

describe("DistributedStoreClient — 분산 조회", () => {
  let env: ReturnType<typeof createDistributedEnv>;

  beforeEach(async () => {
    env = createDistributedEnv();
    const { registry, router, dbA, dbB } = env;

    // 라우팅 설정
    await router.route("role",    "db-a");
    await router.route("action",  "db-a");
    await router.route("content", "db-b");

    // DB-A에 role, action 적재
    await applyEntryBatch("role",   "v1", ROLE_PAYLOAD,   registry, dbA, "2026-01-01T00:00:00Z");
    await applyEntryBatch("action", "v1", ACTION_PAYLOAD, registry, dbA, "2026-01-01T00:00:00Z");

    // DB-B에 content 적재
    await applyEntryBatch("content", "v1", CONTENT_PAYLOAD, registry, dbB, "2026-01-01T00:00:00Z");

    // composite(perm)는 중앙 registry에만 등록 (entry 없음)
    await registry.register({ prefix: "perm", versionId: "v1", capacity: 8 * 4 });
  });

  it("capacity는 중앙 registry에서 D1 라우팅 없이 조회된다", async () => {
    const { client } = env;
    expect(await client.getCapacity("role",    "v1")).toBe(8);
    expect(await client.getCapacity("action",  "v1")).toBe(4);
    expect(await client.getCapacity("content", "v1")).toBe(100);
    expect(await client.getCapacity("perm",    "v1")).toBe(32); // composite
  });

  it("getEntries는 올바른 D1 인스턴스로 라우팅된다", async () => {
    const { client } = env;

    const roleEntries    = await client.getEntries("role",    "v1");
    const actionEntries  = await client.getEntries("action",  "v1");
    const contentEntries = await client.getEntries("content", "v1");

    expect(roleEntries.map((e) => e.value)).toContain("guest");
    expect(actionEntries.map((e) => e.value)).toContain("read");
    expect(contentEntries.map((e) => e.value)).toContain("article");
  });

  it("DB-A와 DB-B의 데이터는 격리되어 있다", async () => {
    const { dbA, dbB } = env;

    // db-a에는 role, action만
    expect(await dbA.getEntries("content", "v1")).toHaveLength(0);

    // db-b에는 content만
    expect(await dbB.getEntries("role", "v1")).toHaveLength(0);
  });

  it("라우팅되지 않은 prefix는 ValidationError", async () => {
    const { client } = env;
    await expect(client.getEntries("unknown", "v1")).rejects.toThrow(ValidationError);
  });

  it("getEntriesInRange도 올바른 D1로 라우팅된다", async () => {
    const { client } = env;

    const range = await client.getEntriesInRange("content", "v1", 1, 5);
    expect(range.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(range.find((e) => e.position === 50)).toBeUndefined(); // 범위 밖
  });

  it("listPrefixesByDatabase로 D1 인스턴스 단위 백업 범위를 파악한다", async () => {
    const { client } = env;

    const dbAPrefixes = (await client.listPrefixesByDatabase("db-a")).toSorted();
    expect(dbAPrefixes).toEqual(["action", "role"]);
    expect(await client.listPrefixesByDatabase("db-b")).toEqual(["content"]);
  });
});

// ── DistributedStoreClient — 엣지 케이스 ─────────────────

describe("DistributedStoreClient — edge cases", () => {
  it("등록되지 않은 prefix로 getEntries 요청 시 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    const router   = new InMemoryPrefixRouter();
    const stores   = new Map([["db-a", new InMemoryIndexMetaStore()]]);
    const client   = new DistributedStoreClient(registry, router, stores);

    // router에 "role"이 등록되지 않음
    await expect(client.getEntries("role", "v1")).rejects.toThrow(ValidationError);
    await expect(client.getEntries("role", "v1")).rejects.toThrow(
      /no D1 database routed for prefix "role"/
    );
  });

  it("등록되지 않은 prefix로 getEntry 요청 시 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    const router   = new InMemoryPrefixRouter();
    const stores   = new Map([["db-a", new InMemoryIndexMetaStore()]]);
    const client   = new DistributedStoreClient(registry, router, stores);

    await expect(client.getEntry("role", "v1", 1)).rejects.toThrow(ValidationError);
  });

  it("등록되지 않은 prefix로 getEntriesInRange 요청 시 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    const router   = new InMemoryPrefixRouter();
    const stores   = new Map([["db-a", new InMemoryIndexMetaStore()]]);
    const client   = new DistributedStoreClient(registry, router, stores);

    await expect(client.getEntriesInRange("role", "v1", 1, 10)).rejects.toThrow(ValidationError);
  });

  it("라우터에 매핑된 store가 stores에 없으면 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    const router   = new InMemoryPrefixRouter();
    // stores에는 "db-a"만 있지만, router는 "db-z"로 매핑
    const stores   = new Map([["db-a", new InMemoryIndexMetaStore()]]);
    const client   = new DistributedStoreClient(registry, router, stores);

    await router.route("role", "db-z"); // db-z는 stores에 없음

    await expect(client.getEntries("role", "v1")).rejects.toThrow(ValidationError);
    await expect(client.getEntries("role", "v1")).rejects.toThrow(
      /D1 database "db-z" not registered in stores/
    );
  });

  it("라우터에 매핑된 store가 stores에 없으면 getEntry도 ValidationError", async () => {
    const registry = new InMemoryPrefixRegistry();
    const router   = new InMemoryPrefixRouter();
    const stores   = new Map([["db-a", new InMemoryIndexMetaStore()]]);
    const client   = new DistributedStoreClient(registry, router, stores);

    await router.route("action", "db-missing");

    await expect(client.getEntry("action", "v1", 1)).rejects.toThrow(ValidationError);
    await expect(client.getEntry("action", "v1", 1)).rejects.toThrow(
      /D1 database "db-missing" not registered in stores/
    );
  });

  it("여러 prefix가 서로 다른 store로 올바르게 라우팅된다", async () => {
    const registry = new InMemoryPrefixRegistry();
    const router   = new InMemoryPrefixRouter();
    const dbA      = new InMemoryIndexMetaStore();
    const dbB      = new InMemoryIndexMetaStore();
    const stores   = new Map([["db-a", dbA], ["db-b", dbB]]);
    const client   = new DistributedStoreClient(registry, router, stores);

    // 라우팅: role → db-a, content → db-b
    await router.route("role",    "db-a");
    await router.route("content", "db-b");

    // 각 DB에 독립 데이터 적재
    await applyEntryBatch("role",    "v1", ROLE_PAYLOAD,    registry, dbA, "2026-01-01T00:00:00Z");
    await applyEntryBatch("content", "v1", CONTENT_PAYLOAD, registry, dbB, "2026-01-01T00:00:00Z");

    // role은 db-a에서 가져와야 함
    const roleEntries = await client.getEntries("role", "v1");
    expect(roleEntries.length).toBe(Object.keys(ROLE_PAYLOAD.entries).length);
    expect(roleEntries.map((e) => e.value)).toContain("admin");

    // content는 db-b에서 가져와야 함
    const contentEntries = await client.getEntries("content", "v1");
    expect(contentEntries.length).toBe(Object.keys(CONTENT_PAYLOAD.entries).length);
    expect(contentEntries.map((e) => e.value)).toContain("article");

    // 교차 격리: db-a에는 content가 없고, db-b에는 role이 없음
    expect(await dbA.getEntries("content", "v1")).toHaveLength(0);
    expect(await dbB.getEntries("role", "v1")).toHaveLength(0);

    // getEntry도 올바른 store로 라우팅
    const roleEntry = await client.getEntry("role", "v1", 1);
    expect(roleEntry).not.toBeNull();
    expect(roleEntry!.value).toBe("guest");

    const contentEntry = await client.getEntry("content", "v1", 50);
    expect(contentEntry).not.toBeNull();
    expect(contentEntry!.value).toBe("podcast");
  });
});

// ── 분산 환경 백업/복원 ───────────────────────────────────

describe("분산 환경 — versionId 단위 백업/복원", () => {
  it("DB-A의 role/v1을 백업하고 새 환경에 복원한다", async () => {
    const src = createDistributedEnv();
    await src.router.route("role", "db-a");
    await applyEntryBatch("role", "v1", ROLE_PAYLOAD, src.registry, src.dbA, "2026-01-01T00:00:00Z");

    // 백업 (versionId 단위)
    const backup = await exportVersion("role", "v1", src.registry, src.dbA);

    // 새 환경에 복원
    const dst = createDistributedEnv();
    await dst.router.route("role", "db-a");
    await importVersion(backup, dst.registry, dst.dbA);

    // capacity 복원 확인
    expect(await dst.client.getCapacity("role", "v1")).toBe(8);

    // entry 복원 확인
    const restored = await dst.client.getEntries("role", "v1");
    const original = await src.client.getEntries("role", "v1");
    expect(restored.map((e) => ({ position: e.position, value: e.value })))
      .toEqual(original.map((e) => ({ position: e.position, value: e.value })));
  });

  it("DB별로 독립 백업 후 순서 무관하게 복원할 수 있다", async () => {
    const src = createDistributedEnv();
    await src.router.route("role",    "db-a");
    await src.router.route("content", "db-b");
    await applyEntryBatch("role",    "v1", ROLE_PAYLOAD,    src.registry, src.dbA, "2026-01-01T00:00:00Z");
    await applyEntryBatch("content", "v1", CONTENT_PAYLOAD, src.registry, src.dbB, "2026-01-01T00:00:00Z");

    const backupRole    = await exportVersion("role",    "v1", src.registry, src.dbA);
    const backupContent = await exportVersion("content", "v1", src.registry, src.dbB);

    // content 먼저, role 나중에 복원 (순서 무관)
    const dst = createDistributedEnv();
    await dst.router.route("role",    "db-a");
    await dst.router.route("content", "db-b");
    await importVersion(backupContent, dst.registry, dst.dbB);
    await importVersion(backupRole,    dst.registry, dst.dbA);

    expect(await dst.registry.getCapacity("role",    "v1")).toBe(8);
    expect(await dst.registry.getCapacity("content", "v1")).toBe(100);
    expect(await dst.dbA.getEntries("role",    "v1")).toHaveLength(Object.keys(ROLE_PAYLOAD.entries).length);
    expect(await dst.dbB.getEntries("content", "v1")).toHaveLength(Object.keys(CONTENT_PAYLOAD.entries).length);
  });
});
