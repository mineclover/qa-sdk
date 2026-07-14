// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { BudgetExceptionFilter } from './budget-exception.filter.js';

import { BudgetUseCase } from '../../application/use-cases/budget.use-case.js';
import { BudgetReadModelQuery } from '../../application/queries/budget-read-model.query.js';
import {
  BudgetAccessQueryPort,
  type BudgetApiId,
} from '../../application/ports/access-check.port.js';
import { BudgetNotFoundException } from '../../domain/budget.exceptions.js';

import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../../auth-deps/current-user.decorator.js';
import { CurrentUserGuard } from '../../../../auth-deps/current-user.guard.js';

const createSchema = z.object({
  projectId: z.string().min(1),
  projectDepartmentId: z.string().min(1),
  amount: z.number().finite().positive(),
  requesterId: z.string().min(1),
});

const decideSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
});

/**
 * Budget HTTP controller — slice 표면.
 *
 * - 라우트는 legacy BudgetController 와 호환 (`/approvals/requests`).
 * - 도메인 예외는 DomainExceptionFilter 가 표준 HTTP 응답으로 변환.
 * - access check 는 BudgetAccessQueryPort (DI) 를 통해 auth bounded context 에 위임.
 */
@Controller('approvals/requests')
@UseFilters(BudgetExceptionFilter)
@UseGuards(CurrentUserGuard)
export class BudgetController {
  constructor(
    @Inject(BudgetUseCase) private readonly useCase: BudgetUseCase,
    @Inject(BudgetReadModelQuery) private readonly readModel: BudgetReadModelQuery,
    @Inject(BudgetAccessQueryPort) private readonly access: BudgetAccessQueryPort,
  ) {}

  private async checkOrThrow(args: {
    apiId: BudgetApiId;
    user: CurrentUserContext;
    requestId: string | null;
    projectDepartmentId: string | null;
    resourceOwnerId?: string | null;
  }) {
    const r = await this.access.check({
      apiId: args.apiId,
      user: {
        userId: args.user.userId,
        bitmapMask: args.user.bitmapMask,
        bitmapVersion: args.user.bitmapVersion,
        departmentId: args.user.departmentId ?? null,
        primaryRoleId: args.user.primaryRoleId ?? null,
        roleIds: args.user.roleIds,
        roleNames: args.user.roleNames,
        roleAssignments: args.user.roleAssignments,
      },
      requestId: args.requestId,
      projectDepartmentId: args.projectDepartmentId,
      resourceOwnerId: args.resourceOwnerId ?? null,
    });
    if (!r.allow) {
      throw new ForbiddenException({
        error: 'access_denied',
        denyReason: r.denyReason,
        rootSpanId: r.rootSpanId,
        firstFailureSpanId: r.firstFailureSpanId,
      });
    }
    return r;
  }

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserContext) {
    const parsed = createSchema.parse(body);
    const pre = await this.checkOrThrow({
      apiId: 'budget.create',
      user,
      requestId: null,
      projectDepartmentId: parsed.projectDepartmentId,
    });
    const id = `br_${parsed.projectId}_${parsed.requesterId}_${Date.now().toString(36)}`;
    const created = await this.useCase.create({
      id,
      projectId: parsed.projectId,
      projectDepartmentId: parsed.projectDepartmentId,
      amount: parsed.amount,
      requesterId: parsed.requesterId,
    });
    const detail = await this.readModel.findDetail(created.id);
    return { ...detail, rootSpanId: pre.rootSpanId };
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.readModel.findDetail(id);
    if (!r) throw new BudgetNotFoundException(id);
    const check = await this.checkOrThrow({
      apiId: 'budget.read',
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    return { ...r, rootSpanId: check.rootSpanId };
  }

  @Get()
  async list(@Query('projectId') projectId: string, @Query('requesterId') requesterId: string) {
    if (projectId) return this.readModel.listByProject(projectId);
    if (requesterId) return this.readModel.listByRequester(requesterId);
    throw new BudgetNotFoundException('projectId or requesterId query required');
  }

  @Get(':id/steps')
  async steps(@Param('id') id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.readModel.findDetail(id);
    if (!r) throw new BudgetNotFoundException(id);
    await this.checkOrThrow({
      apiId: 'budget.read',
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    return this.readModel.listSteps(id);
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.readModel.findDetail(id);
    if (!r) throw new BudgetNotFoundException(id);
    const check = await this.checkOrThrow({
      apiId: 'budget.submit',
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    const updated = await this.useCase.submit(id);
    const detail = await this.readModel.findDetail(updated.id);
    return { ...detail, rootSpanId: check.rootSpanId };
  }

  @Post(':id/start-review')
  async startReview(@Param('id') id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.readModel.findDetail(id);
    if (!r) throw new BudgetNotFoundException(id);
    const check = await this.checkOrThrow({
      apiId: 'budget.start-review',
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    const updated = await this.useCase.startReview(id);
    const detail = await this.readModel.findDetail(updated.id);
    return { ...detail, rootSpanId: check.rootSpanId };
  }

  @Post(':id/decisions')
  async decide(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const parsed = decideSchema.parse(body);
    const r = await this.readModel.findDetail(id);
    if (!r) throw new BudgetNotFoundException(id);
    const apiId: BudgetApiId = parsed.decision === 'approve' ? 'budget.approve' : 'budget.reject';
    const check = await this.checkOrThrow({
      apiId,
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    const updated = await this.useCase.decide({
      id,
      approverId: user.userId,
      decision: parsed.decision === 'approve' ? 'approved' : 'rejected',
      comment: parsed.comment,
    });
    const detail = await this.readModel.findDetail(updated.id);
    return { ...detail, rootSpanId: check.rootSpanId };
  }
}
