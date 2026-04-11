import { describe, expect, it } from "vitest";

import {
  createAuthorizationRealm,
  createAuthorizationRelation,
  createResourceNode,
  evaluateColumnPolicyPropagation,
  normalizeCerbosResourcePolicy,
  normalizeCerbosDerivedRoles,
  projectCerbosDerivedRoles,
  projectCerbosResourcePolicy,
  projectColumnPolicyPropagation,
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
});
