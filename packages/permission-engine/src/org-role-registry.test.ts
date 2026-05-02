// @def.boundary permission-engine-spec
// @def.doc permission-engine-spec

import { describe, it, expect } from "vitest";
import { OrgRoleRegistry } from "./org-role-registry.js";

// ── 픽스처 ───────────────────────────────────────────────────────────────────

function buildOrgRoles(): OrgRoleRegistry {
  const r = new OrgRoleRegistry();
  r.register({
    id: "member",
    parents: [],
    ownAssignments: [
      { domain: "project", role: "viewer" },
      { domain: "billing", role: "viewer" },
    ],
  });
  r.register({
    id: "team_lead",
    parents: ["member"],
    ownAssignments: [
      { domain: "project", role: "author" },
    ],
  });
  r.register({
    id: "div_head",
    parents: ["team_lead"],
    ownAssignments: [
      { domain: "project", role: "manager" },
      { domain: "billing", role: "approver" },
    ],
  });
  return r;
}

// ── OrgRoleRegistry ──────────────────────────────────────────────────────────

describe("OrgRoleRegistry", () => {
  describe("resolve — 배정 확장", () => {
    it("루트 org role은 ownAssignments만 반환한다", () => {
      const r = buildOrgRoles();
      const resolved = r.resolve("member");
      expect(resolved.get("project")).toEqual(new Set(["viewer"]));
      expect(resolved.get("billing")).toEqual(new Set(["viewer"]));
    });

    it("team_lead는 member 배정을 상속한다", () => {
      const r = buildOrgRoles();
      const resolved = r.resolve("team_lead");
      // member에서 상속
      expect(resolved.get("billing")?.has("viewer")).toBe(true);
      // own + 상속: project에 viewer(member) + author(own) 둘 다
      expect(resolved.get("project")?.has("viewer")).toBe(true);
      expect(resolved.get("project")?.has("author")).toBe(true);
    });

    it("div_head는 전체 체인을 상속한다", () => {
      const r = buildOrgRoles();
      const resolved = r.resolve("div_head");
      // project: viewer(member) + author(team_lead) + manager(own)
      const projectRoles = resolved.get("project");
      expect(projectRoles?.has("viewer")).toBe(true);
      expect(projectRoles?.has("author")).toBe(true);
      expect(projectRoles?.has("manager")).toBe(true);
      // billing: viewer(member) + approver(own)
      const billingRoles = resolved.get("billing");
      expect(billingRoles?.has("viewer")).toBe(true);
      expect(billingRoles?.has("approver")).toBe(true);
    });

    it("결과가 캐시된다 (동일 참조)", () => {
      const r = buildOrgRoles();
      expect(r.resolve("team_lead")).toBe(r.resolve("team_lead"));
    });
  });

  describe("resolveForDomain", () => {
    it("특정 도메인의 role 목록만 반환한다", () => {
      const r = buildOrgRoles();
      const projectRoles = r.resolveForDomain("team_lead", "project");
      expect(projectRoles).toContain("viewer");
      expect(projectRoles).toContain("author");
      expect(projectRoles).not.toContain("manager");
    });

    it("배정 없는 도메인은 빈 배열", () => {
      const r = buildOrgRoles();
      expect(r.resolveForDomain("member", "nonexistent")).toEqual([]);
    });
  });

  describe("와일드카드 도메인 금지", () => {
    it("domain='*' 등록 시 즉시 throw", () => {
      const r = new OrgRoleRegistry();
      expect(() =>
        r.register({ id: "bad", parents: [], ownAssignments: [{ domain: "*", role: "viewer" }] })
      ).toThrow("Wildcard");
    });
  });

  describe("validate", () => {
    it("정상 정의는 오류 없음", () => {
      expect(buildOrgRoles().validate()).toEqual([]);
    });

    it("알 수 없는 부모 참조를 감지한다", () => {
      const r = new OrgRoleRegistry();
      r.register({ id: "orphan", parents: ["ghost"], ownAssignments: [] });
      const errors = r.validate();
      expect(errors.length).toBe(1);
      expect(errors[0].kind).toBe("unknown-parent");
    });

    it("순환 상속을 감지한다", () => {
      const r = new OrgRoleRegistry();
      r.register({ id: "a", parents: ["b"], ownAssignments: [] });
      r.register({ id: "b", parents: ["a"], ownAssignments: [] });
      const errors = r.validate();
      expect(errors.some(e => e.kind === "cycle")).toBe(true);
    });
  });

  describe("에러 케이스", () => {
    it("중복 org role 등록 시 throw", () => {
      const r = buildOrgRoles();
      expect(() =>
        r.register({ id: "member", parents: [], ownAssignments: [] })
      ).toThrow("Duplicate");
    });

    it("알 수 없는 org role resolve 시 throw", () => {
      const r = buildOrgRoles();
      expect(() => r.resolve("ghost")).toThrow();
    });
  });
});
