// @def.boundary sim-reporting-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { ReportService } from "./report.service.js";

const createSchema = z.object({
  name: z.string().min(1),
  queryDefinition: z.string().min(1),
  createdBy: z.string().min(1),
});

@Controller("reports")
export class ReportController {
  constructor(private readonly svc: ReportService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`Report not found: ${id}`);
    return r;
  }

  @Get()
  async list() {
    return this.svc.list();
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    return this.svc.update(id, createSchema.partial().parse(body));
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.svc.delete(id);
    return { status: "deleted" };
  }
}
