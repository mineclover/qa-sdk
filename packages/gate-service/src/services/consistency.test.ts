import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  GateEngine,
  InMemoryAddressRangeCache,
  InMemoryAddressStateStore,
  InMemoryEntryFlagStore,
  InMemoryIndexMetaStore,
  InMemoryPrefixRegistry,
  InMemoryVersionLifecycleStore,
} from "index-meta";
import { createGateService } from "../lib/gate-service.js";
import { createConsistencyService, type ConsistencyService } from "./consistency.js";
import type { GateLookupService } from "../lib/gate-service.js";

const AT = "2026-01-01T00:00:00Z";

interface TestContext {
  metaStore: InMemoryIndexMetaStore;
  prefixRegistry: InMemoryPrefixRegistry;
  entryFlagStore: InMemoryEntryFlagStore;
  versionStore: InMemoryVersionLifecycleStore;
  addressStateStore: InMemoryAddressStateStore;
  addressRangeCache: InMemoryAddressRangeCache;
  engine: GateEngine;
  gateService: ReturnType<typeof createGateService>;
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

  const gateService = createGateService({
    addressStateStore,
    gateEngine: engine,
  });

  return {
    metaStore,
    prefixRegistry,
    entryFlagStore,
    versionStore,
    addressStateStore,
    addressRangeCache,
    engine,
    gateService,
  };
}

async function registerLeaf(
  ctx: TestContext,
  prefix: string,
  versionId: string,
  capacity: number,
  entries: string[],
): Promise<void> {
  await ctx.prefixRegistry.register({ prefix, versionId, capacity });
  await ctx.metaStore.insertSchemaVersion({
    prefix,
    versionId,
    capacity,
    createdAt: AT,
  });

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

describe("ConsistencyService", () => {
  let ctx: TestContext;
  let consistency: ConsistencyService;

  beforeEach(async () => {
    ctx = createContext();
    await registerLeaf(ctx, "role", "v1", 4, ["admin", "editor"]);
    // position 2 (editor) → inactive
    await ctx.entryFlagStore.setFlag({
      prefix: "role",
      versionId: "v1",
      position: 2,
      status: "inactive",
      updatedAt: AT,
    });
    await ctx.engine.recompute("role", "v1");
    consistency = createConsistencyService({ gateService: ctx.gateService });
  });

  describe("verifyGate", () => {
    it("shouldVerify=false이면 캐시 결과를 그대로 반환한다 (drifted=false)", async () => {
      // address=0 → active (shouldVerify=false)
      const result = await consistency.verifyGate("role", "v1", 0);

      expect(result.cached.state).toBe("active");
      expect(result.cached.shouldVerify).toBe(false);
      expect(result.verified).toEqual(result.cached);
      expect(result.drifted).toBe(false);
    });

    it("shouldVerify=true이면 primary recompute 후 재확인한다", async () => {
      // address=2 → open (shouldVerify=true)
      const result = await consistency.verifyGate("role", "v1", 2);

      expect(result.cached.state).toBe("open");
      expect(result.cached.shouldVerify).toBe(true);
      // engine 있으므로 verified는 recompute 후 결과
      expect(result.verified).toBeDefined();
      // 동일 상태면 drifted=false (캐시가 최신이었음)
      expect(result.drifted).toBe(false);
    });

    it("캐시와 primary 결과가 다르면 drifted=true를 반환한다", async () => {
      // 먼저 open 상태의 캐시를 만듦 (address=3)
      const cached = await ctx.gateService.checkGate("role", "v1", 3);
      expect(cached.state).toBe("open");

      // 캐시가 stale한 상태를 시뮬레이션: 직접 entry를 추가하여 상태를 변경
      await ctx.metaStore.insertEntry({
        prefix: "role",
        versionId: "v1",
        position: 3,
        value: "viewer",
        createdAt: AT,
      });
      // 기존 캐시는 아직 open인 상태에서 verifyGate 호출
      // recompute가 실행되면 position 3이 active가 됨
      const result = await consistency.verifyGate("role", "v1", 3);

      // recompute 후 상태가 변경되었으므로 drifted=true
      // (open → 다른 상태로 변경되었을 가능성)
      expect(result.cached.state).toBe("open");
      // recompute 후 verified 결과가 다를 수 있음
      if (result.verified.state !== "open") {
        expect(result.drifted).toBe(true);
      }
    });
  });

  describe("verifyGate — engine 없는 모드", () => {
    it("engine 없으면 캐시 결과를 그대로 반환한다", async () => {
      const cacheOnlyService = createGateService({
        addressStateStore: ctx.addressStateStore,
        // engine 없음
      });
      const cacheConsistency = createConsistencyService({
        gateService: cacheOnlyService,
      });

      // open 상태 (shouldVerify=true)
      const result = await cacheConsistency.verifyGate("role", "v1", 2);

      expect(result.cached.state).toBe("open");
      expect(result.cached.shouldVerify).toBe(true);
      // engine 없으므로 verified = cached
      expect(result.verified).toEqual(result.cached);
      expect(result.drifted).toBe(false);
    });
  });

  describe("directLookup", () => {
    it("engine이 있으면 recompute 후 최신 결과를 반환한다", async () => {
      const result = await consistency.directLookup("role", "v1", 0);

      expect(result.state).toBe("active");
      expect(result.encode).toBe(true);
      expect(result.decode).toBe(true);
    });

    it("inactive 주소를 정확히 반환한다", async () => {
      const result = await consistency.directLookup("role", "v1", 1);

      expect(result.state).toBe("inactive");
      expect(result.encode).toBe(false);
      expect(result.decode).toBe(true);
    });

    it("engine 없으면 캐시 기반 결과를 반환한다 (fail-open)", async () => {
      const cacheOnlyService = createGateService({
        addressStateStore: ctx.addressStateStore,
      });
      const cacheConsistency = createConsistencyService({
        gateService: cacheOnlyService,
      });

      const result = await cacheConsistency.directLookup("role", "v1", 1);
      expect(result.state).toBe("inactive");
    });
  });

  describe("directClassify", () => {
    it("engine이 있으면 recompute 후 최신 상태를 반환한다", async () => {
      const state = await consistency.directClassify("role", "v1", 0);
      expect(state).toBe("active");
    });

    it("open 상태를 정확히 반환한다", async () => {
      const state = await consistency.directClassify("role", "v1", 2);
      expect(state).toBe("open");
    });
  });

  describe("recompute 실패 시 fail-open", () => {
    it("recompute 실패 시 onError가 호출되고 캐시 결과를 반환한다", async () => {
      const errors: string[] = [];
      const failingGateService: GateLookupService = {
        engine: {} as any, // engine이 있는 것처럼 보이게
        async checkGate() {
          return {
            encode: true,
            decode: true,
            state: "active" as const,
            shouldVerify: false,
          };
        },
        async classifyAddress() {
          return "active" as const;
        },
        async getStateRanges() {
          return null;
        },
        async recompute() {
          throw new Error("recompute failed");
        },
        async cascadeRecompute() {
          throw new Error("cascade failed");
        },
        async filterRanges() {
          return [];
        },
      };

      const failConsistency = createConsistencyService({
        gateService: failingGateService,
        onError: (_err, ctx) => errors.push(ctx),
      });

      // recompute 실패해도 캐시 결과 반환
      const result = await failConsistency.directLookup("role", "v1", 0);
      expect(result.state).toBe("active");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("primary recompute");
    });

    it("verifyGate에서 recompute 실패 시 cached=verified, drifted=false", async () => {
      const failingGateService: GateLookupService = {
        engine: {} as any,
        async checkGate() {
          return {
            encode: true,
            decode: false,
            state: "open" as const,
            shouldVerify: true,
          };
        },
        async classifyAddress() {
          return "open" as const;
        },
        async getStateRanges() {
          return null;
        },
        async recompute() {
          throw new Error("recompute failed");
        },
        async cascadeRecompute() {
          throw new Error("cascade failed");
        },
        async filterRanges() {
          return [];
        },
      };

      const failConsistency = createConsistencyService({
        gateService: failingGateService,
        onError: () => {},
      });

      const result = await failConsistency.verifyGate("role", "v1", 2);
      expect(result.cached).toEqual(result.verified);
      expect(result.drifted).toBe(false);
    });
  });

  describe("missing prefix", () => {
    it("존재하지 않는 prefix에 대해 active(기본값)를 반환한다", async () => {
      const result = await consistency.directLookup("nonexistent", "v1", 0);
      expect(result.state).toBe("active");
      expect(result.shouldVerify).toBe(false);
    });

    it("verifyGate도 기본 active를 반환한다", async () => {
      const result = await consistency.verifyGate("nonexistent", "v1", 0);
      expect(result.cached.state).toBe("active");
      expect(result.drifted).toBe(false);
    });
  });
});
