// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { beforeEach, describe, expect, it } from "vitest";
import { InvalidTransitionError } from "./state.js";
import {
  DuplicatePolicyError,
  InMemoryResourcePolicyRegistry,
  PolicyNotFoundError,
} from "./registry.js";

const NOW = "2026-04-22T10:00:00Z";
const LATER = "2026-04-22T11:00:00Z";

describe("InMemoryResourcePolicyRegistry", () => {
  let registry: InMemoryResourcePolicyRegistry;

  beforeEach(() => {
    registry = new InMemoryResourcePolicyRegistry();
  });

  describe("create / resolve", () => {
    it("create는 UNREGISTERED policy를 생성하고 resolve로 조회 가능", async () => {
      await registry.create({ resourceId: "d-1", resourceType: "doc", ownerId: "u-1", now: NOW });
      const p = await registry.resolve("d-1");
      expect(p?.state).toBe("UNREGISTERED");
      expect(p?.ownerId).toBe("u-1");
    });

    it("존재하지 않는 ID는 null 반환", async () => {
      expect(await registry.resolve("missing")).toBeNull();
    });

    it("중복 생성은 DuplicatePolicyError", async () => {
      await registry.create({ resourceId: "d-1", resourceType: "doc", ownerId: "u-1", now: NOW });
      await expect(
        registry.create({ resourceId: "d-1", resourceType: "doc", ownerId: "u-2", now: NOW }),
      ).rejects.toThrow(DuplicatePolicyError);
    });
  });

  describe("register", () => {
    it("UNREGISTERED → REGISTERED 정상 전이", async () => {
      await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
      const r = await registry.register("d", { cerbosPolicyRef: "policy-v1", now: LATER });
      expect(r.state).toBe("REGISTERED");
      expect(r.cerbosPolicyRef).toBe("policy-v1");
    });

    it("존재하지 않는 리소스는 PolicyNotFoundError", async () => {
      await expect(
        registry.register("missing", { cerbosPolicyRef: "p", now: NOW }),
      ).rejects.toThrow(PolicyNotFoundError);
    });

    it("이미 REGISTERED인 리소스에 재호출 시 InvalidTransitionError", async () => {
      await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
      await registry.register("d", { cerbosPolicyRef: "p1", now: NOW });
      await expect(
        registry.register("d", { cerbosPolicyRef: "p2", now: LATER }),
      ).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe("delegate", () => {
    it("REGISTERED → DELEGATED 정상 전이, cerbosPolicyRef 유지", async () => {
      await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
      await registry.register("d", { cerbosPolicyRef: "p1", now: NOW });
      const d = await registry.delegate("d", { graphRootId: "root-1", now: LATER });
      expect(d.state).toBe("DELEGATED");
      expect(d.graphRootId).toBe("root-1");
      expect(d.cerbosPolicyRef).toBe("p1");
    });

    it("UNREGISTERED에서 바로 delegate는 InvalidTransitionError (중간 건너뛰기 금지)", async () => {
      await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
      await expect(
        registry.delegate("d", { graphRootId: "root-1", now: LATER }),
      ).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe("remove", () => {
    it("remove 후 resolve는 null", async () => {
      await registry.create({ resourceId: "d", resourceType: "doc", ownerId: "u", now: NOW });
      await registry.remove("d");
      expect(await registry.resolve("d")).toBeNull();
    });

    it("없는 리소스 remove는 no-op (idempotent)", async () => {
      await expect(registry.remove("missing")).resolves.toBeUndefined();
    });
  });

  describe("listByOwner", () => {
    it("동일 owner의 리소스만 반환", async () => {
      await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u-1", now: NOW });
      await registry.create({ resourceId: "d2", resourceType: "doc", ownerId: "u-1", now: NOW });
      await registry.create({ resourceId: "d3", resourceType: "doc", ownerId: "u-2", now: NOW });
      const mine = await registry.listByOwner("u-1");
      expect(mine).toHaveLength(2);
      expect(mine.map((p) => p.resourceId).toSorted()).toEqual(["d1", "d2"]);
    });
  });

  describe("listByState", () => {
    it("상태별 필터링", async () => {
      await registry.create({ resourceId: "d1", resourceType: "doc", ownerId: "u", now: NOW });
      await registry.create({ resourceId: "d2", resourceType: "doc", ownerId: "u", now: NOW });
      await registry.create({ resourceId: "d3", resourceType: "doc", ownerId: "u", now: NOW });
      await registry.register("d2", { cerbosPolicyRef: "p", now: NOW });

      const unreg = await registry.listByState("UNREGISTERED");
      const reg = await registry.listByState("REGISTERED");
      expect(unreg).toHaveLength(2);
      expect(reg).toHaveLength(1);
      expect(reg[0].resourceId).toBe("d2");
    });
  });
});
