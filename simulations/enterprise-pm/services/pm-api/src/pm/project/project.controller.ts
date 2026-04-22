// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { ProjectService } from "./project.service.js";

const createSchema = z.object({
  name: z.string().min(1),
  ownerId: z.string().min(1),
  departmentId: z.string().min(1),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

@Controller("projects")
export class ProjectController {
  constructor(private readonly svc: ProjectService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);
    return p;
  }

  @Get()
  async list(@Query("departmentId") deptId: string, @Query("ownerId") ownerId: string) {
    if (deptId) return this.svc.listByDepartment(deptId);
    if (ownerId) return this.svc.listByOwner(ownerId);
    throw new NotFoundException("departmentId or ownerId query required");
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
