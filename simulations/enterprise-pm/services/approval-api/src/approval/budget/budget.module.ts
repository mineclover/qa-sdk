// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { Module, type Provider } from "@nestjs/common";
import {
  SLICE_LOGGER_PORT,
  type LoggerPort,
  type TransactionPort,
  type OutboxPort,
} from "@qa-sdk/sim-domain-slice-kit";
import type { AccessChecker, ResourcePolicyRegistry } from "permission-engine";

import {
  APPROVAL_DB_INSTANCE,
  APPROVAL_REPOSITORY,
  type ApprovalDbInstanceHandle,
} from "../approval-db.module.js";
import {
  APPROVAL_ACCESS_CHECKER,
  APPROVAL_POLICY_REGISTRY,
} from "../../auth-deps/access-checker.module.js";
import type { ApprovalRepository } from "../shared/port.js";

import { BudgetRepositoryPort } from "./application/ports/budget-repository.port.js";
import { BudgetReadModelQuery } from "./application/queries/budget-read-model.query.js";
import { BudgetUseCase } from "./application/use-cases/budget.use-case.js";
import {
  BudgetAccessQueryPort,
  BudgetPolicyLifecyclePort,
} from "./application/ports/access-check.port.js";

import { createBudgetRepository } from "./infrastructure/persistence/budget.repository.js";
import { createBudgetTransactionPort } from "./infrastructure/transaction/budget.transaction.js";
import { createBudgetOutboxPort } from "./infrastructure/outbox/budget.outbox.js";
import { createBudgetLogger } from "./infrastructure/logging/budget.logger.js";
import {
  RepositoryBudgetReadModel,
  type BudgetStepReader,
} from "./infrastructure/read-model/budget.read-model.js";
import { ApprovalRepositoryBudgetStepReader } from "./infrastructure/read-model/budget-step.reader.js";
import {
  BudgetAccessAdapter,
  BudgetPolicyLifecycleAdapter,
} from "./infrastructure/access/budget-access.adapter.js";

import { BudgetController } from "./presentation/http/budget.controller.js";
import { BudgetDetailBff } from "./presentation/bff/budget-detail.bff.js";
import { BudgetDetailController } from "./presentation/bff/budget-detail.controller.js";

const BUDGET_TRANSACTION_PORT = Symbol.for("sim-approval-api/budget/TransactionPort");
const BUDGET_OUTBOX_PORT = Symbol.for("sim-approval-api/budget/OutboxPort");
const BUDGET_STEP_READER = Symbol.for("sim-approval-api/budget/StepReader");

const repositoryProvider: Provider = {
  provide: BudgetRepositoryPort,
  useFactory: (handle: ApprovalDbInstanceHandle) =>
    createBudgetRepository({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const transactionProvider: Provider = {
  provide: BUDGET_TRANSACTION_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): TransactionPort =>
    createBudgetTransactionPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const outboxProvider: Provider = {
  provide: BUDGET_OUTBOX_PORT,
  useFactory: (handle: ApprovalDbInstanceHandle): OutboxPort =>
    createBudgetOutboxPort({ dialect: handle.dialect, db: handle.db }),
  inject: [APPROVAL_DB_INSTANCE],
};

const loggerProvider: Provider = {
  provide: SLICE_LOGGER_PORT,
  useFactory: (): LoggerPort => createBudgetLogger(),
};

const stepReaderProvider: Provider = {
  provide: BUDGET_STEP_READER,
  useFactory: (repo: ApprovalRepository): BudgetStepReader =>
    new ApprovalRepositoryBudgetStepReader(repo),
  inject: [APPROVAL_REPOSITORY],
};

const accessQueryPortProvider: Provider = {
  provide: BudgetAccessQueryPort,
  useFactory: (checker: AccessChecker): BudgetAccessQueryPort =>
    new BudgetAccessAdapter(checker),
  inject: [APPROVAL_ACCESS_CHECKER],
};

const policyLifecyclePortProvider: Provider = {
  provide: BudgetPolicyLifecyclePort,
  useFactory: (
    registry?: ResourcePolicyRegistry,
  ): BudgetPolicyLifecyclePort | undefined =>
    registry ? new BudgetPolicyLifecycleAdapter(registry) : undefined,
  inject: [{ token: APPROVAL_POLICY_REGISTRY, optional: true }],
};

const readModelProvider: Provider = {
  provide: BudgetReadModelQuery,
  useFactory: (repo: BudgetRepositoryPort, steps: BudgetStepReader) =>
    new RepositoryBudgetReadModel(repo as never, steps),
  inject: [BudgetRepositoryPort, BUDGET_STEP_READER],
};

const useCaseProvider: Provider = {
  provide: BudgetUseCase,
  useFactory: (
    repo: BudgetRepositoryPort,
    outbox: OutboxPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    policyLifecycle?: BudgetPolicyLifecyclePort,
  ) => new BudgetUseCase(repo, outbox, transaction, logger, policyLifecycle),
  inject: [
    BudgetRepositoryPort,
    BUDGET_OUTBOX_PORT,
    BUDGET_TRANSACTION_PORT,
    SLICE_LOGGER_PORT,
    { token: BudgetPolicyLifecyclePort, optional: true },
  ],
};

const detailBffProvider: Provider = {
  provide: BudgetDetailBff,
  useFactory: (rm: BudgetReadModelQuery, logger: LoggerPort) =>
    new BudgetDetailBff(rm, logger),
  inject: [BudgetReadModelQuery, SLICE_LOGGER_PORT],
};

/**
 * Budget 슬라이스의 NestJS 모듈.
 *
 * - ApprovalDbModule (forRoot, global) 의 APPROVAL_DB_INSTANCE / APPROVAL_REPOSITORY 와
 *   AccessCheckerModule (global) 의 APPROVAL_ACCESS_CHECKER / APPROVAL_POLICY_REGISTRY 에 의존.
 * - SLICE_LOGGER_PORT 는 본 모듈 내부에서 직접 provide.
 * - AccessChecker / ResourcePolicyRegistry 는 BudgetAccessQueryPort /
 *   BudgetPolicyLifecyclePort 어댑터로 변환해서 use-case / controller 에 주입.
 * - approval_steps 는 cross-aggregate 테이블이라 ApprovalRepository 를 통해 read.
 */
@Module({
  providers: [
    repositoryProvider,
    transactionProvider,
    outboxProvider,
    loggerProvider,
    stepReaderProvider,
    accessQueryPortProvider,
    policyLifecyclePortProvider,
    readModelProvider,
    useCaseProvider,
    detailBffProvider,
  ],
  controllers: [BudgetController, BudgetDetailController],
  exports: [
    BudgetRepositoryPort,
    BudgetReadModelQuery,
    BudgetUseCase,
    BudgetDetailBff,
    BudgetAccessQueryPort,
  ],
})
export class BudgetSliceModule {}
