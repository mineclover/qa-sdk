// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from "@nestjs/common";
import { z } from "zod";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
} from "@qa-sdk/sim-domain-slice-kit";

import { UserSliceModule } from "../user/user.module.js";
import { RoleSliceModule } from "../role/role.module.js";
import { RoleAssignmentSliceModule } from "../role-assignment/role-assignment.module.js";
import { UserReadModelQuery } from "../user/application/queries/user-read-model.query.js";
import { RoleReadModelQuery } from "../role/application/queries/role-read-model.query.js";
import { RoleAssignmentReadModelQuery } from "../role-assignment/application/queries/role-assignment-read-model.query.js";

import { BitmapIssueQuery } from "./application/queries/bitmap-issue.query.js";
import { UserQueryPort } from "./application/ports/user-query.port.js";
import {
  RoleQueryPort,
  type RoleScopeTypeForBitmap,
} from "./application/ports/role-query.port.js";
import { RoleAssignmentQueryPort } from "./application/ports/role-assignment-query.port.js";

import {
  IssuerBitmapReadModel,
  type BitmapIssuerConfig,
} from "./infrastructure/read-model/bitmap-issue.read-model.js";
import { createBitmapLogger } from "./infrastructure/logging/bitmap.logger.js";

import { BitmapController } from "./presentation/http/bitmap.controller.js";

const BITMAP_ISSUER_CONFIG = Symbol.for("sim-auth-api/bitmap/IssuerConfig");

const bitmapEnvSchema = z.object({
  SIM_BITMAP_SECRET: z.string().default("dev-only-bitmap-secret-32-bytes-min!"),
  SIM_BITMAP_TTL_MS: z.coerce.number().int().positive().default(3600_000),
});

class UserReadModelQueryAdapter extends UserQueryPort {
  constructor(private readonly readModel: UserReadModelQuery) {
    super();
  }
  async findById(userId: string): ReturnType<UserQueryPort["findById"]> {
    const detail = await this.readModel.findDetail(userId);
    if (!detail) return null;
    return { id: detail.id };
  }
}

class RoleReadModelQueryAdapter extends RoleQueryPort {
  constructor(private readonly readModel: RoleReadModelQuery) {
    super();
  }
  async findById(roleId: string): ReturnType<RoleQueryPort["findById"]> {
    const detail = await this.readModel.findDetail(roleId);
    if (!detail) return null;
    return {
      id: detail.id,
      name: detail.name,
      scopeType: detail.scopeType as RoleScopeTypeForBitmap,
      defaultMaskHex: detail.defaultMaskHex,
    };
  }
}

class RoleAssignmentReadModelQueryAdapter extends RoleAssignmentQueryPort {
  constructor(private readonly readModel: RoleAssignmentReadModelQuery) {
    super();
  }
  async listForUser(
    userId: string,
  ): ReturnType<RoleAssignmentQueryPort["listForUser"]> {
    const list = await this.readModel.listForUser(userId);
    return list.map((a) => ({
      userId: a.userId,
      roleId: a.roleId,
      scopeType: a.scopeType,
      scopeId: a.scopeId,
    }));
  }
}

const issuerConfigProvider: Provider = {
  provide: BITMAP_ISSUER_CONFIG,
  useFactory: (): BitmapIssuerConfig => {
    const e = bitmapEnvSchema.parse(process.env);
    return {
      secret: new TextEncoder().encode(e.SIM_BITMAP_SECRET),
      ttlMs: e.SIM_BITMAP_TTL_MS,
      issuer: "sim-auth-api",
      version: "v1",
    };
  },
};

const userQueryProvider: Provider = {
  provide: UserQueryPort,
  useFactory: (rm: UserReadModelQuery) => new UserReadModelQueryAdapter(rm),
  inject: [UserReadModelQuery],
};

const roleQueryProvider: Provider = {
  provide: RoleQueryPort,
  useFactory: (rm: RoleReadModelQuery) => new RoleReadModelQueryAdapter(rm),
  inject: [RoleReadModelQuery],
};

const roleAssignmentQueryProvider: Provider = {
  provide: RoleAssignmentQueryPort,
  useFactory: (rm: RoleAssignmentReadModelQuery) =>
    new RoleAssignmentReadModelQueryAdapter(rm),
  inject: [RoleAssignmentReadModelQuery],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createBitmapLogger(),
};

const issueQueryProvider: Provider = {
  provide: BitmapIssueQuery,
  useFactory: (
    userQuery: UserQueryPort,
    roleAssignmentQuery: RoleAssignmentQueryPort,
    roleQuery: RoleQueryPort,
    config: BitmapIssuerConfig,
  ) =>
    new IssuerBitmapReadModel(userQuery, roleAssignmentQuery, roleQuery, config),
  inject: [
    UserQueryPort,
    RoleAssignmentQueryPort,
    RoleQueryPort,
    BITMAP_ISSUER_CONFIG,
  ],
};

/**
 * Bitmap 슬라이스의 NestJS 모듈 (read-mostly — entity/persistence/outbox 없음).
 *
 * - User/Role/RoleAssignment 슬라이스 의 read model 을 cross-domain query
 *   port 로 어댑팅하여 합성한다.
 * - VersionedBitmap 발급은 transient (서명 + TTL) — write 영속 없음.
 */
@Module({
  imports: [UserSliceModule, RoleSliceModule, RoleAssignmentSliceModule],
  providers: [
    issuerConfigProvider,
    loggerProvider,
    userQueryProvider,
    roleQueryProvider,
    roleAssignmentQueryProvider,
    issueQueryProvider,
  ],
  controllers: [BitmapController],
  exports: [BitmapIssueQuery],
})
export class BitmapSliceModule {}
