import { describe, expect, it } from "vitest";

import {
  OrgRoleRegistry,
  PermissionSet,
  RoleRegistry,
  RoleResolver,
  UserOverrideStore,
  UserPermissionEngine,
  type DimDef,
} from "../../permission-engine/src/index.js";

import {
  auditAuthorizationGraph,
  createAuthorizationRealm,
  mergeAuthorizationGraphs,
  projectPermissionEngineAudit,
  projectPermissionEnginePermissionSet,
  projectPermissionEngineRoles,
} from "./index.js";

const PROJECT_FEATURES: DimDef = {
  name: "project:features",
  ids: ["resource:read", "resource:write", "resource:delete"],
};

const PROJECT_ROLES: DimDef = {
  name: "project:roles",
  ids: ["viewer", "author", "manager"],
};

function buildPermissionRuntime() {
  const roles = new RoleRegistry();
  roles.register({
    id: "viewer",
    domain: "project",
    parents: [],
    ownFeatures: ["resource:read"],
  });
  roles.register({
    id: "author",
    domain: "project",
    parents: ["viewer"],
    ownFeatures: ["resource:write"],
  });
  roles.register({
    id: "manager",
    domain: "project",
    parents: ["author"],
    ownFeatures: ["resource:delete"],
  });

  const orgRoles = new OrgRoleRegistry();
  orgRoles.register({
    id: "team_lead",
    parents: [],
    ownAssignments: [{ domain: "project", role: "author" }],
  });

  const overrides = new UserOverrideStore();
  const engine = new UserPermissionEngine(new RoleResolver(roles, orgRoles), overrides);

  return { roles, orgRoles, overrides, engine };
}

describe("authorization-ontology permission-engine bridge proof", () => {
  it("projects actual PermissionSet snapshots without changing grant semantics", () => {
    const ps = new PermissionSet({
      features: PROJECT_FEATURES,
      roles: PROJECT_ROLES,
    });
    ps.grant("resource:read", "viewer");
    ps.grant("resource:read", "author");
    ps.grant("resource:write", "author");
    ps.grant("resource:delete", "manager");

    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:runtime",
      environment: "test",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "test",
    });

    const graph = projectPermissionEnginePermissionSet({
      policyRealm,
      featureRealm,
      domain: "project",
      scopeKey: "test:kr",
      snapshot: ps.toSnapshot(),
    });

    const projectedGrants = graph.relations
      .filter((relation) => relation.kind === "grants_feature")
      .map((relation) => `${relation.metadata?.["domain"]}:${relation.metadata?.["address"]}`)
      .toSorted();
    const runtimeGrants = ps
      .queryGranted([null, null])
      .map((address) => `project:${address}`)
      .toSorted();

    expect(projectedGrants).toEqual(runtimeGrants);
    expect(graph.relations.some((relation) => relation.kind === "materializes_permission")).toBe(true);
  });

  it("projects actual role registry inheritance and org-role assignment", () => {
    const { roles, orgRoles } = buildPermissionRuntime();
    const roleRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:roles",
      environment: "test",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "test",
    });

    const graph = projectPermissionEngineRoles({
      roleRealm,
      featureRealm,
      roles: roles.rolesInDomain("project").map((roleId) => roles.getDef("project", roleId)),
      orgRoles: orgRoles.orgRoleIds().map((orgRoleId) => ({
        id: orgRoleId,
        parents: [],
        ownAssignments: [...orgRoles.resolve(orgRoleId).entries()].flatMap(([domain, domainRoles]) =>
          [...domainRoles].map((role) => ({ domain, role })),
        ),
      })),
    });

    expect(roles.resolvedFeatures("project", "author").has("resource:read")).toBe(true);
    expect(graph.relations.map((relation) => relation.kind)).toEqual(
      expect.arrayContaining(["derives_role_from", "assigns_role", "grants_feature"]),
    );
    expect(
      graph.relations.some(
        (relation) =>
          relation.kind === "assigns_role" &&
          relation.metadata?.["domain"] === "project",
      ),
    ).toBe(true);
  });

  it("projects actual UserPermissionEngine.audit results including user overrides", () => {
    const { engine, overrides } = buildPermissionRuntime();
    const ctx = {
      directAssignments: [],
      orgRoleId: "team_lead",
    };
    expect(engine.check("user-1", ctx, "project", "resource:write")).toBe(true);

    overrides.deny("user-1", "project", "resource:write");
    const audit = engine.audit("user-1", ctx, "project", "resource:write");
    expect(audit.granted).toBe(false);
    expect(audit.denialReason).toEqual({ kind: "user-override" });
    expect(audit.sources[0]?.domainRole).toBe("author");

    const identityRealm = createAuthorizationRealm({
      kind: "identity",
      authority: "zitadel:test",
      environment: "test",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "test",
    });
    const roleRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:roles",
      environment: "test",
    });
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:runtime",
      environment: "test",
    });
    const enforcementRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "service:project",
      environment: "test",
    });

    const graph = projectPermissionEngineAudit({
      identityRealm,
      featureRealm,
      roleRealm,
      policyRealm,
      enforcementPoint: {
        realm: enforcementRealm,
        enforcementPointId: "project-api:permission-middleware",
        kind: "service_middleware",
      },
      audit,
      observedAt: "2026-04-11T00:00:00.000Z",
    });

    expect(graph.relations.map((relation) => relation.kind)).toEqual(
      expect.arrayContaining([
        "decision_policy",
        "denies_feature",
        "overrides_permission",
        "has_role",
      ]),
    );

    const report = auditAuthorizationGraph(graph, {
      requireRoutePolicy: false,
      requireRouteEnforcement: false,
      requireRouteUpstream: false,
      requireApplicationResourcePolicy: false,
      requireApplicationResourceEnforcement: false,
    });
    expect(report.ok).toBe(true);
  });

  it("combines actual permission-engine runtime graph with authorization audit graph", () => {
    const { roles, orgRoles, engine } = buildPermissionRuntime();
    const ctx = {
      directAssignments: [],
      orgRoleId: "team_lead",
    };
    const runtimeAudit = engine.audit("user-2", ctx, "project", "resource:write");
    expect(runtimeAudit.granted).toBe(true);

    const roleRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:roles",
      environment: "test",
    });
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:runtime",
      environment: "test",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "test",
    });
    const identityRealm = createAuthorizationRealm({
      kind: "identity",
      authority: "zitadel:test",
      environment: "test",
    });

    const materialized = roles.buildDomainPermissionSet("project");
    const graph = mergeAuthorizationGraphs(
      projectPermissionEnginePermissionSet({
        policyRealm,
        roleRealm,
        featureRealm,
        domain: "project",
        scopeKey: "test:kr",
        snapshot: materialized.toSnapshot(),
      }),
      projectPermissionEngineRoles({
        roleRealm,
        featureRealm,
        roles: roles.rolesInDomain("project").map((roleId) => roles.getDef("project", roleId)),
        orgRoles: orgRoles.orgRoleIds().map((orgRoleId) => ({
          id: orgRoleId,
          parents: [],
          ownAssignments: [...orgRoles.resolve(orgRoleId).entries()].flatMap(([domain, domainRoles]) =>
            [...domainRoles].map((role) => ({ domain, role })),
          ),
        })),
      }),
      projectPermissionEngineAudit({
        identityRealm,
        featureRealm,
        roleRealm,
        policyRealm,
        audit: runtimeAudit,
        observedAt: "2026-04-11T00:00:00.000Z",
      }),
    );

    expect(
      graph.relations.some(
        (relation) =>
          relation.kind === "grants_feature" &&
          relation.metadata?.["finalGranted"] === true,
      ),
    ).toBe(true);
    expect(graph.relations.some((relation) => relation.kind === "materializes_permission")).toBe(true);
  });
});
