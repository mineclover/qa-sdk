// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ApprovalRepository } from "../../../shared/port.js";
import type { BudgetStepReader } from "./budget.read-model.js";
import type { BudgetStepReadModel } from "../../application/queries/budget-read-model.query.js";

/**
 * approval_steps 는 budget aggregate 외부의 cross-aggregate 테이블이라
 * legacy ApprovalRepository (approval-db.module.ts 가 export) 가 read 를 제공한다.
 * 본 어댑터가 그 결과를 BudgetStepReadModel 로 매핑.
 */
export class ApprovalRepositoryBudgetStepReader implements BudgetStepReader {
  constructor(private readonly repo: ApprovalRepository) {}

  async listSteps(requestId: string): Promise<BudgetStepReadModel[]> {
    const rows = await this.repo.listSteps(requestId);
    return rows.map((r) => ({
      requestId: r.requestId,
      stageNumber: r.stageNumber,
      approverId: r.approverId,
      decision: r.decision,
      comment: r.comment,
      decidedAt: r.decidedAt,
    }));
  }
}
