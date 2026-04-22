// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Get, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { BudgetService } from "./budget.service.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  amount: z.number().finite(),
  requesterId: z.string().min(1),
});

const decideSchema = z.object({
  approverId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().optional(),
});

@Controller("budgets")
export class BudgetController {
  constructor(private readonly svc: BudgetService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    return r;
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
  async steps(@Param("id") id: string) {
    return this.svc.listSteps(id);
  }

  @Post(":id/submit")
  async submit(@Param("id") id: string) {
    return this.svc.submit(id);
  }

  @Post(":id/start-review")
  async startReview(@Param("id") id: string) {
    return this.svc.startReview(id);
  }

  @Post(":id/decisions")
  async decide(@Param("id") id: string, @Body() body: unknown) {
    const { approverId, decision, comment } = decideSchema.parse(body);
    return this.svc.decide(id, approverId, decision, comment);
  }
}
