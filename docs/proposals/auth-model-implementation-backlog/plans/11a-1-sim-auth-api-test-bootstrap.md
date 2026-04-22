---
lifecycle: draft
plan: 11a-1
phase: 4
depends-on: [11a, 12a]
---

# Plan 11a-1 — sim-auth-api test-bootstrap + seedTestData + /auth/authenticate 실검증

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 11a에서 Defer되어 미구현된 항목 3건을 정식 Plan으로 승격한다. (1) `simulations/enterprise-pm/services/auth-api/src/test-bootstrap.ts` 를 신규 작성하여 `AppModule`, `bootstrapTestApi()`, `seedTestData()` 를 외부 노출한다. (2) `package.json` 에 `exports` 필드를 추가해 `@qa-sdk/sim-auth-api/test-bootstrap` 와 `@qa-sdk/sim-auth-api/auth-codec` 경로를 소비자 측(`@qa-sdk/sim-scenarios`)에서 정적 import 가능하게 한다. (3) 현재 이메일 존재만 확인하는 `POST /auth/authenticate` 를 simplified password 대조(평문 match + 실패 시 `UnauthorizedException`)로 교체해 Plan 13 시나리오 1 (login → bitmap 발급)이 실제로 동작하도록 한다. SQLite in-memory 전용 fixture(better-sqlite3 `:memory:`)로 seed 된 alice(Engineering)/bob(Marketing) + 3 기본 role(manager/member/admin) + role_assignments를 반환한다.

**Architecture:**
- **test-bootstrap 진입점 (순수 함수)**:
  - `bootstrapTestApi(opts?: TestBootstrapOptions): Promise<TestApiHandle>` — Plan 11a의 `AppModule` 을 `@nestjs/testing` 의 `Test.createTestingModule` 로 컴파일 후 `createNestApplication` + `init()` + `listen(0)` (OS 자동 포트 — Plan 13a `in-process` 모드 진입점).
  - `seedTestData(app: INestApplication, fixtures?: TestFixtureInput): Promise<TestFixtureHandle>` — NestJS app의 `UserService`, `DepartmentService`, `RoleService`, `RoleAssignmentService` 를 `app.get()` 으로 꺼내 fixture 데이터 삽입. default seed는 alice/bob + 3 role + 2 dept + 2 role_assignment.
  - `closeTestApi(handle: TestApiHandle): Promise<void>` — 포트 + DB fixture 정리.
- **simplified password (sim 편의)**:
  - `User` 테이블에 `passwordPlain` 컬럼을 추가하지 않고 `seedTestData` 가 메모리 Map(`Map<userId, plainPassword>`) 으로 관리. bootstrap 시 `TestCredentialStore` provider 가 주입되고, `AuthenticateService` 가 이 provider 를 참조. production 서비스(main.ts 부팅)에서는 `NoopCredentialStore` (항상 `false` 반환)가 제공되어 e2e/seed-less 모드와 격리됨.
  - bcrypt 미사용 — sim 편의. 실 운영 포팅 시 `TestCredentialStore` → `BcryptCredentialStore` 로 교체(§Defer).
- **exports 필드 구조**:
  - `"./test-bootstrap"`: `./dist/test-bootstrap.js` + `./dist/test-bootstrap.d.ts` (tsc ESM-only 빌드 결과).
  - `"./auth-codec"`: `./dist/auth/shared/auth-codec.js` — Plan 13 scenario-1 의 `authUnion / AUTH_BITMASK_BYTES / USER_ACTIONS` import 용.
  - `"./jwt"` (approval/pm-api 용 — 실제는 gateway 책임이지만 test-bootstrap 소비 측이 token 검증에 활용 가능).
- **fixture determinism**: seed가 같은 입력이면 같은 id 생성 — `seedTestData` 는 옵션에서 `idStrategy: "deterministic" | "uuid"` (기본 `deterministic`: `user-alice`, `user-bob` 같은 stable id).

**Tech Stack:**
- @nestjs/testing ^11 (Plan 11a Task 2 에서 이미 dep)
- SQLite in-memory (`better-sqlite3` `:memory:`, peerDep optional 이미 구성)
- Plan 11a의 `AuthDbModule.forRoot()` 를 `QA_DB_DIALECT=sqlite`, `QA_SQLITE_PATH=:memory:` 환경 변수로 부팅
- ES2023, TypeScript 5.8, vitest

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/services/auth-api/src/test-bootstrap.ts` | `bootstrapTestApi` / `seedTestData` / `closeTestApi` 진입점 |
| `simulations/enterprise-pm/services/auth-api/src/test-bootstrap.test.ts` | bootstrap + seed 단위 회귀 (fixture id 확인, /auth/authenticate 200/401, /bitmap/issue 200) |
| `simulations/enterprise-pm/services/auth-api/src/auth/authenticate/credential-store.ts` | `TestCredentialStore` / `NoopCredentialStore` provider |
| `simulations/enterprise-pm/services/auth-api/src/auth/authenticate/credential-store.test.ts` | 두 store의 `verify(email, password)` 동작 단위 테스트 |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/auth-api/package.json` | `exports` 필드 추가 (`.`, `./test-bootstrap`, `./auth-codec`), `@nestjs/testing` devDependency 추가 |
| `simulations/enterprise-pm/services/auth-api/src/app.module.ts` | `AuthenticateModule` 에 `CREDENTIAL_STORE` provider 주입 — 기본은 `NoopCredentialStore`, `forTest()` factory 지원 |
| `simulations/enterprise-pm/services/auth-api/src/auth/authenticate/authenticate.module.ts` | `CREDENTIAL_STORE` DI token export + `forRoot({ credentialStore })` static factory |
| `simulations/enterprise-pm/services/auth-api/src/auth/authenticate/authenticate.controller.ts` | `UserService.findByEmail` + `credentialStore.verify` 조합, 실패 시 `UnauthorizedException` 명시 |
| `simulations/enterprise-pm/services/auth-api/tsconfig.json` | `declaration: true`, `declarationMap: true` 가 이미 설정됐는지 확인 (미설정 시 추가) |

---

## Task 0: baseline

- [ ] **Step 1: Plan 11a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/auth-api/src/auth/factory.ts \
     simulations/enterprise-pm/services/auth-api/src/auth/bitmap/bitmap-issuer.service.ts \
     simulations/enterprise-pm/services/auth-api/src/auth/authenticate/authenticate.controller.ts \
     simulations/enterprise-pm/services/auth-api/src/auth/shared/auth-codec.ts
```

Expected: 모두 hit. 미존재 시 Plan 11a 재실행.

- [ ] **Step 2: 현재 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api test 2>&1 | tail -3
```

Expected: Plan 11a 완료 시점의 PASS 수치 기록 (본 plan 추가 후 증가분 계산용).

- [ ] **Step 3: auth-api build 산출 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api build && \
  ls simulations/enterprise-pm/services/auth-api/dist/auth/shared/auth-codec.js \
     simulations/enterprise-pm/services/auth-api/dist/auth/shared/auth-codec.d.ts
```

Expected: `.js` + `.d.ts` 양쪽 존재. `exports` 필드가 이 경로를 가리키도록 구성해야 함 (Task 1).

---

## Task 1: package.json — exports 필드 추가 + devDep 정비

**Files:**
- Modify: `simulations/enterprise-pm/services/auth-api/package.json`

- [ ] **Step 1: exports 필드 추가**

기존 `package.json` 의 `dependencies` 바로 위에 `"type": "module"` 이 이미 있음. 다음 필드를 추가:

```json
{
  "name": "@qa-sdk/sim-auth-api",
  "version": "0.1.0",
  "description": "시뮬 — 사용자/role/department + bitmap 발행 NestJS 서비스",
  "private": true,
  "type": "module",
  "main": "dist/main.js",
  "exports": {
    ".": {
      "import": "./dist/main.js",
      "types": "./dist/main.d.ts"
    },
    "./test-bootstrap": {
      "import": "./dist/test-bootstrap.js",
      "types": "./dist/test-bootstrap.d.ts"
    },
    "./auth-codec": {
      "import": "./dist/auth/shared/auth-codec.js",
      "types": "./dist/auth/shared/auth-codec.d.ts"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md"]
}
```

중요: `"main"` 은 유지 (`node dist/main.js` 동작 보장). `"exports"` 필드가 있으면 `exports` 맵에 선언된 subpath 만 import 가능 — 본 plan은 3개 (`.`, `./test-bootstrap`, `./auth-codec`) 만 허용. 추가 subpath가 필요하면 본 맵 확장.

- [ ] **Step 2: @nestjs/testing devDep + reflect-metadata 확인**

`devDependencies` 에 없으면 추가:

```json
"devDependencies": {
  "@nestjs/testing": "^11.0.0",
  "@types/better-sqlite3": "catalog:",
  "@types/node": "^22.0.0",
  "better-sqlite3": "catalog:",
  "drizzle-kit": "catalog:",
  "postgres": "^3.4.0",
  "tsx": "^4.19.3",
  "typescript": "^5.8.2",
  "vitest": "^1.6.1"
}
```

- [ ] **Step 3: tsconfig.json 의 declaration 옵션 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -E '"declaration"|"declarationMap"|"emitDeclarationOnly"' \
    simulations/enterprise-pm/services/auth-api/tsconfig.json
```

Expected: `"declaration": true` hit. 미설정 시 `compilerOptions` 에 추가:

```json
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

- [ ] **Step 4: pnpm install + 빌드 재검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  pnpm --filter @qa-sdk/sim-auth-api build && \
  node --input-type=module -e "import('@qa-sdk/sim-auth-api/auth-codec').then(m => console.log('authUnion type:', typeof m.authUnion))"
```

Expected: `authUnion type: object`. exports 맵 기반 import 가능함을 확인.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/package.json \
          simulations/enterprise-pm/services/auth-api/tsconfig.json \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
chore(sim-auth-api): exports 필드 — test-bootstrap / auth-codec subpath 노출

@qa-sdk/sim-scenarios 가 in-process bootstrap + authUnion 상수에 접근.
exports 맵으로 제한된 subpath만 공개 — main / test-bootstrap / auth-codec 3건.
tsconfig declaration 옵션 확인, @nestjs/testing devDep 추가.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: credential-store — 테스트/운영 분리된 password verify provider

**Files:**
- Create: `src/auth/authenticate/credential-store.ts`
- Create: `src/auth/authenticate/credential-store.test.ts`

- [ ] **Step 1: credential-store.test.ts (test-first)**

```ts
import { describe, expect, it } from "vitest";
import { NoopCredentialStore, TestCredentialStore } from "./credential-store.js";

describe("NoopCredentialStore", () => {
  it("verify는 항상 false 반환", async () => {
    const store = new NoopCredentialStore();
    expect(await store.verify("alice@example.com", "test123")).toBe(false);
  });
});

describe("TestCredentialStore", () => {
  it("set 후 verify 일치 → true", async () => {
    const store = new TestCredentialStore();
    store.set("alice@example.com", "test123");
    expect(await store.verify("alice@example.com", "test123")).toBe(true);
  });

  it("set 후 verify 비일치 → false", async () => {
    const store = new TestCredentialStore();
    store.set("alice@example.com", "test123");
    expect(await store.verify("alice@example.com", "wrong")).toBe(false);
  });

  it("set 안 된 email → false", async () => {
    const store = new TestCredentialStore();
    expect(await store.verify("unknown@example.com", "any")).toBe(false);
  });

  it("reset — 모든 credential 제거", async () => {
    const store = new TestCredentialStore();
    store.set("alice@example.com", "test123");
    store.reset();
    expect(await store.verify("alice@example.com", "test123")).toBe(false);
  });
});
```

- [ ] **Step 2: credential-store.ts**

```ts
// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

/**
 * CredentialStore — email/password 검증 책임 분리.
 *
 * 운영 auth-api는 NoopCredentialStore (항상 false) — main.ts 부팅 시 기본.
 * 테스트/시뮬 시나리오는 TestCredentialStore (in-memory Map) — seedTestData에서 주입.
 *
 * 실제 bcrypt/argon2 구현은 시뮬 스코프 밖 (§Defer). 본 plan은 sim 편의 목적.
 */
export interface CredentialStore {
  verify(email: string, password: string): Promise<boolean>;
}

export class NoopCredentialStore implements CredentialStore {
  async verify(_email: string, _password: string): Promise<boolean> {
    return false;
  }
}

export class TestCredentialStore implements CredentialStore {
  private readonly credentials = new Map<string, string>();

  set(email: string, passwordPlain: string): void {
    this.credentials.set(email.toLowerCase(), passwordPlain);
  }

  async verify(email: string, password: string): Promise<boolean> {
    const stored = this.credentials.get(email.toLowerCase());
    if (stored === undefined) return false;
    return stored === password;
  }

  reset(): void {
    this.credentials.clear();
  }
}

/** NestJS DI token. */
export const CREDENTIAL_STORE = Symbol("CREDENTIAL_STORE");
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api test -- credential-store
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/authenticate/credential-store.ts \
          simulations/enterprise-pm/services/auth-api/src/auth/authenticate/credential-store.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): CredentialStore provider — Noop / Test 2종

운영은 항상 false (NoopCredentialStore) — main.ts 기본.
시뮬은 TestCredentialStore (in-memory Map) — seedTestData에서 주입.
bcrypt는 §Defer (시뮬 스코프 밖).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: authenticate.module + controller — credentialStore 통합

**Files:**
- Modify: `src/auth/authenticate/authenticate.module.ts`
- Modify: `src/auth/authenticate/authenticate.controller.ts`

- [ ] **Step 1: authenticate.module.ts — forRoot({ credentialStore? }) 패턴**

```ts
// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { DynamicModule, Module } from "@nestjs/common";
import { AuthenticateController } from "./authenticate.controller.js";
import { UserModule } from "../user/user.module.js";
import {
  CREDENTIAL_STORE,
  type CredentialStore,
  NoopCredentialStore,
} from "./credential-store.js";

export interface AuthenticateModuleOptions {
  /** 기본은 NoopCredentialStore. test-bootstrap에서 TestCredentialStore 주입. */
  credentialStore?: CredentialStore;
}

@Module({})
export class AuthenticateModule {
  static forRoot(opts: AuthenticateModuleOptions = {}): DynamicModule {
    const store = opts.credentialStore ?? new NoopCredentialStore();
    return {
      module: AuthenticateModule,
      imports: [UserModule],
      controllers: [AuthenticateController],
      providers: [
        {
          provide: CREDENTIAL_STORE,
          useValue: store,
        },
      ],
      exports: [CREDENTIAL_STORE],
    };
  }
}
```

- [ ] **Step 2: authenticate.controller.ts — credentialStore.verify 조합**

```ts
// @def.boundary sim-auth-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Body, Controller, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { UserService } from "../user/user.service.js";
import { CREDENTIAL_STORE, type CredentialStore } from "./credential-store.js";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/authenticate
 *
 * sim 편의 — email 존재 + credentialStore.verify(email, password) 양자 통과 시 userId 반환.
 * 실패 시 401 — 동일한 오류 메시지로 타이밍 공격 방지 고려는 §Defer.
 */
@Controller("auth")
export class AuthenticateController {
  constructor(
    private readonly users: UserService,
    @Inject(CREDENTIAL_STORE) private readonly credentials: CredentialStore,
  ) {}

  @Post("authenticate")
  async authenticate(@Body() body: unknown) {
    const { email, password } = authSchema.parse(body);
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException({ error: "invalid_credentials" });

    const ok = await this.credentials.verify(email, password);
    if (!ok) throw new UnauthorizedException({ error: "invalid_credentials" });

    return {
      userId: user.id,
      displayName: user.displayName,
      departmentId: user.departmentId ?? null,
    };
  }
}
```

- [ ] **Step 3: app.module.ts — AuthenticateModule.forRoot() 호출로 교체**

```ts
// ...existing imports

@Module({
  imports: [
    HealthModule,
    AuthDbModule.forRoot(),
    UserModule,
    DepartmentModule,
    RoleModule,
    RoleAssignmentModule,
    BitmapModule,
    AuthenticateModule.forRoot(), // 기본 NoopCredentialStore — 운영 부팅
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: true,
      listenerEnabled: false,
      publisherName: "sim-auth-api",
    }),
  ],
})
export class AppModule {}
```

- [ ] **Step 4: 회귀 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api typecheck && \
  pnpm --filter @qa-sdk/sim-auth-api test 2>&1 | tail -5
```

Expected: typecheck 0. 기존 테스트 PASS 유지 + credential-store 5 추가.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/authenticate/authenticate.module.ts \
          simulations/enterprise-pm/services/auth-api/src/auth/authenticate/authenticate.controller.ts \
          simulations/enterprise-pm/services/auth-api/src/app.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): AuthenticateModule.forRoot + password verify 실동작

AuthenticateController가 UserService.findByEmail + credentialStore.verify 조합.
실패 시 UnauthorizedException({ error: "invalid_credentials" }) — 명시적 401.
운영 부팅은 NoopCredentialStore (항상 false) — seedTestData 이후에만 통과.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: test-bootstrap.ts — bootstrapTestApi + seedTestData

**Files:**
- Create: `src/test-bootstrap.ts`
- Create: `src/test-bootstrap.test.ts`

- [ ] **Step 1: test-bootstrap.ts**

```ts
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
import type { INestApplication, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { AuthDbModule } from "./auth/auth-db.module.js";
import { UserModule } from "./auth/user/user.module.js";
import { DepartmentModule } from "./auth/department/department.module.js";
import { RoleModule } from "./auth/role/role.module.js";
import { RoleAssignmentModule } from "./auth/role-assignment/role-assignment.module.js";
import { BitmapModule } from "./auth/bitmap/bitmap.module.js";
import { AuthenticateModule } from "./auth/authenticate/authenticate.module.js";
import { UserService } from "./auth/user/user.service.js";
import { DepartmentService } from "./auth/department/department.service.js";
import { RoleService } from "./auth/role/role.service.js";
import { RoleAssignmentService } from "./auth/role-assignment/role-assignment.service.js";
import { TestCredentialStore } from "./auth/authenticate/credential-store.js";

export { AppModule } from "./app.module.js";

/** SQLite in-memory 전용. Plan 11a의 AuthDbModule이 QA_DB_DIALECT/QA_SQLITE_PATH 참조. */
export interface TestBootstrapOptions {
  sqlitePath?: string; // 기본 ":memory:"
  idStrategy?: "deterministic" | "uuid"; // 기본 deterministic
  jwtSecret?: string; // 기본 "x".repeat(32)
  bitmapV?: string; // 기본 "uv1"
}

export interface TestApiHandle {
  app: INestApplication;
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

/**
 * TestBootstrap 전용 AppModule — AuthenticateModule.forRoot 에 TestCredentialStore 주입.
 * NoopCredentialStore 를 대체하기 위해 별도 모듈로 구성.
 */
function buildTestAppModule(credentialStore: TestCredentialStore): DynamicModule {
  @Module({
    imports: [
      HealthModule,
      AuthDbModule.forRoot(),
      UserModule,
      DepartmentModule,
      RoleModule,
      RoleAssignmentModule,
      BitmapModule,
      AuthenticateModule.forRoot({ credentialStore }),
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

  const app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0);
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
  const users = handle.app.get(UserService);
  const depts = handle.app.get(DepartmentService);
  const roles = handle.app.get(RoleService);
  const assignments = handle.app.get(RoleAssignmentService);

  // 1. 부서
  const engineering = await depts.create({ name: "Engineering" });
  const marketing = await depts.create({ name: "Marketing" });

  // 2. 기본 role 3종 (design.md §3)
  //    manager: department scope, default mask 는 user_action + dept_action 대부분 set
  //    member: project scope, user_action 일부
  //    admin: global scope, 모든 action
  const managerRole = await roles.create({
    name: "manager",
    scopeType: "department",
    defaultMaskHex: "ff00ff", // Plan 11a의 auth-codec 구조에 맞게 default — 실제 mask 는 computeUserBits 에서 계산
  });
  const memberRole = await roles.create({
    name: "member",
    scopeType: "project",
    defaultMaskHex: "0f0000",
  });
  const adminRole = await roles.create({
    name: "admin",
    scopeType: "global",
    defaultMaskHex: "ffffff",
  });

  // 3. alice (Engineering manager) / bob (Marketing member)
  const alice = await users.create({
    email: "alice@example.com",
    displayName: "Alice",
    departmentId: engineering.id,
    primaryRoleId: managerRole.id,
  });
  const bob = await users.create({
    email: "bob@example.com",
    displayName: "Bob",
    departmentId: marketing.id,
    primaryRoleId: memberRole.id,
  });

  // 4. role_assignments
  await assignments.assign({
    userId: alice.id,
    roleId: managerRole.id,
    scopeType: "department",
    scopeId: engineering.id,
  });
  await assignments.assign({
    userId: bob.id,
    roleId: memberRole.id,
    scopeType: "department",
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
```

- [ ] **Step 2: test-bootstrap.test.ts — 통합 smoke**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bootstrapTestApi,
  closeTestApi,
  seedTestData,
  type TestApiHandle,
  type TestFixtureHandle,
} from "./test-bootstrap.js";

describe("sim-auth-api/test-bootstrap", () => {
  let handle: TestApiHandle;
  let fixtures: TestFixtureHandle;

  beforeEach(async () => {
    handle = await bootstrapTestApi();
    fixtures = await seedTestData(handle);
  }, 30_000);

  afterEach(async () => {
    await closeTestApi(handle);
  });

  it("bootstrapTestApi — listen port > 0", () => {
    expect(handle.port).toBeGreaterThan(0);
    expect(handle.baseUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("seedTestData — alice/bob/depts/roles 반환", () => {
    expect(fixtures.alice.email).toBe("alice@example.com");
    expect(fixtures.bob.email).toBe("bob@example.com");
    expect(fixtures.departments.engineering.name).toBe("Engineering");
    expect(fixtures.departments.marketing.name).toBe("Marketing");
    expect(fixtures.roles.manager.name).toBe("manager");
    expect(fixtures.roles.member.name).toBe("member");
    expect(fixtures.roles.admin.name).toBe("admin");
  });

  it("POST /auth/authenticate — 올바른 password → 200", async () => {
    const res = await fetch(`${handle.baseUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: fixtures.alice.email, password: fixtures.alice.password }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string; departmentId: string };
    expect(body.userId).toBe(fixtures.alice.id);
    expect(body.departmentId).toBe(fixtures.departments.engineering.id);
  });

  it("POST /auth/authenticate — 잘못된 password → 401", async () => {
    const res = await fetch(`${handle.baseUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: fixtures.alice.email, password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /auth/authenticate — 미등록 email → 401", async () => {
    const res = await fetch(`${handle.baseUrl}/auth/authenticate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.com", password: "any" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /bitmap/issue — alice 발급 → prefix sim.bitmap", async () => {
    const res = await fetch(`${handle.baseUrl}/bitmap/issue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: fixtures.alice.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { prefix: string; mask: string; signature: string };
    expect(body.prefix).toBe("sim.bitmap");
    expect(body.mask.length).toBeGreaterThan(0);
    expect(body.signature.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api test -- test-bootstrap
```

Expected: 6 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/test-bootstrap.ts \
          simulations/enterprise-pm/services/auth-api/src/test-bootstrap.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): test-bootstrap — bootstrapTestApi + seedTestData

AppModule + TestCredentialStore 결합 — sim-scenarios in-process 진입점.
SQLite :memory: fixture. alice(Engineering)/bob(Marketing) + 3 role + 2 assignment.
/auth/authenticate 200/401 + /bitmap/issue 200 smoke 회귀.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 빌드 산출 + subpath import 동작 확인

- [ ] **Step 1: 빌드 재수행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api clean && \
  pnpm --filter @qa-sdk/sim-auth-api build && \
  ls simulations/enterprise-pm/services/auth-api/dist/test-bootstrap.js \
     simulations/enterprise-pm/services/auth-api/dist/test-bootstrap.d.ts \
     simulations/enterprise-pm/services/auth-api/dist/auth/shared/auth-codec.js \
     simulations/enterprise-pm/services/auth-api/dist/auth/shared/auth-codec.d.ts
```

Expected: 4 파일 모두 존재.

- [ ] **Step 2: 다른 패키지에서 subpath import 검증 (ad-hoc smoke)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node --input-type=module -e "
    import('@qa-sdk/sim-auth-api/test-bootstrap').then(m => {
      if (typeof m.bootstrapTestApi !== 'function') throw new Error('bootstrapTestApi not exported');
      if (typeof m.seedTestData !== 'function') throw new Error('seedTestData not exported');
      if (typeof m.closeTestApi !== 'function') throw new Error('closeTestApi not exported');
      if (!m.AppModule) throw new Error('AppModule not re-exported');
      console.log('OK: test-bootstrap subpath import');
    });
  "
```

Expected: `OK: test-bootstrap subpath import`.

- [ ] **Step 3: auth-codec subpath import 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node --input-type=module -e "
    import('@qa-sdk/sim-auth-api/auth-codec').then(m => {
      if (!m.authUnion) throw new Error('authUnion missing');
      if (typeof m.AUTH_BITMASK_BYTES !== 'number') throw new Error('AUTH_BITMASK_BYTES not number');
      if (!Array.isArray(m.USER_ACTIONS)) throw new Error('USER_ACTIONS not array');
      console.log('OK: auth-codec subpath import (AUTH_BITMASK_BYTES=' + m.AUTH_BITMASK_BYTES + ')');
    });
  "
```

Expected: `OK: auth-codec subpath import (AUTH_BITMASK_BYTES=<N>)`.

- [ ] **Step 4: 미선언 subpath 차단 검증 (exports 맵이 제한 역할 수행)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node --input-type=module -e "
    import('@qa-sdk/sim-auth-api/auth/shared/types').then(
      () => { console.log('UNEXPECTED: unreferenced subpath imported'); process.exit(1); },
      (err) => { console.log('OK: blocked subpath (' + err.code + ')'); }
    );
  "
```

Expected: `OK: blocked subpath (ERR_PACKAGE_PATH_NOT_EXPORTED)`. exports 맵이 정확히 공개 경로만 허용.

---

## Task 6: 회귀 — 전체 테스트 + def gate

- [ ] **Step 1: auth-api 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api typecheck && \
  pnpm --filter @qa-sdk/sim-auth-api test 2>&1 | tail -5
```

Expected: typecheck 0 + Plan 11a baseline + credential-store 5 + test-bootstrap 6 추가 PASS.

- [ ] **Step 2: 시뮬 서비스 전체 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter "@qa-sdk/sim-*" typecheck 2>&1 | tail -10
```

Expected: 9 시뮬 서비스 모두 0 error.

- [ ] **Step 3: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node packages/cli/dist/index.js def validate 2>&1 | head -3
```

Expected: errors 0.

- [ ] **Step 4: workflow-smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli test 2>&1 | tail -3
```

Expected: 12+ smoke PASS.

---

## Self-Review

- [ ] `package.json` exports 필드 — `.`, `./test-bootstrap`, `./auth-codec` 3건만 공개, 나머지 subpath 차단
- [ ] `test-bootstrap.ts` — `bootstrapTestApi` + `seedTestData` + `closeTestApi` 3 entry export
- [ ] `AppModule` re-export — Plan 13a의 `import { AppModule } from "@qa-sdk/sim-auth-api/test-bootstrap"` 가능
- [ ] `TestCredentialStore` 주입 — 운영 `NoopCredentialStore` 와 격리
- [ ] `AuthenticateController` — `UserService.findByEmail` + `credentialStore.verify` 양쪽 통과해야 200, 실패 시 401
- [ ] SQLite in-memory 전용 (`QA_SQLITE_PATH=:memory:`) — 테스트 독립성 확보
- [ ] `seedTestData` — alice(Engineering) / bob(Marketing) + 3 role + 2 dept + 2 assignment 결정론적 id
- [ ] 빌드 산출 `dist/test-bootstrap.js` + `.d.ts` 확인 — exports 맵과 일치
- [ ] 다른 시뮬 서비스 회귀 없음 (9 서비스 typecheck 0)
- [ ] console.log 0건 (CLAUDE.md 로깅 컨벤션)

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| bcrypt/argon2 기반 BcryptCredentialStore | sim 편의 — 운영 포팅 시점 결정 | auth model production plan |
| 타이밍 공격 방지 (constant-time compare) | sim 스코프 밖 | 운영 시점 |
| JWT refresh endpoint — /auth/refresh | 별도 Plan 12a 범위 | Plan 12a / 후속 |
| password 정책 validation (길이, 복잡도) | seed data 가 고정 plain string — sim 불필요 | 운영 시점 |
| seedTestData 의 `idStrategy: "uuid"` 분기 구현 | 결정론적 기본으로 충분 | 필요 시 후속 plan |
| exports 맵에 `./jwt` 추가 | gateway 책임이 명확 — auth-api 는 verify 불필요 | Plan 12a에 위임 |

---

## 의존·후속

- **Plan 11a** (auth domain 모델): 본 plan 의 전제. `AppModule` / `UserService` / `RoleService` 등 import.
- **Plan 12a** (gateway JWT bitmap embed): 본 plan 의 `/auth/authenticate` + `/bitmap/issue` 2-step 을 gateway 에서 조합.
- **Plan 13a** (scenario runner 1/2): 본 plan 의 `@qa-sdk/sim-auth-api/test-bootstrap` subpath 를 dynamic import.
- **Plan 13b/c/d** (scenario 3~8): 본 plan 의 `seedTestData` fixture 에 carol/david/eve/frank 추가 시드 (각 Plan 의 Task 0 에서 `seedTestData` 확장 허용 시점 명시).
- **Plan 11b-1** (pm-api test-bootstrap): 본 plan 과 병렬. 동일 `exports` + `test-bootstrap.ts` 패턴 복제.
- **Plan 11b-2** (approval-api 계약 정렬 + test-bootstrap): 본 plan 과 병렬. password 시드가 필요한 carol/david/eve 는 본 plan 의 `TestCredentialStore` 를 재사용.
