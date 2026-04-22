// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * AccessChecker — 2-pass 권한 체크 + audit 기록 통합.
 *
 * Pass 1: DisjointUnionIndex address로 bitmap bit 체크 (O(1))
 * Pass 2: kind="resource"일 때 ResourcePolicyRegistry FSM 기반 인스턴스 판정
 *
 * 트랜잭션도 API이므로 동일한 Pass 1을 거친다. kind="transaction"은 Pass 2 스킵.
 *
 * 모든 판정 단계는 AuditRecorder에 기록된다.
 */

import { hasBit } from "weighted-index";
import { DisjointUnionIndex } from "weighted-index";

import type { AuditRecorder, CheckPass } from "../audit/index.js";
import type { VersionedBitmap } from "../versioned-bitmap/index.js";
import type {
  ResourcePolicy,
  ResourcePolicyRegistry,
} from "../resource-policy/index.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AccessContext {
  /** 실행 주체. */
  userId: string;
  tenantId?: string;
  /** 검증된 VersionedBitmap. 호출 전에 verifyBitmap()으로 통과해야 함. */
  bitmap: VersionedBitmap;
  /** audit 트리 parent. 없으면 null (root). */
  parentSpanId: string | null;
  /** OTEL trace id. */
  traceId: string;
  /** span id generator — 호출자가 주입 (OTEL context 또는 테스트 mock). */
  newSpanId: () => string;
}

export interface ApiCall {
  /** DisjointUnionIndex variant. */
  kind: "resource" | "transaction";
  /** 사람이 읽는 API 식별자 (로깅용). */
  apiId: string;
  /** bitmap encode용 좌표. variant의 shape에 맞음. */
  coords: number[];
  /** audit에 기록될 target 식별자. kind="resource"이면 resource_type, kind="transaction"이면 transition_id. */
  targetId: string;
  /** kind="resource"일 때만. Pass 2 lifecycle 체크 대상. */
  resource?: {
    id: string;
    ownerId: string;
  };
}

export interface InstancePolicyResolver {
  resolve(resourceId: string): Promise<ResourcePolicy | null>;
}

/** Cerbos/ACL 판정은 구체 구현을 주입 (adapter 패턴). */
export interface InstancePolicyEvaluator {
  /** REGISTERED 상태 판정. */
  evaluateRegistered(args: {
    userId: string;
    resourceId: string;
    policyRef: string;
  }): Promise<boolean>;

  /** DELEGATED 상태 판정. */
  evaluateDelegated(args: {
    userId: string;
    resourceId: string;
    graphRootId: string;
  }): Promise<boolean>;
}

export interface AccessCheckerDeps {
  union: DisjointUnionIndex;
  policyRegistry: ResourcePolicyRegistry;
  evaluator: InstancePolicyEvaluator;
  audit: AuditRecorder;
}

export interface AccessResult {
  allowed: boolean;
  /** 거절 시 사유 코드. */
  denyReason?: string;
  /** execution entry의 spanId. finish는 호출자가 책임. */
  executionSpanId: string;
}

// ── Checker ──────────────────────────────────────────────────────────────────

export class AccessChecker {
  constructor(private readonly deps: AccessCheckerDeps) {}

  async check(ctx: AccessContext, call: ApiCall): Promise<AccessResult> {
    // 1. execution entry 시작
    const execSpanId = ctx.newSpanId();
    await this.deps.audit.startExecution({
      spanId: execSpanId,
      traceId: ctx.traceId,
      parentSpanId: ctx.parentSpanId,
      apiId: call.apiId,
      actorUserId: ctx.userId,
      actorTenantId: ctx.tenantId,
      targetKind: call.kind,
      targetId: call.targetId,
    });

    // 2. Pass 1 — bitmap bit 체크
    const addr = this.deps.union.encode(call.kind, call.coords);
    const pass1 = hasBit(ctx.bitmap.mask, addr);

    await this.deps.audit.recordCheck({
      spanId: ctx.newSpanId(),
      traceId: ctx.traceId,
      parentSpanId: execSpanId,
      pass: "bitmap",
      outcome: pass1 ? "allow" : "deny",
      address: addr,
      unionKind: call.kind,
      denyReason: pass1 ? undefined : "bitmap_bit_not_set",
    });

    if (!pass1) {
      await this.deps.audit.finishExecution(execSpanId, "deny");
      return {
        allowed: false,
        denyReason: "bitmap_bit_not_set",
        executionSpanId: execSpanId,
      };
    }

    // 3. Pass 2 — transaction kind는 Pass 2 스킵
    if (call.kind === "transaction" || !call.resource) {
      await this.deps.audit.finishExecution(execSpanId, "allow");
      return { allowed: true, executionSpanId: execSpanId };
    }

    // 4. 인스턴스 lifecycle
    const policy = await this.deps.policyRegistry.resolve(call.resource.id);
    if (!policy) {
      await this.logCheckAndFinish(
        ctx, execSpanId, "lifecycle", "deny", "policy_not_found",
      );
      return {
        allowed: false,
        denyReason: "policy_not_found",
        executionSpanId: execSpanId,
      };
    }

    const [ok, pass, denyReason] = await this.evaluateInstance(
      ctx.userId, call.resource, policy,
    );

    await this.deps.audit.recordCheck({
      spanId: ctx.newSpanId(),
      traceId: ctx.traceId,
      parentSpanId: execSpanId,
      pass,
      outcome: ok ? "allow" : "deny",
      denyReason: ok ? undefined : denyReason,
    });

    await this.deps.audit.finishExecution(execSpanId, ok ? "allow" : "deny");
    return {
      allowed: ok,
      denyReason: ok ? undefined : denyReason,
      executionSpanId: execSpanId,
    };
  }

  private async evaluateInstance(
    userId: string,
    resource: { id: string; ownerId: string },
    policy: ResourcePolicy,
  ): Promise<[boolean, CheckPass, string | undefined]> {
    switch (policy.state) {
      case "UNREGISTERED": {
        const ok = resource.ownerId === userId;
        return [ok, "lifecycle", ok ? undefined : "not_owner"];
      }
      case "REGISTERED": {
        if (!policy.cerbosPolicyRef) {
          return [false, "cerbos", "missing_policy_ref"];
        }
        const ok = await this.deps.evaluator.evaluateRegistered({
          userId, resourceId: resource.id, policyRef: policy.cerbosPolicyRef,
        });
        return [ok, "cerbos", ok ? undefined : "cerbos_deny"];
      }
      case "DELEGATED": {
        if (!policy.graphRootId) {
          return [false, "acl", "missing_graph_root"];
        }
        const ok = await this.deps.evaluator.evaluateDelegated({
          userId, resourceId: resource.id, graphRootId: policy.graphRootId,
        });
        return [ok, "acl", ok ? undefined : "acl_deny"];
      }
    }
  }

  private async logCheckAndFinish(
    ctx: AccessContext,
    execSpanId: string,
    pass: CheckPass,
    outcome: "allow" | "deny",
    denyReason?: string,
  ): Promise<void> {
    await this.deps.audit.recordCheck({
      spanId: ctx.newSpanId(),
      traceId: ctx.traceId,
      parentSpanId: execSpanId,
      pass,
      outcome,
      denyReason,
    });
    await this.deps.audit.finishExecution(execSpanId, outcome);
  }
}
