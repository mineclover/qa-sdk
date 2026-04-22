// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { BudgetService } from "./budget.service.js";
import { BudgetAccessService } from "./budget-access.service.js";
import { toStorageDecision, type ApiDecision } from "./decision-mapping.js";
import { CurrentUser, type CurrentUserContext } from "../../auth-deps/current-user.decorator.js";
import { CurrentUserGuard } from "../../auth-deps/current-user.guard.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  projectDepartmentId: z.string().min(1),
  amount: z.number().finite().positive(),
  requesterId: z.string().min(1),
});

const decideSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().optional(),
});

@Controller("approvals/requests")
@UseGuards(CurrentUserGuard)
export class BudgetController {
  constructor(
    @Inject(BudgetService) private readonly svc: BudgetService,
    @Inject(BudgetAccessService) private readonly access: BudgetAccessService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserContext) {
    const parsed = createSchema.parse(body);
    const pre = await this.access.check({
      apiId: "budget.create",
      user,
      requestId: null,
      projectDepartmentId: parsed.projectDepartmentId,
    });
    if (!pre.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: pre.denyReason,
        rootSpanId: pre.rootSpanId,
      });
    }
    const created = await this.svc.create(parsed);
    return { ...created, rootSpanId: pre.rootSpanId };
  }

  @Get(":id")
  async get(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.read",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    return { ...r, rootSpanId: check.rootSpanId };
  }

  @Get()
  async list(
    @Query("projectId") projectId: string,
    @Query("requesterId") requesterId: string,
  ) {
    if (projectId) return this.svc.listByProject(projectId);
    if (requesterId) return this.svc.listByRequester(requesterId);
    throw new NotFoundException("projectId or requesterId query required");
  }

  @Get(":id/steps")
  async steps(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.read",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    return this.svc.listSteps(id);
  }

  @Post(":id/submit")
  async submit(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.submit",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const updated = await this.svc.submit(id);
    return { ...updated, rootSpanId: check.rootSpanId };
  }

  @Post(":id/start-review")
  async startReview(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.start-review",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const updated = await this.svc.startReview(id);
    return { ...updated, rootSpanId: check.rootSpanId };
  }

  @Post(":id/decisions")
  async decide(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const parsed = decideSchema.parse(body);

    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);

    const apiId = parsed.decision === "approve" ? "budget.approve" : "budget.reject";
    const check = await this.access.check({
      apiId,
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      resourceOwnerId: r.requesterId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
        firstFailureSpanId: check.firstFailureSpanId,
      });
    }

    const storageDecision = toStorageDecision(parsed.decision as ApiDecision);
    const updated = await this.svc.decide(id, user.userId, storageDecision, parsed.comment);
    return { ...updated, rootSpanId: check.rootSpanId };
  }
}
