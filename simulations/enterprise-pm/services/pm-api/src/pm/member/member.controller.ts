// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { MemberService } from "./member.service.js";

const addSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["lead", "contributor", "viewer"]),
});

@Controller()
export class MemberController {
  constructor(private readonly svc: MemberService) {}

  @Post("members")
  async add(@Body() body: unknown) {
    return this.svc.add(addSchema.parse(body));
  }

  @Delete("members")
  async remove(@Query("projectId") projectId: string, @Query("userId") userId: string) {
    await this.svc.remove(projectId, userId);
    return { status: "removed" };
  }

  @Get("projects/:projectId/members")
  async listForProject(@Param("projectId") projectId: string) {
    return this.svc.listForProject(projectId);
  }

  @Get("users/:userId/projects")
  async listForUser(@Param("userId") userId: string) {
    return this.svc.listForUser(userId);
  }
}
