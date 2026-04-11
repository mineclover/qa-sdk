import { describe, expect, it } from "vitest";

import {
  createAuthorizationRealm,
  createAuthorizationRelation,
  createResourceNode,
  evaluateColumnPolicyPropagation,
  normalizeCerbosResourcePolicy,
  normalizeCerbosDerivedRoles,
  normalizeStructuredEnforcementRoute,
  projectAuthorizationDecision,
  projectCerbosDecisionObservation,
  projectCerbosDerivedRoles,
  projectCerbosResourcePolicy,
  projectColumnPolicyPropagation,
  projectEnforcementRoute,
  projectStructuredEnforcementRoute,
  validateCerbosDerivedRolesLike,
  validateCerbosResourcePolicyLike,
} from "./index.js";

describe("authorization-ontology", () => {
  it("projects Cerbos resource policies into policy/resource/action graph", () => {
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "cerbos:prod",
      environment: "prod",
    });
    const resourceRealm = createAuthorizationRealm({
      kind: "application",
      authority: "service:crm",
      environment: "prod",
    });

    const graph = projectCerbosResourcePolicy({
      policyRealm,
      resourceRealm,
      policy: {
        resourcePolicy: {
          resource: "crm.customer_profile",
          version: "v1",
          rules: [
            {
              actions: ["read", "export"],
              effect: "EFFECT_ALLOW",
              roles: ["analyst"],
              condition: {
                match: {
                  expr: "request.resource.attr.region == request.principal.attr.region",
                },
              },
            },
          ],
        },
      },
      sourceRef: "git://policy-repo/customer.yaml@abc123",
    });

    expect(graph.nodes.map((node) => node.kind).toSorted()).toEqual([
      "action",
      "action",
      "policy",
      "resource",
    ]);
    expect(graph.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "protects",
        }),
        expect.objectContaining({
          kind: "allows_action",
          metadata: expect.objectContaining({
            roles: ["analyst"],
          }),
        }),
      ]),
    );
  });

  it("validates and normalizes Cerbos resource policy shape", () => {
    expect(
      validateCerbosResourcePolicyLike({
        resourcePolicy: {
          resource: "crm.customer_profile",
          rules: [
            {
              actions: ["read", "read"],
              effect: "EFFECT_ALLOW",
              roles: ["analyst"],
            },
          ],
        },
      }),
    ).toEqual({
      valid: true,
      issues: [],
    });

    expect(
      normalizeCerbosResourcePolicy({
        resourcePolicy: {
          resource: "crm.customer_profile",
          rules: [
            {
              actions: ["read", "read"],
              effect: "EFFECT_DENY",
            },
          ],
        },
      }).resourcePolicy.rules,
    ).toEqual([
      {
        actions: ["read"],
        effect: "deny",
        roles: [],
        derivedRoles: [],
        condition: undefined,
        name: undefined,
      },
    ]);

    expect(validateCerbosResourcePolicyLike({}).valid).toBe(false);
  });

  it("projects Cerbos derived roles into role graph", () => {
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "cerbos:prod",
      environment: "prod",
    });

    const derivedRoles = {
      derivedRoles: {
        name: "crm_derived_roles",
        definitions: [
          {
            name: "regional_analyst",
            parentRoles: ["analyst", "viewer"],
            condition: {
              match: {
                expr: "request.principal.attr.region == request.resource.attr.region",
              },
            },
          },
        ],
      },
    };

    expect(validateCerbosDerivedRolesLike(derivedRoles)).toEqual({
      valid: true,
      issues: [],
    });
    expect(normalizeCerbosDerivedRoles(derivedRoles).derivedRoles.definitions[0]).toEqual({
      name: "regional_analyst",
      parentRoles: ["analyst", "viewer"],
      condition: {
        match: {
          expr: "request.principal.attr.region == request.resource.attr.region",
        },
      },
    });

    const graph = projectCerbosDerivedRoles({
      policyRealm,
      derivedRoles,
      sourceRef: "git://policy-repo/derived_roles.yaml@abc123",
    });

    expect(graph.nodes.map((node) => `${node.kind}:${node.coord.anchor}`).toSorted()).toEqual([
      "policy:cerbos:derivedRoles:crm_derived_roles",
      "role:analyst",
      "role:regional_analyst",
      "role:viewer",
    ]);
    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "derives_role_from",
      "derives_role_from",
      "imports_derived_role",
    ]);
  });

  it("classifies column-level policy propagation by lineage transform", () => {
    const dataRealm = createAuthorizationRealm({
      kind: "data",
      authority: "bq:commerce:analytics",
      environment: "prod",
    });
    const source = {
      realm: dataRealm,
      resourceId: "users.email",
      resourceKind: "column" as const,
      classification: "pii",
    };
    const target = {
      realm: dataRealm,
      resourceId: "marketing.user_email",
      resourceKind: "column" as const,
      classification: "pii",
    };

    expect(
      evaluateColumnPolicyPropagation({
        source,
        target,
        transform: "copy",
        sourcePolicyId: "policy:pii-email",
        rules: [
          {
            sourceClassification: "pii",
            transform: "copy",
            propagation: "inherit",
          },
        ],
      }),
    ).toEqual({
      mode: "inherit",
      relationKind: "inherits_policy_from",
      targetClassification: "pii",
      reason: "Propagation inherit via copy",
    });

    const graph = projectColumnPolicyPropagation({
      source,
      target,
      transform: "copy",
      sourcePolicyId: "policy:pii-email",
      rules: [
        {
          sourceClassification: "pii",
          transform: "copy",
          propagation: "inherit",
        },
      ],
    });

    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "derives_from",
      "inherits_policy_from",
    ]);
  });

  it("keeps realm as authority boundary, not resource kind", () => {
    const realm = createAuthorizationRealm({
      kind: "data",
      authority: "postgres:prod:customer-db",
      environment: "prod",
    });
    const node = createResourceNode({
      realm,
      resourceId: "public.users.email",
      resourceKind: "column",
      sensitivity: "pii",
    });

    expect(node.coord.realm).toBe("data:postgres:prod:customer-db:prod");
    expect(node.coord.space).toBe("resource");
    expect(node.coord.taxonomies).toEqual({
      node_kind: "resource",
      resource_kind: "column",
      sensitivity: "pii",
    });

    const relation = createAuthorizationRelation({
      kind: "protects",
      fromNodeId: "policy:customer",
      toNodeId: node.nodeId,
    });
    expect(relation.relationId).toContain("authz:protects");
  });

  it("projects Cerbos decision observations into decision graph", () => {
    const identityRealm = createAuthorizationRealm({
      kind: "identity",
      authority: "zitadel:prod",
      environment: "prod",
    });
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "cerbos:prod",
      environment: "prod",
    });
    const resourceRealm = createAuthorizationRealm({
      kind: "application",
      authority: "service:crm",
      environment: "prod",
    });
    const enforcementRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "authentik:prod",
      environment: "prod",
    });

    const graph = projectCerbosDecisionObservation({
      identityRealm,
      policyRealm,
      resourceRealm,
      enforcementPoint: {
        realm: enforcementRealm,
        enforcementPointId: "outpost:crm",
        kind: "authentik_proxy",
      },
      decision: {
        requestId: "req-1",
        principal: {
          id: "user-1",
          roles: ["analyst"],
          attr: { region: "kr" },
        },
        resource: {
          id: "crm.customer_profile",
          kind: "service",
          attr: { region: "kr" },
        },
        actions: [
          {
            action: "read",
            effect: "EFFECT_ALLOW",
            policyId: "cerbos:resource:crm.customer_profile",
            reason: "matched regional analyst",
          },
        ],
        observedAt: "2026-04-11T00:00:00.000Z",
      },
    });

    expect(graph.nodes.map((node) => node.kind).toSorted()).toEqual([
      "action",
      "decision",
      "enforcement_point",
      "policy",
      "principal",
      "resource",
      "role",
    ]);
    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "decision_action",
      "decision_enforcement",
      "decision_policy",
      "decision_principal",
      "decision_resource",
      "has_role",
    ]);
  });

  it("projects proxy enforcement routes into route/enforcement/policy graph", () => {
    const routeRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "caddy:prod",
      environment: "prod",
    });
    const enforcementRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "authentik:prod",
      environment: "prod",
    });
    const appRealm = createAuthorizationRealm({
      kind: "application",
      authority: "service:crm",
      environment: "prod",
    });
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "cerbos:prod",
      environment: "prod",
    });
    const deploymentRealm = createAuthorizationRealm({
      kind: "infra",
      authority: "argocd:prod",
      environment: "prod",
    });

    const graph = projectEnforcementRoute({
      routeRealm,
      routeId: "crm.example.com/customers/*",
      routeKind: "proxy_route",
      host: "crm.example.com",
      path: "/customers/*",
      methods: ["GET"],
      enforcementPoint: {
        realm: enforcementRealm,
        enforcementPointId: "outpost:crm",
        kind: "authentik_proxy",
      },
      upstreamResource: {
        realm: appRealm,
        resourceId: "crm.customer_profile",
        resourceKind: "service",
      },
      policy: {
        realm: policyRealm,
        policyId: "cerbos:resource:crm.customer_profile",
        policyKind: "cerbos_resource_policy",
      },
      deploymentSource: {
        realm: deploymentRealm,
        sourceId: "argocd:crm",
        kind: "argocd",
        revision: "rev-1",
      },
    });

    expect(graph.nodes.map((node) => node.kind).toSorted()).toEqual([
      "deployment_source",
      "enforcement_point",
      "policy",
      "resource",
      "resource",
    ]);
    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "deployed_by",
      "enforced_at",
      "matches_resource",
      "protects",
    ]);
  });

  it("normalizes structured proxy route configs into enforcement graph", () => {
    const route = normalizeStructuredEnforcementRoute({
      environment: "prod",
      route: {
        host: "crm.example.com",
        path: "/customers/*",
        methods: ["GET"],
      },
      proxy: {
        authority: "authentik:prod",
        kind: "authentik_proxy",
        id: "outpost:crm",
      },
      upstream: {
        authority: "service:crm",
        id: "crm.customer_profile",
      },
      policy: {
        authority: "cerbos:prod",
        id: "cerbos:resource:crm.customer_profile",
      },
      deployment: {
        authority: "argocd:prod",
        id: "argocd:crm",
        kind: "argocd",
        revision: "rev-1",
      },
    });

    expect(route.routeId).toBe("crm.example.com/customers/*");
    expect(route.enforcementPoint.kind).toBe("authentik_proxy");
    expect(route.policy?.policyId).toBe("cerbos:resource:crm.customer_profile");

    const graph = projectStructuredEnforcementRoute({
      environment: "prod",
      route: {
        host: "crm.example.com",
        path: "/customers/*",
      },
      proxy: {
        authority: "authentik:prod",
        kind: "authentik_proxy",
        id: "outpost:crm",
      },
    });
    expect(graph.relations.map((relation) => relation.kind)).toEqual(["enforced_at"]);
  });

  it("projects direct authorization decisions into observable graph", () => {
    const realm = createAuthorizationRealm({
      kind: "application",
      authority: "service:crm",
      environment: "prod",
    });
    const graph = projectAuthorizationDecision({
      decisionId: "decision-1",
      principal: {
        realm,
        principalId: "svc-1",
        principalKind: "service_account",
        roles: ["reader"],
      },
      resource: {
        realm,
        resourceId: "crm.customer_profile",
        resourceKind: "service",
      },
      action: {
        realm,
        actionId: "read",
      },
      effect: "allow",
      observedAt: "2026-04-11T00:00:01.000Z",
    });

    expect(graph.nodes.some((node) => node.kind === "decision")).toBe(true);
    expect(graph.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "decision_principal" }),
        expect.objectContaining({ kind: "decision_resource" }),
        expect.objectContaining({ kind: "decision_action" }),
      ]),
    );
  });
});
