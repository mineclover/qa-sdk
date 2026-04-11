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
  "derives_role_from",
  "imports_derived_role",
  "matches_resource",
  "allows_action",
  "denies_action",
  "derives_from",
  "inherits_policy_from",
  "downgrades_policy_from",
  "requires_manual_review",
  "decision_principal",
  "decision_resource",
  "decision_action",
  "decision_policy",
  "decision_enforcement",
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

export interface CerbosDerivedRolesLike {
  apiVersion?: string;
  derivedRoles: {
    name: string;
    definitions?: CerbosDerivedRoleDefinitionLike[];
  };
  metadata?: Record<string, unknown>;
}

export interface CerbosDerivedRoleDefinitionLike {
  name: string;
  parentRoles: string[];
  condition?: unknown;
}

export interface CerbosPolicyRuleLike {
  actions: string[];
  effect: "EFFECT_ALLOW" | "EFFECT_DENY" | "allow" | "deny" | string;
  roles?: string[];
  derivedRoles?: string[];
  condition?: unknown;
  name?: string;
}

export interface CerbosPolicyValidationIssue {
  level: "error" | "warning";
  code: string;
  path: string;
  message: string;
}

export interface CerbosPolicyValidationResult {
  valid: boolean;
  issues: CerbosPolicyValidationIssue[];
}

export interface NormalizedCerbosPolicyRule {
  actions: string[];
  effect: "allow" | "deny";
  roles: string[];
  derivedRoles: string[];
  condition?: unknown;
  name?: string;
}

export interface NormalizedCerbosResourcePolicy {
  apiVersion?: string;
  resourcePolicy: {
    version: string;
    resource: string;
    scope?: string;
    importDerivedRoles: string[];
    rules: NormalizedCerbosPolicyRule[];
  };
  metadata?: Record<string, unknown>;
}

export interface NormalizedCerbosDerivedRoleDefinition {
  name: string;
  parentRoles: string[];
  condition?: unknown;
}

export interface NormalizedCerbosDerivedRoles {
  apiVersion?: string;
  derivedRoles: {
    name: string;
    definitions: NormalizedCerbosDerivedRoleDefinition[];
  };
  metadata?: Record<string, unknown>;
}

export interface CerbosPolicyProjectionInput {
  policyRealm: AuthorizationRealm;
  resourceRealm: AuthorizationRealm;
  actionRealm?: AuthorizationRealm;
  policy: CerbosResourcePolicyLike;
  sourceRef?: string;
}

export interface CerbosDerivedRolesProjectionInput {
  policyRealm: AuthorizationRealm;
  roleRealm?: AuthorizationRealm;
  derivedRoles: CerbosDerivedRolesLike;
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

export interface CerbosPrincipalLike {
  id: string;
  roles?: string[];
  attr?: Record<string, unknown>;
}

export interface CerbosResourceLike {
  id: string;
  kind?: AuthorizationResourceKind | string;
  attr?: Record<string, unknown>;
}

export interface CerbosActionDecisionLike {
  action: string;
  effect: "EFFECT_ALLOW" | "EFFECT_DENY" | "allow" | "deny" | string;
  policyId?: string;
  reason?: string;
}

export interface CerbosDecisionObservationLike {
  requestId?: string;
  principal: CerbosPrincipalLike;
  resource: CerbosResourceLike;
  actions: Record<string, string> | CerbosActionDecisionLike[];
  observedAt?: string;
}

export interface CerbosDecisionObservationProjectionInput {
  identityRealm: AuthorizationRealm;
  resourceRealm: AuthorizationRealm;
  policyRealm?: AuthorizationRealm;
  actionRealm?: AuthorizationRealm;
  enforcementPoint?: EnforcementPointRef;
  decisionRealm?: AuthorizationRealm;
  decision: CerbosDecisionObservationLike;
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

export function createRoleNode(input: {
  realm: AuthorizationRealm;
  roleId: string;
  roleKind?: "role" | "derived_role";
  sourcePolicyId?: string;
  condition?: unknown;
}): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "role",
    anchor: input.roleId,
    taxonomies: {
      node_kind: "role",
      role_kind: input.roleKind ?? "role",
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "role",
    coord,
    metadata: {
      sourcePolicyId: input.sourcePolicyId,
      condition: input.condition,
    },
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

function createCerbosIssue(
  level: "error" | "warning",
  code: string,
  path: string,
  message: string,
): CerbosPolicyValidationIssue {
  return { level, code, path, message };
}

export function normalizeCerbosResourcePolicy(
  policy: CerbosResourcePolicyLike,
): NormalizedCerbosResourcePolicy {
  return {
    apiVersion: policy.apiVersion,
    metadata: policy.metadata,
    resourcePolicy: {
      version: policy.resourcePolicy.version ?? "default",
      resource: policy.resourcePolicy.resource,
      scope: policy.resourcePolicy.scope,
      importDerivedRoles: policy.resourcePolicy.importDerivedRoles ?? [],
      rules: (policy.resourcePolicy.rules ?? []).map((rule) => ({
        actions: [...new Set(rule.actions)],
        effect: normalizeEffect(rule.effect),
        roles: rule.roles ?? [],
        derivedRoles: rule.derivedRoles ?? [],
        condition: rule.condition,
        name: rule.name,
      })),
    },
  };
}

export function validateCerbosResourcePolicyLike(
  policy: unknown,
): CerbosPolicyValidationResult {
  const issues: CerbosPolicyValidationIssue[] = [];

  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    return {
      valid: false,
      issues: [
        createCerbosIssue(
          "error",
          "policy-not-object",
          "$",
          "Cerbos policy must be an object",
        ),
      ],
    };
  }

  const record = policy as Partial<CerbosResourcePolicyLike>;
  const resourcePolicy = record.resourcePolicy;
  if (!resourcePolicy || typeof resourcePolicy !== "object") {
    issues.push(
      createCerbosIssue(
        "error",
        "resource-policy-missing",
        "resourcePolicy",
        "resourcePolicy is required",
      ),
    );
  } else {
    if (!resourcePolicy.resource || resourcePolicy.resource.trim().length === 0) {
      issues.push(
        createCerbosIssue(
          "error",
          "resource-missing",
          "resourcePolicy.resource",
          "resourcePolicy.resource is required",
        ),
      );
    }

    const rules = resourcePolicy.rules ?? [];
    if (rules.length === 0) {
      issues.push(
        createCerbosIssue(
          "warning",
          "rules-empty",
          "resourcePolicy.rules",
          "resourcePolicy should define at least one rule",
        ),
      );
    }

    rules.forEach((rule, index) => {
      const path = `resourcePolicy.rules.${index}`;
      if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
        issues.push(
          createCerbosIssue(
            "error",
            "rule-actions-empty",
            `${path}.actions`,
            "rule.actions must contain at least one action",
          ),
        );
      }
      if (!rule.effect || typeof rule.effect !== "string") {
        issues.push(
          createCerbosIssue(
            "error",
            "rule-effect-missing",
            `${path}.effect`,
            "rule.effect is required",
          ),
        );
      }
      if ((rule.roles?.length ?? 0) === 0 && (rule.derivedRoles?.length ?? 0) === 0) {
        issues.push(
          createCerbosIssue(
            "warning",
            "rule-principal-match-empty",
            path,
            "rule has no roles or derivedRoles",
          ),
        );
      }
    });
  }

  return {
    valid: issues.every((issue) => issue.level !== "error"),
    issues,
  };
}

export function normalizeCerbosDerivedRoles(
  derivedRoles: CerbosDerivedRolesLike,
): NormalizedCerbosDerivedRoles {
  return {
    apiVersion: derivedRoles.apiVersion,
    metadata: derivedRoles.metadata,
    derivedRoles: {
      name: derivedRoles.derivedRoles.name,
      definitions: (derivedRoles.derivedRoles.definitions ?? []).map((definition) => ({
        name: definition.name,
        parentRoles: [...new Set(definition.parentRoles)],
        condition: definition.condition,
      })),
    },
  };
}

export function validateCerbosDerivedRolesLike(
  input: unknown,
): CerbosPolicyValidationResult {
  const issues: CerbosPolicyValidationIssue[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      issues: [
        createCerbosIssue(
          "error",
          "derived-roles-not-object",
          "$",
          "Cerbos derivedRoles must be an object",
        ),
      ],
    };
  }

  const record = input as Partial<CerbosDerivedRolesLike>;
  if (!record.derivedRoles || typeof record.derivedRoles !== "object") {
    issues.push(
      createCerbosIssue(
        "error",
        "derived-roles-missing",
        "derivedRoles",
        "derivedRoles is required",
      ),
    );
  } else {
    if (!record.derivedRoles.name || record.derivedRoles.name.trim().length === 0) {
      issues.push(
        createCerbosIssue(
          "error",
          "derived-roles-name-missing",
          "derivedRoles.name",
          "derivedRoles.name is required",
        ),
      );
    }

    const definitions = record.derivedRoles.definitions ?? [];
    if (definitions.length === 0) {
      issues.push(
        createCerbosIssue(
          "warning",
          "derived-role-definitions-empty",
          "derivedRoles.definitions",
          "derivedRoles should define at least one definition",
        ),
      );
    }

    definitions.forEach((definition, index) => {
      const path = `derivedRoles.definitions.${index}`;
      if (!definition.name || definition.name.trim().length === 0) {
        issues.push(
          createCerbosIssue(
            "error",
            "derived-role-name-missing",
            `${path}.name`,
            "derived role definition name is required",
          ),
        );
      }
      if (!Array.isArray(definition.parentRoles) || definition.parentRoles.length === 0) {
        issues.push(
          createCerbosIssue(
            "error",
            "derived-role-parent-roles-empty",
            `${path}.parentRoles`,
            "derived role definition parentRoles must contain at least one role",
          ),
        );
      }
    });
  }

  return {
    valid: issues.every((issue) => issue.level !== "error"),
    issues,
  };
}

function uniqueNodes(nodes: AuthorizationNode[]): AuthorizationNode[] {
  return [...new Map(nodes.map((node) => [node.nodeId, node])).values()];
}

function uniqueRelations(relations: AuthorizationRelation[]): AuthorizationRelation[] {
  return [...new Map(relations.map((relation) => [relation.relationId, relation])).values()];
}

function uniqueRealms(realms: AuthorizationRealm[]): AuthorizationRealm[] {
  return [...new Map(realms.map((realm) => [realm.realmId, realm])).values()];
}

export function projectCerbosResourcePolicy(
  input: CerbosPolicyProjectionInput,
): AuthorizationOntologyGraph {
  const validation = validateCerbosResourcePolicyLike(input.policy);
  if (!validation.valid) {
    throw new Error(
      `Invalid Cerbos resource policy: ${validation.issues
        .filter((issue) => issue.level === "error")
        .map((issue) => `${issue.code}@${issue.path}`)
        .join(", ")}`,
    );
  }
  const normalized = normalizeCerbosResourcePolicy(input.policy);
  const policyRef: PolicyRef = {
    realm: input.policyRealm,
    policyId: `cerbos:resource:${normalized.resourcePolicy.resource}`,
    policyKind: "cerbos_resource_policy",
    version: normalized.resourcePolicy.version,
    sourceRef: input.sourceRef,
  };
  const policyNode = createPolicyNode(policyRef);
  const resourceNode = createResourceNode({
    realm: input.resourceRealm,
    resourceId: normalized.resourcePolicy.resource,
    resourceKind: "service",
    attributes: {
      cerbosScope: normalized.resourcePolicy.scope,
      importDerivedRoles: normalized.resourcePolicy.importDerivedRoles,
    },
  });

  const actionRealm = input.actionRealm ?? input.policyRealm;
  const actionNodes = normalized.resourcePolicy.rules.flatMap((rule) =>
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
        cerbosResource: normalized.resourcePolicy.resource,
      },
    }),
    ...normalized.resourcePolicy.rules.flatMap((rule) =>
      rule.actions.map((action) => {
        const actionNode = createActionNode({
          realm: actionRealm,
          actionId: action,
          actionKind: action,
        });
        return createAuthorizationRelation({
          kind: rule.effect === "allow" ? "allows_action" : "denies_action",
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

export function projectCerbosDerivedRoles(
  input: CerbosDerivedRolesProjectionInput,
): AuthorizationOntologyGraph {
  const validation = validateCerbosDerivedRolesLike(input.derivedRoles);
  if (!validation.valid) {
    throw new Error(
      `Invalid Cerbos derivedRoles: ${validation.issues
        .filter((issue) => issue.level === "error")
        .map((issue) => `${issue.code}@${issue.path}`)
        .join(", ")}`,
    );
  }
  const normalized = normalizeCerbosDerivedRoles(input.derivedRoles);
  const policyNode = createPolicyNode({
    realm: input.policyRealm,
    policyId: `cerbos:derivedRoles:${normalized.derivedRoles.name}`,
    policyKind: "cerbos_derived_roles",
    sourceRef: input.sourceRef,
  });
  const roleRealm = input.roleRealm ?? input.policyRealm;
  const derivedRoleNodes = normalized.derivedRoles.definitions.map((definition) =>
    createRoleNode({
      realm: roleRealm,
      roleId: definition.name,
      roleKind: "derived_role",
      sourcePolicyId: policyNode.nodeId,
      condition: definition.condition,
    }),
  );
  const parentRoleNodes = normalized.derivedRoles.definitions.flatMap((definition) =>
    definition.parentRoles.map((parentRole) =>
      createRoleNode({
        realm: roleRealm,
        roleId: parentRole,
        roleKind: "role",
      }),
    ),
  );

  const relations = [
    ...derivedRoleNodes.map((roleNode) =>
      createAuthorizationRelation({
        kind: "imports_derived_role",
        fromNodeId: policyNode.nodeId,
        toNodeId: roleNode.nodeId,
        metadata: {
          derivedRolesName: normalized.derivedRoles.name,
        },
      }),
    ),
    ...normalized.derivedRoles.definitions.flatMap((definition) => {
      const roleNode = createRoleNode({
        realm: roleRealm,
        roleId: definition.name,
        roleKind: "derived_role",
      });
      return definition.parentRoles.map((parentRole) => {
        const parentRoleNode = createRoleNode({
          realm: roleRealm,
          roleId: parentRole,
          roleKind: "role",
        });
        return createAuthorizationRelation({
          kind: "derives_role_from",
          fromNodeId: roleNode.nodeId,
          toNodeId: parentRoleNode.nodeId,
          metadata: {
            condition: definition.condition,
          },
        });
      });
    }),
  ];

  return {
    realms: [input.policyRealm, roleRealm],
    nodes: uniqueNodes([policyNode, ...derivedRoleNodes, ...parentRoleNodes]),
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

export function projectAuthorizationDecision(
  input: AuthorizationDecision,
): AuthorizationOntologyGraph {
  const principalNode = createPrincipalNode(input.principal);
  const resourceNode = createResourceNode(input.resource);
  const actionNode = createActionNode(input.action);
  const decisionNode = createAuthorizationDecisionNode(input);
  const policyNode = input.policy ? createPolicyNode(input.policy) : undefined;
  const enforcementNode = input.enforcementPoint
    ? createEnforcementPointNode(input.enforcementPoint)
    : undefined;
  const roleNodes = (input.principal.roles ?? []).map((role) =>
    createRoleNode({
      realm: input.principal.realm,
      roleId: role,
      roleKind: "role",
    }),
  );

  return {
    realms: uniqueRealms([
      input.principal.realm,
      input.resource.realm,
      input.action.realm,
      ...(input.policy ? [input.policy.realm] : []),
      ...(input.enforcementPoint ? [input.enforcementPoint.realm] : []),
    ]),
    nodes: uniqueNodes([
      principalNode,
      resourceNode,
      actionNode,
      decisionNode,
      ...(policyNode ? [policyNode] : []),
      ...(enforcementNode ? [enforcementNode] : []),
      ...roleNodes,
    ]),
    relations: uniqueRelations([
      createAuthorizationRelation({
        kind: "decision_principal",
        fromNodeId: decisionNode.nodeId,
        toNodeId: principalNode.nodeId,
      }),
      createAuthorizationRelation({
        kind: "decision_resource",
        fromNodeId: decisionNode.nodeId,
        toNodeId: resourceNode.nodeId,
      }),
      createAuthorizationRelation({
        kind: "decision_action",
        fromNodeId: decisionNode.nodeId,
        toNodeId: actionNode.nodeId,
      }),
      ...(policyNode
        ? [
            createAuthorizationRelation({
              kind: "decision_policy",
              fromNodeId: decisionNode.nodeId,
              toNodeId: policyNode.nodeId,
            }),
          ]
        : []),
      ...(enforcementNode
        ? [
            createAuthorizationRelation({
              kind: "decision_enforcement",
              fromNodeId: decisionNode.nodeId,
              toNodeId: enforcementNode.nodeId,
            }),
          ]
        : []),
      ...roleNodes.map((roleNode) =>
        createAuthorizationRelation({
          kind: "has_role",
          fromNodeId: principalNode.nodeId,
          toNodeId: roleNode.nodeId,
        }),
      ),
    ]),
  };
}

function normalizeCerbosActionDecisions(
  actions: CerbosDecisionObservationLike["actions"],
): CerbosActionDecisionLike[] {
  if (Array.isArray(actions)) {
    return actions.map((action) => ({
      ...action,
      effect: normalizeEffect(action.effect),
    }));
  }

  return Object.entries(actions).map(([action, effect]) => ({
    action,
    effect: normalizeEffect(effect),
  }));
}

export function projectCerbosDecisionObservation(
  input: CerbosDecisionObservationProjectionInput,
): AuthorizationOntologyGraph {
  const principal: PrincipalRef = {
    realm: input.identityRealm,
    principalId: input.decision.principal.id,
    principalKind: "human_user",
    issuer: input.identityRealm.authority,
    roles: input.decision.principal.roles ?? [],
    attributes: input.decision.principal.attr ?? {},
  };
  const resource: ResourceRef = {
    realm: input.resourceRealm,
    resourceId: input.decision.resource.id,
    resourceKind: (input.decision.resource.kind ?? "service") as AuthorizationResourceKind,
    attributes: input.decision.resource.attr ?? {},
  };
  const actionRealm = input.actionRealm ?? input.policyRealm ?? input.resourceRealm;
  const decisionRealm =
    input.decisionRealm ?? input.enforcementPoint?.realm ?? input.policyRealm ?? input.resourceRealm;
  const observedAt = input.decision.observedAt ?? new Date().toISOString();
  const actionDecisions = normalizeCerbosActionDecisions(input.decision.actions);
  const graphs = actionDecisions.map((actionDecision) =>
    projectAuthorizationDecision({
      decisionId: `${input.decision.requestId ?? input.decision.resource.id}:${actionDecision.action}`,
      principal,
      resource,
      action: {
        realm: actionRealm,
        actionId: actionDecision.action,
        actionKind: actionDecision.action,
      },
      policy: actionDecision.policyId
        ? {
            realm: input.policyRealm ?? decisionRealm,
            policyId: actionDecision.policyId,
            policyKind: "cerbos_resource_policy",
          }
        : undefined,
      enforcementPoint: input.enforcementPoint,
      effect: normalizeEffect(actionDecision.effect),
      observedAt,
      reason: actionDecision.reason,
    }),
  );

  return {
    realms: uniqueRealms([
      input.identityRealm,
      input.resourceRealm,
      actionRealm,
      decisionRealm,
      ...(input.policyRealm ? [input.policyRealm] : []),
      ...(input.enforcementPoint ? [input.enforcementPoint.realm] : []),
      ...graphs.flatMap((graph) => graph.realms),
    ]),
    nodes: uniqueNodes(graphs.flatMap((graph) => graph.nodes)),
    relations: uniqueRelations(graphs.flatMap((graph) => graph.relations)),
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
