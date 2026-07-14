// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from '@nestjs/common';
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from '@qa-sdk/sim-domain-slice-kit';
import type { ResourcePolicyRegistry } from 'permission-engine';

import { PM_DB_INSTANCE, type PmDbInstanceHandle } from '../pm-db.module.js';
import {
  PROJECT_POLICY_REGISTRY,
  PROJECT_DELEGATION_GRAPH,
} from '../../auth-deps/access-checker.module.js';
import type { ProjectDelegationGraphStore } from '../../auth-deps/delegation-graph-store.js';

import { ProjectRepositoryPort } from './application/ports/project-repository.port.js';
import { ProjectReadModelQuery } from './application/queries/project-read-model.query.js';
import { ProjectAccessService } from './application/services/project-access.service.js';
import { ProjectUseCase } from './application/use-cases/project.use-case.js';
import type {
  PolicyLifecyclePort,
  DelegationGraphPort,
} from './application/ports/project-policy.port.js';

import { createProjectRepository } from './infrastructure/persistence/project.repository.js';
import { createProjectTransactionPort } from './infrastructure/transaction/project.transaction.js';
import { createProjectOutboxPort } from './infrastructure/outbox/project.outbox.js';
import { createProjectLogger } from './infrastructure/logging/project.logger.js';
import { RepositoryProjectReadModel } from './infrastructure/read-model/project.read-model.js';
import {
  ResourcePolicyAdapter,
  DelegationGraphAdapter,
} from './infrastructure/access/policy-adapter.js';

import { ProjectController } from './presentation/http/project.controller.js';

const PROJECT_TRANSACTION_PORT = Symbol.for('sim-pm-api/project/TransactionPort');
const PROJECT_OUTBOX_PORT = Symbol.for('sim-pm-api/project/OutboxPort');
const PROJECT_POLICY_LIFECYCLE_PORT = Symbol.for('sim-pm-api/project/PolicyLifecyclePort');
const PROJECT_DELEGATION_GRAPH_PORT = Symbol.for('sim-pm-api/project/DelegationGraphPort');

const repositoryProvider: Provider = {
  provide: ProjectRepositoryPort,
  useFactory: (handle: PmDbInstanceHandle) =>
    createProjectRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: PROJECT_TRANSACTION_PORT,
  useFactory: (handle: PmDbInstanceHandle): TransactionPort =>
    createProjectTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: PROJECT_OUTBOX_PORT,
  useFactory: (handle: PmDbInstanceHandle): OutboxPort =>
    createProjectOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [PM_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createProjectLogger(),
};

const policyLifecycleProvider: Provider = {
  provide: PROJECT_POLICY_LIFECYCLE_PORT,
  useFactory: (registry?: ResourcePolicyRegistry): PolicyLifecyclePort | undefined =>
    registry ? new ResourcePolicyAdapter(registry) : undefined,
  inject: [{ token: PROJECT_POLICY_REGISTRY, optional: true }],
};

const delegationGraphPortProvider: Provider = {
  provide: PROJECT_DELEGATION_GRAPH_PORT,
  useFactory: (store?: ProjectDelegationGraphStore): DelegationGraphPort | undefined =>
    store ? new DelegationGraphAdapter(store) : undefined,
  inject: [{ token: PROJECT_DELEGATION_GRAPH, optional: true }],
};

const readModelProvider: Provider = {
  provide: ProjectReadModelQuery,
  useFactory: (
    repo: ProjectRepositoryPort,
    policies?: PolicyLifecyclePort,
    delegationGraph?: DelegationGraphPort,
  ) => new RepositoryProjectReadModel(repo, policies, delegationGraph),
  inject: [
    ProjectRepositoryPort,
    { token: PROJECT_POLICY_LIFECYCLE_PORT, optional: true },
    { token: PROJECT_DELEGATION_GRAPH_PORT, optional: true },
  ],
};

const useCaseProvider: Provider = {
  provide: ProjectUseCase,
  useFactory: (
    repo: ProjectRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    policies?: PolicyLifecyclePort,
    delegationGraph?: DelegationGraphPort,
  ) => new ProjectUseCase(repo, outbox, transaction, logger, policies, delegationGraph),
  inject: [
    ProjectRepositoryPort,
    PROJECT_OUTBOX_PORT,
    PROJECT_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
    { token: PROJECT_POLICY_LIFECYCLE_PORT, optional: true },
    { token: PROJECT_DELEGATION_GRAPH_PORT, optional: true },
  ],
};

/**
 * Project 슬라이스의 NestJS 모듈.
 *
 * - PmDbModule (forRoot, global) 의 PM_DB_INSTANCE 와
 *   AccessCheckerModule (global) 의 PROJECT_ACCESS_CHECKER /
 *   PROJECT_POLICY_REGISTRY / PROJECT_DELEGATION_GRAPH 에 의존.
 * - SLICE_LOGGER_PORT 는 본 모듈 내부에서 직접 provide.
 * - ResourcePolicyRegistry / ProjectDelegationGraphStore 는 PolicyLifecyclePort /
 *   DelegationGraphPort 어댑터로 변환해서 use-case 와 read-model 에 주입.
 */
@Module({
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    policyLifecycleProvider,
    delegationGraphPortProvider,
    readModelProvider,
    useCaseProvider,
    ProjectAccessService,
  ],
  controllers: [ProjectController],
  exports: [ProjectRepositoryPort, ProjectReadModelQuery, ProjectUseCase, ProjectAccessService],
})
export class ProjectSliceModule {}
