// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
} from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { MemberUseCase } from "../../application/use-cases/member.use-case.js";
import {
  MemberReadModelQuery,
  type MemberDetailReadModel,
} from "../../application/queries/member-read-model.query.js";

const addSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["lead", "contributor", "viewer"]),
});

/**
 * Member HTTP controller.
 *
 * 기존 routing surface 유지:
 *   - POST /members
 *   - DELETE /members?projectId=...&userId=...
 *   - GET /projects/:projectId/members
 *   - GET /users/:userId/projects
 */
@Controller()
@UseFilters(DomainExceptionFilter)
export class MemberController {
  constructor(
    @Inject(MemberUseCase) private readonly useCase: MemberUseCase,
    @Inject(MemberReadModelQuery) private readonly readModel: MemberReadModelQuery,
  ) {}

  @Post("members")
  async add(@Body() body: unknown): Promise<MemberDetailReadModel> {
    const parsed = addSchema.parse(body);
    const result = await this.useCase.add({
      projectId: parsed.projectId,
      userId: parsed.userId,
      role: parsed.role,
    });
    return result;
  }

  @Delete("members")
  async remove(
    @Query("projectId") projectId: string,
    @Query("userId") userId: string,
  ): Promise<{ status: "removed" }> {
    await this.useCase.remove({ projectId, userId });
    return { status: "removed" };
  }

  @Get("projects/:projectId/members")
  async listForProject(@Param("projectId") projectId: string): Promise<MemberDetailReadModel[]> {
    return this.readModel.listForProject(projectId);
  }

  @Get("users/:userId/projects")
  async listForUser(@Param("userId") userId: string): Promise<MemberDetailReadModel[]> {
    return this.readModel.listForUser(userId);
  }
}
