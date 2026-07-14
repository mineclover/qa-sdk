// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { SLICE_LOGGER_PORT, type LoggerPort } from '@qa-sdk/sim-domain-slice-kit';

import { UserSliceModule } from '../user/user.module.js';
import { RoleSliceModule } from '../role/role.module.js';
import { RoleAssignmentSliceModule } from '../role-assignment/role-assignment.module.js';
import { UserReadModelQuery } from '../user/application/queries/user-read-model.query.js';
import { RoleReadModelQuery } from '../role/application/queries/role-read-model.query.js';
import { RoleAssignmentReadModelQuery } from '../role-assignment/application/queries/role-assignment-read-model.query.js';

import { AuthenticateUseCase } from './application/use-cases/authenticate.use-case.js';
import { UserQueryPort } from './application/ports/user-query.port.js';
import { RoleQueryPort } from './application/ports/role-query.port.js';
import { RoleAssignmentQueryPort } from './application/ports/role-assignment-query.port.js';
import {
  type CredentialStore,
  NoopCredentialStore,
} from './application/ports/credential-store.port.js';

import { createAuthenticateLogger } from './infrastructure/logging/authenticate.logger.js';
import { AuthenticateController } from './presentation/http/authenticate.controller.js';

/** NestJS DI token — TestCredentialStore 주입용. */
const CREDENTIAL_STORE = Symbol.for('sim-auth-api/authenticate/CredentialStore');

export interface AuthenticateSliceModuleOptions {
  /** 기본은 NoopCredentialStore. test-bootstrap에서 TestCredentialStore 주입. */
  credentialStore?: CredentialStore;
}

/** UserQueryPort 어댑터 — User 슬라이스 read model 의 일부만 노출. */
class UserReadModelQueryAdapter extends UserQueryPort {
  constructor(private readonly readModel: UserReadModelQuery) {
    super();
  }
  async findByEmail(email: string): ReturnType<UserQueryPort['findByEmail']> {
    const detail = await this.readModel.findByEmail(email);
    if (!detail) return null;
    return {
      id: detail.id,
      email: detail.email,
      displayName: detail.displayName,
      departmentId: detail.departmentId,
      primaryRoleId: detail.primaryRoleId,
    };
  }
}

class RoleReadModelQueryAdapter extends RoleQueryPort {
  constructor(private readonly readModel: RoleReadModelQuery) {
    super();
  }
  async findById(roleId: string): ReturnType<RoleQueryPort['findById']> {
    const detail = await this.readModel.findDetail(roleId);
    if (!detail) return null;
    return { id: detail.id, name: detail.name };
  }
}

class RoleAssignmentReadModelQueryAdapter extends RoleAssignmentQueryPort {
  constructor(private readonly readModel: RoleAssignmentReadModelQuery) {
    super();
  }
  async listForUser(userId: string): ReturnType<RoleAssignmentQueryPort['listForUser']> {
    const list = await this.readModel.listForUser(userId);
    return list.map((a) => ({
      userId: a.userId,
      roleId: a.roleId,
      scopeType: a.scopeType,
      scopeId: a.scopeId,
    }));
  }
}

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
  useFactory: (rm: RoleAssignmentReadModelQuery) => new RoleAssignmentReadModelQueryAdapter(rm),
  inject: [RoleAssignmentReadModelQuery],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createAuthenticateLogger(),
};

const useCaseProvider: Provider = {
  provide: AuthenticateUseCase,
  useFactory: (
    userQuery: UserQueryPort,
    roleAssignmentQuery: RoleAssignmentQueryPort,
    roleQuery: RoleQueryPort,
    credentialStore: CredentialStore,
    logger: LoggerPort,
  ) =>
    new AuthenticateUseCase({
      userQuery,
      roleAssignmentQuery,
      roleQuery,
      credentialStore,
      logger,
    }),
  inject: [
    UserQueryPort,
    RoleAssignmentQueryPort,
    RoleQueryPort,
    CREDENTIAL_STORE,
    SLICE_LOGGER_PORT,
  ],
};

const baseProviders: Provider[] = [
  loggerProvider,
  userQueryProvider,
  roleQueryProvider,
  roleAssignmentQueryProvider,
  useCaseProvider,
];

/**
 * Authenticate 슬라이스의 NestJS 모듈 (command-only — entity/persistence 없음).
 *
 * - 기본 import (운영): NoopCredentialStore (항상 false) 가 주입된다.
 * - test-bootstrap: AuthenticateSliceModule.forRoot({ credentialStore })
 *   를 사용해 NoopCredentialStore 를 TestCredentialStore 로 교체.
 */
@Module({
  imports: [UserSliceModule, RoleSliceModule, RoleAssignmentSliceModule],
  providers: [...baseProviders, { provide: CREDENTIAL_STORE, useClass: NoopCredentialStore }],
  controllers: [AuthenticateController],
  exports: [AuthenticateUseCase],
})
export class AuthenticateSliceModule {
  static forRoot(opts: AuthenticateSliceModuleOptions = {}): DynamicModule {
    const credentialStore: CredentialStore = opts.credentialStore ?? new NoopCredentialStore();
    return {
      module: AuthenticateSliceModule,
      imports: [UserSliceModule, RoleSliceModule, RoleAssignmentSliceModule],
      providers: [...baseProviders, { provide: CREDENTIAL_STORE, useValue: credentialStore }],
      controllers: [AuthenticateController],
      exports: [AuthenticateUseCase],
    };
  }
}
