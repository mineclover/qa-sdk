// @def.boundary sim-scenarios
// @def.doc sim-erp-pm-design

/**
 * In-process 모드 — 4 NestJS Test 모듈 (auth-api/pm-api/approval-api/audit-browser-api)
 * + Hono in-process gateway 부팅.
 *
 * 3 서비스 (pm-api/approval-api/audit-browser-api) 는 동일 AuditRecorder 를 공유:
 *   1. createInMemorySqliteFixture() 로 shared audit DB 생성
 *   2. createSimAuditRecorder 로 recorder 생성
 *   3. pm-api/approval-api 에 overrideChecker 로 동일 recorder 주입
 *   4. audit-browser-api 는 bootstrapTestAuditBrowserApi 에 직접 recorder 주입
 *
 * 동적 import — sim 서비스 의존을 lazy load.
 */

import type { INestApplication } from "@nestjs/common";
import type { AccessChecker, AuditRecorder } from "permission-engine";

export interface InProcessFixtureUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  departmentId: string | null;
}

export interface InProcessFixtures {
  alice: InProcessFixtureUser;
  bob: InProcessFixtureUser;
  carol: InProcessFixtureUser;
  david: InProcessFixtureUser;
  eve: InProcessFixtureUser;
  frank: InProcessFixtureUser;
  admin: InProcessFixtureUser;
  departments: {
    eng: string;
    marketing: string;
  };
  roles: {
    manager: { id: string };
    member: { id: string };
    admin: { id: string };
    approver_role: { id: string };
  };
  /** Budget request 시드 — 시나리오 3/4/5 용. */
  seedBudgetRequest(args: {
    projectId: string;
    projectDepartmentId: string;
    amount: number;
    requesterId: string;
  }): Promise<{ id: string }>;
  /** Project delegate 헬퍼 — 시나리오 6 용 (pm-api test-bootstrap 확장). */
  delegateProject(args: {
    projectId: string;
    graphRootId: string;
    delegateUserId: string;
  }): Promise<void>;
}

export interface InProcessHandle {
  authApp: INestApplication;
  pmApp: INestApplication;
  approvalApp: INestApplication;
  auditBrowserApp: INestApplication;
  gatewayFetch: (req: Request) => Promise<Response>;
  cleanup(): Promise<void>;
  fixtures: InProcessFixtures;
  /** 공유 AuditRecorder — scenarios/test에서 직접 조회 가능. */
  recorder: AuditRecorder;
}

export interface InProcessOptions {
  jwtSecret: string;
  dialect: "sqlite";
  /** 시나리오 7 짧은 TTL — default 300. */
  jwtTtlSeconds?: number;
}

/**
 * bootstrapInProcess — scenarios in-process 진입점.
 *
 * 순서:
 *   1. shared audit DB/recorder
 *   2. auth-api 부팅 + seedTestData (alice/bob + carol/david/eve/frank/admin 확장)
 *   3. shared real AccessChecker (각 서비스 union 다르므로 실제로는 별도 checker)
 *   4. pm-api + approval-api 부팅 (overrideAudit 로 shared recorder)
 *   5. audit-browser-api 부팅 (같은 recorder)
 *   6. gateway in-process app (proxyTargets 주입)
 */
export async function bootstrapInProcess(
  opts: InProcessOptions,
): Promise<InProcessHandle> {
  // 1. shared audit fixture
  const { createInMemorySqliteFixture } = await import(
    "@qa-sdk/sim-audit-recorder-provider/memory-sqlite-fixture"
  );
  const auditFixture = createInMemorySqliteFixture();
  const { createSimAuditRecorder } = await import(
    "@qa-sdk/sim-audit-recorder-provider"
  );
  const sharedRecorder = await createSimAuditRecorder({
    dialect: "sqlite",
    db: auditFixture.db,
  });

  // 2. auth-api bootstrap + extended seed
  const authBootstrap = await import("@qa-sdk/sim-auth-api/test-bootstrap");
  const authHandle = await authBootstrap.bootstrapTestApi({
    jwtSecret: opts.jwtSecret,
  });
  const baseSeed = await authBootstrap.seedTestData(authHandle);
  const extendedFixtures = await buildFixtures(authHandle, baseSeed);

  // 3. pm-api bootstrap (overrideAudit)
  const pmBootstrap = await import("@qa-sdk/sim-pm-api/test-bootstrap");
  const pmHandle = await pmBootstrap.bootstrapTestApi({
    overrideAudit: sharedRecorder,
  });

  // 4. approval-api bootstrap (overrideAudit)
  const approvalBootstrap = await import(
    "@qa-sdk/sim-approval-api/test-bootstrap"
  );
  const approvalHandle = await approvalBootstrap.bootstrapTestApi({
    overrideAudit: sharedRecorder,
  });

  // 5. audit-browser-api bootstrap — shared recorder 직접 주입
  const auditBrowserBootstrap = await import(
    "@qa-sdk/sim-audit-browser-api/test-bootstrap"
  );
  const auditBrowserHandle = await auditBrowserBootstrap.bootstrapTestAuditBrowserApi({
    recorder: sharedRecorder,
  });
  // audit-browser-api 는 NestJS app 이지만 listen 안 된 상태 — listen 필요
  await auditBrowserHandle.app.listen(0, "127.0.0.1");
  const auditPort = (auditBrowserHandle.app.getHttpServer().address() as {
    port: number;
  }).port;

  // 6. gateway in-process app
  const { createApp } = await import("@qa-sdk/sim-gateway/app");
  const gatewayApp = createApp({
    authApiUrl: authHandle.baseUrl,
    jwtSecret: opts.jwtSecret,
    jwtTtlSeconds: opts.jwtTtlSeconds ?? 300,
    // auth-api BitmapModule 은 "v1" 사용 — gateway 검증도 동일해야 함.
    currentBitmapV: "v1",
    proxyTimeoutMs: 5_000,
    proxyTargets: {
      "sim-pm-api": pmHandle.baseUrl,
      "sim-approval-api": approvalHandle.baseUrl,
      "sim-notification-api": "http://127.0.0.1:1",
      "sim-reporting-api": "http://127.0.0.1:1",
      "sim-document-api": "http://127.0.0.1:1",
      "sim-audit-browser-api": `http://127.0.0.1:${auditPort}`,
    },
  });

  // in-process budget seed helper — approval-api service layer 직접 호출
  // 시나리오 3/4/5 는 decide 호출 가능한 in_review 상태 필요.
  const seedBudgetRequest = async (args: {
    projectId: string;
    projectDepartmentId: string;
    amount: number;
    requesterId: string;
  }) => {
    const { createTestBudgetRequest } = approvalBootstrap;
    const req = await createTestBudgetRequest(approvalHandle, {
      ...args,
      advanceTo: "in_review",
    });
    return { id: req.id };
  };

  // project delegate helper — pm-api service layer 직접 호출.
  const delegateProject = async (args: {
    projectId: string;
    graphRootId: string;
    delegateUserId: string;
  }) => {
    await pmBootstrap.delegateTestProject(pmHandle, args);
  };

  const handle: InProcessHandle = {
    authApp: authHandle.app,
    pmApp: pmHandle.app,
    approvalApp: approvalHandle.app,
    auditBrowserApp: auditBrowserHandle.app,
    gatewayFetch: async (req) => gatewayApp.fetch(req),
    fixtures: {
      ...extendedFixtures,
      seedBudgetRequest,
      delegateProject,
    },
    recorder: sharedRecorder,
    cleanup: async () => {
      await auditBrowserHandle.close();
      await approvalHandle.close();
      await pmHandle.close();
      await authHandle.close();
      auditFixture.close();
    },
  };

  return handle;
}

/**
 * seedExtendedUsers — auth-api base seed (alice/bob) 위에 시나리오 전용 user 4종 추가.
 *
 * - carol: engineering manager (Plan 13c 시나리오 5 stage 1)
 * - david: engineering director (stage 2)
 * - eve: global CFO (stage 3)
 * - frank: 외부 컨설턴트 (시나리오 6 delegate recipient)
 * - admin: global admin (시나리오 8 role 변경 권한)
 *
 * 본 함수는 auth-api 내부 service (UserService/RoleService/RoleAssignmentService/credentials) 를
 * app.get() 으로 직접 호출한다.
 */
async function buildFixtures(
  authHandle: Awaited<
    ReturnType<
      (typeof import("@qa-sdk/sim-auth-api/test-bootstrap"))["bootstrapTestApi"]
    >
  >,
  base: Awaited<
    ReturnType<
      (typeof import("@qa-sdk/sim-auth-api/test-bootstrap"))["seedTestData"]
    >
  >,
): Promise<Omit<InProcessFixtures, "seedBudgetRequest" | "delegateProject">> {
  const { seedExtendedUsers } = await import(
    "@qa-sdk/sim-auth-api/test-bootstrap"
  );
  const ext = await seedExtendedUsers(authHandle, base);

  return {
    alice: {
      id: base.alice.id,
      email: base.alice.email,
      password: base.alice.password,
      displayName: base.alice.displayName,
      departmentId: base.alice.departmentId,
    },
    bob: {
      id: base.bob.id,
      email: base.bob.email,
      password: base.bob.password,
      displayName: base.bob.displayName,
      departmentId: base.bob.departmentId,
    },
    carol: ext.carol,
    david: ext.david,
    eve: ext.eve,
    frank: ext.frank,
    admin: ext.admin,
    departments: {
      eng: base.departments.engineering.id,
      marketing: base.departments.marketing.id,
    },
    roles: {
      manager: { id: base.roles.manager.id },
      member: { id: base.roles.member.id },
      admin: { id: base.roles.admin.id },
      approver_role: { id: ext.extra_roles.approver.id },
    },
  };
}
