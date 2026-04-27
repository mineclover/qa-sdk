// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

/**
 * Plan 11a-1 — sim-auth-api 외부 노출 test-bootstrap.
 *
 * 용도:
 *   - @qa-sdk/sim-scenarios 의 in-process 모드 (Plan 13a)
 *   - 다른 시뮬 서비스의 통합 테스트 (Plan 13b/c/d/14b)
 *
 * 책임:
 *   1. NestJS Test 모듈로 AppModule 부팅 + 자동 포트 listen
 *   2. seedTestData: alice/bob + 3 role + 2 dept + 2 assignment 시드
 *   3. TestCredentialStore 주입 → password 검증이 실제 동작
 */

import { Test } from "@nestjs/testing";
import type { DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { HealthModule } from "./health/health.module.js";
import { AuthDbModule } from "./auth/auth-db.module.js";
import { UserSliceModule } from "./auth/user/user.module.js";
import { DepartmentSliceModule } from "./auth/department/department.module.js";
import { RoleSliceModule } from "./auth/role/role.module.js";
import { RoleAssignmentSliceModule } from "./auth/role-assignment/role-assignment.module.js";
import { BitmapSliceModule } from "./auth/bitmap/bitmap.module.js";
import { AuthenticateSliceModule } from "./auth/authenticate/authenticate.module.js";
import { UserUseCase } from "./auth/user/application/use-cases/user.use-case.js";
import { UserReadModelQuery } from "./auth/user/application/queries/user-read-model.query.js";
import { DepartmentUseCase } from "./auth/department/application/use-cases/department.use-case.js";
import { DepartmentReadModelQuery } from "./auth/department/application/queries/department-read-model.query.js";
import { RoleUseCase } from "./auth/role/application/use-cases/role.use-case.js";
import { RoleReadModelQuery } from "./auth/role/application/queries/role-read-model.query.js";
import { RoleAssignmentUseCase } from "./auth/role-assignment/application/use-cases/role-assignment.use-case.js";
import { TestCredentialStore } from "./auth/authenticate/application/ports/credential-store.port.js";
import type { AssignmentScopeType } from "./auth/role-assignment/domain/index.js";

export { AppModule } from "./app.module.js";

/** SQLite in-memory 전용. Plan 11a의 AuthDbModule이 QA_DB_DIALECT/QA_SQLITE_PATH 참조. */
export interface TestBootstrapOptions {
  sqlitePath?: string; // 기본 ":memory:"
  idStrategy?: "deterministic" | "uuid"; // 기본 deterministic
  jwtSecret?: string; // 기본 "x".repeat(32)
  bitmapV?: string; // 기본 "uv1"
}

export interface TestApiHandle {
  app: NestFastifyApplication;
  port: number;
  baseUrl: string; // http://127.0.0.1:<port>
  credentials: TestCredentialStore;
  close(): Promise<void>;
}

export interface TestFixtureHandle {
  alice: TestUser;
  bob: TestUser;
  departments: {
    engineering: { id: string; name: string };
    marketing: { id: string; name: string };
  };
  roles: {
    manager: { id: string; name: string };
    member: { id: string; name: string };
    admin: { id: string; name: string };
  };
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  departmentId: string;
}

/** 결정론적 ID 헬퍼 — controller derivation 과 동일 규약. */
function deriveUserId(email: string): string {
  return `usr_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function deriveRoleId(name: string): string {
  return `role_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function deriveDeptId(name: string): string {
  return `dept_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

/**
 * TestBootstrap 전용 AppModule — AuthenticateSliceModule.forRoot 에
 * TestCredentialStore 주입.
 *
 * 슬라이스 직접 import 패턴 (registry 미사용) — AuthenticateSliceModule 만
 * dynamic forRoot 로 변경하면 되므로 단순.
 */
function buildTestAppModule(credentialStore: TestCredentialStore): DynamicModule {
  @Module({
    imports: [
      HealthModule,
      AuthDbModule.forRoot(),
      UserSliceModule,
      DepartmentSliceModule,
      RoleSliceModule,
      RoleAssignmentSliceModule,
      BitmapSliceModule,
      AuthenticateSliceModule.forRoot({ credentialStore }),
      // BitmapCacheModule 은 운영용(Redis publisher) — 테스트에서는 생략.
    ],
  })
  class TestAppModule {}
  return { module: TestAppModule };
}

export async function bootstrapTestApi(
  opts: TestBootstrapOptions = {},
): Promise<TestApiHandle> {
  // SQLite in-memory + JWT secret — 환경변수로 Plan 11a의 AuthDbModule 동적 설정 전달.
  const prev = {
    QA_DB_DIALECT: process.env.QA_DB_DIALECT,
    QA_SQLITE_PATH: process.env.QA_SQLITE_PATH,
    SIM_BITMAP_SECRET: process.env.SIM_BITMAP_SECRET,
  };
  process.env.QA_DB_DIALECT = "sqlite";
  process.env.QA_SQLITE_PATH = opts.sqlitePath ?? ":memory:";
  process.env.SIM_BITMAP_SECRET = opts.jwtSecret ?? "x".repeat(32);

  const credentials = new TestCredentialStore();
  const moduleRef = await Test.createTestingModule({
    imports: [buildTestAppModule(credentials)],
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
    credentials,
    close: async () => {
      try {
        await app.close();
      } finally {
        process.env.QA_DB_DIALECT = prev.QA_DB_DIALECT;
        process.env.QA_SQLITE_PATH = prev.QA_SQLITE_PATH;
        process.env.SIM_BITMAP_SECRET = prev.SIM_BITMAP_SECRET;
      }
    },
  };
}

export async function seedTestData(handle: TestApiHandle): Promise<TestFixtureHandle> {
  const userUseCase = handle.app.get(UserUseCase);
  const userReadModel = handle.app.get(UserReadModelQuery);
  const deptUseCase = handle.app.get(DepartmentUseCase);
  const deptReadModel = handle.app.get(DepartmentReadModelQuery);
  const roleUseCase = handle.app.get(RoleUseCase);
  const roleReadModel = handle.app.get(RoleReadModelQuery);
  const assignmentUseCase = handle.app.get(RoleAssignmentUseCase);

  // 1. 부서
  const engineeringId = deriveDeptId("Engineering");
  const marketingId = deriveDeptId("Marketing");
  await deptUseCase.create({ id: engineeringId, name: "Engineering" });
  await deptUseCase.create({ id: marketingId, name: "Marketing" });
  const engineering = await deptReadModel.findDetail(engineeringId);
  const marketing = await deptReadModel.findDetail(marketingId);
  if (!engineering || !marketing) {
    throw new Error("seedTestData: department seed lookup failed");
  }

  // 2. 기본 role 3종 (design.md §3)
  //    manager: department scope, pm-api (8 addr) + approval-api (12 addr) 커버를 위해
  //             2 byte 전체 set (0xffff).
  //    member: project scope, 일부 action (0x0f00 = 하위 4비트만)
  //    admin: global scope, 모든 action
  //    AUTH_BITMASK_BYTES (=2)에 맞춰 2바이트 hex 사용.
  const managerRoleId = deriveRoleId("manager");
  const memberRoleId = deriveRoleId("member");
  const adminRoleId = deriveRoleId("admin");
  await roleUseCase.create({
    id: managerRoleId,
    name: "manager",
    scopeType: "department",
    defaultMaskHex: "ffff",
  });
  await roleUseCase.create({
    id: memberRoleId,
    name: "member",
    scopeType: "project",
    defaultMaskHex: "0f00",
  });
  await roleUseCase.create({
    id: adminRoleId,
    name: "admin",
    scopeType: "global",
    defaultMaskHex: "ffff",
  });
  const managerRole = await roleReadModel.findDetail(managerRoleId);
  const memberRole = await roleReadModel.findDetail(memberRoleId);
  const adminRole = await roleReadModel.findDetail(adminRoleId);
  if (!managerRole || !memberRole || !adminRole) {
    throw new Error("seedTestData: role seed lookup failed");
  }

  // 3. alice (Engineering manager) / bob (Marketing member)
  const aliceId = deriveUserId("alice@example.com");
  const bobId = deriveUserId("bob@example.com");
  await userUseCase.create({
    id: aliceId,
    email: "alice@example.com",
    displayName: "Alice",
    departmentId: engineering.id,
    primaryRoleId: managerRole.id,
  });
  await userUseCase.create({
    id: bobId,
    email: "bob@example.com",
    displayName: "Bob",
    departmentId: marketing.id,
    primaryRoleId: memberRole.id,
  });
  const alice = await userReadModel.findDetail(aliceId);
  const bob = await userReadModel.findDetail(bobId);
  if (!alice || !bob) {
    throw new Error("seedTestData: user seed lookup failed");
  }

  // 4. role_assignments
  await assignmentUseCase.assign({
    userId: alice.id,
    roleId: managerRole.id,
    scopeType: "department" as AssignmentScopeType,
    scopeId: engineering.id,
  });
  await assignmentUseCase.assign({
    userId: bob.id,
    roleId: memberRole.id,
    scopeType: "department" as AssignmentScopeType,
    scopeId: marketing.id,
  });

  // 5. password 등록 — TestCredentialStore
  handle.credentials.set(alice.email, "alice-pass");
  handle.credentials.set(bob.email, "bob-pass");

  return {
    alice: {
      id: alice.id,
      email: alice.email,
      password: "alice-pass",
      displayName: alice.displayName,
      departmentId: engineering.id,
    },
    bob: {
      id: bob.id,
      email: bob.email,
      password: "bob-pass",
      displayName: bob.displayName,
      departmentId: marketing.id,
    },
    departments: {
      engineering: { id: engineering.id, name: engineering.name },
      marketing: { id: marketing.id, name: marketing.name },
    },
    roles: {
      manager: { id: managerRole.id, name: managerRole.name },
      member: { id: memberRole.id, name: memberRole.name },
      admin: { id: adminRole.id, name: adminRole.name },
    },
  };
}

export async function closeTestApi(handle: TestApiHandle): Promise<void> {
  await handle.close();
}

/** 확장 user 시드 결과 — sim-scenarios 가 base seed 위에 얹어서 사용. */
export interface ExtendedSeedHandle {
  carol: TestUser;
  david: TestUser;
  eve: TestUser;
  frank: TestUser;
  admin: TestUser;
  extra_roles: {
    director: { id: string; name: string };
    cfo: { id: string; name: string };
    approver: { id: string; name: string };
    external_consultant: { id: string; name: string };
  };
}

/**
 * seedExtendedUsers — Plan 13c/d 시나리오용 추가 user 5명 + role 4개 시드.
 *
 * 전제: 이미 seedTestData 로 base fixture (alice/bob + manager/member/admin role +
 * engineering/marketing dept) 가 생성되어 있어야 함.
 *
 * 추가 user:
 *   - carol: engineering manager (시나리오 5 stage 1)
 *   - david: engineering director (시나리오 5 stage 2)
 *   - eve:   global CFO (시나리오 5 stage 3)
 *   - frank: external_consultant (시나리오 6 delegate recipient)
 *   - admin: global admin (시나리오 8 role 변경 권한)
 *
 * role.defaultMaskHex 는 pm-api/approval-api 의 buildDefaultUnion 주소 범위를 커버하도록
 * 0xffff (16 bit 전체 set) 로 설정 — approval-api 는 12 address 공간 (kind 2 × labels 6).
 */
export async function seedExtendedUsers(
  handle: TestApiHandle,
  base: TestFixtureHandle,
): Promise<ExtendedSeedHandle> {
  const userUseCase = handle.app.get(UserUseCase);
  const userReadModel = handle.app.get(UserReadModelQuery);
  const roleUseCase = handle.app.get(RoleUseCase);
  const roleReadModel = handle.app.get(RoleReadModelQuery);
  const assignmentUseCase = handle.app.get(RoleAssignmentUseCase);

  const directorId = deriveRoleId("director");
  const cfoId = deriveRoleId("cfo");
  const approverId = deriveRoleId("approver");
  const externalId = deriveRoleId("external_consultant");
  await roleUseCase.create({
    id: directorId,
    name: "director",
    scopeType: "department",
    defaultMaskHex: "ffff",
  });
  await roleUseCase.create({
    id: cfoId,
    name: "cfo",
    scopeType: "global",
    defaultMaskHex: "ffff",
  });
  await roleUseCase.create({
    id: approverId,
    name: "approver",
    scopeType: "department",
    defaultMaskHex: "ffff",
  });
  await roleUseCase.create({
    id: externalId,
    name: "external_consultant",
    scopeType: "global",
    defaultMaskHex: "ffff",
  });
  const director = await roleReadModel.findDetail(directorId);
  const cfo = await roleReadModel.findDetail(cfoId);
  const approver = await roleReadModel.findDetail(approverId);
  const external = await roleReadModel.findDetail(externalId);
  if (!director || !cfo || !approver || !external) {
    throw new Error("seedExtendedUsers: role seed lookup failed");
  }

  const carolId = deriveUserId("carol@example.com");
  const davidId = deriveUserId("david@example.com");
  const eveId = deriveUserId("eve@example.com");
  const frankId = deriveUserId("frank@example.com");
  const adminUserId = deriveUserId("admin@example.com");
  await userUseCase.create({
    id: carolId,
    email: "carol@example.com",
    displayName: "Carol",
    departmentId: base.departments.engineering.id,
    primaryRoleId: base.roles.manager.id,
  });
  await userUseCase.create({
    id: davidId,
    email: "david@example.com",
    displayName: "David",
    departmentId: base.departments.engineering.id,
    primaryRoleId: director.id,
  });
  await userUseCase.create({
    id: eveId,
    email: "eve@example.com",
    displayName: "Eve",
    departmentId: base.departments.engineering.id,
    primaryRoleId: cfo.id,
  });
  await userUseCase.create({
    id: frankId,
    email: "frank@example.com",
    displayName: "Frank",
    departmentId: base.departments.engineering.id,
    primaryRoleId: external.id,
  });
  await userUseCase.create({
    id: adminUserId,
    email: "admin@example.com",
    displayName: "Admin",
    departmentId: base.departments.engineering.id,
    primaryRoleId: base.roles.admin.id,
  });
  const carol = await userReadModel.findDetail(carolId);
  const david = await userReadModel.findDetail(davidId);
  const eve = await userReadModel.findDetail(eveId);
  const frank = await userReadModel.findDetail(frankId);
  const adminUser = await userReadModel.findDetail(adminUserId);
  if (!carol || !david || !eve || !frank || !adminUser) {
    throw new Error("seedExtendedUsers: user seed lookup failed");
  }

  await assignmentUseCase.assign({
    userId: carol.id,
    roleId: base.roles.manager.id,
    scopeType: "department" as AssignmentScopeType,
    scopeId: base.departments.engineering.id,
  });
  await assignmentUseCase.assign({
    userId: david.id,
    roleId: director.id,
    scopeType: "department" as AssignmentScopeType,
    scopeId: base.departments.engineering.id,
  });
  await assignmentUseCase.assign({
    userId: eve.id,
    roleId: cfo.id,
    scopeType: "global" as AssignmentScopeType,
    scopeId: "global",
  });
  await assignmentUseCase.assign({
    userId: frank.id,
    roleId: external.id,
    scopeType: "global" as AssignmentScopeType,
    scopeId: "global",
  });
  await assignmentUseCase.assign({
    userId: adminUser.id,
    roleId: base.roles.admin.id,
    scopeType: "global" as AssignmentScopeType,
    scopeId: "global",
  });

  handle.credentials.set("carol@example.com", "carol-pass");
  handle.credentials.set("david@example.com", "david-pass");
  handle.credentials.set("eve@example.com", "eve-pass");
  handle.credentials.set("frank@example.com", "frank-pass");
  handle.credentials.set("admin@example.com", "admin-pass");

  return {
    carol: {
      id: carol.id,
      email: "carol@example.com",
      password: "carol-pass",
      displayName: "Carol",
      departmentId: base.departments.engineering.id,
    },
    david: {
      id: david.id,
      email: "david@example.com",
      password: "david-pass",
      displayName: "David",
      departmentId: base.departments.engineering.id,
    },
    eve: {
      id: eve.id,
      email: "eve@example.com",
      password: "eve-pass",
      displayName: "Eve",
      departmentId: base.departments.engineering.id,
    },
    frank: {
      id: frank.id,
      email: "frank@example.com",
      password: "frank-pass",
      displayName: "Frank",
      departmentId: base.departments.engineering.id,
    },
    admin: {
      id: adminUser.id,
      email: "admin@example.com",
      password: "admin-pass",
      displayName: "Admin",
      departmentId: base.departments.engineering.id,
    },
    extra_roles: {
      director: { id: director.id, name: director.name },
      cfo: { id: cfo.id, name: cfo.name },
      approver: { id: approver.id, name: approver.name },
      external_consultant: { id: external.id, name: external.name },
    },
  };
}
