// @def.boundary sim-pm-api
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
import { createResourcePolicyRegistry, RESOURCE_POLICIES_DDL } from "resource-policy-store";
import { createSimAuditRecorder } from "@qa-sdk/sim-audit-recorder-provider";
import { AUDIT_ENTRIES_DDL } from "audit-recorder-store";
import { DisjointUnionIndex } from "weighted-index";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { PmRepository } from "../pm/shared/port.js";
import { ProjectDelegationGraphStore } from "./delegation-graph-store.js";

export const PROJECT_ACCESS_CHECKER = Symbol("PROJECT_ACCESS_CHECKER");
export const PROJECT_POLICY_REGISTRY = Symbol("PROJECT_POLICY_REGISTRY");
export const PROJECT_DELEGATION_GRAPH = Symbol("PROJECT_DELEGATION_GRAPH");

/**
 * 기본 InstancePolicyEvaluator — sim 시뮬용.
 *
 * REGISTERED:
 * - owner / project member / admin 허용
 *
 * DELEGATED:
 * - owner / project member / admin 허용
 * - delegate endpoint가 기록한 authorization graph snapshot 에 delegate principal 이 있으면 허용
 *
 * 현재 adapter는 `AuthorizationGraphStore` contract 위의 in-memory 구현이다.
 */
class SimInstanceEvaluator implements InstancePolicyEvaluator {
  constructor(
    private readonly repo: PmRepository | undefined,
    private readonly delegationGraph: ProjectDelegationGraphStore,
  ) {}

  async evaluateRegistered(args: {
    userId: string;
    resourceId: string;
    policyRef: string;
    attributes?: Record<string, unknown>;
  }): Promise<InstancePolicyDecision> {
    if (!this.repo) {
      return { allowed: args.policyRef.length > 0, denyReason: "pm_repo_unavailable" };
    }
    const project = await this.repo.findProject(args.resourceId);
    if (!project) {
      return { allowed: false, denyReason: "project_not_found" };
    }
    if (project.ownerId === args.userId) {
      return { allowed: true };
    }
    const members = await this.repo.listMembers(args.resourceId);
    if (members.some((member) => member.userId === args.userId)) {
      return { allowed: true };
    }
    const roleNames = asStringArray(args.attributes?.actorRoleNames);
    if (roleNames.includes("admin")) {
      return { allowed: true };
    }
    return { allowed: false, denyReason: "project_membership_required" };
  }

  async evaluateDelegated(args: {
    userId: string;
    resourceId: string;
    graphRootId: string;
    attributes?: Record<string, unknown>;
  }): Promise<InstancePolicyDecision> {
    if (!this.repo) {
      return { allowed: args.graphRootId.length > 0, denyReason: "pm_repo_unavailable" };
    }
    const project = await this.repo.findProject(args.resourceId);
    if (!project) {
      return { allowed: false, denyReason: "project_not_found" };
    }
    if (project.ownerId === args.userId) {
      return { allowed: true };
    }
    const members = await this.repo.listMembers(args.resourceId);
    if (members.some((member) => member.userId === args.userId)) {
      return { allowed: true };
    }
    const roleNames = asStringArray(args.attributes?.actorRoleNames);
    if (roleNames.includes("admin")) {
      return { allowed: true };
    }
    if (await this.delegationGraph.hasDelegate(args.graphRootId, args.userId)) {
      return { allowed: true };
    }
    return { allowed: false, denyReason: "delegation_not_found" };
  }
}

/**
 * 기본 DisjointUnionIndex — pm 시뮬용.
 *
 * 실제 DSL 카탈로그와 독립된 테스트/시뮬 전용 variant 공간. kind="transaction"
 * 사용 시 Pass 2 스킵되므로 실제 address는 중요하지 않음 — 비트 bitmap 통과 위해
 * 기본 0번 address에 set된 mask를 사용 (Plan 05 evaluator 책임 외).
 */
function buildDefaultUnion(): DisjointUnionIndex {
  // pm_api_action 4개 value (project.create/read/update/delete) = 4 positions
  // labels 는 dimension name (WeightedIndex 요구) — 1 dim 이므로 label 1개.
  // kind="transaction" 과 "resource" 양쪽에 동일 action 공간 제공.
  return new DisjointUnionIndex([
    { kind: "transaction", shape: [4], labels: ["action"] },
    { kind: "resource", shape: [4], labels: ["action"] },
  ]);
}

export interface AccessCheckerModuleOptions {
  /** Plan 05c factory 에 전달할 db. 테스트에서는 SQLite in-memory. */
  db?: unknown;
  dialect?: "sqlite" | "pg";
  /** 테스트에서 AccessChecker fake 를 주입하고 싶을 때. */
  overrideChecker?: AccessChecker;
  overrideRegistry?: ResourcePolicyRegistry;
  /** audit recorder override. 기본 InMemoryAuditRecorder. */
  overrideAudit?: AuditRecorder;
  /** evaluator override. 기본 SimInstanceEvaluator. */
  overrideEvaluator?: InstancePolicyEvaluator;
  /** union override. 기본 buildDefaultUnion(). */
  overrideUnion?: DisjointUnionIndex;
  /** membership 기반 REGISTERED 판정용 repository. */
  repo?: PmRepository;
}

export interface AccessCheckerAsyncOptions {
  imports?: NonNullable<DynamicModule["imports"]>;
  inject?: Array<string | symbol | (new (...args: never[]) => unknown)>;
  useFactory: (...args: unknown[]) => Promise<AccessCheckerModuleOptions> | AccessCheckerModuleOptions;
}

@Module({})
export class AccessCheckerModule {
  /**
   * forRootAsync — 호출자가 db instance 를 factory 로 주입.
   *
   * 테스트에서는 overrideChecker 로 fake 를 주입 가능.
   * 운영에서는 db + dialect 만 주입해 실 registry 자동 생성.
   */
  static forRootAsync(opts: AccessCheckerAsyncOptions): DynamicModule {
    const delegationGraphProvider: Provider = {
      provide: PROJECT_DELEGATION_GRAPH,
      useValue: new ProjectDelegationGraphStore(),
    };
    const registryProvider: Provider = {
      provide: PROJECT_POLICY_REGISTRY,
      useFactory: async (...deps: unknown[]): Promise<ResourcePolicyRegistry> => {
        const resolved = await opts.useFactory(...deps);
        if (resolved.overrideRegistry) return resolved.overrideRegistry;
        if (!resolved.db || !resolved.dialect) {
          throw new Error(
            "AccessCheckerModule: db + dialect 또는 overrideRegistry 필수",
          );
        }
        // SQLite 경로는 resource-policies DDL 자동 적용 (in-memory fixture 대비).
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
      provide: PROJECT_ACCESS_CHECKER,
      useFactory: async (
        registry: ResourcePolicyRegistry,
        delegationGraph: ProjectDelegationGraphStore,
        ...deps: unknown[]
      ): Promise<AccessChecker> => {
        const resolved = await opts.useFactory(...deps);
        if (resolved.overrideChecker) return resolved.overrideChecker;

        // 실 AuditRecorder 주입 — 같은 db 공유 (pm_db + resource_policies + audit_entries).
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
          evaluator: resolved.overrideEvaluator ?? new SimInstanceEvaluator(resolved.repo, delegationGraph),
          audit,
        };
        return new AccessChecker(checkerDeps);
      },
      inject: [PROJECT_POLICY_REGISTRY, PROJECT_DELEGATION_GRAPH, ...(opts.inject ?? [])],
    };

    return {
      module: AccessCheckerModule,
      imports: opts.imports ?? [],
      providers: [delegationGraphProvider, registryProvider, checkerProvider],
      exports: [PROJECT_ACCESS_CHECKER, PROJECT_POLICY_REGISTRY, PROJECT_DELEGATION_GRAPH],
      global: true,
    };
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
