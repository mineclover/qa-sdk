// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Body, Controller, Get, Inject, Param, Post, Put, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { ExpenseUseCase } from "../../application/use-cases/expense.use-case.js";
import { ExpenseReadModelQuery } from "../../application/queries/expense-read-model.query.js";
import { ExpenseNotFoundException } from "../../domain/expense.exceptions.js";

const createSchema = z.object({
  requesterId: z.string().min(1),
  amount: z.number().finite(),
  category: z.string().min(1),
  description: z.string().min(1),
});

const statusSchema = z.object({
  status: z.enum(["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"]),
});

@Controller("expense-reports")
@UseFilters(DomainExceptionFilter)
export class ExpenseController {
  constructor(
    @Inject(ExpenseUseCase) private readonly useCase: ExpenseUseCase,
    @Inject(ExpenseReadModelQuery) private readonly readModel: ExpenseReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createSchema.parse(body);
    const id = `exp_${parsed.requesterId}_${Date.now().toString(36)}`;
    const r = await this.useCase.create({ id, ...parsed });
    return this.readModel.findDetail(r.id);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const r = await this.readModel.findDetail(id);
    if (!r) throw new ExpenseNotFoundException(id);
    return r;
  }

  @Put(":id/status")
  async updateStatus(@Param("id") id: string, @Body() body: unknown) {
    const { status } = statusSchema.parse(body);
    await this.useCase.updateStatus({ id, status });
    return this.readModel.findDetail(id);
  }
}
