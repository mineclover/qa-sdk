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
  "domain_resource",
  "permission_feature",
  "permission_scope",
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
  "assigns_role",
  "derives_role_from",
  "denies_role",
  "imports_derived_role",
  "matches_resource",
  "grants_feature",
  "denies_feature",
  "materializes_permission",
  "overrides_permission",
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
  kind: "cloud_lb" | "caddy" | "nginx_proxy" | "authentik_proxy" | "service_middleware" | "cerbos_pdp";
}

export interface IdentityProviderRef {
  realm: AuthorizationRealm;
  providerId: string;
  kind: "zitadel" | "authentik" | "oidc" | string;
  issuer?: string;
}

export interface EnforcementRouteRef {
  routeRealm: AuthorizationRealm;
  routeId: string;
  routeKind: "proxy_route" | "api_route" | "cloud_lb" | string;
  host?: string;
  path?: string;
  methods?: string[];
  upstreamResource?: ResourceRef;
  enforcementPoint: EnforcementPointRef;
  policy?: PolicyRef;
  deploymentSource?: {
    realm: AuthorizationRealm;
    sourceId: string;
    kind: "pulumi" | "argocd" | "git" | string;
    revision?: string;
  };
}

export interface StructuredEnforcementRouteConfig {
  environment: string;
  route: {
    id?: string;
    kind?: "proxy_route" | "api_route" | "cloud_lb" | string;
    host: string;
    path: string;
    methods?: string[];
  };
  proxy: {
    authority: string;
    kind: "cloud_lb" | "caddy" | "nginx_proxy" | "authentik_proxy" | "service_middleware";
    id: string;
  };
  upstream?: {
    authority: string;
    id: string;
    kind?: AuthorizationResourceKind;
  };
  policy?: {
    authority: string;
    id: string;
    kind?: PolicyRef["policyKind"];
    version?: string;
  };
  deployment?: {
    authority: string;
    id: string;
    kind: "pulumi" | "argocd" | "git" | string;
    revision?: string;
  };
}

export interface NginxProxyLocation {
  path: string;
  proxyPass: string;
  upstreamName?: string;
  upstreamTarget?: string;
}

export interface NginxProxyConfigProjectionOptions {
  environment: string;
  proxyAuthority: string;
  proxyId: string;
  host?: string;
  proxyKind?: StructuredEnforcementRouteConfig["proxy"]["kind"];
  upstreamAuthority?: string;
  deployment?: StructuredEnforcementRouteConfig["deployment"];
  policyByPath?: Record<string, StructuredEnforcementRouteConfig["policy"]>;
}

export interface ApplicationAuthorizationBindingRef {
  serviceResource: ResourceRef;
  resource: ResourceRef;
  enforcementPoint: EnforcementPointRef;
  policy?: PolicyRef;
  actions?: ActionRef[];
  deploymentSource?: {
    realm: AuthorizationRealm;
    sourceId: string;
    kind: "pulumi" | "argocd" | "git" | string;
    revision?: string;
  };
}

export interface StructuredApplicationAuthorizationConfig {
  environment: string;
  service: {
    authority: string;
    id: string;
    kind?: AuthorizationResourceKind;
  };
  middleware?: {
    authority?: string;
    id?: string;
    kind?: EnforcementPointRef["kind"];
  };
  resource: {
    authority?: string;
    id: string;
    kind?: AuthorizationResourceKind;
    parentResourceId?: string;
    classification?: string;
    sensitivity?: string;
    attributes?: Record<string, unknown>;
  };
  policy?: {
    authority: string;
    id: string;
    kind?: PolicyRef["policyKind"];
    version?: string;
  };
  actions?: Array<string | { id: string; kind?: ActionRef["actionKind"] }>;
  deployment?: {
    authority: string;
    id: string;
    kind: "pulumi" | "argocd" | "git" | string;
    revision?: string;
  };
}

export interface PermissionEnginePermissionSetSnapshotLike {
  features: readonly string[];
  roles: readonly string[];
  mask: string;
}

export interface PermissionEngineGrantLike {
  feature: string;
  role: string;
  address?: number;
}

export interface PermissionEnginePermissionSetProjectionInput {
  policyRealm: AuthorizationRealm;
  roleRealm?: AuthorizationRealm;
  featureRealm: AuthorizationRealm;
  scopeRealm?: AuthorizationRealm;
  domain: string;
  scopeKey?: string;
  policyId?: string;
  sourceRef?: string;
  snapshot?: PermissionEnginePermissionSetSnapshotLike;
  grants?: readonly PermissionEngineGrantLike[];
  includeDenied?: boolean;
}

export interface PermissionEngineDomainRoleDefLike {
  id: string;
  domain: string;
  ownFeatures: readonly string[];
  parents: readonly string[];
  denyRoles?: readonly string[];
  denyFeatures?: readonly string[];
}

export interface PermissionEngineDomainAssignmentLike {
  domain: string;
  role: string;
}

export interface PermissionEngineOrgRoleDefLike {
  id: string;
  ownAssignments: readonly PermissionEngineDomainAssignmentLike[];
  parents: readonly string[];
}

export interface PermissionEngineRoleProjectionInput {
  roleRealm: AuthorizationRealm;
  featureRealm: AuthorizationRealm;
  orgRoleRealm?: AuthorizationRealm;
  domains?: readonly string[];
  roles: readonly PermissionEngineDomainRoleDefLike[];
  orgRoles?: readonly PermissionEngineOrgRoleDefLike[];
}

export interface PermissionEngineAuditGrantSourceLike {
  source: "direct" | "org-role";
  orgRoleId?: string;
  domainRole: string;
  inheritancePath: readonly string[];
}

export interface PermissionEngineAuditResultLike {
  feature: string;
  domain: string;
  userId: string;
  granted: boolean;
  sources: readonly PermissionEngineAuditGrantSourceLike[];
  denialReason: { kind: "not-assigned" | "user-override" } | null;
}

export interface PermissionEngineAuditProjectionInput {
  identityRealm: AuthorizationRealm;
  featureRealm: AuthorizationRealm;
  roleRealm: AuthorizationRealm;
  policyRealm: AuthorizationRealm;
  actionRealm?: AuthorizationRealm;
  decisionRealm?: AuthorizationRealm;
  enforcementPoint?: EnforcementPointRef;
  audit: PermissionEngineAuditResultLike;
  decisionId?: string;
  observedAt?: string;
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

export type AuthorizationAuditSeverity = "error" | "warning";

export type AuthorizationAuditIssueCode =
  | "dangling_relation"
  | "proxy_route_missing_enforcement"
  | "proxy_route_missing_policy"
  | "proxy_route_missing_upstream"
  | "application_resource_missing_policy"
  | "application_resource_missing_enforcement"
  | "decision_missing_resource"
  | "decision_missing_action"
  | "decision_missing_policy"
  | "decision_missing_enforcement"
  | "decision_policy_action_unlinked"
  | "decision_policy_resource_unlinked";

export interface AuthorizationAuditIssue {
  severity: AuthorizationAuditSeverity;
  code: AuthorizationAuditIssueCode;
  message: string;
  nodeId?: string;
  relationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizationGraphAuditOptions {
  routeResourceKinds?: AuthorizationResourceKind[];
  applicationResourceKinds?: AuthorizationResourceKind[];
  requireRoutePolicy?: boolean;
  requireRouteEnforcement?: boolean;
  requireRouteUpstream?: boolean;
  requireApplicationResourcePolicy?: boolean;
  requireApplicationResourceEnforcement?: boolean;
  requireDecisionPolicy?: boolean;
  requireDecisionEnforcement?: boolean;
  requireDecisionPolicyAction?: boolean;
  requireDecisionPolicyResource?: boolean;
}

export interface AuthorizationGraphAuditSummary {
  routeCount: number;
  protectedRouteCount: number;
  enforcedRouteCount: number;
  applicationResourceCount: number;
  protectedApplicationResourceCount: number;
  enforcedApplicationResourceCount: number;
  decisionCount: number;
  decisionsWithPolicyCount: number;
  errors: number;
  warnings: number;
}

export interface AuthorizationGraphAuditReport {
  ok: boolean;
  summary: AuthorizationGraphAuditSummary;
  issues: AuthorizationAuditIssue[];
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
  roleKind?: "role" | "derived_role" | "domain_role" | "org_role" | string;
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

export function createDeploymentSourceNode(input: {
  realm: AuthorizationRealm;
  sourceId: string;
  kind: "pulumi" | "argocd" | "git" | string;
  revision?: string;
}): AuthorizationNode {
  const coord = createAuthNodeCoord({
    realm: input.realm,
    space: "deployment-source",
    anchor: input.sourceId,
    taxonomies: {
      node_kind: "deployment_source",
      deployment_kind: input.kind,
      ...(input.revision ? { revision: input.revision } : {}),
    },
  });
  return {
    nodeId: nodeIdFromCoord(coord),
    kind: "deployment_source",
    coord,
    metadata: {
      revision: input.revision,
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

export function mergeAuthorizationGraphs(
  ...graphs: AuthorizationOntologyGraph[]
): AuthorizationOntologyGraph {
  return {
    realms: uniqueRealms(graphs.flatMap((graph) => graph.realms)),
    nodes: uniqueNodes(graphs.flatMap((graph) => graph.nodes)),
    relations: uniqueRelations(graphs.flatMap((graph) => graph.relations)),
  };
}

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64Bytes(value: string): Uint8Array {
  const clean = value.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let out = 0;

  for (let index = 0; index < clean.length; index += 4) {
    const a = BASE64_CHARS.indexOf(clean[index] ?? "");
    const b = BASE64_CHARS.indexOf(clean[index + 1] ?? "");
    const c = BASE64_CHARS.indexOf(clean[index + 2] ?? "");
    const d = BASE64_CHARS.indexOf(clean[index + 3] ?? "");
    if (a < 0 || b < 0) break;
    bytes[out++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[out++] = ((b & 0xf) << 4) | (c >> 2);
    if (d >= 0) bytes[out++] = ((c & 3) << 6) | d;
  }

  return bytes.slice(0, out);
}

function hasMaskBit(mask: Uint8Array, address: number): boolean {
  return Boolean(mask[address >> 3] & (1 << (address & 7)));
}

function permissionFeatureNode(input: {
  realm: AuthorizationRealm;
  domain: string;
  feature: string;
}): AuthorizationNode {
  return createResourceNode({
    realm: input.realm,
    resourceId: `${input.domain}:${input.feature}`,
    resourceKind: "permission_feature",
    attributes: {
      domain: input.domain,
      feature: input.feature,
    },
  });
}

function permissionRoleNode(input: {
  realm: AuthorizationRealm;
  domain: string;
  role: string;
  roleKind?: "domain_role" | "org_role" | string;
}): AuthorizationNode {
  return createRoleNode({
    realm: input.realm,
    roleId: `${input.domain}:${input.role}`,
    roleKind: input.roleKind ?? "domain_role",
  });
}

function permissionEnginePolicyNode(input: PermissionEnginePermissionSetProjectionInput): AuthorizationNode {
  return createPolicyNode({
    realm: input.policyRealm,
    policyId: input.policyId ?? `permission-engine:${input.domain}:${input.scopeKey ?? "default"}`,
    policyKind: "permission_engine_mask",
    sourceRef: input.sourceRef,
  });
}

function grantsFromPermissionSetInput(
  input: PermissionEnginePermissionSetProjectionInput,
): PermissionEngineGrantLike[] {
  const grants: PermissionEngineGrantLike[] = [...(input.grants ?? [])];
  if (!input.snapshot) return grants;

  const mask = decodeBase64Bytes(input.snapshot.mask);
  const roleCount = input.snapshot.roles.length;
  for (let featureIndex = 0; featureIndex < input.snapshot.features.length; featureIndex += 1) {
    for (let roleIndex = 0; roleIndex < input.snapshot.roles.length; roleIndex += 1) {
      const address = featureIndex * roleCount + roleIndex;
      if (hasMaskBit(mask, address)) {
        grants.push({
          feature: input.snapshot.features[featureIndex]!,
          role: input.snapshot.roles[roleIndex]!,
          address,
        });
      }
    }
  }
  return grants;
}

export function projectPermissionEnginePermissionSet(
  input: PermissionEnginePermissionSetProjectionInput,
): AuthorizationOntologyGraph {
  const roleRealm = input.roleRealm ?? input.policyRealm;
  const grants = grantsFromPermissionSetInput(input);
  const features = input.snapshot?.features ?? [...new Set(grants.map((grant) => grant.feature))];
  const roles = input.snapshot?.roles ?? [...new Set(grants.map((grant) => grant.role))];
  const policyNode = permissionEnginePolicyNode(input);
  const featureNodes = features.map((feature) =>
    permissionFeatureNode({
      realm: input.featureRealm,
      domain: input.domain,
      feature,
    }),
  );
  const roleNodes = roles.map((role) =>
    permissionRoleNode({
      realm: roleRealm,
      domain: input.domain,
      role,
    }),
  );
  const scopeNode = input.scopeKey
    ? createResourceNode({
        realm: input.scopeRealm ?? input.policyRealm,
        resourceId: `${input.domain}:${input.scopeKey}`,
        resourceKind: "permission_scope",
        attributes: {
          domain: input.domain,
          scopeKey: input.scopeKey,
        },
      })
    : undefined;

  const featureById = new Map(
    featureNodes.map((node) => [node.coord.anchor.split(":").slice(1).join(":"), node]),
  );
  const roleById = new Map(
    roleNodes.map((node) => [node.coord.anchor.split(":").slice(1).join(":"), node]),
  );
  const grantedKeys = new Set(grants.map((grant) => `${grant.feature}\u0000${grant.role}`));
  const deniedGrants: PermissionEngineGrantLike[] = input.includeDenied
    ? features.flatMap((feature, featureIndex) =>
        roles
          .filter((role) => !grantedKeys.has(`${feature}\u0000${role}`))
          .map((role, roleIndex) => ({
            feature,
            role,
            address: featureIndex * roles.length + roleIndex,
          })),
      )
    : [];

  return {
    realms: uniqueRealms([
      input.policyRealm,
      roleRealm,
      input.featureRealm,
      ...(scopeNode ? [input.scopeRealm ?? input.policyRealm] : []),
    ]),
    nodes: uniqueNodes([
      policyNode,
      ...featureNodes,
      ...roleNodes,
      ...(scopeNode ? [scopeNode] : []),
    ]),
    relations: uniqueRelations([
      ...featureNodes.map((featureNode) =>
        createAuthorizationRelation({
          kind: "protects",
          fromNodeId: policyNode.nodeId,
          toNodeId: featureNode.nodeId,
          metadata: {
            domain: input.domain,
            scopeKey: input.scopeKey,
            source: "permission-engine",
          },
        }),
      ),
      ...(scopeNode
        ? [
            createAuthorizationRelation({
              kind: "materializes_permission",
              fromNodeId: policyNode.nodeId,
              toNodeId: scopeNode.nodeId,
              metadata: {
                domain: input.domain,
                scopeKey: input.scopeKey,
              },
            }),
          ]
        : []),
      ...grants.flatMap((grant) => {
        const roleNode = roleById.get(grant.role);
        const featureNode = featureById.get(grant.feature);
        if (!roleNode || !featureNode) return [];
        return [
          createAuthorizationRelation({
            kind: "grants_feature",
            fromNodeId: roleNode.nodeId,
            toNodeId: featureNode.nodeId,
            metadata: {
              domain: input.domain,
              scopeKey: input.scopeKey,
              address: grant.address,
              source: "permission-engine:PermissionSet",
            },
          }),
        ];
      }),
      ...deniedGrants.flatMap((grant) => {
        const roleNode = roleById.get(grant.role);
        const featureNode = featureById.get(grant.feature);
        if (!roleNode || !featureNode) return [];
        return [
          createAuthorizationRelation({
            kind: "denies_feature",
            fromNodeId: roleNode.nodeId,
            toNodeId: featureNode.nodeId,
            metadata: {
              domain: input.domain,
              scopeKey: input.scopeKey,
              address: grant.address,
              source: "permission-engine:PermissionSet",
              reason: "bit-unset",
            },
          }),
        ];
      }),
    ]),
  };
}

export function projectPermissionEngineRoles(
  input: PermissionEngineRoleProjectionInput,
): AuthorizationOntologyGraph {
  const orgRoleRealm = input.orgRoleRealm ?? input.roleRealm;
  const domains = input.domains ? new Set(input.domains) : undefined;
  const roles = input.roles.filter((role) => !domains || domains.has(role.domain));
  const roleNodes = roles.map((role) =>
    permissionRoleNode({
      realm: input.roleRealm,
      domain: role.domain,
      role: role.id,
    }),
  );
  const featurePairs = [
    ...new Map(
      roles
        .flatMap((role) =>
          [...role.ownFeatures, ...(role.denyFeatures ?? [])].map((feature) => ({
            domain: role.domain,
            feature,
          })),
        )
        .map((pair) => [`${pair.domain}\u0000${pair.feature}`, pair]),
    ).values(),
  ];
  const featureNodes = featurePairs.map((pair) =>
    permissionFeatureNode({
      realm: input.featureRealm,
      domain: pair.domain,
      feature: pair.feature,
    }),
  );
  const orgRoleNodes = (input.orgRoles ?? []).map((orgRole) =>
    createRoleNode({
      realm: orgRoleRealm,
      roleId: `org:${orgRole.id}`,
      roleKind: "org_role",
    }),
  );

  const roleByKey = new Map(roleNodes.map((node) => [node.coord.anchor, node]));
  const featureByKey = new Map(featureNodes.map((node) => [node.coord.anchor, node]));
  const orgRoleById = new Map(orgRoleNodes.map((node) => [node.coord.anchor.slice("org:".length), node]));

  return {
    realms: uniqueRealms([input.roleRealm, input.featureRealm, orgRoleRealm]),
    nodes: uniqueNodes([...roleNodes, ...featureNodes, ...orgRoleNodes]),
    relations: uniqueRelations([
      ...roles.flatMap((role) => {
        const roleNode = roleByKey.get(`${role.domain}:${role.id}`);
        if (!roleNode) return [];
        return [
          ...role.parents.flatMap((parent) => {
            const parentNode = roleByKey.get(`${role.domain}:${parent}`);
            if (!parentNode) return [];
            return [
              createAuthorizationRelation({
                kind: "derives_role_from",
                fromNodeId: roleNode.nodeId,
                toNodeId: parentNode.nodeId,
                metadata: {
                  domain: role.domain,
                  source: "permission-engine:RoleRegistry",
                },
              }),
            ];
          }),
          ...role.ownFeatures.flatMap((feature) => {
            const featureNode = featureByKey.get(`${role.domain}:${feature}`);
            if (!featureNode) return [];
            return [
              createAuthorizationRelation({
                kind: "grants_feature",
                fromNodeId: roleNode.nodeId,
                toNodeId: featureNode.nodeId,
                metadata: {
                  domain: role.domain,
                  source: "permission-engine:RoleRegistry",
                  direct: true,
                },
              }),
            ];
          }),
          ...(role.denyFeatures ?? []).flatMap((feature) => {
            const featureNode = featureByKey.get(`${role.domain}:${feature}`);
            if (!featureNode) return [];
            return [
              createAuthorizationRelation({
                kind: "denies_feature",
                fromNodeId: roleNode.nodeId,
                toNodeId: featureNode.nodeId,
                metadata: {
                  domain: role.domain,
                  source: "permission-engine:RoleRegistry",
                },
              }),
            ];
          }),
          ...(role.denyRoles ?? []).flatMap((denyRole) => {
            const deniedRoleNode = roleByKey.get(`${role.domain}:${denyRole}`);
            if (!deniedRoleNode) return [];
            return [
              createAuthorizationRelation({
                kind: "denies_role",
                fromNodeId: roleNode.nodeId,
                toNodeId: deniedRoleNode.nodeId,
                metadata: {
                  domain: role.domain,
                  source: "permission-engine:RoleRegistry",
                },
              }),
            ];
          }),
        ];
      }),
      ...(input.orgRoles ?? []).flatMap((orgRole) => {
        const orgRoleNode = orgRoleById.get(orgRole.id);
        if (!orgRoleNode) return [];
        return [
          ...orgRole.parents.flatMap((parent) => {
            const parentNode = orgRoleById.get(parent);
            if (!parentNode) return [];
            return [
              createAuthorizationRelation({
                kind: "derives_role_from",
                fromNodeId: orgRoleNode.nodeId,
                toNodeId: parentNode.nodeId,
                metadata: {
                  source: "permission-engine:OrgRoleRegistry",
                },
              }),
            ];
          }),
          ...orgRole.ownAssignments.flatMap((assignment) => {
            const roleNode = roleByKey.get(`${assignment.domain}:${assignment.role}`);
            if (!roleNode) return [];
            return [
              createAuthorizationRelation({
                kind: "assigns_role",
                fromNodeId: orgRoleNode.nodeId,
                toNodeId: roleNode.nodeId,
                metadata: {
                  domain: assignment.domain,
                  source: "permission-engine:OrgRoleRegistry",
                },
              }),
            ];
          }),
        ];
      }),
    ]),
  };
}

export function projectPermissionEngineAudit(
  input: PermissionEngineAuditProjectionInput,
): AuthorizationOntologyGraph {
  const policyRealm = input.policyRealm;
  const actionRealm = input.actionRealm ?? policyRealm;
  const decisionRealm = input.decisionRealm ?? input.enforcementPoint?.realm ?? input.featureRealm;
  const decision = projectAuthorizationDecision({
    decisionId: input.decisionId ?? `permission-engine:${input.audit.userId}:${input.audit.domain}:${input.audit.feature}`,
    principal: {
      realm: input.identityRealm,
      principalId: input.audit.userId,
      principalKind: "human_user",
      roles: [],
    },
    resource: {
      realm: input.featureRealm,
      resourceId: `${input.audit.domain}:${input.audit.feature}`,
      resourceKind: "permission_feature",
      attributes: {
        domain: input.audit.domain,
        feature: input.audit.feature,
      },
    },
    action: {
      realm: actionRealm,
      actionId: input.audit.feature,
      actionKind: input.audit.feature,
    },
    policy: {
      realm: policyRealm,
      policyId: `permission-engine:${input.audit.domain}:final-mask`,
      policyKind: "permission_engine_final_mask",
    },
    enforcementPoint: input.enforcementPoint,
    effect: input.audit.granted ? "allow" : "deny",
    observedAt: input.observedAt ?? new Date().toISOString(),
    reason: input.audit.denialReason?.kind,
  });
  const principalNode = createPrincipalNode({
    realm: input.identityRealm,
    principalId: input.audit.userId,
    principalKind: "human_user",
  });
  const sourceRoleNodes = input.audit.sources.map((source) =>
    permissionRoleNode({
      realm: input.roleRealm,
      domain: input.audit.domain,
      role: source.domainRole,
    }),
  );
  const overridePolicyNode =
    input.audit.denialReason?.kind === "user-override"
      ? createPolicyNode({
          realm: policyRealm,
          policyId: `permission-engine:${input.audit.domain}:${input.audit.userId}:override`,
          policyKind: "permission_engine_user_override",
        })
      : undefined;
  const featureNode = permissionFeatureNode({
    realm: input.featureRealm,
    domain: input.audit.domain,
    feature: input.audit.feature,
  });
  const finalPolicyNode = createPolicyNode({
    realm: policyRealm,
    policyId: `permission-engine:${input.audit.domain}:final-mask`,
    policyKind: "permission_engine_final_mask",
  });
  const actionNode = createActionNode({
    realm: actionRealm,
    actionId: input.audit.feature,
    actionKind: input.audit.feature,
  });

  return mergeAuthorizationGraphs(decision, {
    realms: uniqueRealms([
      input.identityRealm,
      input.roleRealm,
      input.featureRealm,
      policyRealm,
      actionRealm,
      ...(overridePolicyNode ? [policyRealm] : []),
    ]),
    nodes: uniqueNodes([
      principalNode,
      ...sourceRoleNodes,
      featureNode,
      finalPolicyNode,
      actionNode,
      ...(overridePolicyNode ? [overridePolicyNode] : []),
    ]),
    relations: uniqueRelations([
      createAuthorizationRelation({
        kind: "protects",
        fromNodeId: finalPolicyNode.nodeId,
        toNodeId: featureNode.nodeId,
        metadata: {
          domain: input.audit.domain,
          source: "permission-engine:UserPermissionEngine.audit",
        },
      }),
      createAuthorizationRelation({
        kind: input.audit.granted ? "allows_action" : "denies_action",
        fromNodeId: finalPolicyNode.nodeId,
        toNodeId: actionNode.nodeId,
        metadata: {
          domain: input.audit.domain,
          source: "permission-engine:UserPermissionEngine.audit",
          denialReason: input.audit.denialReason?.kind,
        },
      }),
      ...input.audit.sources.flatMap((source, index) => {
        const roleNode = sourceRoleNodes[index];
        if (!roleNode) return [];
        return [
          createAuthorizationRelation({
            kind: "has_role",
            fromNodeId: principalNode.nodeId,
            toNodeId: roleNode.nodeId,
            metadata: {
              domain: input.audit.domain,
              source: source.source,
              orgRoleId: source.orgRoleId,
              inheritancePath: source.inheritancePath,
            },
          }),
          createAuthorizationRelation({
            kind: "grants_feature",
            fromNodeId: roleNode.nodeId,
            toNodeId: featureNode.nodeId,
            metadata: {
              domain: input.audit.domain,
              source: "permission-engine:UserPermissionEngine.audit",
              finalGranted: input.audit.granted,
            },
          }),
        ];
      }),
      ...(overridePolicyNode
        ? [
            createAuthorizationRelation({
              kind: "denies_feature",
              fromNodeId: overridePolicyNode.nodeId,
              toNodeId: featureNode.nodeId,
              metadata: {
                domain: input.audit.domain,
                userId: input.audit.userId,
                reason: "user-override",
              },
            }),
            createAuthorizationRelation({
              kind: "overrides_permission",
              fromNodeId: overridePolicyNode.nodeId,
              toNodeId: principalNode.nodeId,
              metadata: {
                domain: input.audit.domain,
                feature: input.audit.feature,
              },
            }),
          ]
        : []),
    ]),
  });
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

export function projectEnforcementRoute(input: EnforcementRouteRef): AuthorizationOntologyGraph {
  const routeNode = createResourceNode({
    realm: input.routeRealm,
    resourceId: input.routeId,
    resourceKind: "proxy_route",
    attributes: {
      routeKind: input.routeKind,
      host: input.host,
      path: input.path,
      methods: input.methods ?? [],
    },
  });
  const enforcementNode = createEnforcementPointNode(input.enforcementPoint);
  const upstreamNode = input.upstreamResource
    ? createResourceNode(input.upstreamResource)
    : undefined;
  const policyNode = input.policy ? createPolicyNode(input.policy) : undefined;
  const deploymentNode = input.deploymentSource
    ? createDeploymentSourceNode(input.deploymentSource)
    : undefined;

  return {
    realms: uniqueRealms([
      input.routeRealm,
      input.enforcementPoint.realm,
      ...(input.upstreamResource ? [input.upstreamResource.realm] : []),
      ...(input.policy ? [input.policy.realm] : []),
      ...(input.deploymentSource ? [input.deploymentSource.realm] : []),
    ]),
    nodes: uniqueNodes([
      routeNode,
      enforcementNode,
      ...(upstreamNode ? [upstreamNode] : []),
      ...(policyNode ? [policyNode] : []),
      ...(deploymentNode ? [deploymentNode] : []),
    ]),
    relations: uniqueRelations([
      createAuthorizationRelation({
        kind: "enforced_at",
        fromNodeId: routeNode.nodeId,
        toNodeId: enforcementNode.nodeId,
      }),
      ...(upstreamNode
        ? [
            createAuthorizationRelation({
              kind: "matches_resource",
              fromNodeId: routeNode.nodeId,
              toNodeId: upstreamNode.nodeId,
            }),
          ]
        : []),
      ...(policyNode
        ? [
            createAuthorizationRelation({
              kind: "protects",
              fromNodeId: policyNode.nodeId,
              toNodeId: routeNode.nodeId,
            }),
          ]
        : []),
      ...(deploymentNode
        ? [
            createAuthorizationRelation({
              kind: "deployed_by",
              fromNodeId: routeNode.nodeId,
              toNodeId: deploymentNode.nodeId,
            }),
          ]
        : []),
    ]),
  };
}

export function normalizeStructuredEnforcementRoute(
  config: StructuredEnforcementRouteConfig,
): EnforcementRouteRef {
  const routeId = config.route.id ?? `${config.route.host}${config.route.path}`;
  const routeRealm = createAuthorizationRealm({
    kind: "enforcement",
    authority: config.proxy.authority,
    environment: config.environment,
  });
  const enforcementRealm = createAuthorizationRealm({
    kind: "enforcement",
    authority: config.proxy.authority,
    environment: config.environment,
  });

  return {
    routeRealm,
    routeId,
    routeKind: config.route.kind ?? "proxy_route",
    host: config.route.host,
    path: config.route.path,
    methods: config.route.methods ?? [],
    enforcementPoint: {
      realm: enforcementRealm,
      enforcementPointId: config.proxy.id,
      kind: config.proxy.kind,
    },
    upstreamResource: config.upstream
      ? {
          realm: createAuthorizationRealm({
            kind: "application",
            authority: config.upstream.authority,
            environment: config.environment,
          }),
          resourceId: config.upstream.id,
          resourceKind: config.upstream.kind ?? "service",
        }
      : undefined,
    policy: config.policy
      ? {
          realm: createAuthorizationRealm({
            kind: "policy",
            authority: config.policy.authority,
            environment: config.environment,
          }),
          policyId: config.policy.id,
          policyKind: config.policy.kind ?? "cerbos_resource_policy",
          version: config.policy.version,
        }
      : undefined,
    deploymentSource: config.deployment
      ? {
          realm: createAuthorizationRealm({
            kind: "infra",
            authority: config.deployment.authority,
            environment: config.environment,
          }),
          sourceId: config.deployment.id,
          kind: config.deployment.kind,
          revision: config.deployment.revision,
        }
      : undefined,
  };
}

export function projectStructuredEnforcementRoute(
  config: StructuredEnforcementRouteConfig,
): AuthorizationOntologyGraph {
  return projectEnforcementRoute(normalizeStructuredEnforcementRoute(config));
}

export function projectApplicationAuthorizationBinding(
  input: ApplicationAuthorizationBindingRef,
): AuthorizationOntologyGraph {
  const serviceNode = createResourceNode(input.serviceResource);
  const resourceNode = createResourceNode(input.resource);
  const enforcementNode = createEnforcementPointNode(input.enforcementPoint);
  const policyNode = input.policy ? createPolicyNode(input.policy) : undefined;
  const actionNodes = (input.actions ?? []).map((action) => createActionNode(action));
  const deploymentNode = input.deploymentSource
    ? createDeploymentSourceNode(input.deploymentSource)
    : undefined;

  return {
    realms: uniqueRealms([
      input.serviceResource.realm,
      input.resource.realm,
      input.enforcementPoint.realm,
      ...(input.policy ? [input.policy.realm] : []),
      ...(input.actions ?? []).map((action) => action.realm),
      ...(input.deploymentSource ? [input.deploymentSource.realm] : []),
    ]),
    nodes: uniqueNodes([
      serviceNode,
      resourceNode,
      enforcementNode,
      ...(policyNode ? [policyNode] : []),
      ...actionNodes,
      ...(deploymentNode ? [deploymentNode] : []),
    ]),
    relations: uniqueRelations([
      createAuthorizationRelation({
        kind: "matches_resource",
        fromNodeId: serviceNode.nodeId,
        toNodeId: resourceNode.nodeId,
      }),
      createAuthorizationRelation({
        kind: "enforced_at",
        fromNodeId: resourceNode.nodeId,
        toNodeId: enforcementNode.nodeId,
      }),
      ...(policyNode
        ? [
            createAuthorizationRelation({
              kind: "protects",
              fromNodeId: policyNode.nodeId,
              toNodeId: resourceNode.nodeId,
            }),
          ]
        : []),
      ...actionNodes.map((actionNode) =>
        createAuthorizationRelation({
          kind: "evaluated_by",
          fromNodeId: actionNode.nodeId,
          toNodeId: enforcementNode.nodeId,
          metadata: {
            resourceNodeId: resourceNode.nodeId,
            policyNodeId: policyNode?.nodeId,
          },
        }),
      ),
      ...(deploymentNode
        ? [
            createAuthorizationRelation({
              kind: "deployed_by",
              fromNodeId: resourceNode.nodeId,
              toNodeId: deploymentNode.nodeId,
            }),
          ]
        : []),
    ]),
  };
}

function normalizeStructuredApplicationActions(
  config: StructuredApplicationAuthorizationConfig,
  actionRealm: AuthorizationRealm,
): ActionRef[] {
  return (config.actions ?? []).map((action) => {
    if (typeof action === "string") {
      return {
        realm: actionRealm,
        actionId: action,
        actionKind: action,
      };
    }
    return {
      realm: actionRealm,
      actionId: action.id,
      actionKind: action.kind ?? action.id,
    };
  });
}

export function normalizeStructuredApplicationAuthorization(
  config: StructuredApplicationAuthorizationConfig,
): ApplicationAuthorizationBindingRef {
  const serviceRealm = createAuthorizationRealm({
    kind: "application",
    authority: config.service.authority,
    environment: config.environment,
  });
  const resourceRealm = createAuthorizationRealm({
    kind: "application",
    authority: config.resource.authority ?? config.service.authority,
    environment: config.environment,
  });
  const enforcementRealm = createAuthorizationRealm({
    kind: "enforcement",
    authority: config.middleware?.authority ?? config.service.authority,
    environment: config.environment,
  });
  const policyRealm = config.policy
    ? createAuthorizationRealm({
        kind: "policy",
        authority: config.policy.authority,
        environment: config.environment,
      })
    : undefined;
  const actionRealm = policyRealm ?? resourceRealm;

  return {
    serviceResource: {
      realm: serviceRealm,
      resourceId: config.service.id,
      resourceKind: config.service.kind ?? "service",
    },
    resource: {
      realm: resourceRealm,
      resourceId: config.resource.id,
      resourceKind: config.resource.kind ?? "domain_resource",
      parentResourceId: config.resource.parentResourceId ?? config.service.id,
      classification: config.resource.classification,
      sensitivity: config.resource.sensitivity,
      attributes: config.resource.attributes,
    },
    enforcementPoint: {
      realm: enforcementRealm,
      enforcementPointId: config.middleware?.id ?? `${config.service.id}:middleware`,
      kind: config.middleware?.kind ?? "service_middleware",
    },
    policy: config.policy
      ? {
          realm: policyRealm!,
          policyId: config.policy.id,
          policyKind: config.policy.kind ?? "cerbos_resource_policy",
          version: config.policy.version,
        }
      : undefined,
    actions: normalizeStructuredApplicationActions(config, actionRealm),
    deploymentSource: config.deployment
      ? {
          realm: createAuthorizationRealm({
            kind: "infra",
            authority: config.deployment.authority,
            environment: config.environment,
          }),
          sourceId: config.deployment.id,
          kind: config.deployment.kind,
          revision: config.deployment.revision,
        }
      : undefined,
  };
}

export function projectStructuredApplicationAuthorization(
  config: StructuredApplicationAuthorizationConfig,
): AuthorizationOntologyGraph {
  return projectApplicationAuthorizationBinding(
    normalizeStructuredApplicationAuthorization(config),
  );
}

function parseNginxUpstreams(configText: string): Map<string, string> {
  const upstreams = new Map<string, string>();
  const upstreamPattern = /upstream\s+([a-zA-Z0-9_-]+)\s*\{([\s\S]*?)\}/g;
  for (const match of configText.matchAll(upstreamPattern)) {
    const name = match[1];
    const body = match[2] ?? "";
    const server = body.match(/server\s+([^;]+);/)?.[1]?.trim();
    if (name && server) {
      upstreams.set(name, server);
    }
  }
  return upstreams;
}

export function parseNginxProxyLocations(configText: string): NginxProxyLocation[] {
  const upstreams = parseNginxUpstreams(configText);
  const locations: NginxProxyLocation[] = [];
  const locationPattern = /location\s+([^\s{]+)\s*\{([\s\S]*?)\}/g;
  for (const match of configText.matchAll(locationPattern)) {
    const path = match[1];
    const body = match[2] ?? "";
    const proxyPass = body.match(/proxy_pass\s+([^;]+);/)?.[1]?.trim();
    if (!path || !proxyPass) {
      continue;
    }
    const upstreamName = proxyPass.match(/^https?:\/\/([^/:;]+)/)?.[1];
    locations.push({
      path,
      proxyPass,
      upstreamName,
      upstreamTarget: upstreamName ? upstreams.get(upstreamName) : undefined,
    });
  }
  return locations;
}

export function nginxProxyLocationToStructuredRoute(
  location: NginxProxyLocation,
  options: NginxProxyConfigProjectionOptions,
): StructuredEnforcementRouteConfig {
  const host = options.host ?? "localhost";
  return {
    environment: options.environment,
    route: {
      id: `${host}${location.path}`,
      host,
      path: location.path,
      methods: ["*"],
    },
    proxy: {
      authority: options.proxyAuthority,
      kind: options.proxyKind ?? "nginx_proxy",
      id: options.proxyId,
    },
    upstream: location.upstreamName
      ? {
          authority: options.upstreamAuthority ?? `upstream:${location.upstreamName}`,
          id: location.upstreamName,
          kind: "service",
        }
      : undefined,
    policy: options.policyByPath?.[location.path],
    deployment: options.deployment,
  };
}

export function projectNginxProxyConfig(
  configText: string,
  options: NginxProxyConfigProjectionOptions,
): AuthorizationOntologyGraph {
  const routeGraphs = parseNginxProxyLocations(configText).map((location) =>
    projectStructuredEnforcementRoute(
      nginxProxyLocationToStructuredRoute(location, options),
    ),
  );

  return {
    realms: uniqueRealms(routeGraphs.flatMap((graph) => graph.realms)),
    nodes: uniqueNodes(routeGraphs.flatMap((graph) => graph.nodes)),
    relations: uniqueRelations(routeGraphs.flatMap((graph) => graph.relations)),
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

function getNodeTaxonomy(node: AuthorizationNode, key: string): string | undefined {
  return node.coord.taxonomies[key];
}

function createAuditIssue(input: AuthorizationAuditIssue): AuthorizationAuditIssue {
  return input;
}

function getOutgoingRelations(
  graph: AuthorizationOntologyGraph,
  fromNodeId: string,
  kind?: AuthorizationRelationKind,
): AuthorizationRelation[] {
  return graph.relations.filter(
    (relation) =>
      relation.fromNodeId === fromNodeId && (kind === undefined || relation.kind === kind),
  );
}

function findEquivalentNodeIds(
  graph: AuthorizationOntologyGraph,
  nodesById: Map<string, AuthorizationNode>,
  nodeId: string,
): string[] {
  const node = nodesById.get(nodeId);
  if (!node) {
    return [nodeId];
  }
  return graph.nodes
    .filter(
      (candidate) =>
        candidate.kind === node.kind &&
        candidate.coord.realm === node.coord.realm &&
        candidate.coord.space === node.coord.space &&
        candidate.coord.anchor === node.coord.anchor,
    )
    .map((candidate) => candidate.nodeId);
}

function hasRelationBetweenAny(
  graph: AuthorizationOntologyGraph,
  kind: AuthorizationRelationKind,
  fromNodeIds: string[],
  toNodeIds: string[],
): boolean {
  return graph.relations.some(
    (relation) =>
      relation.kind === kind &&
      fromNodeIds.includes(relation.fromNodeId) &&
      toNodeIds.includes(relation.toNodeId),
  );
}

function policyProtectsResourceThroughRoute(
  graph: AuthorizationOntologyGraph,
  policyNodeIds: string[],
  resourceNodeIds: string[],
  routeResourceKinds: AuthorizationResourceKind[],
  nodesById: Map<string, AuthorizationNode>,
): boolean {
  return graph.relations.some((protectsRelation) => {
    if (
      protectsRelation.kind !== "protects" ||
      !policyNodeIds.includes(protectsRelation.fromNodeId)
    ) {
      return false;
    }
    if (resourceNodeIds.includes(protectsRelation.toNodeId)) {
      return true;
    }
    const protectedNode = nodesById.get(protectsRelation.toNodeId);
    if (!protectedNode || protectedNode.kind !== "resource") {
      return false;
    }
    const resourceKind = getNodeTaxonomy(protectedNode, "resource_kind");
    if (!routeResourceKinds.includes(resourceKind as AuthorizationResourceKind)) {
      return false;
    }
    return graph.relations.some(
      (relation) =>
        relation.kind === "matches_resource" &&
        relation.fromNodeId === protectedNode.nodeId &&
        resourceNodeIds.includes(relation.toNodeId),
    );
  });
}

export function auditAuthorizationGraph(
  graph: AuthorizationOntologyGraph,
  options: AuthorizationGraphAuditOptions = {},
): AuthorizationGraphAuditReport {
  const routeResourceKinds = options.routeResourceKinds ?? ["proxy_route"];
  const applicationResourceKinds = options.applicationResourceKinds ?? ["domain_resource"];
  const requireRoutePolicy = options.requireRoutePolicy ?? true;
  const requireRouteEnforcement = options.requireRouteEnforcement ?? true;
  const requireRouteUpstream = options.requireRouteUpstream ?? true;
  const requireApplicationResourcePolicy = options.requireApplicationResourcePolicy ?? true;
  const requireApplicationResourceEnforcement =
    options.requireApplicationResourceEnforcement ?? true;
  const requireDecisionPolicy = options.requireDecisionPolicy ?? true;
  const requireDecisionEnforcement = options.requireDecisionEnforcement ?? true;
  const requireDecisionPolicyAction = options.requireDecisionPolicyAction ?? true;
  const requireDecisionPolicyResource = options.requireDecisionPolicyResource ?? true;

  const nodesById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const issues: AuthorizationAuditIssue[] = [];

  for (const relation of graph.relations) {
    if (!nodesById.has(relation.fromNodeId) || !nodesById.has(relation.toNodeId)) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "dangling_relation",
          message: `Relation ${relation.kind} points to a missing node`,
          relationId: relation.relationId,
          metadata: {
            fromNodeExists: nodesById.has(relation.fromNodeId),
            toNodeExists: nodesById.has(relation.toNodeId),
          },
        }),
      );
    }
  }

  const routeNodes = graph.nodes.filter(
    (node) =>
      node.kind === "resource" &&
      routeResourceKinds.includes(getNodeTaxonomy(node, "resource_kind") as AuthorizationResourceKind),
  );
  let protectedRouteCount = 0;
  let enforcedRouteCount = 0;

  for (const routeNode of routeNodes) {
    const hasPolicy = graph.relations.some(
      (relation) => relation.kind === "protects" && relation.toNodeId === routeNode.nodeId,
    );
    const hasEnforcement = graph.relations.some(
      (relation) => relation.kind === "enforced_at" && relation.fromNodeId === routeNode.nodeId,
    );
    const hasUpstream = graph.relations.some(
      (relation) => relation.kind === "matches_resource" && relation.fromNodeId === routeNode.nodeId,
    );

    if (hasPolicy) protectedRouteCount += 1;
    if (hasEnforcement) enforcedRouteCount += 1;

    if (requireRoutePolicy && !hasPolicy) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "proxy_route_missing_policy",
          message: `Proxy route ${routeNode.coord.anchor} is not protected by a policy`,
          nodeId: routeNode.nodeId,
        }),
      );
    }
    if (requireRouteEnforcement && !hasEnforcement) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "proxy_route_missing_enforcement",
          message: `Proxy route ${routeNode.coord.anchor} has no enforcement point`,
          nodeId: routeNode.nodeId,
        }),
      );
    }
    if (requireRouteUpstream && !hasUpstream) {
      issues.push(
        createAuditIssue({
          severity: "warning",
          code: "proxy_route_missing_upstream",
          message: `Proxy route ${routeNode.coord.anchor} is not linked to an upstream resource`,
          nodeId: routeNode.nodeId,
        }),
      );
    }
  }

  const applicationResourceNodes = graph.nodes.filter(
    (node) =>
      node.kind === "resource" &&
      applicationResourceKinds.includes(
        getNodeTaxonomy(node, "resource_kind") as AuthorizationResourceKind,
      ),
  );
  let protectedApplicationResourceCount = 0;
  let enforcedApplicationResourceCount = 0;

  for (const resourceNode of applicationResourceNodes) {
    const hasPolicy = graph.relations.some(
      (relation) => relation.kind === "protects" && relation.toNodeId === resourceNode.nodeId,
    );
    const hasEnforcement = graph.relations.some(
      (relation) =>
        relation.kind === "enforced_at" && relation.fromNodeId === resourceNode.nodeId,
    );

    if (hasPolicy) protectedApplicationResourceCount += 1;
    if (hasEnforcement) enforcedApplicationResourceCount += 1;

    if (requireApplicationResourcePolicy && !hasPolicy) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "application_resource_missing_policy",
          message: `Application resource ${resourceNode.coord.anchor} is not protected by a policy`,
          nodeId: resourceNode.nodeId,
        }),
      );
    }
    if (requireApplicationResourceEnforcement && !hasEnforcement) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "application_resource_missing_enforcement",
          message: `Application resource ${resourceNode.coord.anchor} has no application enforcement point`,
          nodeId: resourceNode.nodeId,
        }),
      );
    }
  }

  const decisionNodes = graph.nodes.filter((node) => node.kind === "decision");
  let decisionsWithPolicyCount = 0;

  for (const decisionNode of decisionNodes) {
    const policyRelations = getOutgoingRelations(graph, decisionNode.nodeId, "decision_policy");
    const resourceRelations = getOutgoingRelations(graph, decisionNode.nodeId, "decision_resource");
    const actionRelations = getOutgoingRelations(graph, decisionNode.nodeId, "decision_action");
    const enforcementRelations = getOutgoingRelations(
      graph,
      decisionNode.nodeId,
      "decision_enforcement",
    );

    if (policyRelations.length > 0) decisionsWithPolicyCount += 1;

    if (resourceRelations.length === 0) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "decision_missing_resource",
          message: `Decision ${decisionNode.coord.anchor} has no resource relation`,
          nodeId: decisionNode.nodeId,
        }),
      );
    }
    if (actionRelations.length === 0) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "decision_missing_action",
          message: `Decision ${decisionNode.coord.anchor} has no action relation`,
          nodeId: decisionNode.nodeId,
        }),
      );
    }
    if (requireDecisionPolicy && policyRelations.length === 0) {
      issues.push(
        createAuditIssue({
          severity: "error",
          code: "decision_missing_policy",
          message: `Decision ${decisionNode.coord.anchor} has no policy relation`,
          nodeId: decisionNode.nodeId,
        }),
      );
    }
    if (requireDecisionEnforcement && enforcementRelations.length === 0) {
      issues.push(
        createAuditIssue({
          severity: "warning",
          code: "decision_missing_enforcement",
          message: `Decision ${decisionNode.coord.anchor} has no enforcement relation`,
          nodeId: decisionNode.nodeId,
        }),
      );
    }

    for (const policyRelation of policyRelations) {
      const policyNodeIds = findEquivalentNodeIds(
        graph,
        nodesById,
        policyRelation.toNodeId,
      );
      for (const actionRelation of actionRelations) {
        const actionNodeIds = findEquivalentNodeIds(
          graph,
          nodesById,
          actionRelation.toNodeId,
        );
        const allowsAction = hasRelationBetweenAny(
          graph,
          "allows_action",
          policyNodeIds,
          actionNodeIds,
        );
        const deniesAction = hasRelationBetweenAny(
          graph,
          "denies_action",
          policyNodeIds,
          actionNodeIds,
        );
        const effect = getNodeTaxonomy(decisionNode, "effect");
        const actionLinked = allowsAction || deniesAction;
        if (
          requireDecisionPolicyAction &&
          (!actionLinked || (effect === "allow" && !allowsAction))
        ) {
          issues.push(
            createAuditIssue({
              severity: effect === "allow" ? "error" : "warning",
              code: "decision_policy_action_unlinked",
              message: `Decision ${decisionNode.coord.anchor} action is not declared by its policy`,
              nodeId: decisionNode.nodeId,
              metadata: {
                policyNodeId: policyRelation.toNodeId,
                actionNodeId: actionRelation.toNodeId,
                effect,
              },
            }),
          );
        }
      }

      for (const resourceRelation of resourceRelations) {
        const resourceNodeIds = findEquivalentNodeIds(
          graph,
          nodesById,
          resourceRelation.toNodeId,
        );
        const linked = policyProtectsResourceThroughRoute(
          graph,
          policyNodeIds,
          resourceNodeIds,
          routeResourceKinds,
          nodesById,
        );
        if (requireDecisionPolicyResource && !linked) {
          issues.push(
            createAuditIssue({
              severity: "warning",
              code: "decision_policy_resource_unlinked",
              message: `Decision ${decisionNode.coord.anchor} resource is not protected by its policy graph`,
              nodeId: decisionNode.nodeId,
              metadata: {
                policyNodeId: policyRelation.toNodeId,
                resourceNodeId: resourceRelation.toNodeId,
              },
            }),
          );
        }
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;

  return {
    ok: errors === 0,
    summary: {
      routeCount: routeNodes.length,
      protectedRouteCount,
      enforcedRouteCount,
      applicationResourceCount: applicationResourceNodes.length,
      protectedApplicationResourceCount,
      enforcedApplicationResourceCount,
      decisionCount: decisionNodes.length,
      decisionsWithPolicyCount,
      errors,
      warnings,
    },
    issues,
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
