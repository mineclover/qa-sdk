---
lifecycle: draft
plan: 11b-2
phase: 4
depends-on: [11a-1, 11b, 11b-1, 12a, 05c]
---

# Plan 11b-2 — sim-approval-api 계약 정렬 (/approvals/requests + JWT approverId + decision enum + AccessChecker + test-bootstrap)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 13b 가 요구하는 approval-api 의 정식 계약에 맞추어 Plan 11b 산출물을 재정렬한다. (1) REST 경로 `/budgets` → `/approvals/requests` 로 변경 (NestJS `@Controller` prefix 교체) — 계층적 리소스 표현. (2) `POST /approvals/requests/:id/decisions` 의 body 에서 `approverId` 제거, JWT sub (`x-auth-user-id` 헤더) 에서 자동 도출. (3) decision enum `"approved"|"rejected"` → **`"approve"|"reject"`** (동사 형태) 로 변경 — Plan 13b scenario-3 와 정확히 일치. (4) AccessChecker Pass 2 를 `decide` 경로에 주입 — `project.departmentId vs approver.departmentId` 비교 후 cross-dept deny 시 `audit-recorder.firstFailure` 에 `denyReason: "cross_department_requires_approver_role"` 기록. (5) 응답 body 에 `rootSpanId` 포함. (6) `src/test-bootstrap.ts` + `exports` 필드 + `seedApprovalFixtures` + `createTestBudgetRequest` 외부 노출 — Plan 13a/b 진입점.

**Architecture:**
- **경로 변경 (breaking)**:
  - `@Controller("budgets")` → `@Controller("approvals/requests")`
  - `POST /budgets` → `POST /approvals/requests`
  - `GET /budgets/:id` → `GET /approvals/requests/:id`
  - `GET /budgets/:id/steps` → `GET /approvals/requests/:id/steps`
  - `POST /budgets/:id/submit` → `POST /approvals/requests/:id/submit`
  - `POST /budgets/:id/start-review` → `POST /approvals/requests/:id/start-review`
  - `POST /budgets/:id/decisions` → `POST /approvals/requests/:id/decisions`
  - 기존 `GET /budgets?projectId=...` list — `GET /approvals/requests?projectId=...` 로 이동
- **decision enum 변경**:
  - controller schema: `decision: z.enum(["approve", "reject"])`
  - BudgetService 내부 state machine (`applyDecision`, `recordDecision`) 은 **기존 `"approved"|"rejected"` 를 유지** — 도메인 내부 용어 (storage 상태와 정렬).
  - controller 가 변환: `"approve" → "approved"`, `"reject" → "rejected"`. 양 방향 매핑은 `toStorageDecision` 순수 함수로 추출.
- **JWT-derived approverId**:
  - Plan 11b-1 의 `CurrentUserGuard` + `@CurrentUser()` 패턴을 approval-api 에 복제 (`auth-deps/` 모듈 동일).
  - `decide` controller: body 에서 `approverId` 제거, `@CurrentUser().userId` 사용.
- **AccessChecker Pass 2 — cross-dept 검증**:
  - `decide` 진입 시 `BudgetRequest` 조회 → `project` 참조 (approval-api 내부 projection 또는 `projectId → departmentId` lookup).
  - `AccessChecker.check({ apiId: "budget.approve", targetId: requestId, context: { projectDepartmentId, approverDepartmentId } })`.
  - Pass 2 evaluator 가 `approverDepartmentId != projectDepartmentId` 일 때 deny + `denyReason: "cross_department_requires_approver_role"`.
  - 본 plan 은 evaluator 구현을 approval-api 에 두지 않음 — permission-engine 의 Pass 2 lifecycle policy 가 cerbos 또는 내장 룰로 평가 (별도 Plan 의 책임). 본 plan 은 **입력 컨텍스트 주입** 만 보장.
  - deny 시 403 + `{ error: "access_denied", denyReason, rootSpanId, firstFailureSpanId }`.
- **project.departmentId lookup**:
  - approval-api 는 `BudgetRequest.projectId` 만 보유 (Plan 11b). 부서 확인은 두 옵션:
    - 옵션 A: approval-api 에 `ProjectSummary` read-only projection 테이블 (projectId → departmentId) — eventual sync 필요.
    - 옵션 B: `CurrentUserContext` 에 approver 부서 포함 + request 에 `projectDepartmentId` 를 생성 시점에 저장 (denormalization).
  - 본 plan 채택: **옵션 B** — `BudgetRequest` 테이블에 `project_department_id` 컬럼 추가. 생성(`POST /approvals/requests`) 시 body 에서 받음 (pm-api 의 project 생성 시점 이 아직 gateway 경유 synchronous 통신이 없으므로 body 에 명시). 이후 변경 없음.
  - Plan 13b scenario 3/4 의 `seedBudgetRequest({ departmentId, ... })` 가 `project_department_id` 로 매핑.
- **rootSpanId 응답 포함**:
  - 모든 write 경로 (`decide`, `submit`, `start-review`, `create`) 가 `AccessChecker.check` 결과의 `rootSpanId` 를 응답 body 에 포함 — Plan 13b 의 `fetchAuditTrace(rootSpanId)` 진입점.
- **test-bootstrap 진입점** (Plan 11a-1 / 11b-1 패턴):
  - `bootstrapTestApi(opts)` — `@nestjs/testing` + `AppModule` (AccessChecker override 가능).
  - `seedApprovalFixtures(handle)` — 기본 approver role(manager/director/cfo) + ApprovalStep 템플릿.
  - `createTestBudgetRequest(handle, { amount, projectId, projectDepartmentId, requesterId })` — 단일 request 생성 유틸 (Plan 13b scenario setup 직접 호출).

**Tech Stack:**
- Plan 11b 의 기존 sim-approval-api 스택 유지 + `permission-engine` + `resource-policy-store` 추가 (Plan 11b-1 와 동일 의존)
- ES2023, TypeScript 5.8, vitest, `@nestjs/testing` ^11

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/services/approval-api/src/auth-deps/current-user.decorator.ts` | `@CurrentUser()` (Plan 11b-1 복제) |
| `simulations/enterprise-pm/services/approval-api/src/auth-deps/current-user.guard.ts` | gateway header 파싱 guard |
| `simulations/enterprise-pm/services/approval-api/src/auth-deps/current-user.guard.test.ts` | 4건 단위 테스트 |
| `simulations/enterprise-pm/services/approval-api/src/auth-deps/access-checker.module.ts` | `APPROVAL_ACCESS_CHECKER` / `APPROVAL_POLICY_REGISTRY` provider |
| `simulations/enterprise-pm/services/approval-api/src/approval/budget/decision-mapping.ts` | `toStorageDecision("approve") === "approved"` 순수 변환 |
| `simulations/enterprise-pm/services/approval-api/src/approval/budget/decision-mapping.test.ts` | 양 방향 매핑 + 미지원 값 throw |
| `simulations/enterprise-pm/services/approval-api/src/approval/budget/budget-access.service.ts` | AccessChecker 호출 래퍼 (Pass 1/2 통합) |
| `simulations/enterprise-pm/services/approval-api/src/approval/budget/budget-access.service.test.ts` | allow / cross-dept deny 시나리오 |
| `simulations/enterprise-pm/services/approval-api/src/test-bootstrap.ts` | `bootstrapTestApi` / `seedApprovalFixtures` / `createTestBudgetRequest` |
| `simulations/enterprise-pm/services/approval-api/src/test-bootstrap.test.ts` | bootstrap smoke — `/approvals/requests` POST + decisions 200 |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/services/approval-api/package.json` | `exports` 필드 + `permission-engine` / `resource-policy-store` dep + `@nestjs/testing` devDep |
| `simulations/enterprise-pm/services/approval-api/src/approval/shared/types.ts` | `BudgetRequest` 에 `projectDepartmentId: string` 추가 |
| `simulations/enterprise-pm/services/approval-api/src/approval/sqlite/schema.ts` | `budget_requests` 에 `project_department_id TEXT NOT NULL` 컬럼 |
| `simulations/enterprise-pm/services/approval-api/src/approval/pg/schema.ts` | 동일 컬럼 추가 |
| `simulations/enterprise-pm/services/approval-api/src/approval/sqlite/adapter.ts` | `createBudgetRequest` 가 `projectDepartmentId` 저장 |
| `simulations/enterprise-pm/services/approval-api/src/approval/pg/adapter.ts` | 동일 |
| `simulations/enterprise-pm/services/approval-api/drizzle/sqlite/0002_*.sql` | 컬럼 추가 마이그레이션 |
| `simulations/enterprise-pm/services/approval-api/drizzle/pg/0002_*.sql` | 동일 |
| `simulations/enterprise-pm/services/approval-api/src/approval/budget/budget.controller.ts` | `@Controller("approvals/requests")` + body 에서 `approverId` 제거 + decision enum `approve/reject` + `rootSpanId` 응답 |
| `simulations/enterprise-pm/services/approval-api/src/approval/budget/budget.service.ts` | `decide(id, approverId, storageDecision, comment)` — storageDecision 형식 유지 (내부) |
| `simulations/enterprise-pm/services/approval-api/src/approval/budget/budget.module.ts` | `BudgetAccessService` import |
| `simulations/enterprise-pm/services/approval-api/src/app.module.ts` | `AccessCheckerModule.forRootAsync` 등록 |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/approval-api/src/approval/budget/budget.controller.ts \
     simulations/enterprise-pm/services/pm-api/src/auth-deps/current-user.guard.ts \
     packages/resource-policy-store/src/factory.ts \
     simulations/enterprise-pm/services/auth-api/src/test-bootstrap.ts
```

Expected: Plan 11b + 11b-1 + 11a-1 + 05c 완료. 미완료 시 시작 금지.

- [ ] **Step 2: approval-api 현재 테스트 baseline**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-approval-api test 2>&1 | tail -3
```

- [ ] **Step 3: 현재 경로/body 구조 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -nE "@Controller|approverId|approved|rejected" \
    simulations/enterprise-pm/services/approval-api/src/approval/budget/budget.controller.ts
```

Expected: `@Controller("budgets")`, `approverId: z.string().min(1)`, `decision: z.enum(["approved","rejected"])` hit — 모두 본 plan 변경 대상.

---

## Task 1: package.json — exports + 의존 추가

**Files:**
- Modify: `simulations/enterprise-pm/services/approval-api/package.json`

- [ ] **Step 1: exports + dep**

```json
{
  "name": "@qa-sdk/sim-approval-api",
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

- [ ] **Step 2: pnpm install + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  git add simulations/enterprise-pm/services/approval-api/package.json pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
chore(sim-approval-api): exports 필드 + permission-engine/resource-policy-store dep

test-bootstrap subpath 공개 — Plan 13a in-process 진입점.
AccessChecker 통합 (Plan 11b-2 Task 3~5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: schema + migration — projectDepartmentId 컬럼 추가

**Files:**
- Modify: `src/approval/shared/types.ts`
- Modify: `src/approval/sqlite/schema.ts`
- Modify: `src/approval/pg/schema.ts`
- Modify: `src/approval/sqlite/adapter.ts`
- Modify: `src/approval/pg/adapter.ts`
- Create: `drizzle/sqlite/0002_project_department_id.sql`
- Create: `drizzle/pg/0002_project_department_id.sql`

- [ ] **Step 1: types.ts — BudgetRequest 확장**

```ts
export interface BudgetRequest {
  id: string;
  projectId: string;
  /** project 의 departmentId 를 denormalize 하여 저장. cross-dept 검증 입력. */
  projectDepartmentId: string;
  amount: number;
  requesterId: string;
  status: "draft" | "submitted" | "in_review" | "approved" | "rejected" | "revision_requested";
  currentStage: number;
  totalStages: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRequestCreate {
  projectId: string;
  projectDepartmentId: string;
  amount: number;
  requesterId: string;
}
```

- [ ] **Step 2: sqlite/schema.ts + pg/schema.ts — 컬럼 추가**

`sqliteTable("budget_requests", ...)` 정의에 `projectDepartmentId: text("project_department_id").notNull()` 추가.
`pgSchema("sim").table("approval_budget_requests", ...)` 도 동일.

DDL 문자열 (`SIM_APPROVAL_SQLITE_DDL` / `SIM_APPROVAL_PG_DDL`) 도 `project_department_id TEXT NOT NULL` 포함.

- [ ] **Step 3: 0002 migration 파일**

`drizzle/sqlite/0002_project_department_id.sql`:
```sql
ALTER TABLE budget_requests ADD COLUMN project_department_id TEXT NOT NULL DEFAULT '';
-- 기존 row 가 있으면 수동 backfill 필요 — sim 환경은 첫 부팅 시점에 테이블이 비어있어 무관.
```

`drizzle/pg/0002_project_department_id.sql`:
```sql
ALTER TABLE sim.approval_budget_requests
  ADD COLUMN project_department_id TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 4: adapter.ts 양쪽 — createBudgetRequest 가 projectDepartmentId 저장**

```ts
// sqlite/adapter.ts
async createBudgetRequest(args: BudgetRequestCreate): Promise<BudgetRequest> {
  const id = /* uuid or sequence */;
  const now = new Date().toISOString();
  const totalStages = determineStages(args.amount);
  const record = {
    id,
    projectId: args.projectId,
    projectDepartmentId: args.projectDepartmentId,
    amount: args.amount,
    requesterId: args.requesterId,
    status: "draft" as const,
    currentStage: 1,
    totalStages,
    createdAt: now,
    updatedAt: now,
  };
  await this.db.insert(budgetRequests).values(record);
  await this.createApprovalSteps(id, totalStages);
  return record;
}
```

- [ ] **Step 5: adapter 테스트 갱신 — projectDepartmentId 입력 + select 확인**

기존 Plan 11b sqlite/adapter.test.ts 의 `createBudgetRequest` 케이스에 `projectDepartmentId: "dept-eng"` 추가 + select 시 반환값 검증.

- [ ] **Step 6: 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test -- approval/sqlite approval/pg
```

Expected: typecheck 0, 기존 adapter 테스트 + 새 컬럼 검증 PASS.

- [ ] **Step 7: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/shared/types.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/sqlite \
          simulations/enterprise-pm/services/approval-api/src/approval/pg \
          simulations/enterprise-pm/services/approval-api/drizzle && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): budget_requests.project_department_id 컬럼 추가

cross-dept 검증 입력 — approver.departmentId 와 비교.
sqlite/pg 양쪽 schema + adapter + 0002 migration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: CurrentUser decorator + Guard + AccessCheckerModule (Plan 11b-1 복제)

**Files:**
- Create: `src/auth-deps/current-user.decorator.ts`
- Create: `src/auth-deps/current-user.guard.ts`
- Create: `src/auth-deps/current-user.guard.test.ts`
- Create: `src/auth-deps/access-checker.module.ts`

- [ ] **Step 1~3**: Plan 11b-1 Task 2 내용을 그대로 복제 (`sim-pm-api` → `sim-approval-api` 경로 차이만). `@def.boundary` 는 `sim-approval-api` 로 변경.

- [ ] **Step 4: access-checker.module.ts** — Plan 11b-1 Task 3 의 `PROJECT_*` 를 `APPROVAL_*` symbol 로 변경:

```ts
export const APPROVAL_ACCESS_CHECKER = Symbol("APPROVAL_ACCESS_CHECKER");
export const APPROVAL_POLICY_REGISTRY = Symbol("APPROVAL_POLICY_REGISTRY");
```

나머지 동일.

- [ ] **Step 5: 4 파일 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api test -- current-user && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck
```

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/auth-deps && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): CurrentUser + Guard + AccessCheckerModule (Plan 11b-1 복제)

gateway header 파싱 + AccessChecker DI provider.
APPROVAL_ACCESS_CHECKER / APPROVAL_POLICY_REGISTRY symbol.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: decision-mapping — approve/reject ↔ approved/rejected

**Files:**
- Create: `src/approval/budget/decision-mapping.ts`
- Create: `src/approval/budget/decision-mapping.test.ts`

- [ ] **Step 1: decision-mapping.test.ts (test-first)**

```ts
import { describe, expect, it } from "vitest";
import {
  toStorageDecision,
  fromStorageDecision,
  type ApiDecision,
  type StorageDecision,
} from "./decision-mapping.js";

describe("decision-mapping", () => {
  it("'approve' → 'approved'", () => {
    expect(toStorageDecision("approve")).toBe("approved");
  });

  it("'reject' → 'rejected'", () => {
    expect(toStorageDecision("reject")).toBe("rejected");
  });

  it("unknown api decision → throw", () => {
    expect(() => toStorageDecision("foo" as ApiDecision)).toThrow(/unknown api decision/);
  });

  it("storage 'approved' → 'approve'", () => {
    expect(fromStorageDecision("approved")).toBe("approve");
  });

  it("storage 'rejected' → 'reject'", () => {
    expect(fromStorageDecision("rejected")).toBe("reject");
  });

  it("storage 'pending' → throw (api 표면에 노출 불가)", () => {
    expect(() => fromStorageDecision("pending" as StorageDecision)).toThrow();
  });
});
```

- [ ] **Step 2: decision-mapping.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/** REST API 표면 — 동사 형태 (Plan 13b scenario 요구). */
export type ApiDecision = "approve" | "reject";

/** 내부 storage — 상태 형태 (approval_steps.decision 컬럼과 정렬). */
export type StorageDecision = "approved" | "rejected" | "pending";

/**
 * REST body 값 → storage 값 변환.
 *
 * @throws api decision 이 enum 밖이면 에러 (zod 로 1차 방어 후 내부 방어층).
 */
export function toStorageDecision(api: ApiDecision): "approved" | "rejected" {
  switch (api) {
    case "approve": return "approved";
    case "reject": return "rejected";
    default: throw new Error(`unknown api decision: ${String(api)}`);
  }
}

/**
 * storage 값 → api 표면. pending 은 API 응답에 포함 불가 (controller 가 필터링).
 */
export function fromStorageDecision(storage: StorageDecision): ApiDecision {
  switch (storage) {
    case "approved": return "approve";
    case "rejected": return "reject";
    case "pending": throw new Error("pending storage decision is internal — must not be exposed via API");
    default: throw new Error(`unknown storage decision: ${String(storage)}`);
  }
}
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api test -- decision-mapping
```

Expected: 6 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/budget/decision-mapping.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/budget/decision-mapping.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): decision-mapping — approve/reject ↔ approved/rejected

API 표면은 동사 (Plan 13b scenario 요구), storage 는 상태 (approval_steps 와 정렬).
pending storage 는 API 노출 금지 — fromStorageDecision throw.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: BudgetAccessService — AccessChecker 호출 + cross-dept 컨텍스트 주입

**Files:**
- Create: `src/approval/budget/budget-access.service.ts`
- Create: `src/approval/budget/budget-access.service.test.ts`

- [ ] **Step 1: budget-access.service.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc authorization-ontology-resource-lifecycle

import { Inject, Injectable } from "@nestjs/common";
import type { AccessChecker, CheckResult } from "permission-engine";
import { APPROVAL_ACCESS_CHECKER } from "../../auth-deps/access-checker.module.js";
import type { CurrentUserContext } from "../../auth-deps/current-user.decorator.js";

export interface BudgetAccessInput {
  apiId: "budget.create" | "budget.approve" | "budget.reject" | "budget.read" | "budget.submit" | "budget.start-review";
  user: CurrentUserContext;
  /** request id — null 이면 create 경로 (targetId 없음). */
  requestId: string | null;
  /** request 의 project departmentId — cross-dept 검증 입력. */
  projectDepartmentId: string | null;
  /** approver 본인 departmentId — JWT / user context 에서 전달. */
  approverDepartmentId?: string | null;
}

@Injectable()
export class BudgetAccessService {
  constructor(@Inject(APPROVAL_ACCESS_CHECKER) private readonly checker: AccessChecker) {}

  async check(input: BudgetAccessInput): Promise<CheckResult> {
    return this.checker.check({
      kind: "transaction",
      apiId: input.apiId,
      userId: input.user.userId,
      bitmap: {
        prefix: "sim.bitmap",
        v: input.user.bitmapVersion,
        mask: input.user.bitmapMask,
      },
      coords: [],
      targetId: input.requestId,
      context: {
        projectDepartmentId: input.projectDepartmentId,
        approverDepartmentId: input.approverDepartmentId ?? null,
      },
    });
  }
}
```

- [ ] **Step 2: budget-access.service.test.ts — 3건**

```ts
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { BudgetAccessService } from "./budget-access.service.js";
import { APPROVAL_ACCESS_CHECKER } from "../../auth-deps/access-checker.module.js";

function fakeChecker(result: { allow: boolean; rootSpanId: string; denyReason?: string; firstFailureSpanId?: string }) {
  return { check: async () => result };
}

describe("BudgetAccessService", () => {
  const user = {
    userId: "alice",
    bitmapMask: new Uint8Array([0xff, 0xff]),
    bitmapVersion: "uv1",
  };

  async function svcWith(result: Parameters<typeof fakeChecker>[0]) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetAccessService,
        { provide: APPROVAL_ACCESS_CHECKER, useValue: fakeChecker(result) },
      ],
    }).compile();
    return moduleRef.get(BudgetAccessService);
  }

  it("same dept → allow + rootSpanId", async () => {
    const svc = await svcWith({ allow: true, rootSpanId: "root-allow" });
    const res = await svc.check({
      apiId: "budget.approve",
      user,
      requestId: "r-1",
      projectDepartmentId: "dept-eng",
      approverDepartmentId: "dept-eng",
    });
    expect(res.allow).toBe(true);
    expect(res.rootSpanId).toBe("root-allow");
  });

  it("cross dept → deny + denyReason + firstFailureSpanId", async () => {
    const svc = await svcWith({
      allow: false,
      rootSpanId: "root-deny",
      denyReason: "cross_department_requires_approver_role",
      firstFailureSpanId: "span-first",
    });
    const res = await svc.check({
      apiId: "budget.approve",
      user,
      requestId: "r-1",
      projectDepartmentId: "dept-eng",
      approverDepartmentId: "dept-marketing",
    });
    expect(res.allow).toBe(false);
    expect(res.denyReason).toBe("cross_department_requires_approver_role");
    expect(res.firstFailureSpanId).toBe("span-first");
  });

  it("context 주입 확인 — projectDepartmentId + approverDepartmentId", async () => {
    let captured: { projectDepartmentId?: string | null; approverDepartmentId?: string | null } = {};
    const svc = await svcWith({ allow: true, rootSpanId: "r" });
    (svc as unknown as { checker: { check: (a: { context?: typeof captured }) => Promise<unknown> } }).checker = {
      check: async (a) => {
        captured = a.context ?? {};
        return { allow: true, rootSpanId: "r" };
      },
    };
    await svc.check({
      apiId: "budget.approve",
      user,
      requestId: "r-1",
      projectDepartmentId: "dept-eng",
      approverDepartmentId: "dept-marketing",
    });
    expect(captured.projectDepartmentId).toBe("dept-eng");
    expect(captured.approverDepartmentId).toBe("dept-marketing");
  });
});
```

- [ ] **Step 3: 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api test -- budget-access
```

Expected: 3 PASS.

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/budget/budget-access.service.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/budget/budget-access.service.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): BudgetAccessService — AccessChecker 래퍼 + cross-dept context

projectDepartmentId + approverDepartmentId 를 check context 에 주입.
deny 시 rootSpanId + denyReason + firstFailureSpanId 반환.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: budget.controller.ts — 경로 변경 + body 정렬 + decision enum + rootSpanId

**Files:**
- Modify: `src/approval/budget/budget.controller.ts`
- Modify: `src/approval/budget/budget.service.ts`
- Modify: `src/approval/budget/budget.module.ts`

- [ ] **Step 1: budget.service.ts — decide signature 유지 + storageDecision 호출**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
// ... existing imports

@Injectable()
export class BudgetService {
  constructor(@Inject(APPROVAL_REPOSITORY) private readonly repo: ApprovalRepository) {}

  async create(args: BudgetRequestCreate): Promise<BudgetRequest> {
    return this.repo.createBudgetRequest(args);
  }

  async find(id: string): Promise<BudgetRequest | null> {
    return this.repo.findBudgetRequest(id);
  }

  async submit(id: string): Promise<BudgetRequest> { /* existing */ }
  async startReview(id: string): Promise<BudgetRequest> { /* existing */ }

  /**
   * decide — 내부는 storage enum ("approved"/"rejected"). controller 가 api → storage 변환.
   */
  async decide(
    id: string,
    approverId: string,
    storageDecision: "approved" | "rejected",
    comment: string | undefined,
  ): Promise<BudgetRequest> {
    const cur = await this.repo.findBudgetRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    if (cur.status !== "in_review") throw new InvalidTransitionError(cur.status, "decide");

    await this.repo.recordDecision(id, cur.currentStage, approverId, storageDecision, comment);
    const next = applyDecision(
      { status: cur.status, currentStage: cur.currentStage, totalStages: cur.totalStages },
      storageDecision,
    );
    return this.repo.updateBudgetRequestState(id, next.status, next.currentStage);
  }

  async listSteps(id: string) { return this.repo.listSteps(id); }
  async listByProject(projectId: string) { return this.repo.listBudgetRequestsByProject(projectId); }
  async listByRequester(requesterId: string) { return this.repo.listBudgetRequestsByRequester(requesterId); }
}
```

- [ ] **Step 2: budget.controller.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { BudgetService } from "./budget.service.js";
import { BudgetAccessService } from "./budget-access.service.js";
import { toStorageDecision, type ApiDecision } from "./decision-mapping.js";
import { CurrentUser, type CurrentUserContext } from "../../auth-deps/current-user.decorator.js";
import { CurrentUserGuard } from "../../auth-deps/current-user.guard.js";

const createSchema = z.object({
  projectId: z.string().min(1),
  projectDepartmentId: z.string().min(1),
  amount: z.number().finite().positive(),
  requesterId: z.string().min(1),
});

const decideSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().optional(),
});

@Controller("approvals/requests")
@UseGuards(CurrentUserGuard)
export class BudgetController {
  constructor(
    private readonly svc: BudgetService,
    private readonly access: BudgetAccessService,
  ) {}

  @Post()
  async create(@Body() body: unknown, @CurrentUser() user: CurrentUserContext) {
    const parsed = createSchema.parse(body);
    const pre = await this.access.check({
      apiId: "budget.create",
      user,
      requestId: null,
      projectDepartmentId: parsed.projectDepartmentId,
    });
    if (!pre.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: pre.denyReason,
        rootSpanId: pre.rootSpanId,
      });
    }
    const created = await this.svc.create(parsed);
    return { ...created, rootSpanId: pre.rootSpanId };
  }

  @Get(":id")
  async get(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.read",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    return { ...r, rootSpanId: check.rootSpanId };
  }

  @Get()
  async list(
    @Query("projectId") projectId: string,
    @Query("requesterId") requesterId: string,
  ) {
    if (projectId) return this.svc.listByProject(projectId);
    if (requesterId) return this.svc.listByRequester(requesterId);
    throw new NotFoundException("projectId or requesterId query required");
  }

  @Get(":id/steps")
  async steps(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.read",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    return this.svc.listSteps(id);
  }

  @Post(":id/submit")
  async submit(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.submit",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const updated = await this.svc.submit(id);
    return { ...updated, rootSpanId: check.rootSpanId };
  }

  @Post(":id/start-review")
  async startReview(@Param("id") id: string, @CurrentUser() user: CurrentUserContext) {
    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);
    const check = await this.access.check({
      apiId: "budget.start-review",
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
      });
    }
    const updated = await this.svc.startReview(id);
    return { ...updated, rootSpanId: check.rootSpanId };
  }

  @Post(":id/decisions")
  async decide(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: CurrentUserContext,
  ) {
    const parsed = decideSchema.parse(body);

    const r = await this.svc.find(id);
    if (!r) throw new NotFoundException(`BudgetRequest not found: ${id}`);

    const apiId = parsed.decision === "approve" ? "budget.approve" : "budget.reject";
    const check = await this.access.check({
      apiId,
      user,
      requestId: id,
      projectDepartmentId: r.projectDepartmentId,
      // approverDepartmentId 는 user context 에서 가져옴 (향후 guard 에서 enrich 가능)
      // 본 plan 은 header 에 포함되지 않음 — Plan 12a 가 x-auth-department-id 추가 여부 결정
      approverDepartmentId: undefined,
    });
    if (!check.allow) {
      throw new ForbiddenException({
        error: "access_denied",
        denyReason: check.denyReason,
        rootSpanId: check.rootSpanId,
        firstFailureSpanId: check.firstFailureSpanId,
      });
    }

    const storageDecision = toStorageDecision(parsed.decision as ApiDecision);
    const updated = await this.svc.decide(id, user.userId, storageDecision, parsed.comment);
    return { ...updated, rootSpanId: check.rootSpanId };
  }
}
```

- [ ] **Step 3: budget.module.ts — BudgetAccessService 추가**

```ts
@Module({
  imports: [ApprovalDbModule, AccessCheckerModule],
  providers: [BudgetService, BudgetAccessService],
  controllers: [BudgetController],
  exports: [BudgetService],
})
export class BudgetModule {}
```

- [ ] **Step 4: 기존 budget.service.test.ts 갱신**

기존 테스트가 `svc.decide(id, approverId, "approved", comment)` 를 호출한다면 storageDecision enum 형태 그대로 유지 (내부 contract 보존). controller 테스트가 있다면 `/approvals/requests` 경로 + decision `"approve"/"reject"` 로 갱신.

- [ ] **Step 5: 회귀**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test 2>&1 | tail -5
```

Expected: typecheck 0 + 기존 + 신규 test 통과.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/budget && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): BudgetController — /approvals/requests + JWT approverId + decision enum

경로: /budgets → /approvals/requests (Plan 13b 계약).
body 에서 approverId 제거 — @CurrentUser 로 JWT sub 도출.
decision enum: approve/reject (API) ↔ approved/rejected (storage).
모든 write 경로 AccessChecker.check + rootSpanId 응답 + deny 시 403.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: app.module.ts — AccessCheckerModule 등록

**Files:**
- Modify: `src/app.module.ts`

- [ ] **Step 1: AccessCheckerModule.forRootAsync 추가**

```ts
// @def.boundary sim-approval-api
// @def.doc authorization-ontology-bitmap-pipeline

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module.js";
import { ApprovalDbModule } from "./approval/approval-db.module.js";
import { BudgetModule } from "./approval/budget/budget.module.js";
import { ResourceModule } from "./approval/resource/resource.module.js";
import { TimeOffModule } from "./approval/timeoff/timeoff.module.js";
import { ExpenseModule } from "./approval/expense/expense.module.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { BitmapCacheModule } from "@qa-sdk/sim-bitmap-cache";
import { env } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createSubscriberLogger } from "./lib/bitmap-cache-logger.js";

@Module({
  imports: [
    HealthModule,
    ApprovalDbModule.forRoot(),
    AccessCheckerModule.forRootAsync(async () => ({
      dialect: env.QA_DB_DIALECT,
      db: null, // ApprovalDbModule export db 참조 — 실제 inject 는 imports+inject 문법 필요
    })),
    BudgetModule,
    ResourceModule,
    TimeOffModule,
    ExpenseModule,
    BitmapCacheModule.forRoot({
      redisUrl: env.SIM_REDIS_URL,
      publisherEnabled: false,
      listenerEnabled: true,
      publisherName: "sim-approval-api",
      lruMax: 10_000,
      logger: createSubscriberLogger(createLogger("sim-approval-api.bitmap-cache")),
    }),
  ],
})
export class AppModule {}
```

**주의**: Plan 11b-1 Task 6 과 동일하게 `imports/inject` 로 db instance 를 정확히 주입해야 함. ApprovalDbModule 의 provider 구조에 맞춰 조정.

- [ ] **Step 2: 회귀 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  git add simulations/enterprise-pm/services/approval-api/src/app.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): AccessCheckerModule.forRootAsync 등록

ApprovalDbModule db → AccessChecker 주입.
BudgetModule 이 APPROVAL_ACCESS_CHECKER 소비.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: test-bootstrap.ts — bootstrapTestApi + seedApprovalFixtures + createTestBudgetRequest

**Files:**
- Create: `src/test-bootstrap.ts`
- Create: `src/test-bootstrap.test.ts`

- [ ] **Step 1: test-bootstrap.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

/**
 * sim-approval-api 외부 노출 test-bootstrap — Plan 13a/b in-process 진입점.
 */

import { Test } from "@nestjs/testing";
import type { INestApplication, DynamicModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import type { AccessChecker, ResourcePolicyRegistry } from "permission-engine";
import { HealthModule } from "./health/health.module.js";
import { ApprovalDbModule } from "./approval/approval-db.module.js";
import { BudgetModule } from "./approval/budget/budget.module.js";
import { ResourceModule } from "./approval/resource/resource.module.js";
import { TimeOffModule } from "./approval/timeoff/timeoff.module.js";
import { ExpenseModule } from "./approval/expense/expense.module.js";
import { AccessCheckerModule } from "./auth-deps/access-checker.module.js";
import { BudgetService } from "./approval/budget/budget.service.js";

export { AppModule } from "./app.module.js";

export interface TestBootstrapOptions {
  sqlitePath?: string; // 기본 ":memory:"
  overrideChecker?: AccessChecker;
  overrideRegistry?: ResourcePolicyRegistry;
}

export interface TestApprovalApiHandle {
  app: INestApplication;
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
      AccessCheckerModule.forRootAsync(async () => ({
        dialect: "sqlite",
        db: null,
        overrideChecker: opts.overrideChecker,
        overrideRegistry: opts.overrideRegistry,
      })),
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
      try { await app.close(); }
      finally {
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
  // approval-api 는 role 테이블 없음 — id reference 만 Plan 13 가 사용.
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
```

- [ ] **Step 2: test-bootstrap.test.ts (6건)**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AccessChecker } from "permission-engine";
import {
  bootstrapTestApi,
  createTestBudgetRequest,
  seedApprovalFixtures,
  type TestApprovalApiHandle,
} from "./test-bootstrap.js";

function allowChecker(): AccessChecker {
  return {
    check: async () => ({ allow: true, rootSpanId: "root-allow" }),
  } as unknown as AccessChecker;
}

function denyChecker(): AccessChecker {
  return {
    check: async () => ({
      allow: false,
      rootSpanId: "root-deny",
      denyReason: "cross_department_requires_approver_role",
      firstFailureSpanId: "span-first",
    }),
  } as unknown as AccessChecker;
}

describe("sim-approval-api/test-bootstrap", () => {
  let handle: TestApprovalApiHandle;

  afterEach(async () => {
    await handle?.close();
  });

  it("bootstrapTestApi — port > 0", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    expect(handle.port).toBeGreaterThan(0);
  });

  it("seedApprovalFixtures — approver_role id 반환", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const fx = await seedApprovalFixtures(handle);
    expect(fx.approver_role.id).toBe("role-approver");
  });

  it("createTestBudgetRequest — amount 500_000 → totalStages 1", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const r = await createTestBudgetRequest(handle, {
      projectId: "p-1",
      projectDepartmentId: "dept-eng",
      amount: 500_000,
      requesterId: "user-eng-1",
    });
    expect(r.totalStages).toBe(1);
    expect(r.status).toBe("draft");
    expect(r.projectDepartmentId).toBe("dept-eng");
  });

  it("POST /approvals/requests — header 없음 → 401", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const res = await fetch(`${handle.baseUrl}/approvals/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: "p-1",
        projectDepartmentId: "dept-eng",
        amount: 1_000_000,
        requesterId: "user-1",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("POST /approvals/requests/:id/decisions — approve → 200 + rootSpanId", async () => {
    handle = await bootstrapTestApi({ overrideChecker: allowChecker() });
    const req = await createTestBudgetRequest(handle, {
      projectId: "p-1",
      projectDepartmentId: "dept-eng",
      amount: 1_000_000,
      requesterId: "user-1",
    });
    // submit + start-review — state machine 전이 (header 포함)
    const maskB64 = Buffer.from([0xff, 0xff]).toString("base64");
    const authHeaders = {
      "content-type": "application/json",
      "x-auth-user-id": "alice",
      "x-auth-bitmap-mask": maskB64,
      "x-auth-bitmap-v": "uv1",
    };
    await fetch(`${handle.baseUrl}/approvals/requests/${req.id}/submit`, {
      method: "POST",
      headers: authHeaders,
    });
    await fetch(`${handle.baseUrl}/approvals/requests/${req.id}/start-review`, {
      method: "POST",
      headers: authHeaders,
    });
    const res = await fetch(`${handle.baseUrl}/approvals/requests/${req.id}/decisions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ decision: "approve", comment: "ok" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; rootSpanId: string };
    expect(body.status).toBe("approved");
    expect(body.rootSpanId).toBe("root-allow");
  });

  it("POST decisions — cross-dept deny → 403 + denyReason + firstFailureSpanId", async () => {
    handle = await bootstrapTestApi({ overrideChecker: denyChecker() });
    const req = await createTestBudgetRequest(handle, {
      projectId: "p-1",
      projectDepartmentId: "dept-eng",
      amount: 500_000,
      requesterId: "user-1",
    });
    // decide 전이 상태에 도달 필요 — deny checker 상태에서는 submit 도 deny. 본 테스트는
    // 직접 service.submit/startReview 호출로 state 를 in_review 로 바꾼 후 controller 호출.
    const svc = handle.app.get((await import("./approval/budget/budget.service.js")).BudgetService);
    await svc.submit(req.id);
    await svc.startReview(req.id);

    const maskB64 = Buffer.from([0xff, 0xff]).toString("base64");
    const res = await fetch(`${handle.baseUrl}/approvals/requests/${req.id}/decisions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-auth-user-id": "bob",
        "x-auth-bitmap-mask": maskB64,
        "x-auth-bitmap-v": "uv1",
      },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      message?: { denyReason: string; rootSpanId: string; firstFailureSpanId: string };
      denyReason?: string;
      rootSpanId?: string;
    };
    // NestJS 기본 ForbiddenException 형식 — body.message 에 object 포함
    const payload = body.message && typeof body.message === "object" ? body.message : body;
    expect((payload as { denyReason: string }).denyReason).toBe("cross_department_requires_approver_role");
    expect((payload as { rootSpanId: string }).rootSpanId).toBe("root-deny");
    expect((payload as { firstFailureSpanId: string }).firstFailureSpanId).toBe("span-first");
  });
});
```

- [ ] **Step 3: 테스트 통과**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api test -- test-bootstrap
```

Expected: 6 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/test-bootstrap.ts \
          simulations/enterprise-pm/services/approval-api/src/test-bootstrap.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): test-bootstrap — bootstrap + seedApprovalFixtures + createTestBudgetRequest

Plan 13a/b in-process 진입점 — overrideChecker 로 fake 주입.
createTestBudgetRequest: amount-based totalStages 검증 smoke 포함.
cross-dept deny 응답 검증: denyReason + rootSpanId + firstFailureSpanId.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 빌드 산출 + subpath import 검증

- [ ] **Step 1: 빌드 + subpath import**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api clean && \
  pnpm --filter @qa-sdk/sim-approval-api build && \
  ls simulations/enterprise-pm/services/approval-api/dist/test-bootstrap.js \
     simulations/enterprise-pm/services/approval-api/dist/test-bootstrap.d.ts && \
  node --input-type=module -e "
    import('@qa-sdk/sim-approval-api/test-bootstrap').then(m => {
      if (typeof m.bootstrapTestApi !== 'function') throw new Error('bootstrapTestApi missing');
      if (typeof m.seedApprovalFixtures !== 'function') throw new Error('seedApprovalFixtures missing');
      if (typeof m.createTestBudgetRequest !== 'function') throw new Error('createTestBudgetRequest missing');
      if (!m.AppModule) throw new Error('AppModule missing');
      console.log('OK: test-bootstrap subpath import');
    });
  "
```

Expected: `OK: test-bootstrap subpath import`.

---

## Task 10: 회귀 — 전체 테스트 + 기존 호출자 영향 확인

- [ ] **Step 1: approval-api 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test 2>&1 | tail -5
```

Expected: typecheck 0 + Plan 11b baseline (기존 /budgets 경로 테스트는 본 plan 에서 갱신됨) + 신규 테스트 추가.

- [ ] **Step 2: 기존 호출자 검증 — gateway proxy 설정**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -rn "/budgets" simulations/enterprise-pm/services/gateway/ 2>&1 | head -10
```

Expected: gateway 의 proxy 규칙이 `/approvals/requests` 로 업데이트되어 있거나 prefix 기반 라우팅이라 영향 없음. 있다면 Plan 12a 결과 확인 후 조정 필요.

- [ ] **Step 3: 시뮬 서비스 전체 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter "@qa-sdk/sim-*" typecheck 2>&1 | tail -10
```

Expected: 9 시뮬 서비스 모두 0 error.

- [ ] **Step 4: def gate + workflow-smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  node packages/cli/dist/index.js def validate 2>&1 | head -3 && \
  pnpm --filter @qa-sdk/cli test 2>&1 | tail -3
```

Expected: errors 0 + smoke PASS.

- [ ] **Step 5: e2e smoke (단독 부팅)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-approval-11b2.sqlite \
  pnpm --filter @qa-sdk/sim-approval-api start &
PID=$!
sleep 3

MASK=$(python3 -c "import base64; print(base64.b64encode(bytes([0xff,0xff])).decode())")
echo "POST /approvals/requests:"
R=$(curl -fsS -X POST http://localhost:4600/approvals/requests \
  -H "content-type: application/json" \
  -H "x-auth-user-id: user-alice" \
  -H "x-auth-bitmap-mask: $MASK" \
  -H "x-auth-bitmap-v: uv1" \
  -d '{"projectId":"p-1","projectDepartmentId":"dept-eng","amount":500000,"requesterId":"user-1"}')
echo "$R"

kill $PID 2>/dev/null || true
rm -f /tmp/sim-approval-11b2.sqlite
```

Expected: 응답 JSON 에 `rootSpanId` 존재 + `totalStages: 1` + `status: "draft"`.

---

## Self-Review

- [ ] 경로: `/budgets` → `/approvals/requests` (controller prefix 교체)
- [ ] POST body 에 `approverId` 없음 — `@CurrentUser().userId` 로 도출
- [ ] decision enum API `"approve"|"reject"`, storage `"approved"|"rejected"` — `toStorageDecision` 변환
- [ ] 모든 write 경로에 `AccessChecker.check` + `rootSpanId` 응답
- [ ] cross-dept deny 시 `denyReason: "cross_department_requires_approver_role"` + `firstFailureSpanId` 포함
- [ ] `BudgetRequest.projectDepartmentId` 컬럼 (sqlite/pg + migration 0002)
- [ ] `BudgetAccessService` — context 에 projectDepartmentId + approverDepartmentId 주입
- [ ] `test-bootstrap.ts` — `bootstrapTestApi` + `seedApprovalFixtures` + `createTestBudgetRequest` + `AppModule` re-export
- [ ] `overrideChecker` 로 fake 주입 가능 (allow/deny 양쪽 테스트)
- [ ] SQLite :memory: 테스트 환경
- [ ] CurrentUserGuard — gateway header 없으면 401
- [ ] 9 시뮬 서비스 typecheck 0 유지
- [ ] console.log 0건

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| `x-auth-department-id` gateway header — approver 부서 전달 | Plan 12a gateway spec 확장 시점 | Plan 12a extension |
| Resource/TimeOff/Expense controller 경로 변경 (`/resources/requests` 등) | 현재 Plan 13 시나리오 는 Budget 만 검증 | 별도 plan |
| `decision: "request_revision"` enum 추가 | Plan 11b 에 `revision_requested` status 존재, api 동사 미확정 | 향후 시나리오 추가 시 |
| BudgetRequest CRUD history / audit trail 조회 endpoint | audit-browser-api 가 별도 담당 | Plan 12c |
| project → approval-api 이벤트 pub/sub (projectDepartmentId 자동 sync) | 마이크로서비스 eventual consistency — sim 스코프 밖 | 운영 시점 |
| bcrypt/password 보안 — approval-api 는 auth-api 위임만 | auth-api Plan 11a-1 책임 | Plan 11a-1 |

---

## 의존·후속

- **Plan 11b** (pm/approval domain): 본 plan 의 전제 — `BudgetService`, `approval_repository`, state machine 이 선행 구현.
- **Plan 11b-1** (pm-api AccessChecker): 본 plan 이 동일 패턴 복제 — `CurrentUserGuard`, `AccessCheckerModule`, `AccessService` 3층 구조.
- **Plan 11a-1** (auth-api test-bootstrap): 본 plan 의 `TestCredentialStore` 활용 — Plan 13b scenario 의 carol/david/eve 도 이 store 에 password 주입.
- **Plan 05c** (resource-policy-store factory): `createResourcePolicyRegistry` 사용.
- **Plan 12a** (gateway JWT bitmap embed): JWT → `x-auth-*` 헤더 변환 주체.
- **Plan 12c** (OTel traceparent + audit): `rootSpanId` / `firstFailureSpanId` 값의 실제 발급 체계.
- **Plan 13b** (scenario 3/4): 본 plan 의 정렬된 계약 + test-bootstrap 을 e2e 에서 소비.
- **Plan 13c/d** (scenario 5~8): 본 plan 의 `createTestBudgetRequest` + `/approvals/requests/:id/decisions` 패턴을 다단계 승인으로 확장.
- **Plan 14a/b** (integration + density): cross-dept deny 의 marginal density 측정.
