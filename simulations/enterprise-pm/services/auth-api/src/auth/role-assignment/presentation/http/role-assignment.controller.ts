// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Body, Controller, Delete, Get, Inject, Post, Query, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { RoleAssignmentUseCase } from "../../application/use-cases/role-assignment.use-case.js";
import {
  RoleAssignmentReadModelQuery,
  type RoleAssignmentReadModel,
} from "../../application/queries/role-assignment-read-model.query.js";

const assignSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  scopeType: z.enum(["global", "department", "project"]),
  scopeId: z.string().nullable(),
});

const revokeSchema = assignSchema;

const listQuerySchema = z.object({
  userId: z.string().min(1),
});

@Controller("role-assignments")
@UseFilters(DomainExceptionFilter)
export class RoleAssignmentController {
  constructor(
    @Inject(RoleAssignmentUseCase) private readonly useCase: RoleAssignmentUseCase,
    @Inject(RoleAssignmentReadModelQuery) private readonly readModel: RoleAssignmentReadModelQuery,
  ) {}

  @Post()
  async assign(@Body() body: unknown): Promise<RoleAssignmentReadModel | null> {
    const parsed = assignSchema.parse(body);
    await this.useCase.assign(parsed);
    return this.readModel.findOne(parsed.userId, parsed.roleId, parsed.scopeType, parsed.scopeId);
  }

  @Delete()
  async revoke(@Body() body: unknown): Promise<{ status: "revoked" }> {
    const parsed = revokeSchema.parse(body);
    await this.useCase.revoke(parsed);
    return { status: "revoked" };
  }

  @Get()
  async listForUser(@Query() query: unknown): Promise<RoleAssignmentReadModel[]> {
    const { userId } = listQuerySchema.parse(query);
    return this.readModel.listForUser(userId);
  }
}
