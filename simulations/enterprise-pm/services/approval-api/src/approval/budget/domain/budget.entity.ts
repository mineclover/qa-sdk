// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  toBudgetRequestId,
  toDepartmentId,
  toProjectId,
  toRequesterId,
} from "./budget.ids.js";
import {
  BudgetStageConflictException,
  BudgetTransitionConflictException,
  InvalidBudgetAmountException,
} from "./budget.exceptions.js";
import type { BudgetProps, BudgetSnapshot, BudgetStatus } from "./budget.types.js";

/**
 * design.md §3 — amount-based stage 결정.
 *
 *   amount < 1,000,000   → 1 stage
 *   1M ≤ amount < 10M    → 2 stages
 *   amount ≥ 10M         → 3 stages
 */
export function determineStages(amount: number): number {
  if (amount < 1_000_000) return 1;
  if (amount < 10_000_000) return 2;
  return 3;
}

/**
 * Budget Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 상태 전이는 새 인스턴스 반환 (불변)
 * - invariant: amount > 0, terminal 상태(approved/rejected) 에서는 전이 불가
 */
export class BudgetEntity {
  private constructor(private readonly props: BudgetProps) {}

  static create(input: {
    readonly id: string;
    readonly projectId: string;
    readonly projectDepartmentId: string;
    readonly amount: number;
    readonly requesterId: string;
    readonly now?: Date;
  }): BudgetEntity {
    if (!(input.amount > 0)) {
      throw new InvalidBudgetAmountException(input.amount);
    }
    const now = input.now ?? new Date();
    return new BudgetEntity({
      id: toBudgetRequestId(input.id),
      projectId: toProjectId(input.projectId),
      projectDepartmentId: toDepartmentId(input.projectDepartmentId),
      amount: input.amount,
      requesterId: toRequesterId(input.requesterId),
      status: "draft",
      currentStage: 1,
      totalStages: determineStages(input.amount),
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: BudgetSnapshot): BudgetEntity {
    return new BudgetEntity({
      id: toBudgetRequestId(snapshot.id),
      projectId: toProjectId(snapshot.projectId),
      projectDepartmentId: toDepartmentId(snapshot.projectDepartmentId),
      amount: snapshot.amount,
      requesterId: toRequesterId(snapshot.requesterId),
      status: snapshot.status,
      currentStage: snapshot.currentStage,
      totalStages: snapshot.totalStages,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  submit(now = new Date()): BudgetEntity {
    if (this.props.status !== "draft" && this.props.status !== "revision_requested") {
      throw new BudgetTransitionConflictException(this.props.status, "submit");
    }
    return new BudgetEntity({ ...this.props, status: "submitted", updatedAt: now });
  }

  startReview(now = new Date()): BudgetEntity {
    if (this.props.status !== "submitted") {
      throw new BudgetTransitionConflictException(this.props.status, "review");
    }
    return new BudgetEntity({ ...this.props, status: "in_review", updatedAt: now });
  }

  /** in_review 상태에서만 호출. approved=stage++ (마지막이면 approved), rejected=즉시 rejected. */
  decide(decision: "approved" | "rejected", now = new Date()): BudgetEntity {
    if (this.props.status !== "in_review") {
      throw new BudgetStageConflictException(
        `decide() requires status=in_review, current=${this.props.status}`,
      );
    }
    if (decision === "rejected") {
      return new BudgetEntity({ ...this.props, status: "rejected", updatedAt: now });
    }
    if (this.props.currentStage >= this.props.totalStages) {
      return new BudgetEntity({ ...this.props, status: "approved", updatedAt: now });
    }
    return new BudgetEntity({
      ...this.props,
      currentStage: this.props.currentStage + 1,
      updatedAt: now,
    });
  }

  toSnapshot(): BudgetSnapshot {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      projectDepartmentId: this.props.projectDepartmentId,
      amount: this.props.amount,
      requesterId: this.props.requesterId,
      status: this.props.status,
      currentStage: this.props.currentStage,
      totalStages: this.props.totalStages,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get status(): BudgetStatus {
    return this.props.status;
  }

  get totalStages(): number {
    return this.props.totalStages;
  }

  get currentStage(): number {
    return this.props.currentStage;
  }
}
