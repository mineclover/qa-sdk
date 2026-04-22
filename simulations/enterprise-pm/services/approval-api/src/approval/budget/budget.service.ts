// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { APPROVAL_REPOSITORY } from "../approval-db.module.js";
import type { ApprovalRepository } from "../shared/port.js";
import type { BudgetRequest, BudgetRequestCreate, ApprovalStep } from "../shared/types.js";
import {
  RequestNotFoundError,
  InvalidTransitionError,
} from "../shared/errors.js";
import { transitionRequest, applyDecision } from "../shared/budget-state.js";

@Injectable()
export class BudgetService {
  constructor(@Inject(APPROVAL_REPOSITORY) private readonly repo: ApprovalRepository) {}

  create(args: BudgetRequestCreate): Promise<BudgetRequest> {
    return this.repo.createBudgetRequest(args);
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
