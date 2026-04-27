// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, UseFilters } from "@nestjs/common";
import { z } from "zod";
import { DomainExceptionFilter } from "@qa-sdk/sim-domain-slice-kit";
import { UserUseCase } from "../../application/use-cases/user.use-case.js";
import {
  UserReadModelQuery,
  type UserDetailReadModel,
} from "../../application/queries/user-read-model.query.js";
import { UserDomainException, UserNotFoundException } from "../../domain/index.js";

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  departmentId: z.string().optional(),
  primaryRoleId: z.string().optional(),
});

const updateSchema = createSchema.partial();

interface UserCommandAccepted {
  readonly userId: string;
  readonly status: "ACTIVE" | "DELETED";
}

/**
 * User HTTP 컨트롤러.
 *
 * 라우트 (legacy 보존):
 *   - POST   /users
 *   - GET    /users/:id
 *   - GET    /users?departmentId=
 *   - PUT    /users/:id
 *   - DELETE /users/:id
 */
@Controller("users")
@UseFilters(DomainExceptionFilter)
export class UserController {
  constructor(
    @Inject(UserUseCase) private readonly useCase: UserUseCase,
    @Inject(UserReadModelQuery) private readonly readModel: UserReadModelQuery,
  ) {}

  @Post()
  async create(@Body() body: unknown): Promise<UserDetailReadModel> {
    const parsed = createSchema.parse(body);
    const id = deriveUserId(parsed.email);
    await this.useCase.create({
      id,
      email: parsed.email,
      displayName: parsed.displayName,
      departmentId: parsed.departmentId ?? null,
      primaryRoleId: parsed.primaryRoleId ?? null,
    });
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new UserNotFoundException(id);
    return detail;
  }

  @Get(":id")
  async get(@Param("id") id: string): Promise<UserDetailReadModel> {
    const detail = await this.readModel.findDetail(id);
    if (!detail) throw new UserNotFoundException(id);
    return detail;
  }

  @Get()
  async list(@Query("departmentId") deptId?: string): Promise<UserDetailReadModel[]> {
    if (!deptId) {
      const err = new UserDomainException("MISSING_DEPARTMENT_ID", "departmentId query required");
      err.name = "ValidationError";
      throw err;
    }
    return this.readModel.listByDepartment(deptId);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown): Promise<UserCommandAccepted> {
    const patch = updateSchema.parse(body);
    await this.useCase.update({ id, patch });
    return { userId: id, status: "ACTIVE" };
  }

  @Delete(":id")
  async remove(@Param("id") id: string): Promise<{ status: "deleted" }> {
    await this.useCase.delete({ id });
    return { status: "deleted" };
  }
}

/**
 * 결정론적 UserId derivation — email 기반.
 * 기존 SqliteAuthRepository 가 randomUUID 를 사용했지만, Phase 2 의 use-case 는
 * id 가 입력 필드. controller 에서 결정론적으로 derive 하여 idempotent 하게
 * 만든다.
 */
function deriveUserId(email: string): string {
  return `usr_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
}
