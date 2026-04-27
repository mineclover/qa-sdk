// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Body, Controller, Delete, Get, Inject, Param, Post, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { RoleUseCase } from "../../application/use-cases/role.use-case.js";
import {
  RoleReadModelQuery,
  type RoleDetailReadModel,
} from "../../application/queries/role-read-model.query.js";
import { RoleNotFoundException } from "../../domain/index.js";

const createSchema = z.object({
  name: z.string().min(1),
  scopeType: z.enum(["global", "department", "project"]),
  defaultMaskHex: z.string().regex(/^[0-9a-fA-F]+$/),
});

/**
 * Role HTTP 컨트롤러.
 *
 * 라우트 (legacy 보존):
 *   - POST   /roles
 *   - GET    /roles/:id
 *   - GET    /roles
 *   - DELETE /roles/:id
 */
@Controller("roles")
@UseFilters(DomainExceptionFilter)
export class RoleController {
  constructor(
    @Inject(RoleUseCase) private readonly useCase: RoleUseCase,
    @Inject(RoleReadModelQuery) private readonly readModel: RoleReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<RoleDetailReadModel> {
    const parsed = createSchema.parse(body);
    const id = `role_${parsed.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
    await this.useCase.create({
      id,
      name: parsed.name,
      scopeType: parsed.scopeType,
      defaultMaskHex: parsed.defaultMaskHex,
    });
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new RoleNotFoundException(id);
    return detail;
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<RoleDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new RoleNotFoundException(id);
    return detail;
  }

  @Get()
  async list(): Promise<RoleDetailReadModel[]> {
    return this.readModel.list();
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ status: "deleted" }> {
    await this.useCase.delete({ id });
    return { status: "deleted" };
  }
}
