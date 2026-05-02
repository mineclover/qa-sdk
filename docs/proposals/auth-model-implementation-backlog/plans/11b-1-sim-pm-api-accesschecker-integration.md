---
lifecycle: draft
plan: 11b-1
phase: 4
depends-on: [11a-1, 11b, 12a, 05c, 05d]
---

# Plan 11b-1 — sim-pm-api AccessChecker 통합 + JWT-derived ownerId + test-bootstrap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 11b 에서 Defer 되어 미구현된 pm-api 보강 4건을 정식 Plan 으로 승격한다. (1) `POST /projects` 컨트롤러에서 body 의 `ownerId` 필수를 제거하고 **JWT sub 에서 ownerId 를 자동 도출**한다. (2) 프로젝트 생성 시 `resource-policy-store.create({ state: "UNREGISTERED", ownerId, resourceId: project.id, ... })` 를 **자동 호출**하여 AccessChecker Pass 2 의 lifecycle 분기가 동작할 정책 entry 를 자동 등록한다. (3) **AccessChecker.check** 를 GET `/projects/:id` 와 POST `/projects` 양 경로에 주입하고, 결과의 `rootSpanId` 를 응답 body 에 포함한다. (4) `src/test-bootstrap.ts` + `exports` 필드로 `@qa-sdk/sim-pm-api/test-bootstrap` 진입점 제공 — Plan 13a 의 in-process 부팅에서 정적 import 가능. `seedTestData({ projects, members })` 는 초기 프로젝트/멤버 fixture 삽입에 사용.

**Architecture:**
- **JWT-derived ownerId 도출**:
  - pm-api 는 gateway 가 주입한 `x-auth-user-id` 헤더(Plan 12a 의 gateway JWT verification 결과)를 읽는 `CurrentUserGuard` 를 도입.
  - `@CurrentUser() userId: string` 데코레이터 — `@nestjs/common` 의 `createParamDecorator` 로 구현.
  - POST `/projects` body 스키마에서 `ownerId` 제거, `departmentId` / `name` 만 유지. ownerId 는 guard 에서 주입된 header 값 사용.
  - 누락 시 401 (gateway 가 auth 를 우회한 경우) — sim 환경에서는 gateway 부팅 보장이 전제.
- **resource-policy-store 자동 등록** (design.md §3 lifecycle):
  - `ProjectService.create` 가 트랜잭션 내부에서: `(1) projects INSERT → (2) resource-policy-store.createPolicy({ resourceId: project.id, kind: "project", state: "UNREGISTERED", ownerId, cerbosPolicyRef: null, departmentId })`.
  - `resource-policy-store` 는 Plan 05c 의 `createResourcePolicyRegistry` factory 에서 dialect 분기로 초기화. pm-api 는 `PROJECT_POLICY_REGISTRY` DI token 으로 주입받아 사용.
  - 에러 격리: policy 생성 실패 시 projects row 롤백 + 예외 throw (projects 가 UNREGISTERED 정책 없이 orphan 되는 상태 방지).
- **AccessChecker 통합**:
  - `@qa-sdk/permission-engine` 의 `AccessChecker` 를 `PROJECT_ACCESS_CHECKER` DI token 으로 주입.
  - `ProjectController.create` 가 `accessChecker.check({ kind: "transaction", apiId: "project.create", userId, bitmap, coords: [...], targetId: null })` 호출 → `allow: true` 일 때만 service 실행, `allow: false` 면 403 + `rootSpanId` / `denyReason` 응답.
  - `ProjectController.get` 가 `accessChecker.check({ kind: "transaction", apiId: "project.read", userId, bitmap, coords: [...], targetId: project.id })` 호출 → Pass 2 에서 lifecycle(UNREGISTERED → ownerId 매칭) 분기.
  - 모든 응답 body 에 `rootSpanId` 포함 — Plan 13b/c/d 가 audit trace 조회 시 활용.
- **bitmap 전달 경로**:
  - gateway 는 JWT 의 bitmap claim 을 복호화해 `x-auth-bitmap-mask` (base64) + `x-auth-bitmap-v` 헤더로 전달 (Plan 12a).
  - pm-api 의 `CurrentUserGuard` 가 header → `VersionedBitmap` 객체로 재구성.
- **test-bootstrap 패턴** (Plan 11a-1 복제):
  - `bootstrapTestApi(opts?)` — `@nestjs/testing` + AppModule (`PROJECT_ACCESS_CHECKER` 를 fake 구현으로 교체 가능) + SQLite :memory:.
  - `seedTestData(handle, { projects?, members? })` — Plan 11b 의 PmRepository 로 projects / project_members fixture 삽입.
  - `createTestProject({ name, ownerId, departmentId })` 유틸 — Plan 13a 의 `setup` 단계에서 직접 호출.

**Tech Stack:**
- `@qa-sdk/permission-engine` workspace — `AccessChecker`, `VersionedBitmap` 타입
- `resource-policy-store` workspace — Plan 05c factory
- `@nestjs/testing` + `better-sqlite3` :memory: (Plan 11a-1 와 동일)
- Plan 12a 의 gateway header convention (`x-auth-user-id`, `x-auth-bitmap-mask`, `x-auth-bitmap-v`)
- ES2023, TypeScript 5.8, vitest

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/services/pm-api/src/auth-deps/current-user.decorator.ts` | `@CurrentUser() userId: string` |
| `simulations/enterprise-pm/services/pm-api/src/auth-deps/current-user.guard.ts` | `x-auth-user-id` / `x-auth-bitmap-*` 헤더 파싱 guard |
| `simulations/enterprise-pm/services/pm-api/src/auth-deps/current-user.guard.test.ts` | guard 단위 테스트 (header 있음/없음) |
| `simulations/enterprise-pm/services/pm-api/src/auth-deps/access-checker.module.ts` | `PROJECT_ACCESS_CHECKER` + `PROJECT_POLICY_REGISTRY` provider |
| `simulations/enterprise-pm/services/pm-api/src/pm/project/project-access.service.ts` | AccessChecker + PolicyRegistry 조합 호출 헬퍼 |
| `simulations/enterprise-pm/services/pm-api/src/pm/project/project-access.service.test.ts` | Pass 1 allow + Pass 2 (UNREGISTERED owner match / mismatch) 분기 |
| `simulations/enterprise-pm/services/pm-api/src/test-bootstrap.ts` | `bootstrapTestApi` / `seedTestData` / `createTestProject` |
| `simulations/enterprise-pm/services/pm-api/src/test-bootstrap.test.ts` | bootstrap + seed + POST /projects 200 + GET /projects/:id 200 smoke |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/pm-api/package.json` | `exports` 필드 (`.`, `./test-bootstrap`) + `resource-policy-store` / `permission-engine` workspace dep 추가 |
| `simulations/enterprise-pm/services/pm-api/src/pm/project/project.controller.ts` | body 에서 `ownerId` 제거 + `@CurrentUser()` 주입 + `accessChecker.check` 호출 + `rootSpanId` 응답 포함 |
| `simulations/enterprise-pm/services/pm-api/src/pm/project/project.service.ts` | `create` 가 `PROJECT_POLICY_REGISTRY.createPolicy` 자동 호출 (UNREGISTERED) |
| `simulations/enterprise-pm/services/pm-api/src/pm/project/project.module.ts` | `PROJECT_POLICY_REGISTRY` / `PROJECT_ACCESS_CHECKER` import |
| `simulations/enterprise-pm/services/pm-api/src/app.module.ts` | `AccessCheckerModule.forRoot()` 추가, guard 를 `APP_GUARD` 로 등록 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/pm-api/src/pm/project/project.controller.ts \
     simulations/enterprise-pm/services/auth-api/src/test-bootstrap.ts \
     packages/resource-policy-store/src/factory.ts \
     packages/permission-engine/src/access-checker/checker.ts \
     simulations/enterprise-pm/services/gateway/src/lib/jwt.ts
```

Expected: 모두 hit. Plan 11b + 11a-1 + 05c + 12a 완료. 미완료 시 시작 금지.

- [ ] **Step 2: pm-api 현재 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-pm-api test 2>&1 | tail -3
```

Expected: Plan 11b 완료 시점의 PASS 수치 기록.

- [ ] **Step 3: 현재 POST /projects body 구조 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "createSchema\|ownerId" simulations/enterprise-pm/services/pm-api/src/pm/project/project.controller.ts
```

Expected: `ownerId: z.string().min(1)` hit — 본 plan 이 제거 대상.

---

## Task 1: package.json — exports 필드 + 의존 추가

**Files:**
- Modify: `simulations/enterprise-pm/services/pm-api/package.json`

- [ ] **Step 1: dependencies + exports**

```json
{
  "name": "@qa-sdk/sim-pm-api",
  "version": "0.1.0",
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
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md"],
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "@qa-sdk/core": "workspace:*",
    "@qa-sdk/logger": "workspace:*",
    "@qa-sdk/otel": "workspace:*",
    "@qa-sdk/sim-bitmap-cache": "workspace:*",
    "db-bootstrap": "workspace:*",
    "drizzle-orm": "catalog:",
    "permission-engine": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "resource-policy-store": "workspace:*",
    "rxjs": "^7.8.1",
    "weighted-index": "workspace:*",
    "zod": "^3.24.2"
  },
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
}
```

- [ ] **Step 2: pnpm install**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

Expected: `resource-policy-store` + `permission-engine` workspace link.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/package.json pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
chore(sim-pm-api): exports 필드 + resource-policy-store / permission-engine dep

test-bootstrap subpath 공개 — Plan 13a in-process 진입점.
AccessChecker + PolicyRegistry 통합 (Plan 11b-1 Task 2~5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: CurrentUser decorator + Guard — gateway header 파싱

**Files:**
- Create: `src/auth-deps/current-user.decorator.ts`
- Create: `src/auth-deps/current-user.guard.ts`
- Create: `src/auth-deps/current-user.guard.test.ts`

- [ ] **Step 1: current-user.decorator.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-bitmap-pipeline

import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface CurrentUserContext {
  userId: string;
  bitmapMask: Uint8Array;
  bitmapVersion: string;
}

/**
 * @CurrentUser() — 컨트롤러 파라미터로 gateway 주입 사용자 컨텍스트 소비.
 *
 * Guard 가 request.currentUser 를 세팅했다고 가정. 누락 시 undefined (guard 가 401 throw).
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): CurrentUserContext | undefined => {
    const req = ctx.switchToHttp().getRequest<{ currentUser?: CurrentUserContext }>();
    return req.currentUser;
  },
);
```

- [ ] **Step 2: current-user.guard.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-bitmap-pipeline

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { CurrentUserContext } from "./current-user.decorator.js";

const HEADER_USER = "x-auth-user-id";
const HEADER_MASK = "x-auth-bitmap-mask";
const HEADER_VERSION = "x-auth-bitmap-v";

/**
 * gateway(Plan 12a) 가 JWT 검증 후 주입하는 헤더 3종을 파싱해 request.currentUser 에 주입.
 *
 * 누락 / base64 decode 실패 → 401. 우회 방지 목적 — gateway 없이 pm-api 직접 접근 차단.
 */
@Injectable()
export class CurrentUserGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      currentUser?: CurrentUserContext;
    }>();
    const userId = this.header(req.headers, HEADER_USER);
    const maskBase64 = this.header(req.headers, HEADER_MASK);
    const version = this.header(req.headers, HEADER_VERSION);

    if (!userId || !maskBase64 || !version) {
      throw new UnauthorizedException({ error: "missing_auth_headers" });
    }

    let mask: Uint8Array;
    try {
      mask = Uint8Array.from(Buffer.from(maskBase64, "base64"));
    } catch {
      throw new UnauthorizedException({ error: "invalid_bitmap_mask" });
    }
    if (mask.byteLength === 0) {
      throw new UnauthorizedException({ error: "empty_bitmap_mask" });
    }

    req.currentUser = { userId, bitmapMask: mask, bitmapVersion: version };
    return true;
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string): string | null {
    const v = headers[name];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" ? v : null;
  }
}
```

- [ ] **Step 3: current-user.guard.test.ts (TDD — 4건)**

```ts
import { describe, expect, it } from "vitest";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { CurrentUserGuard } from "./current-user.guard.js";

function ctxWith(headers: Record<string, string>, mutable: { currentUser?: unknown } = {}): ExecutionContext {
  const req = { headers, ...mutable };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe("CurrentUserGuard", () => {
  const guard = new CurrentUserGuard();
  const validMask = Buffer.from([0xff, 0x00, 0xff]).toString("base64");

  it("모든 헤더 존재 → true + currentUser 주입", () => {
    const req: { currentUser?: unknown } = {};
    const ctx = ctxWith(
      { "x-auth-user-id": "alice", "x-auth-bitmap-mask": validMask, "x-auth-bitmap-v": "uv1" },
      req,
    );
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.currentUser).toMatchObject({ userId: "alice", bitmapVersion: "uv1" });
    expect((req.currentUser as { bitmapMask: Uint8Array }).bitmapMask.byteLength).toBe(3);
  });

  it("user-id 누락 → 401", () => {
    const ctx = ctxWith({ "x-auth-bitmap-mask": validMask, "x-auth-bitmap-v": "uv1" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("mask 누락 → 401", () => {
    const ctx = ctxWith({ "x-auth-user-id": "alice", "x-auth-bitmap-v": "uv1" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("mask empty (빈 base64) → 401", () => {
    const ctx = ctxWith({ "x-auth-user-id": "alice", "x-auth-bitmap-mask": "", "x-auth-bitmap-v": "uv1" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 4: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api test -- current-user
```

Expected: 4 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/auth-deps/current-user.decorator.ts \
          simulations/enterprise-pm/services/pm-api/src/auth-deps/current-user.guard.ts \
          simulations/enterprise-pm/services/pm-api/src/auth-deps/current-user.guard.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): CurrentUser decorator + Guard — gateway header 파싱

x-auth-user-id / x-auth-bitmap-mask (base64) / x-auth-bitmap-v 3 헤더.
누락 / decode 실패 → UnauthorizedException (gateway 우회 차단).
request.currentUser = { userId, bitmapMask (Uint8Array), bitmapVersion }.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: AccessChecker + PolicyRegistry provider 모듈

**Files:**
- Create: `src/auth-deps/access-checker.module.ts`

- [ ] **Step 1: access-checker.module.ts — DI 구성**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { type DynamicModule, Module } from "@nestjs/common";
import { AccessChecker } from "permission-engine";
import { createResourcePolicyRegistry } from "resource-policy-store";
import type { ResourcePolicyRegistry } from "permission-engine";

export const PROJECT_ACCESS_CHECKER = Symbol("PROJECT_ACCESS_CHECKER");
export const PROJECT_POLICY_REGISTRY = Symbol("PROJECT_POLICY_REGISTRY");

export interface AccessCheckerModuleOptions {
  /** Plan 05c factory 에 전달할 db. 테스트에서는 SQLite in-memory. */
  db: unknown;
  dialect: "sqlite" | "pg";
  /** 테스트에서 AccessChecker fake 를 주입하고 싶을 때. */
  overrideChecker?: AccessChecker;
  overrideRegistry?: ResourcePolicyRegistry;
}

@Module({})
export class AccessCheckerModule {
  static forRootAsync(factory: () => Promise<AccessCheckerModuleOptions>): DynamicModule {
    const registryProvider = {
      provide: PROJECT_POLICY_REGISTRY,
      useFactory: async (): Promise<ResourcePolicyRegistry> => {
        const opts = await factory();
        if (opts.overrideRegistry) return opts.overrideRegistry;
        return createResourcePolicyRegistry({ dialect: opts.dialect, db: opts.db });
      },
    };
    const checkerProvider = {
      provide: PROJECT_ACCESS_CHECKER,
      useFactory: async (registry: ResourcePolicyRegistry): Promise<AccessChecker> => {
        const opts = await factory();
        if (opts.overrideChecker) return opts.overrideChecker;
        return new AccessChecker({ policyRegistry: registry });
      },
      inject: [PROJECT_POLICY_REGISTRY],
    };
    return {
      module: AccessCheckerModule,
      providers: [registryProvider, checkerProvider],
      exports: [PROJECT_ACCESS_CHECKER, PROJECT_POLICY_REGISTRY],
      global: true,
    };
  }
}
```

**주의**: `AccessChecker` 와 `ResourcePolicyRegistry` 의 정확한 constructor signature 는 Plan 05c + permission-engine spec 을 따름 — 위 코드는 본 plan 수행 시점의 API 에 맞춰 조정 필요(`new AccessChecker({ policyRegistry, auditRecorder? })` 등).

- [ ] **Step 2: typecheck 기준 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api typecheck 2>&1 | tail -5
```

Expected: 0 error. constructor mismatch 시 Plan 05c / permission-engine spec 참조 후 조정.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/auth-deps/access-checker.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): AccessCheckerModule — DI provider 2종

PROJECT_POLICY_REGISTRY: createResourcePolicyRegistry factory (Plan 05c).
PROJECT_ACCESS_CHECKER: AccessChecker wrapping registry.
테스트용 overrideChecker/overrideRegistry 옵션 (fake 주입).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: ProjectService — 자동 UNREGISTERED policy 생성

**Files:**
- Modify: `src/pm/project/project.service.ts`
- Modify: `src/pm/project/project.module.ts`

- [ ] **Step 1: project.service.ts — create 에 policy 등록 통합**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { Inject, Injectable } from "@nestjs/common";
import { createLogger } from "../../lib/logger.js";
import type { PmRepository } from "../shared/port.js";
import type { ProjectCreate, Project } from "../shared/types.js";
import { PM_REPOSITORY } from "../pm-db.module.js";
import type { ResourcePolicyRegistry } from "permission-engine";
import { PROJECT_POLICY_REGISTRY } from "../../auth-deps/access-checker.module.js";

const log = createLogger("sim-pm-api.project.service");

/**
 * ProjectService.create 는 2-step:
 *   1. projects INSERT (PmRepository)
 *   2. resource-policy-store createPolicy — state=UNREGISTERED, ownerId=입력값
 *
 * policy 등록 실패 시 projects 롤백 (PmRepository 의 delete 호출) — orphan 방지.
 * design.md §3 lifecycle: UNREGISTERED 는 owner 만 접근 허용 (Pass 2 분기).
 */
@Injectable()
export class ProjectService {
  constructor(
    @Inject(PM_REPOSITORY) private readonly repo: PmRepository,
    @Inject(PROJECT_POLICY_REGISTRY) private readonly policies: ResourcePolicyRegistry,
  ) {}

  async create(args: ProjectCreate): Promise<Project> {
    const project = await this.repo.createProject(args);
    try {
      await this.policies.createPolicy({
        resourceId: project.id,
        kind: "project",
        state: "UNREGISTERED",
        ownerId: args.ownerId,
        departmentId: args.departmentId,
        cerbosPolicyRef: null,
      });
    } catch (err) {
      log.error({ err, projectId: project.id }, "policy 생성 실패 — project 롤백");
      await this.repo.deleteProject(project.id);
      throw err;
    }
    return project;
  }

  async find(id: string) { return this.repo.findProject(id); }
  async listByDepartment(departmentId: string) { return this.repo.listProjectsByDepartment(departmentId); }
  async listByOwner(ownerId: string) { return this.repo.listProjectsByOwner(ownerId); }
  async update(id: string, patch: Partial<ProjectCreate>) { return this.repo.updateProject(id, patch); }
  async delete(id: string) {
    // policy 도 함께 제거 — §3 lifecycle: deleted → ARCHIVED 는 별도 Plan.
    await this.repo.deleteProject(id);
    await this.policies.deletePolicy(id).catch((err) => {
      log.warn({ err, projectId: id }, "policy 삭제 실패 — orphan policy 가능");
    });
  }
}
```

**주의**: `ResourcePolicyRegistry.createPolicy` / `deletePolicy` signature 는 Plan 05a-c 의 실제 API 와 일치해야 한다. 메서드 이름 / argument shape 가 다르면 본 구현 중 조정.

- [ ] **Step 2: project.module.ts — ProjectService 에 PROJECT_POLICY_REGISTRY 주입**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { Module } from "@nestjs/common";
import { PmDbModule } from "../pm-db.module.js";
import { AccessCheckerModule } from "../../auth-deps/access-checker.module.js";
import { ProjectService } from "./project.service.js";
import { ProjectController } from "./project.controller.js";
import { ProjectAccessService } from "./project-access.service.js";

@Module({
  imports: [PmDbModule, AccessCheckerModule], // AccessCheckerModule 은 global.forRootAsync — 외부에서 forRootAsync 호출
  providers: [ProjectService, ProjectAccessService],
  controllers: [ProjectController],
  exports: [ProjectService],
})
export class ProjectModule {}
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/pm/project/project.service.ts \
          simulations/enterprise-pm/services/pm-api/src/pm/project/project.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): ProjectService.create — UNREGISTERED policy 자동 등록

projects INSERT 후 resource-policy-store.createPolicy 호출.
policy 생성 실패 시 projects 롤백 (orphan 방지).
delete 시 policy 동시 삭제 (실패는 warn).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: ProjectAccessService — AccessChecker 호출 래퍼 + ProjectController 통합

**Files:**
- Create: `src/pm/project/project-access.service.ts`
- Create: `src/pm/project/project-access.service.test.ts`
- Modify: `src/pm/project/project.controller.ts`

- [ ] **Step 1: project-access.service.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import { Inject, Injectable } from "@nestjs/common";
import type { AccessChecker, CheckResult } from "permission-engine";
import { PROJECT_ACCESS_CHECKER } from "../../auth-deps/access-checker.module.js";
import type { CurrentUserContext } from "../../auth-deps/current-user.decorator.js";

export interface ProjectCheckInput {
  apiId: "project.create" | "project.read" | "project.update" | "project.delete";
  user: CurrentUserContext;
  targetId: string | null;
  departmentId: string | null;
}

@Injectable()
export class ProjectAccessService {
  constructor(@Inject(PROJECT_ACCESS_CHECKER) private readonly checker: AccessChecker) {}

  async check(input: ProjectCheckInput): Promise<CheckResult> {
    return this.checker.check({
      kind: "transaction",
      apiId: input.apiId,
      userId: input.user.userId,
      bitmap: {
        prefix: "sim.bitmap",
        v: input.user.bitmapVersion,
        mask: input.user.bitmapMask,
      },
      coords: [], // Plan 14 의 좌표 주입 — 본 plan 은 apiId + targetId 만 사용
      targetId: input.targetId,
      // departmentId 는 Pass 2 의 lifecycle evaluator 가 policy.departmentId 와 비교
      context: input.departmentId ? { departmentId: input.departmentId } : {},
    });
  }
}
```

**주의**: `AccessChecker.check` 의 정확한 argument shape 는 Plan 05c / permission-engine 의 최종 spec 에 맞추어 조정. `CheckResult` 는 `{ allow: boolean, rootSpanId: string, denyReason?: string, firstFailureSpanId?: string }` 형태 가정 (Plan 12c 기준).

- [ ] **Step 2: project-access.service.test.ts — 3건**

```ts
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { ProjectAccessService } from "./project-access.service.js";
import { PROJECT_ACCESS_CHECKER } from "../../auth-deps/access-checker.module.js";

function fakeChecker(result: { allow: boolean; rootSpanId: string; denyReason?: string }) {
  return { check: async () => result };
}

describe("ProjectAccessService", () => {
  const user = {
    userId: "alice",
    bitmapMask: new Uint8Array([0xff, 0xff]),
    bitmapVersion: "uv1",
  };

  async function withChecker(result: Parameters<typeof fakeChecker>[0]) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectAccessService,
        { provide: PROJECT_ACCESS_CHECKER, useValue: fakeChecker(result) },
      ],
    }).compile();
    return moduleRef.get(ProjectAccessService);
  }

  it("allow → rootSpanId 반환", async () => {
    const svc = await withChecker({ allow: true, rootSpanId: "root-1" });
    const res = await svc.check({
      apiId: "project.read",
      user,
      targetId: "p-1",
      departmentId: "dept-eng",
    });
    expect(res.allow).toBe(true);
    expect(res.rootSpanId).toBe("root-1");
  });

  it("deny + denyReason 포함", async () => {
    const svc = await withChecker({ allow: false, rootSpanId: "root-2", denyReason: "not_in_scope" });
    const res = await svc.check({
      apiId: "project.read",
      user,
      targetId: "p-1",
      departmentId: "dept-mkt",
    });
    expect(res.allow).toBe(false);
    expect(res.denyReason).toBe("not_in_scope");
  });

  it("context.departmentId 주입 — Pass 2 lifecycle evaluator 입력", async () => {
    let capturedContext: { departmentId?: string } | undefined;
    const svc = await withChecker({ allow: true, rootSpanId: "root-3" });
    // fake 를 재구성해 capture
    (svc as unknown as { checker: { check: (args: { context?: { departmentId?: string } }) => Promise<unknown> } }).checker = {
      check: async (args) => {
        capturedContext = args.context;
        return { allow: true, rootSpanId: "root-3" };
      },
    };
    await svc.check({
      apiId: "project.read",
      user,
      targetId: "p-1",
      departmentId: "dept-eng",
    });
    expect(capturedContext?.departmentId).toBe("dept-eng");
  });
});
```

- [ ] **Step 3: project.controller.ts — body ownerId 제거 + 2-call flow**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-resource-lifecycle

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { ProjectService } from "./project.service.js";
import { ProjectAccessService } from "./project-access.service.js";
import { CurrentUser, type CurrentUserContext } from "../../auth-deps/current-user.decorator.js";
import { CurrentUserGuard } from "../../auth-deps/current-user.guard.js";

const createSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().min(1),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

const updateSchema = createSchema.partial();

@Controller("projects")
@UseGuards(CurrentUserGuard)
export class ProjectController {
  constructor(
    private readonly svc: ProjectService,
    private readonly access: ProjectAccessService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserContext) {
    const parsed = createSchema.parse(body);

    // Pass 1/2 사전 체크 — 생성 시점은 targetId=null, departmentId 로 Pass 2 policy template 평가
    const pre = await this.access.check({
      apiId: "project.create",
      user,
      targetId: null,
      departmentId: parsed.departmentId,
    });
    if (!pre.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: pre.denyReason,
        rootSpanId: pre.rootSpanId,
      });
    }

    // ownerId 는 JWT sub 에서 도출 (body 에 없음)
    const project = await this.svc.create({
      name: parsed.name,
      ownerId: user.userId,
      departmentId: parsed.departmentId,
      status: parsed.status,
    });

    return { ...project, rootSpanId: pre.rootSpanId };
  }

  @Get(":id")
  async get(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: "project.read",
      user,
      targetId: id,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    return { ...p, rootSpanId: check.rootSpanId };
  }

  @Get()
  async list(@Query("departmentId") deptId: string, @Query("ownerId") ownerId: string) {
    if (deptId) return this.svc.listByDepartment(deptId);
    if (ownerId) return this.svc.listByOwner(ownerId);
    throw new NotFoundException("departmentId or ownerId query required");
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const parsed = updateSchema.parse(body);
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: "project.update",
      user,
      targetId: id,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const updated = await this.svc.update(id, parsed);
    return { ...updated, rootSpanId: check.rootSpanId };
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const p = await this.svc.find(id);
    if (!p) throw new NotFoundException(`Project not found: ${id}`);

    const check = await this.access.check({
      apiId: "project.delete",
      user,
      targetId: id,
      departmentId: p.departmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    await this.svc.delete(id);
    return { status: "deleted", rootSpanId: check.rootSpanId };
  }
}
```

- [ ] **Step 4: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api test -- project-access
```

Expected: 3 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/pm/project/project-access.service.ts \
          simulations/enterprise-pm/services/pm-api/src/pm/project/project-access.service.test.ts \
          simulations/enterprise-pm/services/pm-api/src/pm/project/project.controller.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): ProjectController — AccessChecker 통합 + JWT-derived ownerId

body 에서 ownerId 제거 — @CurrentUser 로 JWT sub 자동 도출.
모든 경로 (create/read/update/delete) 에 access.check 호출.
응답 body 에 rootSpanId 포함 (Plan 13b/c/d audit trace 조회용).
deny 시 403 + denyReason + rootSpanId.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: app.module — AccessCheckerModule.forRootAsync + 전역 guard

**Files:**
- Modify: `src/app.module.ts`

- [ ] **Step 1: app.module.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { PmDbModule, PM_DB_INSTANCE } from "./pm/pm-db.module.js";
import { ProjectModule } from "./pm/project/project.module.js";
import { TaskModule } from "./pm/task/task.module.js";
import { MemberModule } from "./pm/member/member.module.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

@Module({
  imports: [
    HealthModule,
    PmDbModule.forRoot(),
    AccessCheckerModule.forRootAsync(async () => ({
      dialect: env.QA_DB_DIALECT,
      db: globalThis.__pmDbInstance ?? null, // PmDbModule 이 export 한 db instance
    })),
    ProjectModule,
    TaskModule,
    MemberModule,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-pm-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-pm-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
```

**주의**: `PmDbModule` 이 db instance 를 어떻게 export 하는지 Plan 11b 구현에 따라 조정. 현재 `PM_DB_INSTANCE` provider 를 `AccessCheckerModule.forRootAsync` 의 `useFactory` 에 주입하는 형태가 이상적 — 위 코드는 최소 형태. 실제는 provider inject 로 구성:

```ts
AccessCheckerModule.forRootAsync({
  imports: [PmDbModule],
  inject: [PM_DB_INSTANCE],
  useFactory: (db: unknown) => ({ dialect: env.QA_DB_DIALECT, db }),
});
```

- [ ] **Step 2: 회귀 typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api typecheck && \
  pnpm --filter @qa-sdk/sim-pm-api test 2>&1 | tail -5
```

Expected: typecheck 0 + 기존 테스트 PASS 유지 + Task 2/5 신규 7 추가.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/app.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): AccessCheckerModule.forRootAsync 등록

PmDbModule export db → AccessCheckerModule 이 dialect + db 주입.
ProjectModule/TaskModule/MemberModule 이 PROJECT_ACCESS_CHECKER 소비.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: test-bootstrap.ts — bootstrapTestApi + seedTestData + createTestProject

**Files:**
- Create: `src/test-bootstrap.ts`
- Create: `src/test-bootstrap.test.ts`

- [ ] **Step 1: test-bootstrap.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

/**
 * sim-pm-api 외부 노출 test-bootstrap.
 *
 * Plan 13a 의 in-process 모드 진입점.
 * seedTestData({ projects, members }) 는 optional — fixture 시드 없이 API 호출만 테스트도 가능.
 */

import { Test } from "@nestjs/testing";
import type { INestApplication, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type { AccessChecker, ResourcePolicyRegistry } from "permission-engine";
import { HealthModule } from "./health/health.module.js";
import { PmDbModule } from "./pm/pm-db.module.js";
import { ProjectModule } from "./pm/project/project.module.js";
import { TaskModule } from "./pm/task/task.module.js";
import { MemberModule } from "./pm/member/member.module.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { ProjectService } from "./pm/project/project.service.js";
import { TaskService } from "./pm/task/task.service.js";
import { MemberService } from "./pm/member/member.service.js";

export { AppModule } from "./app.module.js";

export interface TestBootstrapOptions {
  sqlitePath?: string; // 기본 ":memory:"
  /** Plan 13 시나리오는 fake AccessChecker (항상 allow) 로 부팅 후 실 Checker 는 통합 테스트에서 교체. */
  overrideChecker?: AccessChecker;
  overrideRegistry?: ResourcePolicyRegistry;
}

export interface TestPmApiHandle {
  app: INestApplication;
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
      AccessCheckerModule.forRootAsync(async () => ({
        dialect: "sqlite",
        db: null,
        overrideChecker: opts.overrideChecker,
        overrideRegistry: opts.overrideRegistry,
      })),
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
    await memberSvc.addMember({
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
```

- [ ] **Step 2: test-bootstrap.test.ts (5건 smoke)**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AccessChecker } from "permission-engine";
import {
  bootstrapTestApi,
  createTestProject,
  seedTestData,
  type TestPmApiHandle,
} from "./test-bootstrap.js";

function fakeAllowChecker(): AccessChecker {
  return {
    check: async () => ({ allow: true, rootSpanId: "root-allow", denyReason: undefined }),
  } as unknown as AccessChecker;
}

describe("sim-pm-api/test-bootstrap", () => {
  let handle: TestPmApiHandle;

  beforeEach(async () => {
    handle = await bootstrapTestApi({ overrideChecker: fakeAllowChecker() });
  }, 30_000);

  afterEach(async () => {
    await handle.close();
  });

  it("bootstrapTestApi — port > 0", () => {
    expect(handle.port).toBeGreaterThan(0);
  });

  it("createTestProject — direct svc 호출 → project 생성 + UNREGISTERED policy 자동", async () => {
    const p = await createTestProject(handle, {
      name: "Demo",
      ownerId: "user-alice",
      departmentId: "dept-eng",
    });
    expect(p.ownerId).toBe("user-alice");
    expect(p.departmentId).toBe("dept-eng");
  });

  it("seedTestData — 2 projects + 1 member", async () => {
    const { projects } = await seedTestData(handle, {
      projects: [
        { name: "P1", ownerId: "user-alice", departmentId: "dept-eng" },
        { name: "P2", ownerId: "user-bob", departmentId: "dept-mkt" },
      ],
    });
    expect(projects).toHaveLength(2);
    const p1 = projects[0];
    await seedTestData(handle, {
      members: [{ projectId: p1.id, userId: "user-bob", role: "contributor" }],
    });
  });

  it("POST /projects — gateway header 없음 → 401", async () => {
    const res = await fetch(`${handle.baseUrl}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X", departmentId: "dept-eng" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /projects — gateway header + allow checker → 201 + rootSpanId", async () => {
    const maskB64 = Buffer.from([0xff, 0xff]).toString("base64");
    const res = await fetch(`${handle.baseUrl}/projects`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-user-id": "user-alice",
        "x-auth-bitmap-mask": maskB64,
        "x-auth-bitmap-v": "uv1",
      },
      body: JSON.stringify({ name: "Scenario2", departmentId: "dept-eng" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; ownerId: string; rootSpanId: string };
    expect(body.ownerId).toBe("user-alice");
    expect(body.rootSpanId).toBe("root-allow");
  });
});
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api test -- test-bootstrap
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/test-bootstrap.ts \
          simulations/enterprise-pm/services/pm-api/src/test-bootstrap.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): test-bootstrap — bootstrapTestApi + seedTestData + createTestProject

Plan 13a in-process 진입점 — overrideChecker 로 fake 주입 가능.
SQLite :memory: + PmDbModule.forRoot() + AccessCheckerModule.forRootAsync.
seedTestData: 배열 projects/members 일괄 삽입.
createTestProject: 단일 프로젝트 편의 유틸.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 빌드 산출 + subpath import 검증

- [ ] **Step 1: 빌드 재수행 + subpath import 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api clean && \
  pnpm --filter @qa-sdk/sim-pm-api build && \
  ls simulations/enterprise-pm/services/pm-api/dist/test-bootstrap.js \
     simulations/enterprise-pm/services/pm-api/dist/test-bootstrap.d.ts && \
  node --input-type=module -e "
    import('@qa-sdk/sim-pm-api/test-bootstrap').then(m => {
      if (typeof m.bootstrapTestApi !== 'function') throw new Error('bootstrapTestApi missing');
      if (typeof m.seedTestData !== 'function') throw new Error('seedTestData missing');
      if (typeof m.createTestProject !== 'function') throw new Error('createTestProject missing');
      if (!m.AppModule) throw new Error('AppModule missing');
      console.log('OK: test-bootstrap subpath import');
    });
  "
```

Expected: `OK: test-bootstrap subpath import`.

---

## Task 9: 회귀 — 전체 테스트 + def gate

- [ ] **Step 1: pm-api 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api typecheck && \
  pnpm --filter @qa-sdk/sim-pm-api test 2>&1 | tail -5
```

Expected: typecheck 0 + Plan 11b baseline + current-user 4 + project-access 3 + test-bootstrap 5 추가 PASS.

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

- [ ] **Step 5: 통합 e2e (pm-api 단독 부팅 — gateway 없이 header 직접 주입)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-pm-11b1.sqlite \
  pnpm --filter @qa-sdk/sim-pm-api start &
PID=$!
sleep 3

MASK=$(python3 -c "import base64; print(base64.b64encode(bytes([0xff,0xff])).decode())")
echo "POST /projects (with auth headers):"
curl -fsS -X POST http://localhost:4500/projects \
  -H "content-type: application/json" \
  -H "x-auth-user-id: user-alice" \
  -H "x-auth-bitmap-mask: $MASK" \
  -H "x-auth-bitmap-v: uv1" \
  -d '{"name":"Test","departmentId":"dept-eng"}'

echo
kill $PID 2>/dev/null || true
rm -f /tmp/sim-pm-11b1.sqlite
```

Expected: 실제 AccessChecker (Plan 05c PolicyRegistry 기반) 가 결정 — Plan 05c/permission-engine 의 실 구현 상태에 따라 allow/deny. 최소 `rootSpanId` 필드가 응답에 포함되어야 함.

---

## Self-Review

- [ ] `package.json` exports 필드 — `.`, `./test-bootstrap` 2건 공개
- [ ] `CurrentUserGuard` — `x-auth-user-id` / `x-auth-bitmap-mask` / `x-auth-bitmap-v` 3 헤더 필수
- [ ] `POST /projects` body 에 `ownerId` 없음 — JWT sub 에서 자동 도출
- [ ] `ProjectService.create` — `projects INSERT` + `resource-policy-store.createPolicy(UNREGISTERED)` 트랜잭션
- [ ] policy 생성 실패 시 project row 롤백 (orphan 방지)
- [ ] `ProjectController` 모든 경로 (create/read/update/delete) 에서 `AccessChecker.check` 호출
- [ ] 응답 body 에 `rootSpanId` 포함
- [ ] deny 시 403 + `denyReason` + `rootSpanId`
- [ ] `test-bootstrap.ts` — `bootstrapTestApi` + `seedTestData` + `createTestProject` + `AppModule` re-export
- [ ] `TestBootstrapOptions.overrideChecker` — Plan 13 시나리오가 fake 주입 가능
- [ ] SQLite :memory: 전용 테스트 환경
- [ ] 9 시뮬 서비스 typecheck 0 유지
- [ ] console.log 0건

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| Task / Member 도메인 AccessChecker 통합 | Plan 13 시나리오 1/2 는 Project 에만 집중 — Task/Member 는 후속 | Plan 15b / 별도 |
| `project.update` → policy state 전이 (UNREGISTERED → REGISTERED) | design.md §3 lifecycle transition — 별도 plan | Plan 13c (시나리오 6 연관) |
| `project.delegate` endpoint (DELEGATED 상태 전이) | Plan 13c 시나리오 6 고유 책임 | Plan 13c |
| gateway JWT 검증 — 본 plan 은 header 주입만 가정 | Plan 12a 가 JWT → header 변환 | Plan 12a |
| policy 복구 (orphan policy 수리) | 운영 시점 tool | 후속 |
| AccessCheckerModule 의 global=true 해제 — 명시적 import | module scope 명확화 | Plan 14 |

---

## 의존·후속

- **Plan 11b** (pm/approval domain): 본 plan 의 전제 — `ProjectService`, `ProjectModule`, `PmRepository` 를 수정.
- **Plan 11a-1** (auth-api test-bootstrap): 본 plan 의 `seedTestData` 호출 시점에 auth fixture 필요 (Plan 13 scenario 에서 조합).
- **Plan 05c** (resource-policy-store factory): `createResourcePolicyRegistry` 사용.
- **Plan 05d** (policy store consumer migration): 본 plan 이 pm-api 를 **신규 consumer** 로 추가.
- **Plan 12a** (gateway JWT bitmap embed): JWT → `x-auth-*` 헤더 변환 주체. 본 plan 은 header consumer.
- **Plan 13a/b/c/d** (시나리오 runner): 본 plan 의 `test-bootstrap` + `rootSpanId` 응답 + UNREGISTERED policy 자동 등록을 e2e 에서 검증.
- **Plan 11b-2** (approval-api 계약 정렬): 본 plan 과 병렬. 동일 `CurrentUserGuard` + `AccessCheckerModule` 패턴 복제.
