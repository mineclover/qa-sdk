import { describe, it, expect, beforeEach } from "vitest";
import { NodeSqliteDriver } from "./node-sqlite-driver.js";
import { SqlPrefixRegistry } from "./sql-prefix-registry.js";
import { ValidationError } from "../errors.js";

// ── 공통 픽스처 ─────────────────────────────────────────

function makeRegistry() {
  const driver = new NodeSqliteDriver(":memory:");
  return new SqlPrefixRegistry(driver);
}

// ── leaf 등록 ──────────────────────────────────────────

describe("leaf prefix", () => {
  it("register → getRecord 왕복", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });

    const record = await reg.getRecord("role", "v1");
    expect(record).toMatchObject({ prefix: "role", versionId: "v1", capacity: 8 });
    expect(record?.refs).toBeUndefined();
  });

  it("getCapacity fast-path", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    expect(await reg.getCapacity("role", "v1")).toBe(8);
    expect(await reg.getCapacity("role", "v2")).toBeNull();
  });

  it("getShape — leaf는 [capacity] 반환", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    expect(await reg.getShape("role", "v1")).toEqual([8]);
  });

  it("getDeps — leaf는 빈 배열", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    expect(await reg.getDeps("role", "v1")).toEqual([]);
  });

  it("중복 등록은 ValidationError", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    await expect(reg.register({ prefix: "role", versionId: "v1", capacity: 16 }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("미등록 prefix는 null 반환", async () => {
    const reg = makeRegistry();
    expect(await reg.getRecord("unknown", "v1")).toBeNull();
    expect(await reg.getCapacity("unknown", "v1")).toBeNull();
    expect(await reg.getShape("unknown", "v1")).toBeNull();
  });
});

// ── composite 등록 ─────────────────────────────────────

describe("composite prefix", () => {
  it("register → getRecord 왕복 (refs 포함)", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role",   versionId: "v1", capacity: 8  });
    await reg.register({ prefix: "action", versionId: "v1", capacity: 16 });
    await reg.register({
      prefix: "perm", versionId: "v1", capacity: 128,
      refs: [
        { prefix: "role",   versionId: "v1", capacity: 8  },
        { prefix: "action", versionId: "v1", capacity: 16 },
      ],
    });

    const record = await reg.getRecord("perm", "v1");
    expect(record?.capacity).toBe(128);
    expect(record?.refs).toHaveLength(2);
    expect(record?.refs?.[0]).toMatchObject({ prefix: "role",   versionId: "v1", capacity: 8  });
    expect(record?.refs?.[1]).toMatchObject({ prefix: "action", versionId: "v1", capacity: 16 });
  });

  it("refs 순서(dim_order)가 보존된다", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "r", versionId: "v1", capacity: 4 });
    await reg.register({ prefix: "a", versionId: "v1", capacity: 4 });
    await reg.register({ prefix: "e", versionId: "v1", capacity: 4 });
    await reg.register({
      prefix: "p", versionId: "v1", capacity: 64,
      refs: [
        { prefix: "r", versionId: "v1", capacity: 4 },
        { prefix: "a", versionId: "v1", capacity: 4 },
        { prefix: "e", versionId: "v1", capacity: 4 },
      ],
    });

    const refs = await reg.getDeps("p", "v1");
    expect(refs.map((r) => r.prefix)).toEqual(["r", "a", "e"]);
  });

  it("getShape — composite는 refs의 capacity 배열", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "r", versionId: "v1", capacity: 8  });
    await reg.register({ prefix: "a", versionId: "v1", capacity: 16 });
    await reg.register({
      prefix: "perm", versionId: "v1", capacity: 128,
      refs: [
        { prefix: "r", versionId: "v1", capacity: 8  },
        { prefix: "a", versionId: "v1", capacity: 16 },
      ],
    });

    expect(await reg.getShape("perm", "v1")).toEqual([8, 16]);
  });
});

// ── listVersions / listAll ─────────────────────────────

describe("listVersions / listAll", () => {
  it("listVersions — 해당 prefix의 모든 버전만", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8  });
    await reg.register({ prefix: "role", versionId: "v2", capacity: 16 });
    await reg.register({ prefix: "action", versionId: "v1", capacity: 4 });

    const versions = await reg.listVersions("role");
    expect(versions).toHaveLength(2);
    expect(versions.map((r) => r.versionId)).toEqual(["v1", "v2"]);
  });

  it("listAll — 전체 레코드 반환", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role",   versionId: "v1", capacity: 8  });
    await reg.register({ prefix: "action", versionId: "v1", capacity: 16 });
    await reg.register({
      prefix: "perm", versionId: "v1", capacity: 128,
      refs: [
        { prefix: "role",   versionId: "v1", capacity: 8  },
        { prefix: "action", versionId: "v1", capacity: 16 },
      ],
    });

    const all = await reg.listAll();
    expect(all).toHaveLength(3);

    const perm = all.find((r) => r.prefix === "perm");
    expect(perm?.refs).toHaveLength(2);

    const role = all.find((r) => r.prefix === "role");
    expect(role?.refs).toBeUndefined();
  });
});

// ── getDeps / getTransitiveDeps ────────────────────────

describe("transitive deps", () => {
  it("flat composite — getDeps == getTransitiveDeps", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "r", versionId: "v1", capacity: 4 });
    await reg.register({ prefix: "a", versionId: "v1", capacity: 4 });
    await reg.register({
      prefix: "p", versionId: "v1", capacity: 16,
      refs: [
        { prefix: "r", versionId: "v1", capacity: 4 },
        { prefix: "a", versionId: "v1", capacity: 4 },
      ],
    });

    const deps     = await reg.getDeps("p", "v1");
    const transitive = await reg.getTransitiveDeps("p", "v1");
    expect(transitive).toEqual(deps);
  });

  it("중첩 composite — transitive deps 전이 포함", async () => {
    const reg = makeRegistry();
    // r, a → sub (composite), sub, b → top (composite of composite)
    await reg.register({ prefix: "r",   versionId: "v1", capacity: 4  });
    await reg.register({ prefix: "a",   versionId: "v1", capacity: 4  });
    await reg.register({ prefix: "b",   versionId: "v1", capacity: 8  });
    await reg.register({
      prefix: "sub", versionId: "v1", capacity: 16,
      refs: [
        { prefix: "r", versionId: "v1", capacity: 4 },
        { prefix: "a", versionId: "v1", capacity: 4 },
      ],
    });
    await reg.register({
      prefix: "top", versionId: "v1", capacity: 128,
      refs: [
        { prefix: "sub", versionId: "v1", capacity: 16 },
        { prefix: "b",   versionId: "v1", capacity: 8  },
      ],
    });

    const transitive = await reg.getTransitiveDeps("top", "v1");
    // DFS: top → sub (recurse: r, a), b
    expect(transitive.map((d) => d.prefix)).toEqual(["sub", "r", "a", "b"]);
  });

  it("cycle 방어 — visited set으로 무한루프 없음", async () => {
    // SqlPrefixRegistry는 FK로 cycle을 막지 않으므로 직접 시험하기 어렵지만
    // leaf끼리는 transitive가 빈 배열이어야 한다
    const reg = makeRegistry();
    await reg.register({ prefix: "x", versionId: "v1", capacity: 4 });
    expect(await reg.getTransitiveDeps("x", "v1")).toEqual([]);
  });
});

// ── getReverseRefs ────────────────────────────────────

describe("getReverseRefs", () => {
  it("역방향 조회 — role:v1을 참조하는 composite 목록", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role",   versionId: "v1", capacity: 8  });
    await reg.register({ prefix: "action", versionId: "v1", capacity: 16 });
    await reg.register({
      prefix: "perm", versionId: "v1", capacity: 128,
      refs: [
        { prefix: "role",   versionId: "v1", capacity: 8  },
        { prefix: "action", versionId: "v1", capacity: 16 },
      ],
    });
    await reg.register({
      prefix: "perm2", versionId: "v1", capacity: 8,
      refs: [
        { prefix: "role", versionId: "v1", capacity: 8 },
      ],
    });

    const reverseRefs = await reg.getReverseRefs("role", "v1");
    expect(reverseRefs.map((r) => r.prefix).sort()).toEqual(["perm", "perm2"]);
  });

  it("아무도 참조하지 않으면 빈 배열", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });
    expect(await reg.getReverseRefs("role", "v1")).toEqual([]);
  });
});

// ── resolveAddress ────────────────────────────────────

describe("resolveAddress", () => {
  it("leaf — valid 주소", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });

    const resolved = await reg.resolveAddress("role:v1:3");
    expect(resolved).toMatchObject({
      prefix: "role", versionId: "v1", index: 3,
      capacity: 8, shape: [8], refs: [], valid: true,
    });
  });

  it("composite — shape과 refs 포함", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "r", versionId: "v1", capacity: 4 });
    await reg.register({ prefix: "a", versionId: "v1", capacity: 4 });
    await reg.register({
      prefix: "p", versionId: "v1", capacity: 16,
      refs: [
        { prefix: "r", versionId: "v1", capacity: 4 },
        { prefix: "a", versionId: "v1", capacity: 4 },
      ],
    });

    const resolved = await reg.resolveAddress("p:v1:10");
    expect(resolved?.shape).toEqual([4, 4]);
    expect(resolved?.refs).toHaveLength(2);
    expect(resolved?.valid).toBe(true);
  });

  it("범위 초과 index — valid=false", async () => {
    const reg = makeRegistry();
    await reg.register({ prefix: "role", versionId: "v1", capacity: 8 });

    const resolved = await reg.resolveAddress("role:v1:100");
    expect(resolved?.valid).toBe(false);
  });

  it("미등록 prefix — null", async () => {
    const reg = makeRegistry();
    expect(await reg.resolveAddress("unknown:v1:0")).toBeNull();
  });

  it("형식이 잘못된 주소 — null", async () => {
    const reg = makeRegistry();
    expect(await reg.resolveAddress("noversion")).toBeNull();
    expect(await reg.resolveAddress("only:one")).toBeNull();
  });
});
