// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from "@nestjs/common";
import { z } from "zod";
import { DepartmentService } from "./department.service.js";

const createSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
  managerId: z.string().optional(),
});

@Controller("departments")
export class DepartmentController {
  constructor(private readonly svc: DepartmentService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const d = await this.svc.find(id);
    if (!d) throw new NotFoundException(`Department not found: ${id}`);
    return d;
  }

  @Get()
  async list() {
    return this.svc.list();
  }

  @Get(":id/chain")
  async chain(@Param("id") id: string) {
    return this.svc.chain(id);
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
