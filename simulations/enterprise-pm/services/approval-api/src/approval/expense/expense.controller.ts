// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Get, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { ExpenseService } from "./expense.service.js";

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
export class ExpenseController {
  constructor(private readonly svc: ExpenseService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`ExpenseReport not found: ${id}`);
    return r;
  }

  @Put(":id/status")
  async updateStatus(@Param("id") id: string, @Body() body: unknown) {
    const { status } = statusSchema.parse(body);
    return this.svc.updateStatus(id, status);
  }
}
