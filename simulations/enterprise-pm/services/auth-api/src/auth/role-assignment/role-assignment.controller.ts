// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { RoleAssignmentService } from "./role-assignment.service.js";

const assignSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  scopeType: z.enum(["global", "department", "project"]),
  scopeId: z.string().nullable(),
});

const revokeSchema = z.object({
  userId: z.string().min(1),
  roleId: z.string().min(1),
  scopeType: z.enum(["global", "department", "project"]),
  scopeId: z.string().nullable(),
});

@Controller()
export class RoleAssignmentController {
  constructor(private readonly svc: RoleAssignmentService) {}

  @Post("assignments")
  async assign(@Body() body: unknown) {
    return this.svc.assign(assignSchema.parse(body));
  }

  @Delete("assignments")
  async revoke(@Body() body: unknown) {
    const { userId, roleId, scopeType, scopeId } = revokeSchema.parse(body);
    await this.svc.revoke(userId, roleId, scopeType, scopeId);
    return { status: "revoked" };
  }

  @Get("users/:userId/assignments")
  async listForUser(@Param("userId") userId: string) {
    return this.svc.listForUser(userId);
  }
}
