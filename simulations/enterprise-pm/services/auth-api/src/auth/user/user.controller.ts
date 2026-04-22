// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { UserService } from "./user.service.js";

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  departmentId: z.string().optional(),
  primaryRoleId: z.string().optional(),
});

@Controller("users")
export class UserController {
  constructor(private readonly svc: UserService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const u = await this.svc.find(id);
    if (!u) throw new NotFoundException(`User not found: ${id}`);
    return u;
  }

  @Get()
  async list(@Query("departmentId") deptId: string) {
    if (!deptId) throw new NotFoundException("departmentId query required");
    return this.svc.listByDepartment(deptId);
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
