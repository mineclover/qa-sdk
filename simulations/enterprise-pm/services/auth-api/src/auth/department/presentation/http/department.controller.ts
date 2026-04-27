// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Body, Controller, Delete, Get, Inject, Param, Post, Put, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { DepartmentUseCase } from "../../application/use-cases/department.use-case.js";
import {
  DepartmentReadModelQuery,
  type DepartmentDetailReadModel,
} from "../../application/queries/department-read-model.query.js";
import { DepartmentNotFoundException } from "../../domain/index.js";

const createSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
  managerId: z.string().optional(),
});

const updateSchema = createSchema.partial();

@Controller("departments")
@UseFilters(DomainExceptionFilter)
export class DepartmentController {
  constructor(
    @Inject(DepartmentUseCase) private readonly useCase: DepartmentUseCase,
    @Inject(DepartmentReadModelQuery) private readonly readModel: DepartmentReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<DepartmentDetailReadModel> {
    const parsed = createSchema.parse(body);
    const id = `dept_${parsed.name.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
    await this.useCase.create({
      id,
      name: parsed.name,
      parentId: parsed.parentId ?? null,
      managerId: parsed.managerId ?? null,
    });
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new DepartmentNotFoundException(id);
    return detail;
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<DepartmentDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new DepartmentNotFoundException(id);
    return detail;
  }

  @Get()
  async list(): Promise<DepartmentDetailReadModel[]> {
    return this.readModel.list();
  }

  @Get(":id/chain")
  async chain(@Param("id") id: string): Promise<DepartmentDetailReadModel[]> {
    return this.readModel.resolveChain(id);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<{ deptId: string; status: "ACTIVE" }> {
    const patch = updateSchema.parse(body);
    await this.useCase.update({ id, patch });
    return { deptId: id, status: "ACTIVE" };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ status: "deleted" }> {
    await this.useCase.delete({ id });
    return { status: "deleted" };
  }
}
