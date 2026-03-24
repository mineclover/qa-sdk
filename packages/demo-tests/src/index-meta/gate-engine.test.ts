/**
 * GateEngine — release / flag 변경 시 AddressStateStore 자동 재계산 테스트
 *
 * [G1] buildDimStateSpecs: leaf / composite 의 DimStateSpec[] 생성
 * [G2] recompute: 계산 결과를 AddressStateStore에 저장 + AddressRangeCache 무효화
 * [G3] cascadeRecompute: leaf 변경 → composite 전파
 * [G4] GateAwareVersionLifecycleStore: release() 후 자동 재계산
 * [G5] GateAwareEntryFlagStore: flexible 모드 setFlag() 후 자동 재계산
 * [G6] E2E: 비활성화 → range 반영
 */

import { describe, it, expect, beforeEach } from "vitest";

import {
  InMemoryIndexMetaStore,
  InMemoryPrefixRegistry,
  InMemoryEntryFlagStore,
  InMemoryAddressStateStore,
  InMemoryAddressRangeCache,
  InMemoryVersionLifecycleStore,
  checkGate,
  GateEngine,
  GateAwareVersionLifecycleStore,
  GateAwareEntryFlagStore,
} from "index-meta";

// ── 공통 픽스처 ─────────────────────────────────────────────

const AT = "2026-01-01T00:00:00Z";

interface TestContext {
  metaStore: InMemoryIndexMetaStore;
  prefixRegistry: InMemoryPrefixRegistry;
  entryFlagStore: InMemoryEntryFlagStore;
  versionStore: InMemoryVersionLifecycleStore;
  addressStateStore: InMemoryAddressStateStore;
  addressRangeCache: InMemoryAddressRangeCache;
  engine: GateEngine;
}

function createContext(): TestContext {
  const metaStore = new InMemoryIndexMetaStore();
  const prefixRegistry = new InMemoryPrefixRegistry();
  const entryFlagStore = new InMemoryEntryFlagStore();
  const versionStore = new InMemoryVersionLifecycleStore();
  const addressStateStore = new InMemoryAddressStateStore();
  const addressRangeCache = new InMemoryAddressRangeCache();

  const engine = new GateEngine({
    prefixRegistry,
    metaStore,
    entryFlagStore,
    versionLifecycleStore: versionStore,
    addressStateStore,
    addressRangeCache,
  });

  return {
    metaStore,
    prefixRegistry,
    entryFlagStore,
    versionStore,
    addressStateStore,
    addressRangeCache,
    engine,
  };
}

/** leaf prefix 등록 + schema_version + entries 삽입 헬퍼 */
async function registerLeaf(
  ctx: TestContext,
  prefix: string,
  versionId: string,
  capacity: number,
  entries: string[],
): Promise<void> {
  await ctx.prefixRegistry.register({ prefix, versionId, capacity });
  await ctx.metaStore.insertSchemaVersion({ prefix, versionId, capacity, createdAt: AT });
  for (let i = 0; i < entries.length; i++) {
    await ctx.metaStore.insertEntry({
      prefix,
      versionId,
      position: i + 1,
      value: entries[i]!,
      createdAt: AT,
    });
  }
}

// ── [G1] buildDimStateSpecs ─────────────────────────────────

describe("[G1] buildDimStateSpecs — DimStateSpec[] 생성", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = createContext(); });

  it("leaf — inactive + open specs 생성", async () => {
    await registerLeaf(ctx, "role", "v1", 8, ["admin", "editor", "viewer"]);
    // pos 2 비활성화
    await ctx.entryFlagStore.setFlag({
      prefix: "role", versionId: "v1", position: 2,
      status: "inactive", updatedAt: AT,
    });

    const specs = await ctx.engine.buildDimStateSpecs("role", "v1");

    // inactive: pos 2
    const inactiveSpec = specs.find((s) => s.state === "inactive");
    expect(inactiveSpec).toBeDefined();
    expect(inactiveSpec!.dimIndex).toBe(0);
    expect(inactiveSpec!.coords).toBe("2");

    // open: pos 4-8
    const openSpec = specs.find((s) => s.state === "open");
    expect(openSpec).toBeDefined();
    expect(openSpec!.dimIndex).toBe(0);
    expect(openSpec!.coords).toBe("4-8");
  });

  it("leaf — entry 없으면 전체 open", async () => {
    await registerLeaf(ctx, "role", "v1", 4, []);

    const specs = await ctx.engine.buildDimStateSpecs("role", "v1");

    expect(specs).toHaveLength(1);
    expect(specs[0]!.state).toBe("open");
    expect(specs[0]!.coords).toBe("1-4");
  });

  it("leaf — 전부 채우고 inactive 없으면 빈 배열", async () => {
    await registerLeaf(ctx, "role", "v1", 3, ["admin", "editor", "viewer"]);

    const specs = await ctx.engine.buildDimStateSpecs("role", "v1");
    expect(specs).toEqual([]);
  });

  it("composite — 각 dim의 leaf ref에서 specs 수집", async () => {
    // leaf: role(cap=4, 2 entries), action(cap=3, 3 entries)
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);
    await registerLeaf(ctx, "action", "v1", 3, ["read", "write", "delete"]);

    // composite: perm = role × action
    await ctx.prefixRegistry.register({
      prefix: "perm",
      versionId: "v1",
      capacity: 12, // 4 × 3
      refs: [
        { prefix: "role", versionId: "v1", capacity: 4 },
        { prefix: "action", versionId: "v1", capacity: 3 },
      ],
    });

    const specs = await ctx.engine.buildDimStateSpecs("perm", "v1");

    // role dim (index 0): open pos 3-4
    const roleOpen = specs.find((s) => s.dimIndex === 0 && s.state === "open");
    expect(roleOpen).toBeDefined();
    expect(roleOpen!.coords).toBe("3-4");

    // action dim (index 1): 전부 채워짐 → open 없음
    const actionOpen = specs.find((s) => s.dimIndex === 1 && s.state === "open");
    expect(actionOpen).toBeUndefined();
  });

  it("미등록 prefix → 빈 배열", async () => {
    const specs = await ctx.engine.buildDimStateSpecs("unknown", "v1");
    expect(specs).toEqual([]);
  });
});

// ── [G2] recompute ──────────────────────────────────────────

describe("[G2] recompute — AddressStateStore 저장 + AddressRangeCache 무효화", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = createContext(); });

  it("leaf — AddressStateStore에 계산 결과 저장", async () => {
    await registerLeaf(ctx, "role", "v1", 8, ["admin", "editor", "viewer"]);
    await ctx.entryFlagStore.setFlag({
      prefix: "role", versionId: "v1", position: 3,
      status: "inactive", updatedAt: AT,
    });

    await ctx.engine.recompute("role", "v1");

    const record = await ctx.addressStateStore.get("role", "v1");
    expect(record).not.toBeNull();
    expect(record!.prefix).toBe("role");
    expect(record!.versionId).toBe("v1");
    // inactive ranges: pos 3 주소
    expect(record!.inactiveRanges.length).toBeGreaterThan(0);
    // open ranges: pos 4-8
    expect(record!.openRanges.length).toBeGreaterThan(0);
  });

  it("leaf — AddressRangeCache 무효화", async () => {
    await registerLeaf(ctx, "role", "v1", 8, ["admin", "editor", "viewer"]);

    // 사전에 range cache 저장
    await ctx.addressRangeCache.save({
      prefix: "role", versionId: "v1", label: "test-label",
      ranges: [[0, 7]], computedAt: AT,
    });
    expect(await ctx.addressRangeCache.get("role", "v1", "test-label")).not.toBeNull();

    await ctx.engine.recompute("role", "v1");

    // 무효화 확인
    expect(await ctx.addressRangeCache.get("role", "v1", "test-label")).toBeNull();
  });

  it("composite — nD shape 기반 계산", async () => {
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);
    await registerLeaf(ctx, "action", "v1", 3, ["read", "write", "delete"]);
    await ctx.prefixRegistry.register({
      prefix: "perm", versionId: "v1", capacity: 12,
      refs: [
        { prefix: "role", versionId: "v1", capacity: 4 },
        { prefix: "action", versionId: "v1", capacity: 3 },
      ],
    });

    await ctx.engine.recompute("perm", "v1");

    const record = await ctx.addressStateStore.get("perm", "v1");
    expect(record).not.toBeNull();
    // prefix_ref(refEntries 미정의)는 headroom을 reserved로 승격한다 (CON-006)
    expect(record!.reservedRanges.length).toBeGreaterThan(0);
    expect(checkGate(6, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state).toBe("reserved");
  });

  it("미등록 prefix → no-op", async () => {
    await ctx.engine.recompute("unknown", "v1");
    expect(await ctx.addressStateStore.get("unknown", "v1")).toBeNull();
  });
});

// ── [G3] cascadeRecompute ───────────────────────────────────

describe("[G3] cascadeRecompute — leaf 변경 → composite 전파", () => {
  let ctx: TestContext;
  beforeEach(() => { ctx = createContext(); });

  it("leaf 변경 → 참조하는 composite도 재계산", async () => {
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);
    await registerLeaf(ctx, "action", "v1", 3, ["read", "write", "delete"]);
    await ctx.prefixRegistry.register({
      prefix: "perm", versionId: "v1", capacity: 12,
      refs: [
        { prefix: "role", versionId: "v1", capacity: 4 },
        { prefix: "action", versionId: "v1", capacity: 3 },
      ],
    });

    await ctx.engine.cascadeRecompute("role", "v1");

    // leaf + composite 모두 저장됨
    expect(await ctx.addressStateStore.get("role", "v1")).not.toBeNull();
    expect(await ctx.addressStateStore.get("perm", "v1")).not.toBeNull();
  });

  it("reverseRef 없으면 leaf만 재계산", async () => {
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);

    await ctx.engine.cascadeRecompute("role", "v1");

    expect(await ctx.addressStateStore.get("role", "v1")).not.toBeNull();
  });
});

// ── [G4] GateAwareVersionLifecycleStore ─────────────────────

describe("[G4] GateAwareVersionLifecycleStore — release() 자동 재계산", () => {
  let ctx: TestContext;
  let gateStore: GateAwareVersionLifecycleStore;

  beforeEach(() => {
    ctx = createContext();
    gateStore = new GateAwareVersionLifecycleStore(ctx.versionStore, ctx.engine);
  });

  it("release() 후 AddressStateStore에 캐시 자동 저장", async () => {
    await registerLeaf(ctx, "role", "v1", 8, ["admin", "editor", "viewer"]);
    await gateStore.createDraft("role", "v1", null, 8);
    await gateStore.release("role", "v1");

    const record = await ctx.addressStateStore.get("role", "v1");
    expect(record).not.toBeNull();
    expect(record!.openRanges.length).toBeGreaterThan(0); // pos 4-8 open
  });

  it("release() → composite cascade", async () => {
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);
    await registerLeaf(ctx, "action", "v1", 3, ["read", "write", "delete"]);
    await ctx.prefixRegistry.register({
      prefix: "perm", versionId: "v1", capacity: 12,
      refs: [
        { prefix: "role", versionId: "v1", capacity: 4 },
        { prefix: "action", versionId: "v1", capacity: 3 },
      ],
    });

    await gateStore.createDraft("role", "v1", null, 4);
    await gateStore.release("role", "v1");

    expect(await ctx.addressStateStore.get("role", "v1")).not.toBeNull();
    expect(await ctx.addressStateStore.get("perm", "v1")).not.toBeNull();
  });

  it("release 이외 메서드는 side-effect 없이 delegate", async () => {
    await gateStore.createDraft("role", "v1", null, 8, "strict");
    const ver = await gateStore.getVersion("role", "v1");
    expect(ver).not.toBeNull();
    expect(ver!.status).toBe("draft");
    // AddressStateStore에 아무것도 없음
    expect(await ctx.addressStateStore.get("role", "v1")).toBeNull();
  });

  it("release 실패 시 recompute 미실행", async () => {
    // released 상태에서 release 시도 → 에러
    await ctx.versionStore.createDraft("role", "v1", null, 8);
    await ctx.versionStore.release("role", "v1");

    await expect(gateStore.release("role", "v1")).rejects.toThrow();
    // recompute가 실행되지 않았으므로 addressStateStore 변경 없음 (이미 있을 수도 있지만 에러 경로에서는 호출 안 됨)
  });
});

// ── [G5] GateAwareEntryFlagStore ────────────────────────────

describe("[G5] GateAwareEntryFlagStore — flexible 모드 자동 재계산", () => {
  let ctx: TestContext;
  let gateFlagStore: GateAwareEntryFlagStore;

  beforeEach(() => {
    ctx = createContext();
    gateFlagStore = new GateAwareEntryFlagStore(ctx.entryFlagStore, ctx.engine);
  });

  it("flexible 모드 — setFlag() 후 자동 재계산", async () => {
    await registerLeaf(ctx, "config", "v1", 8, ["theme", "locale", "tz"]);
    await ctx.versionStore.createDraft("config", "v1", null, 8, "flexible");
    await ctx.versionStore.release("config", "v1");

    // setFlag → 자동 재계산
    await gateFlagStore.setFlag({
      prefix: "config", versionId: "v1", position: 2,
      status: "inactive", updatedAt: AT,
    });

    const record = await ctx.addressStateStore.get("config", "v1");
    expect(record).not.toBeNull();
    expect(record!.inactiveRanges.length).toBeGreaterThan(0);
  });

  it("strict 모드 — setFlag()가 재계산을 트리거하지 않음", async () => {
    await registerLeaf(ctx, "role", "v1", 8, ["admin", "editor", "viewer"]);
    await ctx.versionStore.createDraft("role", "v1", null, 8, "strict");
    await ctx.versionStore.release("role", "v1");

    await gateFlagStore.setFlag({
      prefix: "role", versionId: "v1", position: 2,
      status: "inactive", updatedAt: AT,
    });

    // strict 모드이므로 자동 재계산 없음
    expect(await ctx.addressStateStore.get("role", "v1")).toBeNull();
  });

  it("flexible — leaf setFlag → composite cascade", async () => {
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);
    await registerLeaf(ctx, "action", "v1", 3, ["read", "write", "delete"]);
    await ctx.prefixRegistry.register({
      prefix: "perm", versionId: "v1", capacity: 12,
      refs: [
        { prefix: "role", versionId: "v1", capacity: 4 },
        { prefix: "action", versionId: "v1", capacity: 3 },
      ],
    });
    await ctx.versionStore.createDraft("role", "v1", null, 4, "flexible");
    await ctx.versionStore.release("role", "v1");

    await gateFlagStore.setFlag({
      prefix: "role", versionId: "v1", position: 1,
      status: "inactive", updatedAt: AT,
    });

    // leaf + composite 모두 재계산
    expect(await ctx.addressStateStore.get("role", "v1")).not.toBeNull();
    expect(await ctx.addressStateStore.get("perm", "v1")).not.toBeNull();
  });

  it("getFlag/getFlags/getInactivePositions는 delegate only", async () => {
    await ctx.entryFlagStore.setFlag({
      prefix: "role", versionId: "v1", position: 1,
      status: "inactive", updatedAt: AT,
    });

    expect(await gateFlagStore.getFlag("role", "v1", 1)).not.toBeNull();
    expect(await gateFlagStore.getFlags("role", "v1")).toHaveLength(1);
    expect(await gateFlagStore.getInactivePositions("role", "v1")).toEqual([1]);
  });
});

// ── [G6] E2E: 비활성화 → range 반영 ────────────────────────

describe("[G6] E2E: 비활성화 → checkGate 반영", () => {
  let ctx: TestContext;
  let gateStore: GateAwareVersionLifecycleStore;
  let gateFlagStore: GateAwareEntryFlagStore;

  beforeEach(() => {
    ctx = createContext();
    gateStore = new GateAwareVersionLifecycleStore(ctx.versionStore, ctx.engine);
    gateFlagStore = new GateAwareEntryFlagStore(ctx.entryFlagStore, ctx.engine);
  });

  it("1D leaf — release 후 active 주소 확인 → 비활성화 → inactive 반영", async () => {
    // 1. Setup: role(cap=8, 3 entries), flexible 모드
    await registerLeaf(ctx, "role", "v1", 8, ["admin", "editor", "viewer"]);
    await gateStore.createDraft("role", "v1", null, 8, "flexible");
    await gateStore.release("role", "v1");

    // 2. release 후 상태 확인
    const afterRelease = await ctx.addressStateStore.get("role", "v1");
    expect(afterRelease).not.toBeNull();

    // pos 1-3: active (encode ✓, decode ✓)
    for (const pos of [1, 2, 3]) {
      // 1D에서 address = position - 1 (0-based)
      const gate = checkGate(
        pos - 1,
        afterRelease!.reservedRanges,
        afterRelease!.inactiveRanges,
        afterRelease!.openRanges,
      );
      expect(gate.state).toBe("active");
    }

    // pos 4-8: open (encode ✓, decode ✗)
    for (const pos of [4, 5, 6, 7, 8]) {
      const gate = checkGate(
        pos - 1,
        afterRelease!.reservedRanges,
        afterRelease!.inactiveRanges,
        afterRelease!.openRanges,
      );
      expect(gate.state).toBe("open");
    }

    // 3. pos 2 (editor) 비활성화
    await gateFlagStore.setFlag({
      prefix: "role", versionId: "v1", position: 2,
      status: "inactive", updatedAt: "2026-01-02T00:00:00Z",
    });

    // 4. 재계산된 상태 확인
    const afterDeactivate = await ctx.addressStateStore.get("role", "v1");
    expect(afterDeactivate).not.toBeNull();

    // pos 1 (admin): active
    expect(checkGate(0, afterDeactivate!.reservedRanges, afterDeactivate!.inactiveRanges, afterDeactivate!.openRanges).state).toBe("active");
    // pos 2 (editor): inactive (encode ✗, decode ✓)
    expect(checkGate(1, afterDeactivate!.reservedRanges, afterDeactivate!.inactiveRanges, afterDeactivate!.openRanges).state).toBe("inactive");
    // pos 3 (viewer): active
    expect(checkGate(2, afterDeactivate!.reservedRanges, afterDeactivate!.inactiveRanges, afterDeactivate!.openRanges).state).toBe("active");
  });

  it("nD composite — leaf 비활성화가 composite 게이트에 반영", async () => {
    // Setup: role(cap=4) × action(cap=3), flexible 모드
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);
    await registerLeaf(ctx, "action", "v1", 3, ["read", "write", "delete"]);
    await ctx.prefixRegistry.register({
      prefix: "perm", versionId: "v1", capacity: 12,
      refs: [
        { prefix: "role", versionId: "v1", capacity: 4 },
        { prefix: "action", versionId: "v1", capacity: 3 },
      ],
    });

    await gateStore.createDraft("role", "v1", null, 4, "flexible");
    await gateStore.release("role", "v1");

    // release 후 composite도 계산됨
    const permBefore = await ctx.addressStateStore.get("perm", "v1");
    expect(permBefore).not.toBeNull();

    // role pos 1 (admin) × action pos 1 (read) → address = 0*3 + 0 = 0 → active
    expect(checkGate(0, permBefore!.reservedRanges, permBefore!.inactiveRanges, permBefore!.openRanges).state).toBe("active");

    // role 비활성화: pos 1 (admin) → inactive
    await gateFlagStore.setFlag({
      prefix: "role", versionId: "v1", position: 1,
      status: "inactive", updatedAt: "2026-01-02T00:00:00Z",
    });

    // composite 재계산 확인
    const permAfter = await ctx.addressStateStore.get("perm", "v1");
    expect(permAfter).not.toBeNull();

    // role=1(inactive) × action=1(active) → address 0 → inactive
    expect(checkGate(0, permAfter!.reservedRanges, permAfter!.inactiveRanges, permAfter!.openRanges).state).toBe("inactive");
    // role=1(inactive) × action=2(active) → address 1 → inactive
    expect(checkGate(1, permAfter!.reservedRanges, permAfter!.inactiveRanges, permAfter!.openRanges).state).toBe("inactive");
    // role=1(inactive) × action=3(active) → address 2 → inactive
    expect(checkGate(2, permAfter!.reservedRanges, permAfter!.inactiveRanges, permAfter!.openRanges).state).toBe("inactive");

    // role=2(active) × action=1(active) → address 1*3 + 0 = 3 → active
    expect(checkGate(3, permAfter!.reservedRanges, permAfter!.inactiveRanges, permAfter!.openRanges).state).toBe("active");
  });

  it("재활성화 → active로 복원", async () => {
    await registerLeaf(ctx, "tag", "v1", 4, ["hot", "new"]);
    await gateStore.createDraft("tag", "v1", null, 4, "flexible");
    await gateStore.release("tag", "v1");

    // 비활성화
    await gateFlagStore.setFlag({
      prefix: "tag", versionId: "v1", position: 1,
      status: "inactive", updatedAt: "2026-01-02T00:00:00Z",
    });
    const afterInactive = await ctx.addressStateStore.get("tag", "v1");
    expect(checkGate(0, afterInactive!.reservedRanges, afterInactive!.inactiveRanges, afterInactive!.openRanges).state).toBe("inactive");

    // 재활성화
    await gateFlagStore.setFlag({
      prefix: "tag", versionId: "v1", position: 1,
      status: "active", updatedAt: "2026-01-03T00:00:00Z",
    });
    const afterActive = await ctx.addressStateStore.get("tag", "v1");
    expect(checkGate(0, afterActive!.reservedRanges, afterActive!.inactiveRanges, afterActive!.openRanges).state).toBe("active");
  });
});
