// @def.boundary sim-pm-api
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
import { createResourcePolicyRegistry } from "resource-policy-store";
import { DisjointUnionIndex } from "weighted-index";

export const PROJECT_ACCESS_CHECKER = Symbol("PROJECT_ACCESS_CHECKER");
export const PROJECT_POLICY_REGISTRY = Symbol("PROJECT_POLICY_REGISTRY");

/**
 * 기본 InstancePolicyEvaluator — sim 시뮬용 (Cerbos 미도입).
 *
 * REGISTERED 상태는 policyRef 존재 시 모두 allow (정책 구현 이전 단계 placeholder).
 * DELEGATED 상태는 graphRoot 존재 시 모두 allow. sim 시나리오에서 충분.
 */
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

/**
 * 기본 DisjointUnionIndex — pm 시뮬용.
 *
 * 실제 DSL 카탈로그와 독립된 테스트/시뮬 전용 variant 공간. kind="transaction"
 * 사용 시 Pass 2 스킵되므로 실제 address는 중요하지 않음 — 비트 bitmap 통과 위해
 * 기본 0번 address에 set된 mask를 사용 (Plan 05 evaluator 책임 외).
 */
function buildDefaultUnion(): DisjointUnionIndex {
  // pm_api_action 4개 라벨 (project.create/read/update/delete) = 4 positions
  // kind="transaction" 과 "resource" 양쪽에 동일 action 공간 제공.
  const labels = [
    "project.create",
    "project.read",
    "project.update",
    "project.delete",
  ];
  return new DisjointUnionIndex([
    { kind: "transaction", shape: [labels.length], labels },
    { kind: "resource", shape: [labels.length], labels },
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
        return createResourcePolicyRegistry({
          dialect: resolved.dialect,
          db: resolved.db as never,
        });
      },
      inject: opts.inject ?? [],
    };

    const checkerProvider: Provider = {
      provide: PROJECT_ACCESS_CHECKER,
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
      inject: [PROJECT_POLICY_REGISTRY, ...(opts.inject ?? [])],
    };

    return {
      module: AccessCheckerModule,
      imports: opts.imports ?? [],
      providers: [registryProvider, checkerProvider],
      exports: [PROJECT_ACCESS_CHECKER, PROJECT_POLICY_REGISTRY],
      global: true,
    };
  }
}
