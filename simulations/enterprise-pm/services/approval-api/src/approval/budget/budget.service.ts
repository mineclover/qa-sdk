// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable, Optional } from "@nestjs/common";
import { createLogger } from "../../lib/logger.js";
import type { ResourcePolicyRegistry } from "permission-engine";
import { APPROVAL_REPOSITORY } from "../approval-db.module.js";
import { APPROVAL_POLICY_REGISTRY } from "../../auth-deps/access-checker.module.js";
import type { ApprovalRepository } from "../shared/port.js";
import type { BudgetRequest, BudgetRequestCreate, ApprovalStep } from "../shared/types.js";
import {
  RequestNotFoundError,
  InvalidTransitionError,
} from "../shared/errors.js";
import { transitionRequest, applyDecision } from "../shared/budget-state.js";

const log = createLogger("sim-approval-api.budget.service");

/**
 * BudgetService.create 는 2-step:
 *   1. budget_requests INSERT (ApprovalRepository)
 *   2. resource-policy-store create — state=UNREGISTERED, ownerId=requesterId
 *
 * Pass 2 lifecycle 분기에서 policy 가 없으면 "policy_not_found" deny.
 * UNREGISTERED + ownerId=requesterId 매칭으로 requester 만 초기 접근 가능.
 */
@Injectable()
export class BudgetService {
  constructor(
    @Inject(APPROVAL_REPOSITORY) private readonly repo: ApprovalRepository,
    @Optional()
    @Inject(APPROVAL_POLICY_REGISTRY)
    private readonly policies?: ResourcePolicyRegistry,
  ) {}

  async create(args: BudgetRequestCreate): Promise<BudgetRequest> {
    const request = await this.repo.createBudgetRequest(args);
    if (!this.policies) {
      log.warn(
        { requestId: request.id },
        "APPROVAL_POLICY_REGISTRY 미등록 — UNREGISTERED policy 생성 생략",
      );
      return request;
    }
    try {
      await this.policies.create({
        resourceId: request.id,
        resourceType: "budget_request",
        ownerId: args.requesterId,
      });
    } catch (err) {
      log.error(
        { err, requestId: request.id },
        "policy 생성 실패 — budget_request 롤백 고려 필요",
      );
      throw err;
    }
    return request;
  }

  find(id: string): Promise<BudgetRequest | null> {
    return this.repo.findBudgetRequest(id);
  }

  listByProject(projectId: string): Promise<BudgetRequest[]> {
    return this.repo.listBudgetRequestsByProject(projectId);
  }

  listByRequester(requesterId: string): Promise<BudgetRequest[]> {
    return this.repo.listBudgetRequestsByRequester(requesterId);
  }

  listSteps(id: string): Promise<ApprovalStep[]> {
    return this.repo.listSteps(id);
  }

  async submit(id: string): Promise<BudgetRequest> {
    const cur = await this.repo.findBudgetRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    const next = transitionRequest(
      { status: cur.status, currentStage: cur.currentStage, totalStages: cur.totalStages },
      "submit",
    );
    return this.repo.updateBudgetRequestState(id, next.status, next.currentStage);
  }

  async startReview(id: string): Promise<BudgetRequest> {
    const cur = await this.repo.findBudgetRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    const next = transitionRequest(
      { status: cur.status, currentStage: cur.currentStage, totalStages: cur.totalStages },
      "review",
    );
    return this.repo.updateBudgetRequestState(id, next.status, next.currentStage);
  }

  async decide(
    id: string,
    approverId: string,
    decision: "approved" | "rejected",
    comment?: string,
  ): Promise<BudgetRequest> {
    const cur = await this.repo.findBudgetRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    if (cur.status !== "in_review") throw new InvalidTransitionError(cur.status, "decide");

    await this.repo.recordDecision(id, cur.currentStage, approverId, decision, comment);

    const next = applyDecision(
      { status: cur.status, currentStage: cur.currentStage, totalStages: cur.totalStages },
      decision,
    );
    return this.repo.updateBudgetRequestState(id, next.status, next.currentStage);
  }
}
