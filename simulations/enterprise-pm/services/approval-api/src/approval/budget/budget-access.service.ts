// @def.boundary sim-approval-api
// @def.doc authorization-ontology-resource-lifecycle

import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { AccessChecker, AccessContext, AccessResult, ApiCall } from "permission-engine";
import { APPROVAL_ACCESS_CHECKER } from "../../auth-deps/access-checker.module.js";
import type { CurrentUserContext } from "../../auth-deps/current-user.decorator.js";

export type BudgetApiId =
  | "budget.create"
  | "budget.read"
  | "budget.submit"
  | "budget.start-review"
  | "budget.approve"
  | "budget.reject";

export interface BudgetAccessInput {
  apiId: BudgetApiId;
  user: CurrentUserContext;
  requestId: string | null;
  projectDepartmentId: string | null;
  approverDepartmentId?: string | null;
  /** resource 소유자 id. null 이면 Pass 2 스킵 (transaction kind). */
  resourceOwnerId?: string | null;
}

export interface BudgetCheckResult {
  allow: boolean;
  rootSpanId: string;
  denyReason?: string;
  firstFailureSpanId?: string;
}

const BUDGET_API_COORDS: Record<BudgetApiId, number[]> = {
  "budget.create": [0],
  "budget.read": [1],
  "budget.submit": [2],
  "budget.start-review": [3],
  "budget.approve": [4],
  "budget.reject": [5],
};

function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

function newTraceId(): string {
  return randomBytes(16).toString("hex");
}

@Injectable()
export class BudgetAccessService {
  constructor(
    @Inject(APPROVAL_ACCESS_CHECKER) private readonly checker: AccessChecker,
  ) {}

  async check(input: BudgetAccessInput): Promise<BudgetCheckResult> {
    const hasResource =
      input.requestId !== null &&
      input.resourceOwnerId !== null &&
      input.resourceOwnerId !== undefined;

    const call: ApiCall = hasResource
      ? {
          kind: "resource",
          apiId: input.apiId,
          coords: BUDGET_API_COORDS[input.apiId],
          targetId: input.requestId!,
          resource: {
            id: input.requestId!,
            ownerId: input.resourceOwnerId!,
          },
        }
      : {
          kind: "transaction",
          apiId: input.apiId,
          coords: BUDGET_API_COORDS[input.apiId],
          targetId: input.requestId ?? input.apiId,
        };

    const ctx: AccessContext = {
      userId: input.user.userId,
      bitmap: {
        prefix: "sim.bitmap",
        v: input.user.bitmapVersion,
        mask: input.user.bitmapMask,
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        issuer: "sim-approval-api",
        signature: "",
      },
      parentSpanId: null,
      traceId: newTraceId(),
      newSpanId,
    };

    const result: AccessResult = await this.checker.check(ctx, call);

    return {
      allow: result.allowed,
      rootSpanId: result.executionSpanId,
      denyReason: result.denyReason,
    };
  }
}
