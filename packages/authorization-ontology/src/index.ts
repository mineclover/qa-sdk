import {
  createEdgeCanonicalKey,
  createInformationFacetRef,
  createNodeCoord,
  type DataLineageLink,
  type InformationFacetKind,
  type InformationFacetRef,
  type NodeCoord,
} from "operational-ontology";

export const AUTHORIZATION_REALM_KINDS = [
  "identity",
  "policy",
  "enforcement",
  "infra",
  "application",
  "data",
  "observation",
] as const;

export type AuthorizationRealmKind = (typeof AUTHORIZATION_REALM_KINDS)[number];

export interface AuthorizationRealm {
  realmId: string;
  kind: AuthorizationRealmKind;
  authority: string;
  environment?: string;
  region?: string;
  owner?: string;
}

export const AUTHORIZATION_NODE_KINDS = [
  "principal",
  "role",
  "resource",
  "action",
  "policy",
  "decision",
  "enforcement_point",
  "identity_provider",
  "deployment_source",
  "lineage_policy",
] as const;

export type AuthorizationNodeKind = (typeof AUTHORIZATION_NODE_KINDS)[number];

export const AUTHORIZATION_RESOURCE_KINDS = [
  "api_route",
  "service",
  "k8s_object",
  "cloud_lb",
  "proxy_route",
  "dataset",
  "table",
  "view",
  "column",
  "graph_node",
  "graph_property",
] as const;

export type AuthorizationResourceKind = (typeof AUTHORIZATION_RESOURCE_KINDS)[number];

export const AUTHORIZATION_RELATION_KINDS = [
  "issued_by",
  "authenticated_by",
  "enters_at",
  "enforced_at",
  "protects",
  "evaluated_by",
  "deployed_by",
  "has_role",
  "matches_resource",
  "allows_action",
  "denies_action",
  "derives_from",
  "inherits_policy_from",
  "downgrades_policy_from",
  "requires_manual_review",
] as const;

export type AuthorizationRelationKind = (typeof AUTHORIZATION_RELATION_KINDS)[number];

export interface AuthorizationNode {
  nodeId: string;
  kind: AuthorizationNodeKind;
  coord: NodeCoord;
  labels?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthorizationRelation {
  relationId: string;
  kind: AuthorizationRelationKind;
  fromNodeId: string;
  toNodeId: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizationOntologyGraph {
  realms: AuthorizationRealm[];
  nodes: AuthorizationNode[];
  relations: AuthorizationRelation[];
}

export interface PrincipalRef {
  realm: AuthorizationRealm;
  principalId: string;
  principalKind: "human_user" | "service_account" | "machine" | "group" | "role";
  issuer?: string;
  roles?: string[];
  attributes?: Record<string, unknown>;
}

export interface ResourceRef {
  realm: AuthorizationRealm;
  resourceId: string;
  resourceKind: AuthorizationResourceKind;
  parentResourceId?: string;
  classification?: string;
  sensitivity?: string;
  attributes?: Record<string, unknown>;
}

export interface ActionRef {
  realm: AuthorizationRealm;
  actionId: string;
  actionKind?: "read" | "write" | "delete" | "execute" | "export" | "traverse" | string;
}

export interface PolicyRef {
  realm: AuthorizationRealm;
  policyId: string;
  policyKind: "cerbos_resource_policy" | "cerbos_derived_roles" | "lineage_policy" | "gateway_policy" | string;
  version?: string;
  sourceRef?: string;
}

export interface EnforcementPointRef {
  realm: AuthorizationRealm;
  enforcementPointId: string;
  kind: "cloud_lb" | "caddy" | "authentik_proxy" | "service_middleware" | "cerbos_pdp";
}

export interface IdentityProviderRef {
  realm: AuthorizationRealm;
  providerId: string;
  kind: "zitadel" | "authentik" | "oidc" | string;
  issuer?: string;
}

export interface CerbosResourcePolicyLike {
  apiVersion?: string;
  resourcePolicy: {
    version?: string;
    resource: string;
    scope?: string;
    importDerivedRoles?: string[];
    rules?: CerbosPolicyRuleLike[];
  };
  metadata?: Record<string, unknown>;
}

export interface CerbosPolicyRuleLike {
  actions: string[];
  effect: "EFFECT_ALLOW" | "EFFECT_DENY" | "allow" | "deny" | string;
  roles?: string[];
  derivedRoles?: string[];
  condition?: unknown;
  name?: string;
}

export interface CerbosPolicyProjectionInput {
  policyRealm: AuthorizationRealm;
  resourceRealm: AuthorizationRealm;
  actionRealm?: AuthorizationRealm;
  policy: CerbosResourcePolicyLike;
  sourceRef?: string;
}

export const LINEAGE_AUTHORIZATION_TRANSFORMS = [
  "direct",
  "rename",
  "copy",
  "hash",
  "mask",
  "aggregate",
  "join",
  "filter",
  "derive",
] as const;

export type LineageAuthorizationTransform =
  (typeof LINEAGE_AUTHORIZATION_TRANSFORMS)[number];

export type PolicyPropagationMode =
  | "inherit"
  | "downgrade"
  | "block"
  | "manual_review";

export interface LineagePolicyPropagationRule {
  sourceClassification: string;
  transform: LineageAuthorizationTransform;
  propagation: PolicyPropagationMode;
  targetClassification?: string;
  reason?: string;
}

export interface ColumnPolicyPropagationInput {
  source: ResourceRef;
  target: ResourceRef;
  transform: LineageAuthorizationTransform;
  sourcePolicyId: string;
  rules: LineagePolicyPropagationRule[];
}

export interface ColumnPolicyPropagationResult {
  mode: PolicyPropagationMode;
  relationKind:
    | "inherits_policy_from"
    | "downgrades_policy_from"
    | "requires_manual_review";
  targetClassification: string;
  reason: string;
}

export interface AuthorizationDecision {
  decisionId: string;
  principal: PrincipalRef;
  resource: ResourceRef;
  action: ActionRef;
  policy?: PolicyRef;
  enforcementPoint?: EnforcementPointRef;
  effect: "allow" | "deny";
  observedAt: string;
  reason?: string;
}

export function createAuthorizationRealmId(input: Omit<AuthorizationRealm, "realmId">): string {
  const parts = [
    input.kind,
    input.authority,
    input.environment,
    input.region,
  ].filter((part): part is string => Boolean(part));
  return parts.join(":");
}

export function createAuthorizationRealm(
  input: Omit<AuthorizationRealm, "realmId"> & { realmId?: string },
): AuthorizationRealm {
  return {
    ...input,
    realmId: input.realmId ?? createAuthorizationRealmId(input),
  };
}

function createAuthNodeCoord(input: {
  realm: AuthorizationRealm;
  space: string;
  anchor: string;
  taxonomies: Record<string, string>;
}): NodeCoord {
  return createNodeCoord({
    realm: input.realm.realmId,
    space: input.space,
    anchor: input.anchor,
    taxonomies: input.taxonomies,
  });
}

function nodeIdFromCoord(coord: NodeCoord): string {
  return coord.canonicalKey;
}

export function createPrincipalNode(input: PrincipalRef): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "principal",
    anchor: input.principalId,
    taxonomies: {
      node_kind: "principal",
      principal_kind: input.principalKind,
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "principal",
    coord,
    metadata: {
      issuer: input.issuer,
      roles: input.roles ?? [],
      attributes: input.attributes ?? {},
    },
  };
}

export function createResourceNode(input: ResourceRef): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "resource",
    anchor: input.resourceId,
    taxonomies: {
      node_kind: "resource",
      resource_kind: input.resourceKind,
      ...(input.classification ? { classification: input.classification } : {}),
      ...(input.sensitivity ? { sensitivity: input.sensitivity } : {}),
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "resource",
    coord,
    metadata: {
      parentResourceId: input.parentResourceId,
      attributes: input.attributes ?? {},
    },
  };
}

export function createActionNode(input: ActionRef): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "action",
    anchor: input.actionId,
    taxonomies: {
      node_kind: "action",
      action_kind: input.actionKind ?? input.actionId,
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "action",
    coord,
  };
}

export function createPolicyNode(input: PolicyRef): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "policy",
    anchor: input.policyId,
    taxonomies: {
      node_kind: "policy",
      policy_kind: input.policyKind,
      ...(input.version ? { version: input.version } : {}),
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "policy",
    coord,
    metadata: {
      sourceRef: input.sourceRef,
    },
  };
}

export function createEnforcementPointNode(input: EnforcementPointRef): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "enforcement",
    anchor: input.enforcementPointId,
    taxonomies: {
      node_kind: "enforcement_point",
      enforcement_kind: input.kind,
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "enforcement_point",
    coord,
  };
}

export function createIdentityProviderNode(input: IdentityProviderRef): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "identity-provider",
    anchor: input.providerId,
    taxonomies: {
      node_kind: "identity_provider",
      provider_kind: input.kind,
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "identity_provider",
    coord,
    metadata: {
      issuer: input.issuer,
    },
  };
}

export function createAuthorizationRelation(input: {
  kind: AuthorizationRelationKind;
  fromNodeId: string;
  toNodeId: string;
  metadata?: Record<string, unknown>;
}): AuthorizationRelation {
  return {
    relationId: createEdgeCanonicalKey({
      start: input.fromNodeId,
      relationType: `authz:${input.kind}`,
      end: input.toNodeId,
    }),
    kind: input.kind,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    metadata: input.metadata,
  };
}

function normalizeEffect(effect: string): "allow" | "deny" {
  return effect === "EFFECT_DENY" || effect === "deny" ? "deny" : "allow";
}

function uniqueNodes(nodes: AuthorizationNode[]): AuthorizationNode[] {
  return [...new Map(nodes.map((node) => [node.nodeId, node])).values()];
}

function uniqueRelations(relations: AuthorizationRelation[]): AuthorizationRelation[] {
  return [...new Map(relations.map((relation) => [relation.relationId, relation])).values()];
}

export function projectCerbosResourcePolicy(
  input: CerbosPolicyProjectionInput,
): AuthorizationOntologyGraph {
  const policyRef: PolicyRef = {
    realm: input.policyRealm,
    policyId: `cerbos:resource:${input.policy.resourcePolicy.resource}`,
    policyKind: "cerbos_resource_policy",
    version: input.policy.resourcePolicy.version,
    sourceRef: input.sourceRef,
  };
  const policyNode = createPolicyNode(policyRef);
  const resourceNode = createResourceNode({
    realm: input.resourceRealm,
    resourceId: input.policy.resourcePolicy.resource,
    resourceKind: "service",
    attributes: {
      cerbosScope: input.policy.resourcePolicy.scope,
      importDerivedRoles: input.policy.resourcePolicy.importDerivedRoles ?? [],
    },
  });

  const actionRealm = input.actionRealm ?? input.policyRealm;
  const actionNodes = (input.policy.resourcePolicy.rules ?? []).flatMap((rule) =>
    rule.actions.map((action) =>
      createActionNode({
        realm: actionRealm,
        actionId: action,
        actionKind: action,
      }),
    ),
  );

  const relations: AuthorizationRelation[] = [
    createAuthorizationRelation({
      kind: "protects",
      fromNodeId: policyNode.nodeId,
      toNodeId: resourceNode.nodeId,
      metadata: {
        cerbosResource: input.policy.resourcePolicy.resource,
      },
    }),
    ...(input.policy.resourcePolicy.rules ?? []).flatMap((rule) =>
      rule.actions.map((action) => {
        const actionNode = createActionNode({
          realm: actionRealm,
          actionId: action,
          actionKind: action,
        });
        return createAuthorizationRelation({
          kind: normalizeEffect(rule.effect) === "allow" ? "allows_action" : "denies_action",
          fromNodeId: policyNode.nodeId,
          toNodeId: actionNode.nodeId,
          metadata: {
            roles: rule.roles ?? [],
            derivedRoles: rule.derivedRoles ?? [],
            condition: rule.condition,
            ruleName: rule.name,
          },
        });
      }),
    ),
  ];

  return {
    realms: [input.policyRealm, input.resourceRealm, actionRealm],
    nodes: uniqueNodes([policyNode, resourceNode, ...actionNodes]),
    relations: uniqueRelations(relations),
  };
}

export function evaluateColumnPolicyPropagation(
  input: ColumnPolicyPropagationInput,
): ColumnPolicyPropagationResult {
  const matched = input.rules.find(
    (rule) =>
      rule.sourceClassification === (input.source.classification ?? input.source.sensitivity ?? "unknown") &&
      rule.transform === input.transform,
  );
  const fallback: ColumnPolicyPropagationResult = {
    mode: "manual_review",
    relationKind: "requires_manual_review",
    targetClassification: input.target.classification ?? input.target.sensitivity ?? "unknown",
    reason: "No matching lineage authorization propagation rule",
  };

  if (!matched) {
    return fallback;
  }

  const relationKind =
    matched.propagation === "inherit"
      ? "inherits_policy_from"
      : matched.propagation === "downgrade"
        ? "downgrades_policy_from"
        : "requires_manual_review";

  return {
    mode: matched.propagation,
    relationKind,
    targetClassification:
      matched.targetClassification ??
      input.target.classification ??
      input.target.sensitivity ??
      "unknown",
    reason: matched.reason ?? `Propagation ${matched.propagation} via ${input.transform}`,
  };
}

export function projectColumnPolicyPropagation(
  input: ColumnPolicyPropagationInput,
): AuthorizationOntologyGraph & { propagation: ColumnPolicyPropagationResult } {
  const sourceNode = createResourceNode(input.source);
  const targetNode = createResourceNode(input.target);
  const propagation = evaluateColumnPolicyPropagation(input);

  return {
    propagation,
    realms: [input.source.realm, input.target.realm],
    nodes: [sourceNode, targetNode],
    relations: [
      createAuthorizationRelation({
        kind: "derives_from",
        fromNodeId: targetNode.nodeId,
        toNodeId: sourceNode.nodeId,
        metadata: {
          transform: input.transform,
        },
      }),
      createAuthorizationRelation({
        kind: propagation.relationKind,
        fromNodeId: targetNode.nodeId,
        toNodeId: sourceNode.nodeId,
        metadata: {
          sourcePolicyId: input.sourcePolicyId,
          mode: propagation.mode,
          reason: propagation.reason,
        },
      }),
    ],
  };
}

export function createAuthorizationDecisionNode(input: AuthorizationDecision): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.enforcementPoint?.realm ?? input.policy?.realm ?? input.resource.realm,
    space: "decision",
    anchor: input.decisionId,
    taxonomies: {
      node_kind: "decision",
      effect: input.effect,
    },
  });

  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "decision",
    coord,
    metadata: {
      observedAt: input.observedAt,
      reason: input.reason,
    },
  };
}

export function createAuthorizationFacetRef(
  node: AuthorizationNode,
  facetKind: InformationFacetKind,
): InformationFacetRef {
  return createInformationFacetRef({
    nodeId: node.nodeId,
    facetKind,
  });
}
