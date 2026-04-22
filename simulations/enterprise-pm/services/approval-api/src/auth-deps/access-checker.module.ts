// @def.boundary sim-approval-api
// @def.doc authorization-ontology-resource-lifecycle

import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import {
  AccessChecker,
  InMemoryAuditRecorder,
  type AccessCheckerDeps,
  type AuditRecorder,
  type InstancePolicyEvaluator,
  type ResourcePolicyRegistry,
} from "permission-engine";
import {
  createResourcePolicyRegistry,
  RESOURCE_POLICIES_DDL,
} from "resource-policy-store";
import { DisjointUnionIndex } from "weighted-index";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export const APPROVAL_ACCESS_CHECKER = Symbol("APPROVAL_ACCESS_CHECKER");
export const APPROVAL_POLICY_REGISTRY = Symbol("APPROVAL_POLICY_REGISTRY");

class SimInstanceEvaluator implements InstancePolicyEvaluator {
  async evaluateRegistered(args: {
    userId: string;
    resourceId: string;
    policyRef: string;
  }): Promise<boolean> {
    return args.policyRef.length > 0;
  }

  async evaluateDelegated(args: {
    userId: string;
    resourceId: string;
    graphRootId: string;
  }): Promise<boolean> {
    return args.graphRootId.length > 0;
  }
}

function buildDefaultUnion(): DisjointUnionIndex {
  // approval_api_action 6 라벨
  const labels = [
    "budget.create",
    "budget.read",
    "budget.submit",
    "budget.start-review",
    "budget.approve",
    "budget.reject",
  ];
  return new DisjointUnionIndex([
    { kind: "transaction", shape: [labels.length], labels },
    { kind: "resource", shape: [labels.length], labels },
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
        const checkerDeps: AccessCheckerDeps = {
          union: resolved.overrideUnion ?? buildDefaultUnion(),
          policyRegistry: registry,
          evaluator: resolved.overrideEvaluator ?? new SimInstanceEvaluator(),
          audit: resolved.overrideAudit ?? new InMemoryAuditRecorder(),
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
