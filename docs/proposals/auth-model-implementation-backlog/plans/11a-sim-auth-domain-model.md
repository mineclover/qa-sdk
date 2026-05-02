---
lifecycle: draft
plan: 11a
phase: 4
depends-on: [10a, 04c, 05c]
---

# Plan 11a — 시뮬 auth domain 모델 (User / Department / Role / RoleAssignment + Bitmap 발행)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 10a에서 부팅한 `sim-auth-api` 위에 auth domain의 4 entity (User, Department, Role, RoleAssignment) + bitmap 발행 (BitmapIssuerService)을 부착한다. Drizzle ORM + dual-target (sqlite/ + pg/) 구조로, Plan 04c `db-bootstrap`의 `createConnection`과 Plan 05x `factory` 패턴(dynamic import)을 그대로 복제. 비즈니스 로직(state, computeUserBits)은 dialect-agnostic 순수 함수로 추출하고 어댑터는 SQL CRUD만 담당. weighted-index의 `DisjointUnionIndex`로 `sim.bitmap` prefix encoding 정의 후 `permission-engine`의 `issueBitmap`을 활용해 JWT-embed 가능한 `VersionedBitmap` 발급.

**Architecture:**
- **dual-target SSOT 패턴 (Plan 04c + 05x 복제)**:
  - `shared/` — dialect-agnostic 순수 도메인 (codec, state machine, computeUserBits, port interface)
  - `sqlite/schema.ts` + `sqlite/adapter.ts` — sqliteTable + 어댑터
  - `pg/schema.ts` + `pg/adapter.ts` — `pgSchema("sim")` + 어댑터
  - `factory.ts` — `QA_DB_DIALECT` 분기 dynamic import
  - `port-contract.test.ts` — 양쪽 어댑터에 동일 시나리오 적용 (Plan 05c와 동일 패턴)
- **bitmap encoding** (`shared/auth-codec.ts`): `DisjointUnionIndex` 4 variant
  - `user_action` — login/logout/refresh
  - `role_action` — assign/revoke
  - `dept_action` — manage_users/budget_request
  - `bitmap_action` — issue/refresh/invalidate
- **computeUserBits** (`shared/compute-user-bits.ts`): 사용자의 RoleAssignment 목록을 받아 scope(global/department/project)별로 ACTION을 union, `DisjointUnionIndex.encode`로 address 도출 → bitmap mask Uint8Array 생성
- **RoleAssignment scope 해석**:
  - `global` → 모든 ACTION 비트 set
  - `department:<id>` → 해당 dept_action 비트만 set + role의 user_action 일부
  - `project:<id>` → role-defined user_action 비트만 set
- **NestJS 모듈 구조** (Plan 10a app.module.ts에 imports):
  - `AuthDbModule` — factory로 connection 생성, db instance를 provider로 expose
  - `UserModule` — UserController + UserService (CRUD)
  - `DepartmentModule` — DepartmentController + DepartmentService (CRUD + parent tree)
  - `RoleModule` — RoleController + RoleService (CRUD)
  - `RoleAssignmentModule` — assign/revoke + listForUser
  - `BitmapIssuerModule` — POST /bitmap/issue (userId → VersionedBitmap)
- **db schema** — design.md §3 그대로:
  - users(id, email, displayName, departmentId, primaryRoleId)
  - departments(id, name, parentId, managerId)
  - roles(id, name, scopeType, defaultMaskHex)
  - role_assignments(userId, roleId, scopeType, scopeId)
- **TDD steps** — 각 layer (codec → schema → adapter → service → controller)에서 tests-first

**Tech Stack:**
- weighted-index (workspace) — DisjointUnionIndex
- permission-engine (workspace) — issueBitmap, VersionedBitmap
- drizzle-orm (catalog)
- db-bootstrap (workspace, Plan 04c)
- @nestjs/{common,core}, NestJS 11
- vitest, ES2023

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/services/auth-api/src/
├── auth/
│   ├── shared/
│   │   ├── types.ts                  # User/Department/Role/RoleAssignment 도메인 타입
│   │   ├── auth-codec.ts             # DisjointUnionIndex sim.bitmap encoding
│   │   ├── auth-codec.test.ts
│   │   ├── compute-user-bits.ts      # RoleAssignment[] → Uint8Array mask (순수 함수)
│   │   ├── compute-user-bits.test.ts
│   │   ├── port.ts                   # AuthRepository 인터페이스 (Plan 05c port 패턴)
│   │   └── errors.ts
│   ├── sqlite/
│   │   ├── schema.ts                 # sqliteTable × 4 + DDL
│   │   ├── adapter.ts                # SqliteAuthRepository (port 구현)
│   │   └── adapter.test.ts
│   ├── pg/
│   │   ├── schema.ts                 # pgSchema("sim") × 4 테이블
│   │   ├── adapter.ts                # PgAuthRepository
│   │   └── adapter.test.ts           # env gate QA_TEST_PG=1
│   ├── factory.ts                    # createAuthRepository({ dialect, db })
│   ├── factory.test.ts
│   ├── port-contract.test.ts         # SQLite + PG 동일 시나리오
│   ├── auth-db.module.ts             # NestJS DI provider — connection + repository
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.service.ts           # CRUD + listByDepartment
│   │   ├── user.service.test.ts
│   │   └── user.controller.ts        # REST endpoints
│   ├── department/
│   │   ├── department.module.ts
│   │   ├── department.service.ts     # CRUD + tree traversal (parent chain)
│   │   ├── department.service.test.ts
│   │   └── department.controller.ts
│   ├── role/
│   │   ├── role.module.ts
│   │   ├── role.service.ts
│   │   ├── role.service.test.ts
│   │   └── role.controller.ts
│   ├── role-assignment/
│   │   ├── role-assignment.module.ts
│   │   ├── role-assignment.service.ts  # assign/revoke + listForUser
│   │   ├── role-assignment.service.test.ts
│   │   └── role-assignment.controller.ts
│   └── bitmap/
│       ├── bitmap.module.ts
│       ├── bitmap-issuer.service.ts    # computeUserBits + issueBitmap
│       ├── bitmap-issuer.service.test.ts
│       └── bitmap.controller.ts        # POST /bitmap/issue
└── drizzle/
    ├── sqlite/0001_init.sql
    └── pg/0001_init.sql
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `src/app.module.ts` | imports에 AuthDbModule + 5 도메인 모듈 추가 |
| `src/health/health.controller.ts` | bitmap encoding ready 표시 (선택) |
| `package.json` | weighted-index + permission-engine + drizzle-orm + better-sqlite3/postgres dep 추가 |
| `drizzle.sqlite.config.ts` (신규) + `drizzle.pg.config.ts` (신규) | per-dialect Drizzle Kit config |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/auth-api/src/main.ts && \
  ls packages/db-bootstrap/src/connection.ts && \
  grep -n "createResourcePolicyRegistry" packages/resource-policy-store/src/factory.ts
```

Expected: 모두 hit. Plan 10a (auth-api 부팅) + 04c (db-bootstrap) + 05c (factory 패턴) 완료. 미완료 시 시작 금지.

- [ ] **Step 2: qa-sdk-postgres 컨테이너 부팅 (PG contract 검증용)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml ps qa-sdk-db | grep healthy || \
  docker compose -f docker-compose.infra.yaml up -d qa-sdk-db
```

- [ ] **Step 3: sim schema 존재 확인 (Plan 09b가 init.sql 갱신)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db \
    psql -U postgres -d qa_sdk -tA -c "SELECT nspname FROM pg_namespace WHERE nspname='sim';"
```

Expected: `sim` 출력. 미존재 시 Plan 09b 미완료 → 시작 금지.

- [ ] **Step 4: 현재 auth-api 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api test 2>&1 | tail -3
```

Expected: 9 PASS (Plan 10a env 6 + health 3).

---

## Task 1: package.json — 도메인 dep 추가

**Files:**
- Modify: `simulations/enterprise-pm/services/auth-api/package.json`

- [ ] **Step 1: dep + peerDep 추가**

Plan 05x 패턴: better-sqlite3 / postgres는 `peerDep optional`로 등록 + dev에 양쪽 설치. weighted-index / permission-engine / drizzle-orm은 dependency.

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-fastify": "^11.0.0",
    "@qa-sdk/core": "workspace:*",
    "@qa-sdk/logger": "workspace:*",
    "@qa-sdk/otel": "workspace:*",
    "db-bootstrap": "workspace:*",
    "drizzle-orm": "catalog:",
    "permission-engine": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "weighted-index": "workspace:*",
    "zod": "^3.24.2"
  },
  "peerDependencies": {
    "better-sqlite3": "catalog:",
    "postgres": "^3.4.0"
  },
  "peerDependenciesMeta": {
    "better-sqlite3": { "optional": true },
    "postgres": { "optional": true }
  },
  "devDependencies": {
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

Expected: weighted-index / permission-engine workspace 링크 + postgres ^3.4.0 신규 설치.

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/package.json pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
chore(sim-auth-api): 도메인 dep — weighted-index + permission-engine + drizzle

dual-target 패턴 (Plan 05x): better-sqlite3/postgres는 peerDep optional.
db-bootstrap connection factory를 통해 dialect 분기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: shared/types + shared/errors + shared/port (TDD: types-first)

**Files:**
- Create: `src/auth/shared/types.ts`
- Create: `src/auth/shared/errors.ts`
- Create: `src/auth/shared/port.ts`

- [ ] **Step 1: types.ts** (design.md §3 그대로)

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

export type ScopeType = "global" | "department" | "project";

export interface User {
  id: string;
  email: string;
  displayName: string;
  departmentId: string | null;
  primaryRoleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;        // project_manager / member / approver / finance / admin / director / cfo
  scopeType: ScopeType;
  /** role의 기본 ACTION 비트마스크 (hex). computeUserBits에서 base mask로 사용. */
  defaultMaskHex: string;
  createdAt: string;
}

export interface RoleAssignment {
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  /** scopeType=global이면 null. department/project이면 해당 ID. */
  scopeId: string | null;
  assignedAt: string;
}

export interface UserCreate {
  email: string;
  displayName: string;
  departmentId?: string;
  primaryRoleId?: string;
}

export interface DepartmentCreate {
  name: string;
  parentId?: string;
  managerId?: string;
}

export interface RoleCreate {
  name: string;
  scopeType: ScopeType;
  defaultMaskHex: string;
}

export interface RoleAssignmentCreate {
  userId: string;
  roleId: string;
  scopeType: ScopeType;
  scopeId: string | null;
}
```

- [ ] **Step 2: errors.ts**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

export class UserNotFoundError extends Error {
  constructor(public readonly userId: string) {
    super(`User not found: ${userId}`);
    this.name = "UserNotFoundError";
  }
}

export class DepartmentNotFoundError extends Error {
  constructor(public readonly departmentId: string) {
    super(`Department not found: ${departmentId}`);
    this.name = "DepartmentNotFoundError";
  }
}

export class RoleNotFoundError extends Error {
  constructor(public readonly roleId: string) {
    super(`Role not found: ${roleId}`);
    this.name = "RoleNotFoundError";
  }
}

export class DuplicateUserError extends Error {
  constructor(public readonly email: string) {
    super(`User already exists: ${email}`);
    this.name = "DuplicateUserError";
  }
}

export class InvalidScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidScopeError";
  }
}
```

- [ ] **Step 3: port.ts** (Plan 05c port 패턴)

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type {
  User,
  UserCreate,
  Department,
  DepartmentCreate,
  Role,
  RoleCreate,
  RoleAssignment,
  RoleAssignmentCreate,
} from "./types.js";

/**
 * AuthRepository — auth domain의 모든 영속 작업을 추상화.
 * SQLite/PG 어댑터가 본 인터페이스를 구현. NestJS service layer는 port만 의존.
 */
export interface AuthRepository {
  // ── User ────
  createUser(args: UserCreate): Promise<User>;
  findUser(userId: string): Promise<User | null>;
  findUserByEmail(email: string): Promise<User | null>;
  listUsersByDepartment(departmentId: string): Promise<User[]>;
  updateUser(userId: string, patch: Partial<UserCreate>): Promise<User>;
  deleteUser(userId: string): Promise<void>;

  // ── Department ────
  createDepartment(args: DepartmentCreate): Promise<Department>;
  findDepartment(deptId: string): Promise<Department | null>;
  listDepartments(): Promise<Department[]>;
  /** parent chain — root까지의 ancestor 목록 (자기 자신 포함). */
  resolveDepartmentChain(deptId: string): Promise<Department[]>;
  updateDepartment(deptId: string, patch: Partial<DepartmentCreate>): Promise<Department>;
  deleteDepartment(deptId: string): Promise<void>;

  // ── Role ────
  createRole(args: RoleCreate): Promise<Role>;
  findRole(roleId: string): Promise<Role | null>;
  listRoles(): Promise<Role[]>;
  deleteRole(roleId: string): Promise<void>;

  // ── RoleAssignment ────
  assignRole(args: RoleAssignmentCreate): Promise<RoleAssignment>;
  revokeRole(userId: string, roleId: string, scopeType: string, scopeId: string | null): Promise<void>;
  listAssignmentsForUser(userId: string): Promise<RoleAssignment[]>;
}
```

- [ ] **Step 4: typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api typecheck
```

Expected: 0 error.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/shared && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): auth domain shared — types + errors + port

design.md §3 데이터 모델 그대로 (User/Dept/Role/RoleAssignment).
AuthRepository port는 어댑터 구현 + service layer 모두의 단일 진입점.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: shared/auth-codec — DisjointUnionIndex (TDD)

**Files:**
- Create: `src/auth/shared/auth-codec.ts`
- Create: `src/auth/shared/auth-codec.test.ts`

- [ ] **Step 1: auth-codec.test.ts (test-first)**

```ts
import { describe, expect, it } from "vitest";
import { authUnion, USER_ACTIONS, ROLE_ACTIONS, DEPT_ACTIONS, BITMAP_ACTIONS } from "./auth-codec.js";

describe("sim auth-codec — DisjointUnionIndex", () => {
  it("4 variant 등록 (user/role/dept/bitmap action)", () => {
    expect(authUnion.kinds).toEqual(["user_action", "role_action", "dept_action", "bitmap_action"]);
  });

  it("totalSize = sum of all variants (낭비 없음)", () => {
    const expected = USER_ACTIONS.length + ROLE_ACTIONS.length + DEPT_ACTIONS.length + BITMAP_ACTIONS.length;
    expect(authUnion.totalSize).toBe(expected);
  });

  it("user_action.login encode/decode round-trip", () => {
    const addr = authUnion.encode("user_action", [USER_ACTIONS.indexOf("login")]);
    const decoded = authUnion.decode(addr);
    expect(decoded.kind).toBe("user_action");
    expect(decoded.coords[0]).toBe(USER_ACTIONS.indexOf("login"));
  });

  it("dept_action.budget_request encode/decode round-trip", () => {
    const addr = authUnion.encode("dept_action", [DEPT_ACTIONS.indexOf("budget_request")]);
    const decoded = authUnion.decode(addr);
    expect(decoded.kind).toBe("dept_action");
    expect(decoded.coords[0]).toBe(DEPT_ACTIONS.indexOf("budget_request"));
  });

  it("disjoint — kind 별 address range 겹치지 않음", () => {
    const userAddr = authUnion.encode("user_action", [0]);
    const roleAddr = authUnion.encode("role_action", [0]);
    const deptAddr = authUnion.encode("dept_action", [0]);
    const bmAddr = authUnion.encode("bitmap_action", [0]);
    const set = new Set([userAddr, roleAddr, deptAddr, bmAddr]);
    expect(set.size).toBe(4); // 모두 다른 address
  });
});
```

- [ ] **Step 2: auth-codec.ts**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { DisjointUnionIndex } from "weighted-index";

/**
 * sim.bitmap prefix encoding.
 *
 * design.md §3 — 4 variant disjoint union:
 *   user_action  — login/logout/refresh
 *   role_action  — assign/revoke
 *   dept_action  — manage_users/budget_request
 *   bitmap_action — issue/refresh/invalidate
 *
 * 각 variant는 1차원 shape (action enum만). project_action은 sim.project prefix가 owns.
 */

export const USER_ACTIONS = ["login", "logout", "refresh"] as const;
export const ROLE_ACTIONS = ["assign", "revoke"] as const;
export const DEPT_ACTIONS = ["manage_users", "budget_request"] as const;
export const BITMAP_ACTIONS = ["issue", "refresh", "invalidate"] as const;

export type UserAction = (typeof USER_ACTIONS)[number];
export type RoleAction = (typeof ROLE_ACTIONS)[number];
export type DeptAction = (typeof DEPT_ACTIONS)[number];
export type BitmapAction = (typeof BITMAP_ACTIONS)[number];

export const authUnion = new DisjointUnionIndex([
  { kind: "user_action", shape: [USER_ACTIONS.length], labels: USER_ACTIONS },
  { kind: "role_action", shape: [ROLE_ACTIONS.length], labels: ROLE_ACTIONS },
  { kind: "dept_action", shape: [DEPT_ACTIONS.length], labels: DEPT_ACTIONS },
  { kind: "bitmap_action", shape: [BITMAP_ACTIONS.length], labels: BITMAP_ACTIONS },
]);

/** 비트마스크 capacity (byte 단위, ceil). issueBitmap 호출 시 mask 길이 결정. */
export const AUTH_BITMASK_BYTES = Math.ceil(authUnion.totalSize / 8);
```

- [ ] **Step 3: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api test -- auth-codec
```

Expected: 5 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/shared/auth-codec.ts \
          simulations/enterprise-pm/services/auth-api/src/auth/shared/auth-codec.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): DisjointUnionIndex sim.bitmap encoding

4 variant: user/role/dept/bitmap action.
totalSize = sum (낭비 없음, product 1×N×N×N 회피).
AUTH_BITMASK_BYTES = ceil(total/8) — issueBitmap mask 길이.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: shared/compute-user-bits — 순수 함수 (TDD)

**Files:**
- Create: `src/auth/shared/compute-user-bits.ts`
- Create: `src/auth/shared/compute-user-bits.test.ts`

- [ ] **Step 1: compute-user-bits.test.ts (test-first)**

```ts
import { describe, expect, it } from "vitest";
import { computeUserBits } from "./compute-user-bits.js";
import { authUnion, USER_ACTIONS, DEPT_ACTIONS, AUTH_BITMASK_BYTES } from "./auth-codec.js";
import type { Role, RoleAssignment } from "./types.js";

const baseRole = (id: string, scopeType: "global" | "department" | "project", defaultMaskHex: string): Role => ({
  id, name: id, scopeType, defaultMaskHex, createdAt: "2026-04-22T00:00:00Z",
});

const baseAssign = (
  userId: string, roleId: string, scopeType: "global" | "department" | "project", scopeId: string | null,
): RoleAssignment => ({
  userId, roleId, scopeType, scopeId, assignedAt: "2026-04-22T00:00:00Z",
});

describe("computeUserBits", () => {
  it("global scope role → 모든 ACTION 비트 set (admin)", () => {
    const adminMask = "ff".repeat(AUTH_BITMASK_BYTES);
    const roles = new Map([["admin", baseRole("admin", "global", adminMask)]]);
    const assignments = [baseAssign("user-1", "admin", "global", null)];
    const mask = computeUserBits({ assignments, roles });
    // 모든 비트 set
    for (const b of mask) expect(b).toBe(0xff);
  });

  it("user_action.login만 가진 role → 해당 비트만 set", () => {
    const loginAddr = authUnion.encode("user_action", [USER_ACTIONS.indexOf("login")]);
    const loginMask = setBitToHex(loginAddr);
    const roles = new Map([["member", baseRole("member", "project", loginMask)]]);
    const assignments = [baseAssign("user-1", "member", "project", "proj-1")];
    const mask = computeUserBits({ assignments, roles });
    expect(getBit(mask, loginAddr)).toBe(true);
    expect(getBit(mask, loginAddr + 1)).toBe(false);
  });

  it("dept_action.budget_request — dept scope 일치 시만 union", () => {
    const reqAddr = authUnion.encode("dept_action", [DEPT_ACTIONS.indexOf("budget_request")]);
    const reqMask = setBitToHex(reqAddr);
    const roles = new Map([["dept_mgr", baseRole("dept_mgr", "department", reqMask)]]);
    const assignments = [baseAssign("user-1", "dept_mgr", "department", "dept-eng")];
    const mask = computeUserBits({ assignments, roles });
    expect(getBit(mask, reqAddr)).toBe(true);
  });

  it("여러 RoleAssignment union — 비트 OR", () => {
    const loginAddr = authUnion.encode("user_action", [USER_ACTIONS.indexOf("login")]);
    const reqAddr = authUnion.encode("dept_action", [DEPT_ACTIONS.indexOf("budget_request")]);
    const roles = new Map([
      ["member", baseRole("member", "project", setBitToHex(loginAddr))],
      ["dept_mgr", baseRole("dept_mgr", "department", setBitToHex(reqAddr))],
    ]);
    const assignments = [
      baseAssign("user-1", "member", "project", "proj-1"),
      baseAssign("user-1", "dept_mgr", "department", "dept-eng"),
    ];
    const mask = computeUserBits({ assignments, roles });
    expect(getBit(mask, loginAddr)).toBe(true);
    expect(getBit(mask, reqAddr)).toBe(true);
  });

  it("RoleAssignment의 role이 roles map에 없으면 무시 (fail-open warning은 호출자)", () => {
    const roles = new Map();
    const assignments = [baseAssign("user-1", "missing", "project", "proj-1")];
    const mask = computeUserBits({ assignments, roles });
    // 모든 비트 0
    for (const b of mask) expect(b).toBe(0);
  });

  it("mask 길이는 AUTH_BITMASK_BYTES와 일치", () => {
    const roles = new Map();
    const mask = computeUserBits({ assignments: [], roles });
    expect(mask.length).toBe(AUTH_BITMASK_BYTES);
  });
});

// helpers — 비트 단위 검증
function setBitToHex(bitIndex: number): string {
  const bytes = new Uint8Array(AUTH_BITMASK_BYTES);
  bytes[Math.floor(bitIndex / 8)] |= 1 << (bitIndex % 8);
  return Buffer.from(bytes).toString("hex");
}

function getBit(mask: Uint8Array, bitIndex: number): boolean {
  return (mask[Math.floor(bitIndex / 8)] & (1 << (bitIndex % 8))) !== 0;
}
```

- [ ] **Step 2: compute-user-bits.ts (실제 구현)**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type { RoleAssignment, Role } from "./types.js";
import { AUTH_BITMASK_BYTES } from "./auth-codec.js";

export interface ComputeUserBitsArgs {
  /** 사용자의 모든 RoleAssignment. */
  assignments: readonly RoleAssignment[];
  /** roleId → Role 사전. assignments의 roleId가 없으면 해당 assignment 무시. */
  roles: ReadonlyMap<string, Role>;
}

/**
 * 사용자의 RoleAssignment 목록을 기반으로 sim.bitmap mask를 계산한다.
 *
 * 알고리즘:
 *   1. 빈 mask (AUTH_BITMASK_BYTES bytes, 모두 0)
 *   2. 각 assignment에 대해
 *      a. roles.get(assignment.roleId) 조회. 없으면 skip.
 *      b. role.defaultMaskHex를 Uint8Array로 디코드.
 *      c. accumulator |= roleMask  (OR union).
 *   3. mask 반환.
 *
 * scope 검증은 본 함수에서 하지 않음 — 호출자(BitmapIssuerService)가
 * scopeType/scopeId 매칭이 필요한 경우 assignments를 미리 필터링해서 전달한다.
 *
 * 순수 함수 — DB·시간·랜덤성 의존 없음. SQLite/PG 어댑터 양쪽에서 재사용.
 */
export function computeUserBits(args: ComputeUserBitsArgs): Uint8Array {
  const accumulator = new Uint8Array(AUTH_BITMASK_BYTES);

  for (const assignment of args.assignments) {
    const role = args.roles.get(assignment.roleId);
    if (!role) continue;

    const roleMask = hexToBytes(role.defaultMaskHex);
    if (roleMask.length !== AUTH_BITMASK_BYTES) {
      throw new Error(
        `Role ${role.id} mask length ${roleMask.length} mismatch (expected ${AUTH_BITMASK_BYTES})`,
      );
    }
    for (let i = 0; i < AUTH_BITMASK_BYTES; i++) {
      accumulator[i] |= roleMask[i];
    }
  }

  return accumulator;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`hex string must have even length: ${hex}`);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
```

- [ ] **Step 3: 테스트 실행 (red → green)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api test -- compute-user-bits
```

Expected: 6 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/shared/compute-user-bits.ts \
          simulations/enterprise-pm/services/auth-api/src/auth/shared/compute-user-bits.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): computeUserBits — RoleAssignment[] → bitmap mask

순수 함수 — 어댑터 무관 재사용.
RoleAssignment scope 필터링은 호출자 책임 (BitmapIssuerService).
mask는 AUTH_BITMASK_BYTES 정확히 일치, 길이 mismatch는 throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: sqlite/schema + sqlite/adapter (TDD)

**Files:**
- Create: `src/auth/sqlite/schema.ts`
- Create: `src/auth/sqlite/adapter.ts`
- Create: `src/auth/sqlite/adapter.test.ts`

- [ ] **Step 1: schema.ts (sqliteTable × 4 + DDL)**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  departmentId: text("department_id"),
  primaryRoleId: text("primary_role_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_users_dept").on(t.departmentId)]);

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  managerId: text("manager_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_dept_parent").on(t.parentId)]);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
  defaultMaskHex: text("default_mask_hex").notNull(),
  createdAt: text("created_at").notNull(),
});

export const roleAssignments = sqliteTable("role_assignments", {
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
  scopeId: text("scope_id"),
  assignedAt: text("assigned_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.roleId, t.scopeType, t.scopeId] }),
  index("idx_ra_user").on(t.userId),
]);

export const SIM_AUTH_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department_id TEXT,
  primary_role_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_dept ON users(department_id);

CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dept_parent ON departments(parent_id);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  default_mask_hex TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_assignments (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  scope_id TEXT,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id, scope_type, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_ra_user ON role_assignments(user_id);
`;
```

- [ ] **Step 2: adapter.ts** (resource-policy-store DrizzleResourcePolicyRegistry 패턴 그대로)

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { AuthRepository } from "../shared/port.js";
import type {
  User, UserCreate, Department, DepartmentCreate,
  Role, RoleCreate, RoleAssignment, RoleAssignmentCreate,
} from "../shared/types.js";
import {
  UserNotFoundError, DuplicateUserError,
  DepartmentNotFoundError, RoleNotFoundError,
} from "../shared/errors.js";
import { users, departments, roles, roleAssignments } from "./schema.js";

export class SqliteAuthRepository implements AuthRepository {
  constructor(private readonly db: BetterSQLite3Database) {}

  // ── User ────────────────────────────────────────────────
  async createUser(args: UserCreate): Promise<User> {
    const existing = await this.findUserByEmail(args.email);
    if (existing) throw new DuplicateUserError(args.email);
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      email: args.email,
      displayName: args.displayName,
      departmentId: args.departmentId ?? null,
      primaryRoleId: args.primaryRoleId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(users).values({
      id: user.id, email: user.email, displayName: user.displayName,
      departmentId: user.departmentId, primaryRoleId: user.primaryRoleId,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    }).run();
    return user;
  }

  async findUser(userId: string): Promise<User | null> {
    const rows = this.db.select().from(users).where(eq(users.id, userId)).limit(1).all();
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const rows = this.db.select().from(users).where(eq(users.email, email)).limit(1).all();
    return rows[0] ? toUser(rows[0]) : null;
  }

  async listUsersByDepartment(departmentId: string): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.departmentId, departmentId)).all().map(toUser);
  }

  async updateUser(userId: string, patch: Partial<UserCreate>): Promise<User> {
    const cur = await this.findUser(userId);
    if (!cur) throw new UserNotFoundError(userId);
    const now = new Date().toISOString();
    const next: User = {
      ...cur,
      email: patch.email ?? cur.email,
      displayName: patch.displayName ?? cur.displayName,
      departmentId: patch.departmentId ?? cur.departmentId,
      primaryRoleId: patch.primaryRoleId ?? cur.primaryRoleId,
      updatedAt: now,
    };
    this.db.update(users).set({
      email: next.email, displayName: next.displayName,
      departmentId: next.departmentId, primaryRoleId: next.primaryRoleId,
      updatedAt: next.updatedAt,
    }).where(eq(users.id, userId)).run();
    return next;
  }

  async deleteUser(userId: string): Promise<void> {
    this.db.delete(users).where(eq(users.id, userId)).run();
  }

  // ── Department ──────────────────────────────────────────
  async createDepartment(args: DepartmentCreate): Promise<Department> {
    const now = new Date().toISOString();
    const dept: Department = {
      id: randomUUID(),
      name: args.name,
      parentId: args.parentId ?? null,
      managerId: args.managerId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(departments).values({
      id: dept.id, name: dept.name, parentId: dept.parentId, managerId: dept.managerId,
      createdAt: dept.createdAt, updatedAt: dept.updatedAt,
    }).run();
    return dept;
  }

  async findDepartment(deptId: string): Promise<Department | null> {
    const rows = this.db.select().from(departments).where(eq(departments.id, deptId)).limit(1).all();
    return rows[0] ? toDepartment(rows[0]) : null;
  }

  async listDepartments(): Promise<Department[]> {
    return this.db.select().from(departments).all().map(toDepartment);
  }

  async resolveDepartmentChain(deptId: string): Promise<Department[]> {
    const chain: Department[] = [];
    let curId: string | null = deptId;
    const seen = new Set<string>();
    while (curId && !seen.has(curId)) {
      seen.add(curId);
      const dept = await this.findDepartment(curId);
      if (!dept) break;
      chain.push(dept);
      curId = dept.parentId;
    }
    return chain;
  }

  async updateDepartment(deptId: string, patch: Partial<DepartmentCreate>): Promise<Department> {
    const cur = await this.findDepartment(deptId);
    if (!cur) throw new DepartmentNotFoundError(deptId);
    const now = new Date().toISOString();
    const next: Department = {
      ...cur,
      name: patch.name ?? cur.name,
      parentId: patch.parentId ?? cur.parentId,
      managerId: patch.managerId ?? cur.managerId,
      updatedAt: now,
    };
    this.db.update(departments).set({
      name: next.name, parentId: next.parentId, managerId: next.managerId, updatedAt: next.updatedAt,
    }).where(eq(departments.id, deptId)).run();
    return next;
  }

  async deleteDepartment(deptId: string): Promise<void> {
    this.db.delete(departments).where(eq(departments.id, deptId)).run();
  }

  // ── Role ────────────────────────────────────────────────
  async createRole(args: RoleCreate): Promise<Role> {
    const role: Role = {
      id: randomUUID(),
      name: args.name,
      scopeType: args.scopeType,
      defaultMaskHex: args.defaultMaskHex,
      createdAt: new Date().toISOString(),
    };
    this.db.insert(roles).values(role).run();
    return role;
  }

  async findRole(roleId: string): Promise<Role | null> {
    const rows = this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1).all();
    return rows[0] ? (rows[0] as Role) : null;
  }

  async listRoles(): Promise<Role[]> {
    return this.db.select().from(roles).all().map((r) => r as Role);
  }

  async deleteRole(roleId: string): Promise<void> {
    this.db.delete(roles).where(eq(roles.id, roleId)).run();
  }

  // ── RoleAssignment ──────────────────────────────────────
  async assignRole(args: RoleAssignmentCreate): Promise<RoleAssignment> {
    const role = await this.findRole(args.roleId);
    if (!role) throw new RoleNotFoundError(args.roleId);
    const ra: RoleAssignment = {
      userId: args.userId,
      roleId: args.roleId,
      scopeType: args.scopeType,
      scopeId: args.scopeId,
      assignedAt: new Date().toISOString(),
    };
    this.db.insert(roleAssignments).values(ra).onConflictDoNothing().run();
    return ra;
  }

  async revokeRole(userId: string, roleId: string, scopeType: string, scopeId: string | null): Promise<void> {
    this.db.delete(roleAssignments).where(
      and(
        eq(roleAssignments.userId, userId),
        eq(roleAssignments.roleId, roleId),
        eq(roleAssignments.scopeType, scopeType as "global" | "department" | "project"),
        scopeId === null ? eq(roleAssignments.scopeId, null as any) : eq(roleAssignments.scopeId, scopeId),
      ),
    ).run();
  }

  async listAssignmentsForUser(userId: string): Promise<RoleAssignment[]> {
    return this.db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId)).all() as RoleAssignment[];
  }
}

// ── Row mappers ────────────────────────────────────────────
function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    departmentId: row.departmentId ?? null,
    primaryRoleId: row.primaryRoleId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDepartment(row: typeof departments.$inferSelect): Department {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId ?? null,
    managerId: row.managerId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 3: adapter.test.ts** (TDD — `:memory:` SQLite + DDL)

```ts
import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "./adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "./schema.js";

function fixture() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  return { repo: new SqliteAuthRepository(drizzle(raw)), close: () => raw.close() };
}

describe("SqliteAuthRepository", () => {
  let f: ReturnType<typeof fixture>;
  beforeEach(() => { f = fixture(); });

  it("createUser → findUser round-trip", async () => {
    const u = await f.repo.createUser({ email: "a@b.c", displayName: "A" });
    const read = await f.repo.findUser(u.id);
    expect(read?.email).toBe("a@b.c");
  });

  it("createUser duplicate email → DuplicateUserError", async () => {
    await f.repo.createUser({ email: "a@b.c", displayName: "A" });
    await expect(f.repo.createUser({ email: "a@b.c", displayName: "B" }))
      .rejects.toThrow("User already exists");
  });

  it("listUsersByDepartment", async () => {
    const dept = await f.repo.createDepartment({ name: "Eng" });
    await f.repo.createUser({ email: "1@x", displayName: "u1", departmentId: dept.id });
    await f.repo.createUser({ email: "2@x", displayName: "u2", departmentId: dept.id });
    await f.repo.createUser({ email: "3@x", displayName: "u3" });
    expect((await f.repo.listUsersByDepartment(dept.id)).length).toBe(2);
  });

  it("resolveDepartmentChain — root까지", async () => {
    const root = await f.repo.createDepartment({ name: "Root" });
    const mid = await f.repo.createDepartment({ name: "Mid", parentId: root.id });
    const leaf = await f.repo.createDepartment({ name: "Leaf", parentId: mid.id });
    const chain = await f.repo.resolveDepartmentChain(leaf.id);
    expect(chain.map((d) => d.name)).toEqual(["Leaf", "Mid", "Root"]);
  });

  it("createRole + assignRole + listAssignmentsForUser", async () => {
    const role = await f.repo.createRole({ name: "admin", scopeType: "global", defaultMaskHex: "ff" });
    const u = await f.repo.createUser({ email: "x@x", displayName: "x" });
    await f.repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    const list = await f.repo.listAssignmentsForUser(u.id);
    expect(list[0]?.roleId).toBe(role.id);
  });

  it("assignRole에 unknown roleId → RoleNotFoundError", async () => {
    const u = await f.repo.createUser({ email: "x@x", displayName: "x" });
    await expect(f.repo.assignRole({ userId: u.id, roleId: "missing", scopeType: "global", scopeId: null }))
      .rejects.toThrow("Role not found");
  });

  it("revokeRole — assignment 삭제", async () => {
    const role = await f.repo.createRole({ name: "r", scopeType: "global", defaultMaskHex: "ff" });
    const u = await f.repo.createUser({ email: "x@x", displayName: "x" });
    await f.repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    await f.repo.revokeRole(u.id, role.id, "global", null);
    expect((await f.repo.listAssignmentsForUser(u.id)).length).toBe(0);
  });

  it("updateUser — patch만 적용", async () => {
    const u = await f.repo.createUser({ email: "x@x", displayName: "old" });
    const updated = await f.repo.updateUser(u.id, { displayName: "new" });
    expect(updated.displayName).toBe("new");
    expect(updated.email).toBe("x@x");
  });
});
```

- [ ] **Step 4: 테스트 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api test -- adapter.test
```

Expected: 8 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/sqlite && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): SQLite schema + adapter (4 entity)

design.md §3 그대로. randomUUID로 ID 생성.
PRIMARY KEY (user_id, role_id, scope_type, scope_id) — 동일 조합 idempotent.
resolveDepartmentChain은 cycle-guard 포함 root까지 traversal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: pg/schema + pg/adapter (TDD — env gate QA_TEST_PG=1)

**Files:**
- Create: `src/auth/pg/schema.ts`
- Create: `src/auth/pg/adapter.ts`
- Create: `src/auth/pg/adapter.test.ts`

- [ ] **Step 1: pg/schema.ts** (`pgSchema("sim")` + 동일 4 테이블)

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { pgSchema, primaryKey, index, text } from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

export const users = sim.table("auth_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  departmentId: text("department_id"),
  primaryRoleId: text("primary_role_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_sim_users_dept").on(t.departmentId)]);

export const departments = sim.table("auth_departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  managerId: text("manager_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("idx_sim_dept_parent").on(t.parentId)]);

export const roles = sim.table("auth_roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
  defaultMaskHex: text("default_mask_hex").notNull(),
  createdAt: text("created_at").notNull(),
});

export const roleAssignments = sim.table("auth_role_assignments", {
  userId: text("user_id").notNull(),
  roleId: text("role_id").notNull(),
  scopeType: text("scope_type", { enum: ["global", "department", "project"] }).notNull(),
  scopeId: text("scope_id"),
  assignedAt: text("assigned_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.roleId, t.scopeType, t.scopeId] }),
  index("idx_sim_ra_user").on(t.userId),
]);

/** PG DDL — drizzle-kit migration 또는 테스트 fixture가 사용. */
export const SIM_AUTH_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  department_id TEXT,
  primary_role_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_users_dept ON sim.auth_users(department_id);

CREATE TABLE IF NOT EXISTS sim.auth_departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_dept_parent ON sim.auth_departments(parent_id);

CREATE TABLE IF NOT EXISTS sim.auth_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  default_mask_hex TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim.auth_role_assignments (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  scope_id TEXT,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id, scope_type, scope_id)
);
CREATE INDEX IF NOT EXISTS idx_sim_ra_user ON sim.auth_role_assignments(user_id);
`;
```

**테이블명 prefix `auth_`**: design.md §5에 따라 `sim` schema 안에서 도메인별 prefix를 사용 (`sim.auth_users`, `sim.pm_project` 등). 다른 도메인(11b/11c)도 동일 패턴 (`pm_project`, `approval_budget_request`, ...).

- [ ] **Step 2: pg/adapter.ts** (PgResourcePolicyRegistry 패턴 — sqlite와 동일 비즈니스 로직, drizzle PostgresJsDatabase 사용)

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { AuthRepository } from "../shared/port.js";
import type {
  User, UserCreate, Department, DepartmentCreate,
  Role, RoleCreate, RoleAssignment, RoleAssignmentCreate,
} from "../shared/types.js";
import {
  UserNotFoundError, DuplicateUserError,
  DepartmentNotFoundError, RoleNotFoundError,
} from "../shared/errors.js";
import { users, departments, roles, roleAssignments } from "./schema.js";

export class PgAuthRepository implements AuthRepository {
  constructor(private readonly db: PostgresJsDatabase) {}

  // ── User ────────────────────────────────────────────────
  async createUser(args: UserCreate): Promise<User> {
    const existing = await this.findUserByEmail(args.email);
    if (existing) throw new DuplicateUserError(args.email);
    const now = new Date().toISOString();
    const user: User = {
      id: randomUUID(),
      email: args.email,
      displayName: args.displayName,
      departmentId: args.departmentId ?? null,
      primaryRoleId: args.primaryRoleId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(users).values({
      id: user.id, email: user.email, displayName: user.displayName,
      departmentId: user.departmentId, primaryRoleId: user.primaryRoleId,
      createdAt: user.createdAt, updatedAt: user.updatedAt,
    });
    return user;
  }

  async findUser(userId: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async listUsersByDepartment(departmentId: string): Promise<User[]> {
    const rows = await this.db.select().from(users).where(eq(users.departmentId, departmentId));
    return rows.map(toUser);
  }

  async updateUser(userId: string, patch: Partial<UserCreate>): Promise<User> {
    const cur = await this.findUser(userId);
    if (!cur) throw new UserNotFoundError(userId);
    const now = new Date().toISOString();
    const next: User = {
      ...cur,
      email: patch.email ?? cur.email,
      displayName: patch.displayName ?? cur.displayName,
      departmentId: patch.departmentId ?? cur.departmentId,
      primaryRoleId: patch.primaryRoleId ?? cur.primaryRoleId,
      updatedAt: now,
    };
    await this.db.update(users).set({
      email: next.email, displayName: next.displayName,
      departmentId: next.departmentId, primaryRoleId: next.primaryRoleId,
      updatedAt: next.updatedAt,
    }).where(eq(users.id, userId));
    return next;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }

  // ── Department / Role / RoleAssignment ──────────────────
  // SQLite 어댑터와 동일 비즈니스 로직, await Promise + isNull 처리만 차이
  async createDepartment(args: DepartmentCreate): Promise<Department> {
    const now = new Date().toISOString();
    const dept: Department = {
      id: randomUUID(), name: args.name,
      parentId: args.parentId ?? null, managerId: args.managerId ?? null,
      createdAt: now, updatedAt: now,
    };
    await this.db.insert(departments).values({
      id: dept.id, name: dept.name, parentId: dept.parentId, managerId: dept.managerId,
      createdAt: dept.createdAt, updatedAt: dept.updatedAt,
    });
    return dept;
  }

  async findDepartment(deptId: string): Promise<Department | null> {
    const rows = await this.db.select().from(departments).where(eq(departments.id, deptId)).limit(1);
    return rows[0] ? toDepartment(rows[0]) : null;
  }

  async listDepartments(): Promise<Department[]> {
    const rows = await this.db.select().from(departments);
    return rows.map(toDepartment);
  }

  async resolveDepartmentChain(deptId: string): Promise<Department[]> {
    const chain: Department[] = [];
    let curId: string | null = deptId;
    const seen = new Set<string>();
    while (curId && !seen.has(curId)) {
      seen.add(curId);
      const dept = await this.findDepartment(curId);
      if (!dept) break;
      chain.push(dept);
      curId = dept.parentId;
    }
    return chain;
  }

  async updateDepartment(deptId: string, patch: Partial<DepartmentCreate>): Promise<Department> {
    const cur = await this.findDepartment(deptId);
    if (!cur) throw new DepartmentNotFoundError(deptId);
    const now = new Date().toISOString();
    const next: Department = {
      ...cur,
      name: patch.name ?? cur.name,
      parentId: patch.parentId ?? cur.parentId,
      managerId: patch.managerId ?? cur.managerId,
      updatedAt: now,
    };
    await this.db.update(departments).set({
      name: next.name, parentId: next.parentId, managerId: next.managerId, updatedAt: next.updatedAt,
    }).where(eq(departments.id, deptId));
    return next;
  }

  async deleteDepartment(deptId: string): Promise<void> {
    await this.db.delete(departments).where(eq(departments.id, deptId));
  }

  async createRole(args: RoleCreate): Promise<Role> {
    const role: Role = {
      id: randomUUID(), name: args.name, scopeType: args.scopeType,
      defaultMaskHex: args.defaultMaskHex, createdAt: new Date().toISOString(),
    };
    await this.db.insert(roles).values(role);
    return role;
  }

  async findRole(roleId: string): Promise<Role | null> {
    const rows = await this.db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
    return rows[0] ? (rows[0] as Role) : null;
  }

  async listRoles(): Promise<Role[]> {
    return (await this.db.select().from(roles)) as Role[];
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, roleId));
  }

  async assignRole(args: RoleAssignmentCreate): Promise<RoleAssignment> {
    const role = await this.findRole(args.roleId);
    if (!role) throw new RoleNotFoundError(args.roleId);
    const ra: RoleAssignment = {
      userId: args.userId, roleId: args.roleId,
      scopeType: args.scopeType, scopeId: args.scopeId,
      assignedAt: new Date().toISOString(),
    };
    await this.db.insert(roleAssignments).values(ra).onConflictDoNothing();
    return ra;
  }

  async revokeRole(userId: string, roleId: string, scopeType: string, scopeId: string | null): Promise<void> {
    await this.db.delete(roleAssignments).where(and(
      eq(roleAssignments.userId, userId),
      eq(roleAssignments.roleId, roleId),
      eq(roleAssignments.scopeType, scopeType as "global" | "department" | "project"),
      scopeId === null ? isNull(roleAssignments.scopeId) : eq(roleAssignments.scopeId, scopeId),
    ));
  }

  async listAssignmentsForUser(userId: string): Promise<RoleAssignment[]> {
    return (await this.db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId))) as RoleAssignment[];
  }
}

function toUser(row: typeof users.$inferSelect): User {
  return { id: row.id, email: row.email, displayName: row.displayName,
    departmentId: row.departmentId ?? null, primaryRoleId: row.primaryRoleId ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt };
}
function toDepartment(row: typeof departments.$inferSelect): Department {
  return { id: row.id, name: row.name, parentId: row.parentId ?? null,
    managerId: row.managerId ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
```

- [ ] **Step 3: pg/adapter.test.ts** (env gate + db-bootstrap createPgTestFixture 사용)

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createPgTestFixture } from "db-bootstrap";
import { PgAuthRepository } from "./adapter.js";
import { SIM_AUTH_PG_DDL } from "./schema.js";

const enabled = process.env.QA_TEST_PG === "1";
const describeFn = enabled ? describe : describe.skip;

describeFn("PgAuthRepository", () => {
  let fixture: Awaited<ReturnType<typeof createPgTestFixture>>;
  let repo: PgAuthRepository;

  beforeAll(async () => {
    fixture = await createPgTestFixture(SIM_AUTH_PG_DDL);
    repo = new PgAuthRepository(fixture.db);
  });
  afterAll(async () => { await fixture.cleanup(); });

  it("createUser → findUser round-trip (PG schema 격리)", async () => {
    const u = await repo.createUser({ email: "pg@x.c", displayName: "PG" });
    expect((await repo.findUser(u.id))?.email).toBe("pg@x.c");
  });

  it("revokeRole — scopeId null 처리 (isNull 사용)", async () => {
    const role = await repo.createRole({ name: "pg-admin", scopeType: "global", defaultMaskHex: "ff" });
    const u = await repo.createUser({ email: "pg2@x.c", displayName: "PG2" });
    await repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    await repo.revokeRole(u.id, role.id, "global", null);
    expect((await repo.listAssignmentsForUser(u.id)).length).toBe(0);
  });
});
```

- [ ] **Step 4: 테스트 (PG 컨테이너 의존)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_TEST_PG=1 QA_PG_HOST=localhost QA_PG_PORT=5434 QA_PG_DATABASE=qa_sdk_test \
  pnpm --filter @qa-sdk/sim-auth-api test -- pg/adapter.test
```

Expected: 2 PASS. PG 미부팅 시 `describe.skip`로 통과 (red 아님).

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/pg && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): PG schema + adapter (sim.auth_* 테이블 4개)

pgSchema("sim") + auth_ prefix 테이블명 (도메인별 격리).
db-bootstrap createPgTestFixture로 random schema 격리.
QA_TEST_PG=1 env gate — PG 미부팅 환경은 skip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: factory + port-contract test (Plan 05c 패턴)

**Files:**
- Create: `src/auth/factory.ts`
- Create: `src/auth/factory.test.ts`
- Create: `src/auth/port-contract.test.ts`

- [ ] **Step 1: factory.ts (dynamic import per dialect)**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import type { AuthRepository } from "./shared/port.js";

export interface AuthRepoFactoryOpts {
  dialect: "sqlite" | "pg";
  db: unknown;
}

/**
 * dialect-specific 어댑터 인스턴스화. Plan 05c factory 패턴.
 *
 * 미설치 드라이버 환경에서는 해당 dialect 분기에 닿지 않으면 부팅 가능
 * (peerDep optional 동기). 호출자는 db-bootstrap의 createConnection으로
 * 미리 dialect별 db 인스턴스를 만들어 전달.
 */
export async function createAuthRepository(opts: AuthRepoFactoryOpts): Promise<AuthRepository> {
  if (opts.dialect === "sqlite") {
    const { SqliteAuthRepository } = await import("./sqlite/adapter.js");
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    // db가 raw better-sqlite3 인스턴스이거나 이미 Drizzle 인스턴스일 수 있음
    const drizzleDb = isDrizzleSqlite(opts.db) ? opts.db : drizzle(opts.db as any);
    return new SqliteAuthRepository(drizzleDb as any);
  }
  if (opts.dialect === "pg") {
    const { PgAuthRepository } = await import("./pg/adapter.js");
    return new PgAuthRepository(opts.db as any);
  }
  throw new Error(`Unsupported dialect: ${opts.dialect}`);
}

function isDrizzleSqlite(db: unknown): boolean {
  return typeof db === "object" && db !== null && typeof (db as any).select === "function";
}
```

- [ ] **Step 2: factory.test.ts**

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createAuthRepository } from "./factory.js";
import { SIM_AUTH_SQLITE_DDL } from "./sqlite/schema.js";

describe("createAuthRepository", () => {
  it("sqlite dialect → SqliteAuthRepository 인스턴스 (drizzle-wrapped)", async () => {
    const raw = new Database(":memory:");
    raw.exec(SIM_AUTH_SQLITE_DDL);
    const repo = await createAuthRepository({ dialect: "sqlite", db: drizzle(raw) });
    const u = await repo.createUser({ email: "f@x", displayName: "f" });
    expect(u.id).toBeTruthy();
    raw.close();
  });

  it("unknown dialect → throw", async () => {
    await expect(createAuthRepository({ dialect: "unknown" as any, db: {} }))
      .rejects.toThrow("Unsupported dialect");
  });
});
```

- [ ] **Step 3: port-contract.test.ts (Plan 05c — 양쪽 어댑터 동등성)**

```ts
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { createPgTestFixture } from "db-bootstrap";
import { createAuthRepository } from "./factory.js";
import { SIM_AUTH_SQLITE_DDL } from "./sqlite/schema.js";
import { SIM_AUTH_PG_DDL } from "./pg/schema.js";
import type { AuthRepository } from "./shared/port.js";

interface Fixture {
  repo: AuthRepository;
  cleanup: () => Promise<void>;
}

async function sqliteFixture(): Promise<Fixture> {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  const repo = await createAuthRepository({ dialect: "sqlite", db: drizzleSqlite(raw) });
  return { repo, cleanup: async () => { raw.close(); } };
}

async function pgFixture(): Promise<Fixture> {
  const f = await createPgTestFixture(SIM_AUTH_PG_DDL);
  const repo = await createAuthRepository({ dialect: "pg", db: f.db });
  return { repo, cleanup: f.cleanup };
}

const fixtures: Array<[string, () => Promise<Fixture>]> = [
  ["sqlite", sqliteFixture],
  ...(process.env.QA_TEST_PG === "1" ? [["pg", pgFixture] as [string, () => Promise<Fixture>]] : []),
];

describe.each(fixtures)("AuthRepository contract — %s", (_, makeFixture) => {
  let f: Fixture;
  beforeAll(async () => { f = await makeFixture(); });
  afterAll(async () => { await f.cleanup(); });

  it("createUser + findUserByEmail", async () => {
    const u = await f.repo.createUser({ email: `c-${_}@x`, displayName: "c" });
    const read = await f.repo.findUserByEmail(`c-${_}@x`);
    expect(read?.id).toBe(u.id);
  });

  it("createDepartment + resolveDepartmentChain (3-level tree)", async () => {
    const root = await f.repo.createDepartment({ name: `root-${_}` });
    const mid = await f.repo.createDepartment({ name: `mid-${_}`, parentId: root.id });
    const leaf = await f.repo.createDepartment({ name: `leaf-${_}`, parentId: mid.id });
    const chain = await f.repo.resolveDepartmentChain(leaf.id);
    expect(chain.length).toBe(3);
  });

  it("createRole + assignRole + listAssignmentsForUser", async () => {
    const role = await f.repo.createRole({ name: `role-${_}`, scopeType: "global", defaultMaskHex: "ff" });
    const u = await f.repo.createUser({ email: `r-${_}@x`, displayName: "r" });
    await f.repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    expect((await f.repo.listAssignmentsForUser(u.id))[0]?.roleId).toBe(role.id);
  });

  it("revokeRole — assignment 삭제 (양쪽 dialect 동등)", async () => {
    const role = await f.repo.createRole({ name: `rv-${_}`, scopeType: "global", defaultMaskHex: "ff" });
    const u = await f.repo.createUser({ email: `rv-${_}@x`, displayName: "rv" });
    await f.repo.assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    await f.repo.revokeRole(u.id, role.id, "global", null);
    expect((await f.repo.listAssignmentsForUser(u.id)).length).toBe(0);
  });
});
```

- [ ] **Step 4: 테스트 실행 (PG 포함)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_TEST_PG=1 QA_PG_HOST=localhost QA_PG_PORT=5434 QA_PG_DATABASE=qa_sdk_test \
  pnpm --filter @qa-sdk/sim-auth-api test -- factory port-contract
```

Expected: factory 2 + contract (4 × 2 dialects) = 10 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/factory.ts \
          simulations/enterprise-pm/services/auth-api/src/auth/factory.test.ts \
          simulations/enterprise-pm/services/auth-api/src/auth/port-contract.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): factory + port-contract test (dual-target equivalence)

Plan 05c 패턴 그대로 — describe.each로 SQLite + PG 동일 시나리오.
QA_TEST_PG=1 set 시 PG fixture 활성화 (db-bootstrap createPgTestFixture).
양쪽 dialect의 비즈니스 동등성 회귀 게이트.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: NestJS module — auth-db.module + 5 도메인 모듈

**Files:**
- Create: `src/auth/auth-db.module.ts`
- Create: `src/auth/user/{user.module.ts,user.service.ts,user.service.test.ts,user.controller.ts}`
- Create: `src/auth/department/{department.module.ts,department.service.ts,department.service.test.ts,department.controller.ts}`
- Create: `src/auth/role/{role.module.ts,role.service.ts,role.service.test.ts,role.controller.ts}`
- Create: `src/auth/role-assignment/{role-assignment.module.ts,role-assignment.service.ts,role-assignment.service.test.ts,role-assignment.controller.ts}`

- [ ] **Step 1: auth-db.module.ts (factory + connection을 NestJS provider로)**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module, type DynamicModule } from "@nestjs/common";
import { createConnection } from "db-bootstrap";
import { createAuthRepository } from "./factory.js";
import { env } from "../config/env.js";
import type { AuthRepository } from "./shared/port.js";

export const AUTH_REPOSITORY = Symbol("AUTH_REPOSITORY");

@Module({})
export class AuthDbModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthDbModule,
      providers: [
        {
          provide: AUTH_REPOSITORY,
          useFactory: async (): Promise<AuthRepository> => {
            const conn = await createConnection({
              dialect: env.QA_DB_DIALECT,
              sqlitePath: env.QA_SQLITE_PATH,
              pgHost: env.QA_PG_HOST,
              pgPort: env.QA_PG_PORT,
              pgDatabase: env.QA_PG_DATABASE,
              pgUser: env.QA_PG_USER,
              pgPassword: env.QA_PG_PASSWORD,
              pgSchema: env.QA_PG_SCHEMA ?? "sim",
            });
            return createAuthRepository({ dialect: conn.dialect, db: conn.db });
          },
        },
      ],
      exports: [AUTH_REPOSITORY],
      global: true,
    };
  }
}
```

- [ ] **Step 2: user.service.ts + user.service.test.ts (TDD)**

`src/auth/user/user.service.ts`:

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import type { User, UserCreate } from "../shared/types.js";

@Injectable()
export class UserService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository) {}

  create(args: UserCreate): Promise<User> { return this.repo.createUser(args); }
  find(id: string): Promise<User | null> { return this.repo.findUser(id); }
  findByEmail(email: string): Promise<User | null> { return this.repo.findUserByEmail(email); }
  listByDepartment(deptId: string): Promise<User[]> { return this.repo.listUsersByDepartment(deptId); }
  update(id: string, patch: Partial<UserCreate>): Promise<User> { return this.repo.updateUser(id, patch); }
  delete(id: string): Promise<void> { return this.repo.deleteUser(id); }
}
```

`src/auth/user/user.service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "../sqlite/adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "../sqlite/schema.js";
import { UserService } from "./user.service.js";

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  return new UserService(new SqliteAuthRepository(drizzle(raw)));
}

describe("UserService", () => {
  it("create + find", async () => {
    const s = svc();
    const u = await s.create({ email: "a@x", displayName: "A" });
    expect((await s.find(u.id))?.email).toBe("a@x");
  });
  it("findByEmail", async () => {
    const s = svc();
    await s.create({ email: "b@x", displayName: "B" });
    expect((await s.findByEmail("b@x"))?.displayName).toBe("B");
  });
});
```

- [ ] **Step 3: user.controller.ts**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";
import { z } from "zod";
import { UserService } from "./user.service.js";

const createSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  departmentId: z.string().optional(),
  primaryRoleId: z.string().optional(),
});

@Controller("users")
export class UserController {
  constructor(private readonly svc: UserService) {}

  @Post()
  async create(@Body() body: unknown) {
    return this.svc.create(createSchema.parse(body));
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const u = await this.svc.find(id);
    if (!u) return { error: "not-found" };
    return u;
  }

  @Get()
  async list(@Query("departmentId") deptId: string) {
    if (!deptId) return { error: "departmentId query required" };
    return this.svc.listByDepartment(deptId);
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() body: unknown) {
    return this.svc.update(id, createSchema.partial().parse(body));
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.svc.delete(id);
    return { status: "deleted" };
  }
}
```

- [ ] **Step 4: user.module.ts**

```ts
import { Module } from "@nestjs/common";
import { UserService } from "./user.service.js";
import { UserController } from "./user.controller.js";

@Module({
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
export class UserModule {}
```

- [ ] **Step 5: department / role / role-assignment 모듈도 동일 패턴 작성**

각 모듈 4파일 (module/service/service.test/controller). UserModule 패턴 그대로 — `repo.createDepartment` / `repo.createRole` / `repo.assignRole` 호출. controller 라우트:
- `DepartmentController`: `POST /departments`, `GET /departments/:id`, `GET /departments`, `GET /departments/:id/chain`, `PUT /departments/:id`, `DELETE /departments/:id`
- `RoleController`: `POST /roles`, `GET /roles/:id`, `GET /roles`, `DELETE /roles/:id`
- `RoleAssignmentController`: `POST /assignments`, `DELETE /assignments` (body로 userId/roleId/scopeType/scopeId), `GET /users/:userId/assignments`

각 service는 2~3 단위 테스트 (create + 핵심 query 1~2개). 본 plan은 happy path만 — 에러 시나리오는 e2e (Plan 13).

- [ ] **Step 6: typecheck + 4 모듈 단위 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api typecheck && \
  pnpm --filter @qa-sdk/sim-auth-api test -- user department role role-assignment
```

Expected: typecheck 0, 모듈별 2~3 PASS × 4 = 8~12 PASS.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/auth-db.module.ts \
          simulations/enterprise-pm/services/auth-api/src/auth/user \
          simulations/enterprise-pm/services/auth-api/src/auth/department \
          simulations/enterprise-pm/services/auth-api/src/auth/role \
          simulations/enterprise-pm/services/auth-api/src/auth/role-assignment && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): NestJS 4 도메인 모듈 — User/Department/Role/RoleAssignment

AuthDbModule.forRoot()가 db-bootstrap createConnection + factory로
AUTH_REPOSITORY provider 노출. global module — 모든 service가 inject.
zod로 controller body 검증.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: bitmap module — BitmapIssuerService + Controller (TDD)

**Files:**
- Create: `src/auth/bitmap/bitmap-issuer.service.ts`
- Create: `src/auth/bitmap/bitmap-issuer.service.test.ts`
- Create: `src/auth/bitmap/bitmap.controller.ts`
- Create: `src/auth/bitmap/bitmap.module.ts`

- [ ] **Step 1: bitmap-issuer.service.test.ts (test-first)**

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SqliteAuthRepository } from "../sqlite/adapter.js";
import { SIM_AUTH_SQLITE_DDL } from "../sqlite/schema.js";
import { BitmapIssuerService } from "./bitmap-issuer.service.js";
import { AUTH_BITMASK_BYTES } from "../shared/auth-codec.js";

const SECRET = new TextEncoder().encode("test-secret-32bytes-long-enough-1234");

function svc() {
  const raw = new Database(":memory:");
  raw.exec(SIM_AUTH_SQLITE_DDL);
  return new BitmapIssuerService(
    new SqliteAuthRepository(drizzle(raw)),
    { secret: SECRET, ttlMs: 3600_000, issuer: "sim-auth-api" },
  );
}

describe("BitmapIssuerService", () => {
  it("user 없으면 null 반환", async () => {
    const s = svc();
    expect(await s.issueForUser("missing")).toBeNull();
  });

  it("user 있고 assignment 없음 → mask 모두 0인 VersionedBitmap", async () => {
    const s = svc();
    const u = await s["repo"].createUser({ email: "x@x", displayName: "x" });
    const bm = await s.issueForUser(u.id);
    expect(bm).not.toBeNull();
    expect(bm!.mask.length).toBe(AUTH_BITMASK_BYTES);
    for (const b of bm!.mask) expect(b).toBe(0);
  });

  it("global admin role 부여 → mask 모든 비트 set", async () => {
    const s = svc();
    const adminMaskHex = "ff".repeat(AUTH_BITMASK_BYTES);
    const role = await s["repo"].createRole({ name: "admin", scopeType: "global", defaultMaskHex: adminMaskHex });
    const u = await s["repo"].createUser({ email: "a@x", displayName: "a" });
    await s["repo"].assignRole({ userId: u.id, roleId: role.id, scopeType: "global", scopeId: null });
    const bm = await s.issueForUser(u.id);
    expect(bm).not.toBeNull();
    for (const b of bm!.mask) expect(b).toBe(0xff);
  });

  it("발급된 VersionedBitmap은 prefix='sim.bitmap' + signature 포함", async () => {
    const s = svc();
    const u = await s["repo"].createUser({ email: "y@x", displayName: "y" });
    const bm = await s.issueForUser(u.id);
    expect(bm!.prefix).toBe("sim.bitmap");
    expect(bm!.v).toBeTruthy();
    expect(bm!.signature).toMatch(/^[0-9a-f]+$/);
    expect(bm!.expiresAt > bm!.issuedAt).toBe(true);
  });
});
```

- [ ] **Step 2: bitmap-issuer.service.ts (실제 구현)**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { issueBitmap, type VersionedBitmap } from "permission-engine";
import { AUTH_REPOSITORY } from "../auth-db.module.js";
import type { AuthRepository } from "../shared/port.js";
import { computeUserBits } from "../shared/compute-user-bits.js";
import type { Role } from "../shared/types.js";

export interface BitmapIssuerConfig {
  secret: Uint8Array;
  ttlMs: number;
  issuer: string;
  /** prefix version. design.md §3 — 초기는 'v1', latestPrefixVersion 동적 조회는 향후. */
  version?: string;
}

@Injectable()
export class BitmapIssuerService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepository,
    @Inject("BITMAP_ISSUER_CONFIG") private readonly cfg: BitmapIssuerConfig,
  ) {}

  /**
   * 주어진 userId에 대해 sim.bitmap prefix VersionedBitmap을 발급.
   *
   * 알고리즘:
   *   1. user 존재 확인. 없으면 null.
   *   2. user의 모든 RoleAssignment 조회.
   *   3. assignments에 등장하는 roleId 셋 → roles map 구성.
   *   4. computeUserBits로 mask 계산.
   *   5. issueBitmap으로 HMAC 서명된 VersionedBitmap 반환.
   *
   * scope 필터는 본 plan에서는 모든 assignment를 그대로 union (단순화).
   * Plan 12a가 scope 매칭 로직(department/project)을 추가.
   */
  async issueForUser(userId: string): Promise<VersionedBitmap | null> {
    const user = await this.repo.findUser(userId);
    if (!user) return null;

    const assignments = await this.repo.listAssignmentsForUser(userId);
    const roleIds = new Set(assignments.map((a) => a.roleId));
    const roles = new Map<string, Role>();
    for (const rid of roleIds) {
      const role = await this.repo.findRole(rid);
      if (role) roles.set(rid, role);
    }

    const mask = computeUserBits({ assignments, roles });

    return issueBitmap({
      prefix: "sim.bitmap",
      v: this.cfg.version ?? "v1",
      mask,
      issuer: this.cfg.issuer,
      secret: this.cfg.secret,
      ttlMs: this.cfg.ttlMs,
    });
  }
}
```

- [ ] **Step 3: bitmap.controller.ts**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Body, Controller, NotFoundException, Post } from "@nestjs/common";
import { z } from "zod";
import { BitmapIssuerService } from "./bitmap-issuer.service.js";

const issueSchema = z.object({ userId: z.string().min(1) });

@Controller("bitmap")
export class BitmapController {
  constructor(private readonly issuer: BitmapIssuerService) {}

  @Post("issue")
  async issue(@Body() body: unknown) {
    const { userId } = issueSchema.parse(body);
    const bm = await this.issuer.issueForUser(userId);
    if (!bm) throw new NotFoundException(`User not found: ${userId}`);
    return {
      ...bm,
      mask: Buffer.from(bm.mask).toString("base64"), // wire format — JSON-safe
    };
  }
}
```

- [ ] **Step 4: bitmap.module.ts**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { z } from "zod";
import { BitmapIssuerService } from "./bitmap-issuer.service.js";
import { BitmapController } from "./bitmap.controller.js";

const bitmapEnvSchema = z.object({
  /** HMAC secret — 최소 16 bytes. base64 또는 hex. */
  SIM_BITMAP_SECRET: z.string().default("dev-only-bitmap-secret-32-bytes-min!"),
  SIM_BITMAP_TTL_MS: z.coerce.number().int().positive().default(3600_000),
});

@Module({
  providers: [
    BitmapIssuerService,
    {
      provide: "BITMAP_ISSUER_CONFIG",
      useFactory: () => {
        const env = bitmapEnvSchema.parse(process.env);
        return {
          secret: new TextEncoder().encode(env.SIM_BITMAP_SECRET),
          ttlMs: env.SIM_BITMAP_TTL_MS,
          issuer: "sim-auth-api",
          version: "v1",
        };
      },
    },
  ],
  controllers: [BitmapController],
  exports: [BitmapIssuerService],
})
export class BitmapModule {}
```

`SIM_BITMAP_SECRET` 기본값은 dev only — 운영은 `.env.sim` (sops)에서 주입.

- [ ] **Step 5: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-auth-api test -- bitmap-issuer
```

Expected: 4 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/auth/bitmap && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): BitmapIssuerService + POST /bitmap/issue

permission-engine issueBitmap + computeUserBits 결합.
HMAC 서명 + TTL VersionedBitmap. mask는 base64 wire format.
SIM_BITMAP_SECRET env (dev 기본값, 운영은 sops).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: app.module 연결 + e2e 부팅 검증

**Files:**
- Modify: `src/app.module.ts`

- [ ] **Step 1: app.module.ts에 6 모듈 imports**

```ts
// @def.boundary sim-auth-api
// @def.doc sim-erp-pm-design

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { AuthDbModule } from "./auth/auth-db.module.js";
import { UserModule } from "./auth/user/user.module.js";
import { DepartmentModule } from "./auth/department/department.module.js";
import { RoleModule } from "./auth/role/role.module.js";
import { RoleAssignmentModule } from "./auth/role-assignment/role-assignment.module.js";
import { BitmapModule } from "./auth/bitmap/bitmap.module.js";

@Module({
  imports: [
    HealthModule,
    AuthDbModule.forRoot(),
    UserModule,
    DepartmentModule,
    RoleModule,
    RoleAssignmentModule,
    BitmapModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: typecheck + 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-auth-api typecheck && \
  pnpm --filter @qa-sdk/sim-auth-api test
```

Expected: typecheck 0. 전체 테스트:
- env 6
- health 3
- auth-codec 5
- compute-user-bits 6
- sqlite/adapter 8
- pg/adapter 2 (QA_TEST_PG=1 시) / 0 (skip)
- factory 2
- port-contract 4 (sqlite) / 8 (sqlite + pg)
- user/department/role/ra service 8~12
- bitmap-issuer 4

총 SQLite-only: 46+ PASS, with PG: 56+ PASS.

- [ ] **Step 3: e2e 부팅 + /bitmap/issue 호출 검증 (SQLite)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-auth-test.sqlite \
  pnpm --filter @qa-sdk/sim-auth-api start &
PID=$!
sleep 3

# user + role 생성 후 bitmap 발급
echo "create user:"; USER_JSON=$(curl -fsS -X POST http://localhost:4400/users \
  -H "content-type: application/json" \
  -d '{"email":"e2e@x","displayName":"E2E"}')
echo "$USER_JSON"
USER_ID=$(echo "$USER_JSON" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

echo "create role:"; ROLE_JSON=$(curl -fsS -X POST http://localhost:4400/roles \
  -H "content-type: application/json" \
  -d '{"name":"e2e-admin","scopeType":"global","defaultMaskHex":"ff"}')
echo "$ROLE_JSON"
ROLE_ID=$(echo "$ROLE_JSON" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

echo "assign role:"; curl -fsS -X POST http://localhost:4400/assignments \
  -H "content-type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"roleId\":\"$ROLE_ID\",\"scopeType\":\"global\",\"scopeId\":null}"

echo "issue bitmap:"; curl -fsS -X POST http://localhost:4400/bitmap/issue \
  -H "content-type: application/json" \
  -d "{\"userId\":\"$USER_ID\"}"

kill $PID 2>/dev/null || true
rm -f /tmp/sim-auth-test.sqlite
```

Expected: 4 단계 모두 200, 마지막 응답에 `prefix: "sim.bitmap"`, `mask: "<base64>"`, `signature: "<hex>"`.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/src/app.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): app.module — 6 도메인 모듈 imports

AuthDbModule.forRoot() global provider + 5 도메인 모듈.
e2e 검증: user 생성 → role assign → bitmap 발급 round-trip 통과.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: drizzle config + migration 디렉토리 (마이그레이션 SSOT)

**Files:**
- Create: `simulations/enterprise-pm/services/auth-api/drizzle.sqlite.config.ts`
- Create: `simulations/enterprise-pm/services/auth-api/drizzle.pg.config.ts`
- Create: `simulations/enterprise-pm/services/auth-api/drizzle/sqlite/0001_init.sql`
- Create: `simulations/enterprise-pm/services/auth-api/drizzle/pg/0001_init.sql`

- [ ] **Step 1: drizzle.sqlite.config.ts**

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/auth/sqlite/schema.ts",
  out: "./drizzle/sqlite",
  dialect: "sqlite",
  driver: "better-sqlite",
} satisfies Config;
```

- [ ] **Step 2: drizzle.pg.config.ts**

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/auth/pg/schema.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
} satisfies Config;
```

- [ ] **Step 3: 0001_init.sql 두 dialect 모두 작성** — SIM_AUTH_SQLITE_DDL / SIM_AUTH_PG_DDL의 내용을 그대로 복사하여 마이그레이션 파일로 보존.

- [ ] **Step 4: package.json scripts 추가**

```json
"scripts": {
  ...
  "db:gen:sqlite": "drizzle-kit generate --config drizzle.sqlite.config.ts",
  "db:gen:pg": "drizzle-kit generate --config drizzle.pg.config.ts"
}
```

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/auth-api/drizzle* \
          simulations/enterprise-pm/services/auth-api/package.json && \
  git commit -m "$(cat <<'EOF'
feat(sim-auth-api): drizzle.sqlite/pg.config + 0001_init migrations

dialect별 독립 시퀀스. PG 0001은 sim schema + auth_* 테이블.
SIM_AUTH_*_DDL은 schema.ts SSOT, migration은 그 복사본.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: 회귀 — workflow-smoke + def gate

- [ ] **Step 1: workflow-smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | tail -3
```

Expected: 12+ smoke PASS.

- [ ] **Step 2: def validate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && node packages/cli/dist/index.js def validate 2>&1 | head -3
```

Expected: errors 0.

- [ ] **Step 3: 다른 시뮬 서비스 회귀 (10b/10c)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter "@qa-sdk/sim-*" typecheck 2>&1 | tail -10
```

Expected: 9 시뮬 서비스 모두 typecheck 0.

---

## Self-Review

- [ ] Plan 04c db-bootstrap의 `createConnection` + `dbEnvSchema` 정확히 활용
- [ ] Plan 05c 패턴 (factory + port-contract.test) 정확히 복제
- [ ] dual-target — sqlite/ + pg/ 양쪽 어댑터 동등성 검증
- [ ] DisjointUnionIndex 4 variant + AUTH_BITMASK_BYTES SSOT
- [ ] computeUserBits는 순수 함수 (DB·시간 의존 없음)
- [ ] permission-engine `issueBitmap`을 그대로 사용 (직접 HMAC 구현 금지)
- [ ] AuthDbModule global provider — 모든 service가 `@Inject(AUTH_REPOSITORY)`
- [ ] zod로 controller body 검증 (스펙 엄격)
- [ ] PG schema = `sim.auth_*` (테이블명 prefix로 도메인 격리)
- [ ] e2e 부팅: 4400/users + /roles + /assignments + /bitmap/issue 모두 200
- [ ] console.log 0건 (CLAUDE.md 로깅 컨벤션)

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| RoleAssignment scope 매칭 (department/project resource) | gateway 라우팅과 함께 설계 | Plan 12a |
| Bitmap pub/sub invalidation | Redis 통합 | Plan 12b |
| Bitmap refresh endpoint | Plan 12a JWT flow와 함께 | Plan 12a |
| latestPrefixVersion 동적 조회 (v1 하드코딩 → registry-service 조회) | catalog 통합 시점 | Plan 14b |
| RLS 정책 (sim.auth_* 테이블) | Phase 3 §3 RLS plan | Phase 3 |
| seed/ — 7 dept + 50 user + 7 role | seed runner는 09d, 도메인 데이터는 본 plan defer | Plan 13a |

---

## 의존·후속

- **Plan 10a** (auth-api 부팅): 본 plan의 직접 전제.
- **Plan 04c** (db-bootstrap): `createConnection` + `dbEnvSchema` + `createPgTestFixture` 사용.
- **Plan 05c** (resource-policy-store factory + port-contract): 본 plan이 패턴 그대로 복제.
- **Plan 09b** (init.sql sim schema): PG adapter 동작의 전제.
- **Plan 11b** (pm + approval domain): 본 plan과 직렬 — 동일 dual-target 패턴 복제.
- **Plan 12a** (gateway JWT bitmap embed): 본 plan의 `/bitmap/issue` 호출.
- **Plan 12b** (bitmap pub/sub invalidation): 본 plan의 issuer 위에 invalidation 부착.
- **Plan 13a** (시나리오 1, 2): 본 plan의 user/role/bitmap 흐름을 e2e 검증.
