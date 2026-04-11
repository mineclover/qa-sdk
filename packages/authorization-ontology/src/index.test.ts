import { describe, expect, it } from "vitest";

import {
  auditAuthorizationGraph,
  AuthorizationGraphIngestService,
  createAuthorizationRealm,
  createAuthorizationRelation,
  diffAuthorizationGraphSnapshots,
  diffAuthorizationGraphs,
  InMemoryAuthorizationGraphStore,
  createResourceNode,
  evaluateColumnPolicyPropagation,
  mergeAuthorizationGraphs,
  normalizeCerbosResourcePolicy,
  normalizeCerbosDerivedRoles,
  normalizeStructuredEnforcementRoute,
  projectAuthorizationDecision,
  projectCerbosDecisionObservation,
  projectCerbosDerivedRoles,
  projectCerbosResourcePolicy,
  projectColumnPolicyPropagation,
  projectEnforcementRoute,
  projectNginxProxyConfig,
  projectPermissionEngineAudit,
  projectPermissionEngineMiddlewareFeedback,
  projectPermissionEnginePermissionSet,
  projectPermissionEngineRoles,
  projectStructuredApplicationAuthorization,
  projectStructuredEnforcementRoute,
  parseNginxProxyLocations,
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

  it("projects Nginx proxy config into enforcement route graph", () => {
    const config = `
upstream zitadel_api {
  server zitadel:8080;
}
upstream zitadel_login {
  server zitadel-login:3000;
}
server {
  listen 80;
  server_name localhost;
  location /ui/v2/login {
    proxy_pass http://zitadel_login;
  }
  location / {
    proxy_pass http://zitadel_api;
  }
}
`;

    expect(parseNginxProxyLocations(config)).toEqual([
      {
        path: "/ui/v2/login",
        proxyPass: "http://zitadel_login",
        upstreamName: "zitadel_login",
        upstreamTarget: "zitadel-login:3000",
      },
      {
        path: "/",
        proxyPass: "http://zitadel_api",
        upstreamName: "zitadel_api",
        upstreamTarget: "zitadel:8080",
      },
    ]);

    const graph = projectNginxProxyConfig(config, {
      environment: "local",
      proxyAuthority: "nginx:zitadel",
      proxyId: "zitadel-nginx",
      host: "localhost:8085",
      deployment: {
        authority: "docker-compose:local",
        id: "infra-engine:docker-compose.infra.yaml",
        kind: "git",
        revision: "working-tree",
      },
    });

    expect(graph.nodes.filter((node) => node.kind === "resource")).toHaveLength(4);
    expect(graph.nodes.filter((node) => node.kind === "enforcement_point")).toHaveLength(1);
    expect(
      graph.nodes.find((node) => node.kind === "enforcement_point")?.coord.taxonomies
        .enforcement_kind,
    ).toBe("nginx_proxy");
    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "deployed_by",
      "deployed_by",
      "enforced_at",
      "enforced_at",
      "matches_resource",
      "matches_resource",
    ]);
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

  it("projects application middleware authorization into resource/policy graph", () => {
    const graph = projectStructuredApplicationAuthorization({
      environment: "prod",
      service: {
        authority: "service:crm",
        id: "crm-api",
      },
      middleware: {
        authority: "service:crm",
        id: "crm-api:cerbos-middleware",
        kind: "service_middleware",
      },
      resource: {
        id: "crm.customer_profile:customer-123",
        kind: "domain_resource",
        attributes: {
          domainKind: "crm.customer_profile",
          tenantId: "tenant-1",
        },
      },
      policy: {
        authority: "cerbos:prod",
        id: "cerbos:resource:crm.customer_profile",
      },
      actions: ["read", "export"],
      deployment: {
        authority: "argocd:prod",
        id: "argocd:crm",
        kind: "argocd",
        revision: "rev-1",
      },
    });

    expect(graph.nodes.map((node) => node.kind).toSorted()).toEqual([
      "action",
      "action",
      "deployment_source",
      "enforcement_point",
      "policy",
      "resource",
      "resource",
    ]);
    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "deployed_by",
      "enforced_at",
      "evaluated_by",
      "evaluated_by",
      "matches_resource",
      "protects",
    ]);
    expect(
      graph.nodes.find((node) => node.kind === "resource" && node.coord.anchor.includes("customer-123"))
        ?.coord.taxonomies.resource_kind,
    ).toBe("domain_resource");
  });

  it("composes Cerbos policy, proxy route, decision, and column lineage into one authorization flow", () => {
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
    const dataRealm = createAuthorizationRealm({
      kind: "data",
      authority: "bq:commerce:analytics",
      environment: "prod",
    });
    const infraRealm = createAuthorizationRealm({
      kind: "infra",
      authority: "argocd:prod",
      environment: "prod",
    });

    const derivedRolesGraph = projectCerbosDerivedRoles({
      policyRealm,
      derivedRoles: {
        derivedRoles: {
          name: "crm_derived_roles",
          definitions: [
            {
              name: "regional_analyst",
              parentRoles: ["analyst"],
              condition: {
                match: {
                  expr: "request.principal.attr.region == request.resource.attr.region",
                },
              },
            },
          ],
        },
      },
    });

    const policyGraph = projectCerbosResourcePolicy({
      policyRealm,
      resourceRealm: appRealm,
      policy: {
        resourcePolicy: {
          resource: "crm.customer_profile",
          version: "v1",
          importDerivedRoles: ["crm_derived_roles"],
          rules: [
            {
              actions: ["read"],
              effect: "EFFECT_ALLOW",
              derivedRoles: ["regional_analyst"],
            },
          ],
        },
      },
    });

    const routeGraph = projectEnforcementRoute({
      routeRealm: enforcementRealm,
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
        version: "v1",
      },
      deploymentSource: {
        realm: infraRealm,
        sourceId: "argocd:crm",
        kind: "argocd",
        revision: "rev-1",
      },
    });

    const decisionGraph = projectCerbosDecisionObservation({
      identityRealm,
      resourceRealm: appRealm,
      policyRealm,
      enforcementPoint: {
        realm: enforcementRealm,
        enforcementPointId: "outpost:crm",
        kind: "authentik_proxy",
      },
      decision: {
        requestId: "req-authorization-flow",
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
          },
        ],
        observedAt: "2026-04-11T00:00:00.000Z",
      },
    });

    const lineageGraph = projectColumnPolicyPropagation({
      source: {
        realm: dataRealm,
        resourceId: "users.email",
        resourceKind: "column",
        classification: "pii",
      },
      target: {
        realm: dataRealm,
        resourceId: "crm.customer_email",
        resourceKind: "column",
        classification: "pii",
      },
      transform: "copy",
      sourcePolicyId: "cerbos:resource:crm.customer_profile",
      rules: [
        {
          sourceClassification: "pii",
          transform: "copy",
          propagation: "inherit",
        },
      ],
    });

    const allRelations = [
      ...derivedRolesGraph.relations,
      ...policyGraph.relations,
      ...routeGraph.relations,
      ...decisionGraph.relations,
      ...lineageGraph.relations,
    ].map((relation) => relation.kind);

    expect(allRelations).toEqual(
      expect.arrayContaining([
        "imports_derived_role",
        "derives_role_from",
        "protects",
        "allows_action",
        "enforced_at",
        "matches_resource",
        "deployed_by",
        "decision_principal",
        "decision_resource",
        "decision_action",
        "decision_policy",
        "decision_enforcement",
        "derives_from",
        "inherits_policy_from",
      ]),
    );
  });

  it("audits policy declarations, proxy routes, and decision observations", () => {
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
    const enforcementRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "nginx:prod",
      environment: "prod",
    });
    const appRealm = createAuthorizationRealm({
      kind: "application",
      authority: "service:crm",
      environment: "prod",
    });

    const policyGraph = projectCerbosResourcePolicy({
      policyRealm,
      resourceRealm: appRealm,
      policy: {
        resourcePolicy: {
          resource: "crm.customer_profile",
          rules: [
            {
              actions: ["read"],
              effect: "EFFECT_ALLOW",
              roles: ["analyst"],
            },
          ],
        },
      },
    });
    const routeGraph = projectStructuredEnforcementRoute({
      environment: "prod",
      route: {
        host: "crm.example.com",
        path: "/customers",
      },
      proxy: {
        authority: "nginx:prod",
        kind: "nginx_proxy",
        id: "nginx:crm",
      },
      upstream: {
        authority: "service:crm",
        id: "crm.customer_profile",
      },
      policy: {
        authority: "cerbos:prod",
        id: "cerbos:resource:crm.customer_profile",
      },
    });
    const decisionGraph = projectCerbosDecisionObservation({
      identityRealm,
      resourceRealm: appRealm,
      policyRealm,
      enforcementPoint: {
        realm: enforcementRealm,
        enforcementPointId: "nginx:crm",
        kind: "nginx_proxy",
      },
      decision: {
        requestId: "req-audit",
        principal: {
          id: "user-1",
          roles: ["analyst"],
        },
        resource: {
          id: "crm.customer_profile",
          kind: "service",
        },
        actions: [
          {
            action: "read",
            effect: "EFFECT_ALLOW",
            policyId: "cerbos:resource:crm.customer_profile",
          },
        ],
      },
    });

    const report = auditAuthorizationGraph(
      mergeAuthorizationGraphs(policyGraph, routeGraph, decisionGraph),
    );

    expect(report.ok).toBe(true);
    expect(report.summary).toEqual(
      expect.objectContaining({
        routeCount: 1,
        protectedRouteCount: 1,
        decisionCount: 1,
        decisionsWithPolicyCount: 1,
        errors: 0,
      }),
    );

    const brokenReport = auditAuthorizationGraph(
      mergeAuthorizationGraphs(
        projectStructuredEnforcementRoute({
          environment: "prod",
          route: {
            host: "crm.example.com",
            path: "/exports",
          },
          proxy: {
            authority: "nginx:prod",
            kind: "nginx_proxy",
            id: "nginx:crm",
          },
          upstream: {
            authority: "service:crm",
            id: "crm.customer_profile",
          },
        }),
        projectCerbosDecisionObservation({
          identityRealm,
          resourceRealm: appRealm,
          policyRealm,
          enforcementPoint: {
            realm: enforcementRealm,
            enforcementPointId: "nginx:crm",
            kind: "nginx_proxy",
          },
          decision: {
            requestId: "req-broken-audit",
            principal: {
              id: "user-1",
              roles: ["analyst"],
            },
            resource: {
              id: "crm.customer_profile",
              kind: "service",
            },
            actions: [
              {
                action: "export",
                effect: "EFFECT_ALLOW",
                policyId: "cerbos:resource:crm.customer_profile",
              },
            ],
          },
        }),
      ),
    );

    expect(brokenReport.ok).toBe(false);
    expect(brokenReport.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "proxy_route_missing_policy",
        "decision_policy_action_unlinked",
        "decision_policy_resource_unlinked",
      ]),
    );
  });

  it("audits application middleware protected domain resources", () => {
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
    const appRealm = createAuthorizationRealm({
      kind: "application",
      authority: "service:crm",
      environment: "prod",
    });
    const enforcementRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "service:crm",
      environment: "prod",
    });

    const policyGraph = projectCerbosResourcePolicy({
      policyRealm,
      resourceRealm: appRealm,
      policy: {
        resourcePolicy: {
          resource: "crm.customer_profile",
          rules: [
            {
              actions: ["read"],
              effect: "EFFECT_ALLOW",
              roles: ["analyst"],
            },
          ],
        },
      },
    });
    const applicationGraph = projectStructuredApplicationAuthorization({
      environment: "prod",
      service: {
        authority: "service:crm",
        id: "crm-api",
      },
      middleware: {
        authority: "service:crm",
        id: "crm-api:cerbos-middleware",
      },
      resource: {
        id: "crm.customer_profile:customer-123",
        kind: "domain_resource",
      },
      policy: {
        authority: "cerbos:prod",
        id: "cerbos:resource:crm.customer_profile",
      },
      actions: ["read"],
    });
    const decisionGraph = projectCerbosDecisionObservation({
      identityRealm,
      resourceRealm: appRealm,
      policyRealm,
      enforcementPoint: {
        realm: enforcementRealm,
        enforcementPointId: "crm-api:cerbos-middleware",
        kind: "service_middleware",
      },
      decision: {
        requestId: "req-app-audit",
        principal: {
          id: "user-1",
          roles: ["analyst"],
        },
        resource: {
          id: "crm.customer_profile:customer-123",
          kind: "domain_resource",
        },
        actions: [
          {
            action: "read",
            effect: "EFFECT_ALLOW",
            policyId: "cerbos:resource:crm.customer_profile",
          },
        ],
      },
    });

    const report = auditAuthorizationGraph(
      mergeAuthorizationGraphs(policyGraph, applicationGraph, decisionGraph),
      {
        requireRoutePolicy: false,
        requireRouteEnforcement: false,
        requireRouteUpstream: false,
      },
    );

    expect(report.ok).toBe(true);
    expect(report.summary).toEqual(
      expect.objectContaining({
        applicationResourceCount: 1,
        protectedApplicationResourceCount: 1,
        enforcedApplicationResourceCount: 1,
        decisionCount: 1,
        errors: 0,
      }),
    );

    const brokenReport = auditAuthorizationGraph(
      projectStructuredApplicationAuthorization({
        environment: "prod",
        service: {
          authority: "service:crm",
          id: "crm-api",
        },
        resource: {
          id: "crm.customer_profile:customer-456",
          kind: "domain_resource",
        },
      }),
      {
        requireRoutePolicy: false,
        requireRouteEnforcement: false,
        requireRouteUpstream: false,
        requireDecisionPolicy: false,
        requireDecisionEnforcement: false,
      },
    );

    expect(brokenReport.ok).toBe(false);
    expect(brokenReport.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["application_resource_missing_policy"]),
    );
  });

  it("projects permission-engine bitmask grants into feature/role graph", () => {
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:prod",
      environment: "prod",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "prod",
    });

    const graph = projectPermissionEnginePermissionSet({
      policyRealm,
      featureRealm,
      domain: "project",
      scopeKey: "prod:kr",
      snapshot: {
        features: ["resource:read", "resource:write"],
        roles: ["viewer", "author"],
        mask: "CQ==",
      },
      includeDenied: true,
    });

    expect(graph.nodes.map((node) => `${node.kind}:${node.coord.anchor}`).toSorted()).toEqual([
      "policy:permission-engine:project:prod:kr",
      "resource:project:prod:kr",
      "resource:project:resource:read",
      "resource:project:resource:write",
      "role:project:author",
      "role:project:viewer",
    ]);
    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "denies_feature",
      "denies_feature",
      "grants_feature",
      "grants_feature",
      "materializes_permission",
      "protects",
      "protects",
    ]);
    expect(
      graph.relations.find((relation) => relation.kind === "grants_feature")?.metadata,
    ).toEqual(
      expect.objectContaining({
        source: "permission-engine:PermissionSet",
      }),
    );
  });

  it("projects permission-engine role and org-role inheritance", () => {
    const roleRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:roles",
      environment: "prod",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "prod",
    });

    const graph = projectPermissionEngineRoles({
      roleRealm,
      featureRealm,
      roles: [
        {
          id: "viewer",
          domain: "project",
          parents: [],
          ownFeatures: ["resource:read"],
        },
        {
          id: "author",
          domain: "project",
          parents: ["viewer"],
          ownFeatures: ["resource:write"],
          denyFeatures: ["resource:delete"],
        },
      ],
      orgRoles: [
        {
          id: "team_lead",
          parents: [],
          ownAssignments: [{ domain: "project", role: "author" }],
        },
      ],
    });

    expect(graph.relations.map((relation) => relation.kind).toSorted()).toEqual([
      "assigns_role",
      "denies_feature",
      "derives_role_from",
      "grants_feature",
      "grants_feature",
    ]);
    expect(graph.nodes.map((node) => `${node.kind}:${node.coord.anchor}`)).toContain(
      "role:org:team_lead",
    );
  });

  it("projects permission-engine audit results into decision graph", () => {
    const identityRealm = createAuthorizationRealm({
      kind: "identity",
      authority: "zitadel:prod",
      environment: "prod",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "prod",
    });
    const roleRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:roles",
      environment: "prod",
    });
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:prod",
      environment: "prod",
    });
    const enforcementRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "service:project",
      environment: "prod",
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
      audit: {
        feature: "resource:write",
        domain: "project",
        userId: "user-1",
        granted: false,
        sources: [
          {
            source: "org-role",
            orgRoleId: "team_lead",
            domainRole: "author",
            inheritancePath: ["viewer", "author"],
          },
        ],
        denialReason: { kind: "user-override" },
      },
      observedAt: "2026-04-11T00:00:00.000Z",
    });

    expect(graph.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(["decision", "principal", "resource", "action", "policy", "role"]),
    );
    expect(graph.relations.map((relation) => relation.kind)).toEqual(
      expect.arrayContaining([
        "decision_principal",
        "decision_resource",
        "decision_action",
        "decision_policy",
        "decision_enforcement",
        "has_role",
        "grants_feature",
        "denies_feature",
        "overrides_permission",
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

  it("projects permission middleware feedback into denial decision graph", () => {
    const identityRealm = createAuthorizationRealm({
      kind: "identity",
      authority: "zitadel:prod",
      environment: "prod",
    });
    const featureRealm = createAuthorizationRealm({
      kind: "application",
      authority: "permission-engine:project",
      environment: "prod",
    });
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "permission-engine:runtime",
      environment: "prod",
    });
    const enforcementRealm = createAuthorizationRealm({
      kind: "enforcement",
      authority: "service:project",
      environment: "prod",
    });

    const graph = projectPermissionEngineMiddlewareFeedback({
      identityRealm,
      featureRealm,
      policyRealm,
      enforcementPoint: {
        realm: enforcementRealm,
        enforcementPointId: "project-api:permission-middleware",
        kind: "service_middleware",
      },
      feedback: {
        ok: false,
        userId: "user-1",
        domain: "project",
        feature: "resource:write",
        error: {
          kind: "PERMISSION_DENIED",
          message: "Permission denied",
        },
      },
      observedAt: "2026-04-11T00:00:00.000Z",
    });

    expect(graph.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(["decision", "principal", "resource", "action", "policy"]),
    );
    expect(graph.relations.map((relation) => relation.kind)).toEqual(
      expect.arrayContaining(["decision_policy", "denies_action", "protects"]),
    );
    expect(graph.relations.find((relation) => relation.kind === "denies_action")?.metadata).toEqual(
      expect.objectContaining({
        errorKind: "PERMISSION_DENIED",
      }),
    );
  });

  it("stores, lists, audits, and diffs authorization graph snapshots", async () => {
    const store = new InMemoryAuthorizationGraphStore();
    const policyRealm = createAuthorizationRealm({
      kind: "policy",
      authority: "cerbos:prod",
      environment: "prod",
    });
    const appRealm = createAuthorizationRealm({
      kind: "application",
      authority: "service:crm",
      environment: "prod",
    });
    const baseGraph = projectCerbosResourcePolicy({
      policyRealm,
      resourceRealm: appRealm,
      policy: {
        resourcePolicy: {
          resource: "crm.customer_profile",
          rules: [
            {
              actions: ["read"],
              effect: "EFFECT_ALLOW",
              roles: ["analyst"],
            },
          ],
        },
      },
    });
    const expandedGraph = mergeAuthorizationGraphs(
      baseGraph,
      projectStructuredApplicationAuthorization({
        environment: "prod",
        service: {
          authority: "service:crm",
          id: "crm-api",
        },
        middleware: {
          authority: "service:crm",
          id: "crm-api:cerbos-middleware",
        },
        resource: {
          id: "crm.customer_profile:customer-123",
          kind: "domain_resource",
        },
        policy: {
          authority: "cerbos:prod",
          id: "cerbos:resource:crm.customer_profile",
        },
        actions: ["read"],
      }),
    );

    const first = await store.saveSnapshot({
      graphId: "crm-authz",
      snapshotId: "crm-authz:001",
      graph: baseGraph,
      createdAt: "2026-04-11T00:00:00.000Z",
      tags: ["crm", "policy"],
      labels: { env: "prod" },
      audit: true,
      auditOptions: {
        requireRoutePolicy: false,
        requireRouteEnforcement: false,
        requireRouteUpstream: false,
        requireApplicationResourcePolicy: false,
        requireApplicationResourceEnforcement: false,
      },
    });
    const second = await store.saveSnapshot({
      graphId: "crm-authz",
      snapshotId: "crm-authz:002",
      graph: expandedGraph,
      createdAt: "2026-04-11T00:01:00.000Z",
      tags: ["crm", "application"],
      labels: { env: "prod" },
    });

    expect(first.auditReport?.ok).toBe(true);
    expect(await store.getSnapshot(first.snapshotId)).toEqual(first);
    expect(await store.listSnapshots({ graphId: "crm-authz" })).toHaveLength(2);
    expect(await store.listSnapshots({ tag: "application" })).toEqual([second]);

    const directDiff = diffAuthorizationGraphs(first.graph, second.graph);
    expect(directDiff.summary.addedNodeCount).toBeGreaterThan(0);
    expect(directDiff.summary.addedRelationCount).toBeGreaterThan(0);

    const storedDiff = await diffAuthorizationGraphSnapshots(
      store,
      first.snapshotId,
      second.snapshotId,
    );
    expect(storedDiff?.toSnapshotId).toBe(second.snapshotId);
    expect(await store.deleteSnapshot(first.snapshotId)).toBe(true);
    expect(await store.getSnapshot(first.snapshotId)).toBeNull();
  });

  it("ingests decision observations into graph snapshots and returns diffs", async () => {
    const store = new InMemoryAuthorizationGraphStore();
    const ingest = new AuthorizationGraphIngestService(store);
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
      authority: "service:crm",
      environment: "prod",
    });

    const first = await ingest.ingest({
      kind: "cerbos_decision",
      graphId: "crm-authz-observations",
      observedAt: "2026-04-11T00:00:00.000Z",
      sourceRef: "cerbos://decision/req-1",
      audit: true,
      auditOptions: {
        requireRoutePolicy: false,
        requireRouteEnforcement: false,
        requireRouteUpstream: false,
        requireApplicationResourcePolicy: false,
        requireApplicationResourceEnforcement: false,
        requireDecisionPolicyAction: false,
        requireDecisionPolicyResource: false,
      },
      decision: {
        identityRealm,
        policyRealm,
        resourceRealm,
        enforcementPoint: {
          realm: enforcementRealm,
          enforcementPointId: "crm-api:cerbos-middleware",
          kind: "service_middleware",
        },
        decision: {
          requestId: "req-1",
          principal: {
            id: "user-1",
            roles: ["analyst"],
          },
          resource: {
            id: "crm.customer_profile",
            kind: "service",
          },
          actions: [
            {
              action: "read",
              effect: "EFFECT_ALLOW",
              policyId: "cerbos:resource:crm.customer_profile",
            },
          ],
          observedAt: "2026-04-11T00:00:00.000Z",
        },
      },
    });

    const second = await ingest.ingest({
      kind: "permission_engine_middleware_feedback",
      graphId: "crm-authz-observations",
      observedAt: "2026-04-11T00:01:00.000Z",
      mergeWithLatest: true,
      feedback: {
        identityRealm,
        featureRealm: resourceRealm,
        policyRealm,
        enforcementPoint: {
          realm: enforcementRealm,
          enforcementPointId: "crm-api:permission-middleware",
          kind: "service_middleware",
        },
        feedback: {
          ok: false,
          userId: "user-1",
          domain: "crm",
          feature: "resource:export",
          error: {
            kind: "PERMISSION_DENIED",
            message: "Permission denied",
          },
        },
        observedAt: "2026-04-11T00:01:00.000Z",
      },
    });

    expect(first.record.auditReport?.ok).toBe(true);
    expect(second.previousSnapshot?.snapshotId).toBe(first.record.snapshotId);
    expect(second.diff?.summary.addedNodeCount).toBeGreaterThan(0);
    expect(second.storedGraph.nodes.length).toBeGreaterThan(first.storedGraph.nodes.length);
    expect(await store.listSnapshots({ labels: { ingestKind: "cerbos_decision" } })).toHaveLength(1);
    expect(await store.listSnapshots({ tag: "permission_engine_middleware_feedback" })).toHaveLength(1);
  });
});
