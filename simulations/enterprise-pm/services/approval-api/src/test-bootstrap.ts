// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * sim-approval-api 외부 노출 test-bootstrap — Plan 13a/b in-process 진입점.
 */

import { Test } from "@nestjs/testing";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { AccessChecker, ResourcePolicyRegistry } from "permission-engine";
import { HealthModule } from "./health/health.module.js";
import {
  ApprovalDbModule,
  APPROVAL_DB_INSTANCE,
  type ApprovalDbInstanceHandle,
} from "./approval/approval-db.module.js";
import { BudgetModule } from "./approval/budget/budget.module.js";
import { ResourceModule } from "./approval/resource/resource.module.js";
import { TimeOffModule } from "./approval/timeoff/timeoff.module.js";
import { ExpenseModule } from "./approval/expense/expense.module.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { BudgetService } from "./approval/budget/budget.service.js";

export { AppModule } from "./app.module.js";

export interface TestBootstrapOptions {
  sqlitePath?: string;
  overrideChecker?: AccessChecker;
  overrideRegistry?: ResourcePolicyRegistry;
}

export interface TestApprovalApiHandle {
  app: NestFastifyApplication;
  port: number;
  baseUrl: string;
  close(): Promise<void>;
}

export interface ApprovalFixtureHandle {
  /** approver role 식별자 — Plan 13 의 테스트 시드가 참조. 실제 role row 는 auth-api 책임. */
  approver_role: { id: string };
}

export interface TestBudgetRequestFixture {
  id: string;
  projectId: string;
  projectDepartmentId: string;
  amount: number;
  requesterId: string;
  status: string;
  currentStage: number;
  totalStages: number;
}

function buildTestAppModule(opts: TestBootstrapOptions): DynamicModule {
  @Module({
    imports: [
      HealthModule,
      ApprovalDbModule.forRoot(),
      AccessCheckerModule.forRootAsync({
        inject: [APPROVAL_DB_INSTANCE],
        useFactory: (...args: unknown[]) => {
          const handle = args[0] as ApprovalDbInstanceHandle;
          return {
            dialect: handle.dialect,
            db: handle.db,
            overrideChecker: opts.overrideChecker,
            overrideRegistry: opts.overrideRegistry,
          };
        },
      }),
      BudgetModule,
      ResourceModule,
      TimeOffModule,
      ExpenseModule,
    ],
  })
  class TestAppModule {}
  return { module: TestAppModule };
}

export async function bootstrapTestApi(
  opts: TestBootstrapOptions = {},
): Promise<TestApprovalApiHandle> {
  const prev = {
    QA_DB_DIALECT: process.env.QA_DB_DIALECT,
    QA_SQLITE_PATH: process.env.QA_SQLITE_PATH,
  };
  process.env.QA_DB_DIALECT = "sqlite";
  process.env.QA_SQLITE_PATH = opts.sqlitePath ?? ":memory:";

  const moduleRef = await Test.createTestingModule({
    imports: [buildTestAppModule(opts)],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  await app.listen(0, "127.0.0.1");
  const addr = app.getHttpServer().address() as { port: number } | null;
  if (!addr) throw new Error("bootstrapTestApi: HTTP server not listening");
  const port = addr.port;

  return {
    app,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      try {
        await app.close();
      } finally {
        process.env.QA_DB_DIALECT = prev.QA_DB_DIALECT;
        process.env.QA_SQLITE_PATH = prev.QA_SQLITE_PATH;
      }
    },
  };
}

/**
 * approver role 등 approval-api 도메인 전용 fixture 시드.
 * role 자체는 auth-api (Plan 11a-1) 에 존재하므로 본 fixture 는 id reference 만 반환.
 */
export async function seedApprovalFixtures(
  _handle: TestApprovalApiHandle,
): Promise<ApprovalFixtureHandle> {
  return {
    approver_role: { id: "role-approver" },
  };
}

/**
 * 단일 budget request 생성 — Plan 13b scenario 3/4 setup 진입점.
 * gateway / guard 우회 (직접 service 호출) — 내부 테스트 전용.
 */
export async function createTestBudgetRequest(
  handle: TestApprovalApiHandle,
  args: {
    projectId: string;
    projectDepartmentId: string;
    amount: number;
    requesterId: string;
  },
): Promise<TestBudgetRequestFixture> {
  const svc = handle.app.get(BudgetService);
  const req = await svc.create(args);
  return {
    id: req.id,
    projectId: req.projectId,
    projectDepartmentId: req.projectDepartmentId,
    amount: req.amount,
    requesterId: req.requesterId,
    status: req.status,
    currentStage: req.currentStage,
    totalStages: req.totalStages,
  };
}
