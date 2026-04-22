// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { RoleService } from "./role.service.js";

const createSchema = z.object({
  name: z.string().min(1),
  scopeType: z.enum(["global", "department", "project"]),
  defaultMaskHex: z.string().regex(/^[0-9a-fA-F]+$/),
});

@Controller("roles")
export class RoleController {
  constructor(private readonly svc: RoleService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`Role not found: ${id}`);
    return r;
  }

  @Get()
  async list() {
    return this.svc.list();
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.svc.delete(id);
    return { status: "deleted" };
  }
}
