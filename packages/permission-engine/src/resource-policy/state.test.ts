// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { describe, expect, it } from "vitest";
import {
  InvalidTransitionError,
  canAccessUnregistered,
  canTransition,
  createUnregistered,
  delegate,
  register,
  type ResourcePolicy,
} from "./state.js";

const NOW = "2026-04-22T10:00:00Z";
const LATER = "2026-04-22T11:00:00Z";

describe("ResourcePolicy FSM", () => {
  describe("createUnregistered", () => {
    it("초기 상태는 UNREGISTERED, owner만 설정", () => {
      const p = createUnregistered({
        resourceId: "doc-1",
        resourceType: "document",
        ownerId: "user-1",
        now: NOW,
      });
      expect(p.state).toBe("UNREGISTERED");
      expect(p.ownerId).toBe("user-1");
      expect(p.cerbosPolicyRef).toBeUndefined();
      expect(p.graphRootId).toBeUndefined();
      expect(p.updatedAt).toBe(NOW);
    });
  });

  describe("canTransition", () => {
    it("허용: UNREGISTERED → REGISTERED", () => {
      expect(canTransition("UNREGISTERED", "REGISTERED")).toBe(true);
    });

    it("허용: REGISTERED → DELEGATED", () => {
      expect(canTransition("REGISTERED", "DELEGATED")).toBe(true);
    });

    it("금지: UNREGISTERED → DELEGATED (중간 상태 건너뛰기)", () => {
      expect(canTransition("UNREGISTERED", "DELEGATED")).toBe(false);
    });

    it("금지: REGISTERED → UNREGISTERED (역전이)", () => {
      expect(canTransition("REGISTERED", "UNREGISTERED")).toBe(false);
    });

    it("금지: DELEGATED → REGISTERED (역전이)", () => {
      expect(canTransition("DELEGATED", "REGISTERED")).toBe(false);
    });

    it("금지: DELEGATED → UNREGISTERED (역전이)", () => {
      expect(canTransition("DELEGATED", "UNREGISTERED")).toBe(false);
    });

    it("금지: 자기 자신으로의 전이", () => {
      expect(canTransition("UNREGISTERED", "UNREGISTERED")).toBe(false);
      expect(canTransition("REGISTERED", "REGISTERED")).toBe(false);
      expect(canTransition("DELEGATED", "DELEGATED")).toBe(false);
    });
  });

  describe("register (UNREGISTERED → REGISTERED)", () => {
    it("합법 전이: state와 cerbosPolicyRef 설정", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "u", now: NOW });
      const r = register(p, { cerbosPolicyRef: "policy-v1", now: LATER });
      expect(r.state).toBe("REGISTERED");
      expect(r.cerbosPolicyRef).toBe("policy-v1");
      expect(r.registeredAt).toBe(LATER);
      expect(r.updatedAt).toBe(LATER);
      expect(r.ownerId).toBe("u");
    });

    it("이미 REGISTERED인 리소스에 호출하면 예외", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "u", now: NOW });
      const r1 = register(p, { cerbosPolicyRef: "policy-v1", now: NOW });
      expect(() => register(r1, { cerbosPolicyRef: "policy-v2", now: LATER }))
        .toThrow(InvalidTransitionError);
    });

    it("DELEGATED 상태에 호출하면 예외 (역전이 금지)", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "u", now: NOW });
      const r = register(p, { cerbosPolicyRef: "p", now: NOW });
      const d = delegate(r, { graphRootId: "root-1", now: NOW });
      expect(() => register(d, { cerbosPolicyRef: "p2", now: LATER }))
        .toThrow(InvalidTransitionError);
    });
  });

  describe("delegate (REGISTERED → DELEGATED)", () => {
    it("합법 전이: state와 graphRootId 설정, cerbosPolicyRef 유지", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "u", now: NOW });
      const r = register(p, { cerbosPolicyRef: "policy-v1", now: NOW });
      const d = delegate(r, { graphRootId: "root-1", now: LATER });
      expect(d.state).toBe("DELEGATED");
      expect(d.graphRootId).toBe("root-1");
      expect(d.cerbosPolicyRef).toBe("policy-v1");
      expect(d.delegatedAt).toBe(LATER);
      expect(d.registeredAt).toBeDefined();
    });

    it("UNREGISTERED 상태에 호출하면 예외 (중간 건너뛰기 금지)", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "u", now: NOW });
      expect(() => delegate(p, { graphRootId: "root-1", now: LATER }))
        .toThrow(InvalidTransitionError);
    });

    it("REGISTERED인데 cerbosPolicyRef가 없으면 예외 (데이터 무결성)", () => {
      // 정상 경로로는 생성 불가능하지만 손상된 데이터 방어
      const broken: ResourcePolicy = {
        resourceId: "d",
        resourceType: "t",
        state: "REGISTERED",
        ownerId: "u",
        cerbosPolicyRef: undefined,
        updatedAt: NOW,
      };
      expect(() => delegate(broken, { graphRootId: "root-1", now: LATER }))
        .toThrow(InvalidTransitionError);
    });
  });

  describe("canAccessUnregistered", () => {
    it("owner 일치 시 true", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "user-1", now: NOW });
      expect(canAccessUnregistered(p, "user-1")).toBe(true);
    });

    it("owner 불일치 시 false", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "user-1", now: NOW });
      expect(canAccessUnregistered(p, "user-2")).toBe(false);
    });

    it("UNREGISTERED가 아닌 상태에 호출하면 예외 (오용 방지)", () => {
      const p = createUnregistered({ resourceId: "d", resourceType: "t", ownerId: "user-1", now: NOW });
      const r = register(p, { cerbosPolicyRef: "policy", now: NOW });
      expect(() => canAccessUnregistered(r, "user-1")).toThrow();
    });
  });
});
