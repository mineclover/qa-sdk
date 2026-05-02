// @def.boundary sim-approval-api
// @def.doc authorization-ontology-resource-lifecycle

import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import {
  AccessChecker,
  InMemoryAuditRecorder,
  type AccessCheckerDeps,
  type AuditRecorder,
  type InstancePolicyDecision,
  type InstancePolicyEvaluator,
  type ResourcePolicyRegistry,
} from "permission-engine";
import {
  createResourcePolicyRegistry,
  RESOURCE_POLICIES_DDL,
} from "resource-policy-store";
import { createSimAuditRecorder } from "@qa-sdk/sim-audit-recorder-provider";
import { AUDIT_ENTRIES_DDL } from "audit-recorder-store";
import { DisjointUnionIndex } from "weighted-index";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ApprovalRepository } from "../approval/shared/port.js";

export const APPROVAL_ACCESS_CHECKER = Symbol("APPROVAL_ACCESS_CHECKER");
export const APPROVAL_POLICY_REGISTRY = Symbol("APPROVAL_POLICY_REGISTRY");

class SimInstanceEvaluator implements InstancePolicyEvaluator {
  constructor(private readonly repo: ApprovalRepository | undefined) {}

  async evaluateRegistered(args: {
    userId: string;
    resourceId: string;
    policyRef: string;
    attributes?: Record<string, unknown>;
  }): Promise<InstancePolicyDecision> {
    if (!this.repo) {
      return { allowed: args.policyRef.length > 0, denyReason: "approval_repo_unavailable" };
    }
    const request = await this.repo.findBudgetRequest(args.resourceId);
    if (!request) {
      return { allowed: false, denyReason: "request_not_found" };
    }

    const roleNames = asStringArray(args.attributes?.actorRoleNames);
    const actorDepartmentId = asNullableString(args.attributes?.actorDepartmentId);
    const roleAssignments = asRoleAssignments(args.attributes?.actorRoleAssignments);
    const apiId = asString(args.attributes?.apiId);

    if (roleNames.includes("admin")) {
      return { allowed: true };
    }

    const isOwner = request.requesterId === args.userId;
    if (isOwner && apiId !== "budget.approve" && apiId !== "budget.reject") {
      return { allowed: true };
    }

    const sameDepartment =
      actorDepartmentId !== null && actorDepartmentId === request.projectDepartmentId;
    const scopedManager = hasScopedRole(roleAssignments, ["manager"], request.projectDepartmentId);
    const scopedDirector = hasScopedRole(roleAssignments, ["director"], request.projectDepartmentId);
    const scopedApprover = hasScopedRole(roleAssignments, ["approver"], request.projectDepartmentId);
    const globalCfo = hasScopedRole(roleAssignments, ["cfo"], request.projectDepartmentId);
    const globalAdmin = hasScopedRole(roleAssignments, ["admin"], request.projectDepartmentId);
    const scopedStageCapability =
      scopedManager || scopedDirector || scopedApprover || globalCfo || globalAdmin;
    if (!sameDepartment && !scopedStageCapability) {
      return { allowed: false, denyReason: "cross_department_requires_approver_role" };
    }

    if (apiId === "budget.read" || apiId === "budget.submit" || apiId === "budget.start-review") {
      return {
        allowed: sameDepartment || scopedStageCapability,
        denyReason: sameDepartment || scopedStageCapability ? undefined : "department_scope_mismatch",
      };
    }

    const stageAllowed = isStageRoleAllowed(request.currentStage, {
      scopedManager,
      scopedDirector,
      scopedApprover,
      globalCfo,
      globalAdmin,
      roleNames,
    });
    return {
      allowed: stageAllowed,
      denyReason: stageAllowed ? undefined : "approval_stage_role_mismatch",
    };
  }

  async evaluateDelegated(args: {
    userId: string;
    resourceId: string;
    graphRootId: string;
    attributes?: Record<string, unknown>;
  }): Promise<InstancePolicyDecision> {
    const roleNames = asStringArray(args.attributes?.actorRoleNames);
    return {
      allowed: hasAnyRole(roleNames, ["admin", "approver", "cfo"]),
      denyReason: hasAnyRole(roleNames, ["admin", "approver", "cfo"]) ? undefined : "delegation_not_supported",
    };
  }
}

function buildDefaultUnion(): DisjointUnionIndex {
  // approval_api_action 6 values — WeightedIndex labels 는 dimension name.
  return new DisjointUnionIndex([
    { kind: "transaction", shape: [6], labels: ["action"] },
    { kind: "resource", shape: [6], labels: ["action"] },
  ]);
}

export interface AccessCheckerModuleOptions {
  db?: unknown;
  dialect?: "sqlite" | "pg";
  overrideChecker?: AccessChecker;
  overrideRegistry?: ResourcePolicyRegistry;
  overrideAudit?: AuditRecorder;
  overrideEvaluator?: InstancePolicyEvaluator;
  overrideUnion?: DisjointUnionIndex;
  repo?: ApprovalRepository;
}

export interface AccessCheckerAsyncOptions {
  imports?: NonNullable<DynamicModule["imports"]>;
  inject?: Array<string | symbol | (new (...args: never[]) => unknown)>;
  useFactory: (
    ...args: unknown[]
  ) => Promise<AccessCheckerModuleOptions> | AccessCheckerModuleOptions;
}

@Module({})
export class AccessCheckerModule {
  static forRootAsync(opts: AccessCheckerAsyncOptions): DynamicModule {
    const registryProvider: Provider = {
      provide: APPROVAL_POLICY_REGISTRY,
      useFactory: async (...deps: unknown[]): Promise<ResourcePolicyRegistry> => {
        const resolved = await opts.useFactory(...deps);
        if (resolved.overrideRegistry) return resolved.overrideRegistry;
        if (!resolved.db || !resolved.dialect) {
          throw new Error(
            "AccessCheckerModule: db + dialect 또는 overrideRegistry 필수",
          );
        }
        if (resolved.dialect === "sqlite") {
          const raw = (resolved.db as BetterSQLite3Database as unknown as {
            $client: { exec: (sql: string) => void };
          }).$client;
          if (raw && typeof raw.exec === "function") {
            raw.exec(RESOURCE_POLICIES_DDL);
          }
        }
        return createResourcePolicyRegistry({
          dialect: resolved.dialect,
          db: resolved.db as BetterSQLite3Database | PostgresJsDatabase,
        });
      },
      inject: opts.inject ?? [],
    };

    const checkerProvider: Provider = {
      provide: APPROVAL_ACCESS_CHECKER,
      useFactory: async (
        registry: ResourcePolicyRegistry,
        ...deps: unknown[]
      ): Promise<AccessChecker> => {
        const resolved = await opts.useFactory(...deps);
        if (resolved.overrideChecker) return resolved.overrideChecker;

        let audit: AuditRecorder;
        if (resolved.overrideAudit) {
          audit = resolved.overrideAudit;
        } else if (resolved.db && resolved.dialect) {
          if (resolved.dialect === "sqlite") {
            const raw = (resolved.db as BetterSQLite3Database as unknown as {
              $client: { exec: (sql: string) => void };
            }).$client;
            if (raw && typeof raw.exec === "function") {
              raw.exec(AUDIT_ENTRIES_DDL);
            }
          }
          audit = await createSimAuditRecorder({
            dialect: resolved.dialect,
            db: resolved.db,
          });
        } else {
          audit = new InMemoryAuditRecorder();
        }

        const checkerDeps: AccessCheckerDeps = {
          union: resolved.overrideUnion ?? buildDefaultUnion(),
          policyRegistry: registry,
          evaluator: resolved.overrideEvaluator ?? new SimInstanceEvaluator(resolved.repo),
          audit,
        };
        return new AccessChecker(checkerDeps);
      },
      inject: [APPROVAL_POLICY_REGISTRY, ...(opts.inject ?? [])],
    };

    return {
      module: AccessCheckerModule,
      imports: opts.imports ?? [],
      providers: [registryProvider, checkerProvider],
      exports: [APPROVAL_ACCESS_CHECKER, APPROVAL_POLICY_REGISTRY],
      global: true,
    };
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function hasAnyRole(roleNames: readonly string[], expected: readonly string[]): boolean {
  return expected.some((role) => roleNames.includes(role));
}

function asRoleAssignments(
  value: unknown,
): Array<{ roleId: string; roleName: string; scopeType: string; scopeId: string | null }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    item &&
    typeof item === "object" &&
    typeof (item as Record<string, unknown>).roleId === "string" &&
    typeof (item as Record<string, unknown>).roleName === "string" &&
    typeof (item as Record<string, unknown>).scopeType === "string"
      ? [{
          roleId: (item as Record<string, unknown>).roleId as string,
          roleName: (item as Record<string, unknown>).roleName as string,
          scopeType: (item as Record<string, unknown>).scopeType as string,
          scopeId:
            typeof (item as Record<string, unknown>).scopeId === "string" || (item as Record<string, unknown>).scopeId === null
              ? ((item as Record<string, unknown>).scopeId as string | null)
              : null,
        }]
      : [],
  );
}

function hasScopedRole(
  assignments: readonly { roleName: string; scopeType: string; scopeId: string | null }[],
  expectedRoleNames: readonly string[],
  projectDepartmentId: string,
): boolean {
  return assignments.some((assignment) => {
    if (!expectedRoleNames.includes(assignment.roleName)) return false;
    return assignment.scopeType === "global" ||
      (assignment.scopeType === "department" && assignment.scopeId === projectDepartmentId);
  });
}

function isStageRoleAllowed(
  stage: number,
  args: {
    scopedManager: boolean;
    scopedDirector: boolean;
    scopedApprover: boolean;
    globalCfo: boolean;
    globalAdmin: boolean;
    roleNames: readonly string[];
  },
): boolean {
  if (stage <= 1) {
    return args.scopedManager || args.scopedDirector || args.scopedApprover || args.globalCfo || args.globalAdmin;
  }
  if (stage === 2) {
    return args.scopedDirector || args.scopedApprover || args.globalCfo || args.globalAdmin;
  }
  return args.scopedApprover || args.globalCfo || args.globalAdmin;
}
