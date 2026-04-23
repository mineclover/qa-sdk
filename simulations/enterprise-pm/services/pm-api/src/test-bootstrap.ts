// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

/**
 * sim-pm-api 외부 노출 test-bootstrap.
 *
 * Plan 13a 의 in-process 모드 진입점.
 * seedTestData({ projects, members }) 는 optional — fixture 시드 없이 API 호출만 테스트도 가능.
 */

import { Test } from "@nestjs/testing";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { AccessChecker, AuditRecorder, ResourcePolicyRegistry } from "permission-engine";
import { HealthModule } from "./health/health.module.js";
import {
  PmDbModule,
  PM_DB_INSTANCE,
  PM_REPOSITORY,
  type PmDbInstanceHandle,
} from "./pm/pm-db.module.js";
import { ProjectModule } from "./pm/project/project.module.js";
import { TaskModule } from "./pm/task/task.module.js";
import { MemberModule } from "./pm/member/member.module.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { ProjectService } from "./pm/project/project.service.js";
import { MemberService } from "./pm/member/member.service.js";
import type { PmRepository } from "./pm/shared/port.js";

export { AppModule } from "./app.module.js";

export interface TestBootstrapOptions {
  sqlitePath?: string; // 기본 ":memory:"
  /** Plan 13 시나리오는 fake AccessChecker (항상 allow) 로 부팅 후 실 Checker 는 통합 테스트에서 교체. */
  overrideChecker?: AccessChecker;
  overrideRegistry?: ResourcePolicyRegistry;
  /** Plan 13 시나리오 — 3 서비스 간 공유 AuditRecorder. 미주입 시 서비스별 InMemory. */
  overrideAudit?: AuditRecorder;
}

export interface TestPmApiHandle {
  app: NestFastifyApplication;
  port: number;
  baseUrl: string;
  close(): Promise<void>;
}

export interface TestProjectFixture {
  id: string;
  name: string;
  ownerId: string;
  departmentId: string;
}

export interface TestDelegationFixture {
  state: string;
  graphRootId: string;
}

export interface TestDelegationGraphFixture {
  graphId: string;
  snapshotId: string;
  nodeCount: number;
  relationCount: number;
  graph: {
    nodes: Array<{ nodeId: string; coord: { anchor: string } }>;
    relations: Array<{ relationId: string }>;
  };
}

export interface TestSeedInput {
  projects?: Array<{ name: string; ownerId: string; departmentId: string }>;
  members?: Array<{ projectId: string; userId: string; role: "lead" | "contributor" | "viewer" }>;
}

export interface TestSeedHandle {
  projects: TestProjectFixture[];
}

function buildTestAppModule(opts: TestBootstrapOptions): DynamicModule {
  @Module({
    imports: [
      HealthModule,
      PmDbModule.forRoot(),
      AccessCheckerModule.forRootAsync({
        inject: [PM_DB_INSTANCE, PM_REPOSITORY],
        useFactory: (...args: unknown[]) => {
          const handle = args[0] as PmDbInstanceHandle;
          const repo = args[1] as PmRepository;
          return {
            dialect: handle.dialect,
            db: handle.db,
            repo,
            overrideChecker: opts.overrideChecker,
            overrideRegistry: opts.overrideRegistry,
            overrideAudit: opts.overrideAudit,
          };
        },
      }),
      ProjectModule,
      TaskModule,
      MemberModule,
      // BitmapCacheModule 은 운영용 — 테스트에서 생략
    ],
  })
  class TestAppModule {}
  return { module: TestAppModule };
}

export async function bootstrapTestApi(
  opts: TestBootstrapOptions = {},
): Promise<TestPmApiHandle> {
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

export async function seedTestData(
  handle: TestPmApiHandle,
  input: TestSeedInput = {},
): Promise<TestSeedHandle> {
  const projectSvc = handle.app.get(ProjectService);
  const memberSvc = handle.app.get(MemberService);

  const projects: TestProjectFixture[] = [];
  for (const p of input.projects ?? []) {
    const created = await projectSvc.create({
      name: p.name,
      ownerId: p.ownerId,
      departmentId: p.departmentId,
    });
    projects.push({
      id: created.id,
      name: created.name,
      ownerId: created.ownerId,
      departmentId: created.departmentId,
    });
  }
  for (const m of input.members ?? []) {
    await memberSvc.add({
      projectId: m.projectId,
      userId: m.userId,
      role: m.role,
    });
  }

  return { projects };
}

/** 단일 프로젝트 생성 편의 유틸 — Plan 13a setup 에서 직접 호출. */
export async function createTestProject(
  handle: TestPmApiHandle,
  args: { name: string; ownerId: string; departmentId: string },
): Promise<TestProjectFixture> {
  const svc = handle.app.get(ProjectService);
  const p = await svc.create(args);
  return {
    id: p.id,
    name: p.name,
    ownerId: p.ownerId,
    departmentId: p.departmentId,
  };
}

/** delegate endpoint/service 확인용 편의 유틸 — in-process runner 와 통합 테스트에서 재사용. */
export async function delegateTestProject(
  handle: TestPmApiHandle,
  args: { projectId: string; graphRootId: string; delegateUserId: string },
): Promise<TestDelegationFixture> {
  const svc = handle.app.get(ProjectService);
  return svc.delegate(args);
}

export async function getDelegationGraph(
  handle: TestPmApiHandle,
  projectId: string,
): Promise<TestDelegationGraphFixture | null> {
  const svc = handle.app.get(ProjectService);
  const snapshot = await svc.getDelegationSnapshot(projectId);
  if (!snapshot) return null;
  return {
    graphId: snapshot.graphId,
    snapshotId: snapshot.snapshotId,
    nodeCount: snapshot.graph.nodes.length,
    relationCount: snapshot.graph.relations.length,
    graph: snapshot.graph as TestDelegationGraphFixture["graph"],
  };
}
