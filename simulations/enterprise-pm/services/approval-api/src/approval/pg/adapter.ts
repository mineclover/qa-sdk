// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { ApprovalRepository } from '../shared/port.js';
import type {
  BudgetRequest,
  BudgetRequestCreate,
  ApprovalStep,
  ResourceRequest,
  ResourceRequestCreate,
  TimeOffRequest,
  TimeOffRequestCreate,
  ExpenseReport,
  ExpenseReportCreate,
  RequestStatus,
  StepDecision,
} from '../shared/types.js';
import { RequestNotFoundError } from '../shared/errors.js';
import { determineStages } from '../shared/budget-state.js';
import {
  budgetRequests,
  approvalSteps,
  resourceRequests,
  timeOffRequests,
  expenseReports,
} from './schema.js';

export class PgApprovalRepository implements ApprovalRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  // ── BudgetRequest ────
  async createBudgetRequest(args: BudgetRequestCreate): Promise<BudgetRequest> {
    const now = new Date().toISOString();
    const totalStages = determineStages(args.amount);
    const request: BudgetRequest = {
      id: randomUUID(),
      projectId: args.projectId,
      projectDepartmentId: args.projectDepartmentId ?? '',
      amount: args.amount,
      requesterId: args.requesterId,
      status: 'draft',
      currentStage: 1,
      totalStages,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(budgetRequests).values(request);
    await this.createApprovalSteps(request.id, totalStages);
    return request;
  }

  async findBudgetRequest(id: string): Promise<BudgetRequest | null> {
    const rows = await this.db
      .select()
      .from(budgetRequests)
      .where(eq(budgetRequests.id, id))
      .limit(1);
    return rows[0] ? (rows[0] as BudgetRequest) : null;
  }

  async listBudgetRequestsByProject(projectId: string): Promise<BudgetRequest[]> {
    return (await this.db
      .select()
      .from(budgetRequests)
      .where(eq(budgetRequests.projectId, projectId))) as BudgetRequest[];
  }

  async listBudgetRequestsByRequester(requesterId: string): Promise<BudgetRequest[]> {
    return (await this.db
      .select()
      .from(budgetRequests)
      .where(eq(budgetRequests.requesterId, requesterId))) as BudgetRequest[];
  }

  async updateBudgetRequestState(
    id: string,
    status: RequestStatus,
    currentStage: number,
  ): Promise<BudgetRequest> {
    const cur = await this.findBudgetRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    const now = new Date().toISOString();
    const next: BudgetRequest = { ...cur, status, currentStage, updatedAt: now };
    await this.db
      .update(budgetRequests)
      .set({
        status: next.status,
        currentStage: next.currentStage,
        updatedAt: next.updatedAt,
      })
      .where(eq(budgetRequests.id, id));
    return next;
  }

  // ── ApprovalStep ────
  async createApprovalSteps(requestId: string, totalStages: number): Promise<ApprovalStep[]> {
    const steps: ApprovalStep[] = [];
    for (let i = 1; i <= totalStages; i++) {
      const step: ApprovalStep = {
        requestId,
        stageNumber: i,
        approverId: null,
        decision: 'pending',
        comment: null,
        decidedAt: null,
      };
      await this.db.insert(approvalSteps).values(step).onConflictDoNothing();
      steps.push(step);
    }
    return steps;
  }

  async recordDecision(
    requestId: string,
    stageNumber: number,
    approverId: string,
    decision: StepDecision,
    comment?: string,
  ): Promise<ApprovalStep> {
    const now = new Date().toISOString();
    await this.db
      .update(approvalSteps)
      .set({
        approverId,
        decision,
        comment: comment ?? null,
        decidedAt: now,
      })
      .where(
        and(eq(approvalSteps.requestId, requestId), eq(approvalSteps.stageNumber, stageNumber)),
      );
    return {
      requestId,
      stageNumber,
      approverId,
      decision,
      comment: comment ?? null,
      decidedAt: now,
    };
  }

  async listSteps(requestId: string): Promise<ApprovalStep[]> {
    return (await this.db
      .select()
      .from(approvalSteps)
      .where(eq(approvalSteps.requestId, requestId))
      .orderBy(asc(approvalSteps.stageNumber))) as ApprovalStep[];
  }

  // ── ResourceRequest ────
  async createResourceRequest(args: ResourceRequestCreate): Promise<ResourceRequest> {
    const now = new Date().toISOString();
    const r: ResourceRequest = {
      id: randomUUID(),
      projectId: args.projectId,
      requesterId: args.requesterId,
      resourceType: args.resourceType,
      description: args.description,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(resourceRequests).values(r);
    return r;
  }

  async findResourceRequest(id: string): Promise<ResourceRequest | null> {
    const rows = await this.db
      .select()
      .from(resourceRequests)
      .where(eq(resourceRequests.id, id))
      .limit(1);
    return rows[0] ? (rows[0] as ResourceRequest) : null;
  }

  async updateResourceRequestStatus(id: string, status: RequestStatus): Promise<ResourceRequest> {
    const cur = await this.findResourceRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    const now = new Date().toISOString();
    const next: ResourceRequest = { ...cur, status, updatedAt: now };
    await this.db
      .update(resourceRequests)
      .set({ status: next.status, updatedAt: next.updatedAt })
      .where(eq(resourceRequests.id, id));
    return next;
  }

  // ── TimeOffRequest ────
  async createTimeOffRequest(args: TimeOffRequestCreate): Promise<TimeOffRequest> {
    const now = new Date().toISOString();
    const r: TimeOffRequest = {
      id: randomUUID(),
      requesterId: args.requesterId,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(timeOffRequests).values(r);
    return r;
  }

  async findTimeOffRequest(id: string): Promise<TimeOffRequest | null> {
    const rows = await this.db
      .select()
      .from(timeOffRequests)
      .where(eq(timeOffRequests.id, id))
      .limit(1);
    return rows[0] ? (rows[0] as TimeOffRequest) : null;
  }

  async updateTimeOffRequestStatus(id: string, status: RequestStatus): Promise<TimeOffRequest> {
    const cur = await this.findTimeOffRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    const now = new Date().toISOString();
    const next: TimeOffRequest = { ...cur, status, updatedAt: now };
    await this.db
      .update(timeOffRequests)
      .set({ status: next.status, updatedAt: next.updatedAt })
      .where(eq(timeOffRequests.id, id));
    return next;
  }

  // ── ExpenseReport ────
  async createExpenseReport(args: ExpenseReportCreate): Promise<ExpenseReport> {
    const now = new Date().toISOString();
    const r: ExpenseReport = {
      id: randomUUID(),
      requesterId: args.requesterId,
      amount: args.amount,
      category: args.category,
      description: args.description,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(expenseReports).values(r);
    return r;
  }

  async findExpenseReport(id: string): Promise<ExpenseReport | null> {
    const rows = await this.db
      .select()
      .from(expenseReports)
      .where(eq(expenseReports.id, id))
      .limit(1);
    return rows[0] ? (rows[0] as ExpenseReport) : null;
  }

  async updateExpenseReportStatus(id: string, status: RequestStatus): Promise<ExpenseReport> {
    const cur = await this.findExpenseReport(id);
    if (!cur) throw new RequestNotFoundError(id);
    const now = new Date().toISOString();
    const next: ExpenseReport = { ...cur, status, updatedAt: now };
    await this.db
      .update(expenseReports)
      .set({ status: next.status, updatedAt: next.updatedAt })
      .where(eq(expenseReports.id, id));
    return next;
  }
}
