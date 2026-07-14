// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { buildIdempotencyKey } from 'sim-identifier-grammar';

import { RoleAssignmentEntity, RoleAssignmentNotFoundException } from '../../domain/index.js';
import { toGrammarSafeAggregateId } from '../../../_outbox/idempotency-key-source.js';
import type { AssignRoleCommand } from '../commands/assign-role.command.js';
import type { RevokeRoleCommand } from '../commands/revoke-role.command.js';
import type { RoleAssignmentLoggerPort } from '../ports/role-assignment-logger.port.js';
import type {
  RoleAssignmentOutboxPort,
  RoleAssignedEventPayload,
  RoleRevokedEventPayload,
} from '../ports/role-assignment-outbox.port.js';
import type { RoleAssignmentRepositoryPort } from '../ports/role-assignment-repository.port.js';
import type { RoleAssignmentTransactionPort } from '../ports/role-assignment-transaction.port.js';
import type { RoleQueryPort } from '../ports/role-query.port.js';
import type { PermissionChangePublisherPort } from '../ports/permission-change-publisher.port.js';

export interface RoleAssignmentUseCaseDeps {
  readonly repository: RoleAssignmentRepositoryPort;
  readonly outbox: RoleAssignmentOutboxPort;
  readonly transaction: RoleAssignmentTransactionPort;
  readonly logger: RoleAssignmentLoggerPort;
  readonly roleQuery: RoleQueryPort;
  readonly permissionPublisher: PermissionChangePublisherPort;
}

export class RoleAssignmentUseCase {
  constructor(private readonly deps: RoleAssignmentUseCaseDeps) {}

  async assign(
    command: AssignRoleCommand,
  ): Promise<{ readonly id: string; readonly status: 'ASSIGNED' }> {
    const aggregateId = `${command.userId}|${command.roleId}|${command.scopeType}|${command.scopeId ?? ''}`;
    const traceId = command.traceId ?? `trace-${aggregateId}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: 'role-assignment',
      useCase: 'RoleAssignmentUseCase.assign',
      aggregateId,
      commandName: 'AssignRoleCommand',
    } as const;
    this.deps.logger.info({ ...ctxBase }, 'role-assignment.assign.started');

    try {
      // Cross-domain validation — role 존재 여부 확인.
      const exists = await this.deps.roleQuery.roleExists(command.roleId);
      if (!exists) {
        const err = new RoleAssignmentNotFoundException(command.userId, command.roleId);
        err.name = 'NotFoundError';
        throw err;
      }

      const eventName = 'auth.role-assignment.assigned';
      await this.deps.transaction.run('role-assignment.assign', async (scope): Promise<void> => {
        const ra = RoleAssignmentEntity.create({
          userId: command.userId,
          roleId: command.roleId,
          scopeType: command.scopeType,
          scopeId: command.scopeId,
        });
        await this.deps.repository.save(ra, scope);
        const occurredAt = new Date();
        const payload: RoleAssignedEventPayload = {
          userId: command.userId,
          roleId: command.roleId,
          scopeType: command.scopeType,
          scopeId: command.scopeId,
          occurredAt: occurredAt.toISOString(),
        };
        await this.deps.outbox.append(
          {
            aggregateId,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(aggregateId),
              eventName,
              occurredAt,
            }),
          },
          scope,
        );
      });

      // §5 Invalidation — 권한 변경 publish (트랜잭션 외부, fail-open).
      try {
        await this.deps.permissionPublisher.publishUserChange(command.userId, 'permission_change');
      } catch (publishError) {
        this.deps.logger.warn(
          {
            ...ctxBase,
            outcome: 'failure',
            errorCode: publishError instanceof Error ? publishError.name : 'UNKNOWN_ERROR',
          },
          'role-assignment.assign.publish-failure',
        );
      }

      this.deps.logger.info(
        { ...ctxBase, eventName, eventVersion: 1, outcome: 'success' },
        'role-assignment.assign.success',
      );
      return { id: aggregateId, status: 'ASSIGNED' };
    } catch (error) {
      this.deps.logger.error(
        {
          ...ctxBase,
          outcome: 'failure',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          err: error,
        },
        'role-assignment.assign.failure',
      );
      throw error;
    }
  }

  async revoke(
    command: RevokeRoleCommand,
  ): Promise<{ readonly id: string; readonly status: 'REVOKED' }> {
    const aggregateId = `${command.userId}|${command.roleId}|${command.scopeType}|${command.scopeId ?? ''}`;
    const traceId = command.traceId ?? `trace-${aggregateId}`;
    const correlationId = command.correlationId ?? traceId;
    const ctxBase = {
      traceId,
      correlationId,
      domain: 'role-assignment',
      useCase: 'RoleAssignmentUseCase.revoke',
      aggregateId,
      commandName: 'RevokeRoleCommand',
    } as const;
    this.deps.logger.info({ ...ctxBase }, 'role-assignment.revoke.started');

    try {
      const eventName = 'auth.role-assignment.revoked';
      await this.deps.transaction.run('role-assignment.revoke', async (scope): Promise<void> => {
        await this.deps.repository.delete(
          command.userId,
          command.roleId,
          command.scopeType,
          command.scopeId,
          scope,
        );
        const occurredAt = new Date();
        const payload: RoleRevokedEventPayload = {
          userId: command.userId,
          roleId: command.roleId,
          scopeType: command.scopeType,
          scopeId: command.scopeId,
          occurredAt: occurredAt.toISOString(),
        };
        await this.deps.outbox.append(
          {
            aggregateId,
            eventName,
            eventVersion: 1,
            payload,
            occurredAt,
            idempotencyKey: buildIdempotencyKey({
              aggregateId: toGrammarSafeAggregateId(aggregateId),
              eventName,
              occurredAt,
            }),
          },
          scope,
        );
      });

      try {
        await this.deps.permissionPublisher.publishUserChange(command.userId, 'permission_change');
      } catch (publishError) {
        this.deps.logger.warn(
          {
            ...ctxBase,
            outcome: 'failure',
            errorCode: publishError instanceof Error ? publishError.name : 'UNKNOWN_ERROR',
          },
          'role-assignment.revoke.publish-failure',
        );
      }

      this.deps.logger.info(
        { ...ctxBase, eventName, eventVersion: 1, outcome: 'success' },
        'role-assignment.revoke.success',
      );
      return { id: aggregateId, status: 'REVOKED' };
    } catch (error) {
      this.deps.logger.error(
        {
          ...ctxBase,
          outcome: 'failure',
          errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          err: error,
        },
        'role-assignment.revoke.failure',
      );
      throw error;
    }
  }
}
