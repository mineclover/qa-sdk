// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import {
  InvalidAuthenticateInputException,
  InvalidCredentialsException,
  type AuthenticatedSession,
  type AuthenticatedRoleAssignment,
} from "../../domain/index.js";
import type { AuthenticateCommand } from "../commands/authenticate.command.js";
import type { AuthenticateLoggerPort } from "../ports/authenticate-logger.port.js";
import type { UserQueryPort } from "../ports/user-query.port.js";
import type { RoleAssignmentQueryPort } from "../ports/role-assignment-query.port.js";
import type { RoleQueryPort } from "../ports/role-query.port.js";
import type { CredentialStore } from "../ports/credential-store.port.js";
import type { TransactionPort, LoggerPort } from "@qa-sdk/sim-domain-slice-kit";

/**
 * Command-only 슬라이스 — write 가 없으므로 실 TransactionPort 는 사용하지
 * 않는다. validator 컨벤션 일관성을 위해 type import 는 유지 (LoggerPort 도
 * 동일).
 */
export type AuthenticateTransactionPortMarker = TransactionPort;
export type AuthenticateLoggerPortMarker = LoggerPort;

export interface AuthenticateUseCaseDeps {
  readonly userQuery: UserQueryPort;
  readonly roleAssignmentQuery: RoleAssignmentQueryPort;
  readonly roleQuery: RoleQueryPort;
  readonly credentialStore: CredentialStore;
  readonly logger: AuthenticateLoggerPort;
}

/**
 * Command-only 슬라이스 — 외부 인증 자격증명 검증 + read-side composition.
 *
 * - aggregate / persistence write 없음 (transaction/outbox 미사용)
 * - 검증 실패 시 도메인 표준 UnauthorizedError 로 throw
 * - 성공 응답은 다른 슬라이스 read model 의 합성 (cross-domain query ports)
 *
 * 외부 시스템 연동 (Plan defer): bcrypt/argon2 — 본 슬라이스는 추상 CredentialStore
 * 만 의존하고 verify 책임을 외부에 위임한다.
 */
export class AuthenticateUseCase {
  constructor(private readonly deps: AuthenticateUseCaseDeps) {}

  async authenticate(command: AuthenticateCommand): Promise<AuthenticatedSession> {
    const traceId = command.traceId ?? `trace-auth-${Date.now()}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: "authenticate",
      useCase: "AuthenticateUseCase.authenticate",
      commandName: "AuthenticateCommand",
    } as const;
    this.deps.logger.info({ ...ctxBase }, "authenticate.started");

    try {
      if (command.email.trim().length === 0) {
        throw new InvalidAuthenticateInputException("email must not be empty.");
      }
      if (command.password.length === 0) {
        throw new InvalidAuthenticateInputException("password must not be empty.");
      }

      const user = await this.deps.userQuery.findByEmail(command.email);
      if (!user) throw new InvalidCredentialsException();

      const ok = await this.deps.credentialStore.verify(command.email, command.password);
      if (!ok) throw new InvalidCredentialsException();

      const assignments = await this.deps.roleAssignmentQuery.listForUser(user.id);
      const roleViews = await Promise.all(
        assignments.map(async (a) => ({
          assignment: a,
          role: await this.deps.roleQuery.findById(a.roleId),
        })),
      );
      const roleAssignments: AuthenticatedRoleAssignment[] = roleViews.flatMap(({ assignment, role }) =>
        role
          ? [{
              roleId: assignment.roleId,
              roleName: role.name,
              scopeType: assignment.scopeType,
              scopeId: assignment.scopeId,
            }]
          : [],
      );
      const roleIds = [...new Set(roleAssignments.map((r) => r.roleId))];
      const roleNames = [...new Set(roleAssignments.map((r) => r.roleName))];

      this.deps.logger.info(
        { ...ctxBase, aggregateId: user.id, outcome: "success" },
        "authenticate.success",
      );

      return {
        userId: user.id,
        displayName: user.displayName,
        departmentId: user.departmentId,
        primaryRoleId: user.primaryRoleId,
        roleIds,
        roleNames,
        roleAssignments,
      };
    } catch (error) {
      this.deps.logger.error(
        {
          ...ctxBase,
          outcome: "failure",
          errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          err: error,
        },
        "authenticate.failure",
      );
      throw error;
    }
  }
}
