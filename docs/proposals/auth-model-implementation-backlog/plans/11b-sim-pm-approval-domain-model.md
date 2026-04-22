---
lifecycle: draft
plan: 11b
phase: 4
depends-on: [10a, 11a, 04c]
---

# Plan 11b — 시뮬 pm + approval domain (Project / Task / Member + Budget/Resource/TimeOff/Expense state machine)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 10a에서 부팅한 `sim-pm-api`와 `sim-approval-api`에 도메인 모델을 부착한다. **pm-api**는 design.md §3의 Project / Task / ProjectMember 3 entity를 dual-target Drizzle (sqlite/ + pg/)로 영속하고, **approval-api**는 BudgetRequest / ApprovalStep / ResourceRequest / TimeOffRequest / ExpenseReport 5 entity + state machine (BudgetRequest의 amount-based stage 결정)을 부착한다. 두 서비스 모두 Plan 11a와 동일한 SSOT 패턴: `shared/` 순수 도메인 + `sqlite/` + `pg/` + `factory.ts` + `port-contract.test.ts`. NestJS 모듈은 service per entity + controller로 REST 노출.

**Architecture:**
- **dual-target SSOT 패턴** (Plan 11a 복제):
  - pm-api: `src/pm/{shared,sqlite,pg,factory.ts,port-contract.test.ts}`
  - approval-api: `src/approval/{shared,sqlite,pg,factory.ts,port-contract.test.ts}`
- **pm-api 도메인** (design.md §3):
  - Project (id, name, ownerId, departmentId, status: draft|active|archived)
  - Task (id, projectId, title, assigneeId, status: todo|in_progress|done|blocked, parentTaskId)
  - ProjectMember (projectId, userId, role: lead|contributor|viewer)
- **approval-api 도메인** (design.md §3):
  - BudgetRequest (id, projectId, amount, requesterId, status: draft|submitted|in_review|approved|rejected|revision_requested, currentStage, totalStages)
  - ApprovalStep (requestId, stageNumber, approverId, decision: approved|rejected|pending, comment, decidedAt)
  - ResourceRequest, TimeOffRequest, ExpenseReport — 유사 패턴 (단순화: status + requesterId + 도메인별 필드만)
- **state machine** (`approval/shared/budget-state.ts` — 순수 함수):
  - `determineStages(amount)`: amount<1M→1, 1M≤amount<10M→2, amount≥10M→3
  - `transitionRequest(cur, action)`: draft→submit→in_review→(approve|reject|request_revision→submit)
  - `applyDecision(request, step, decision)`: 단계 결정 후 다음 stage advance 또는 최종 status 갱신
- **trans 의존**: pm-api의 ProjectMember는 sim-auth-api의 user와 fk 없음 (마이크로서비스 격리). userId는 reference만, 검증은 BFF/gateway 책임.
- **TDD steps** — Plan 11a와 동일: shared types → state machine pure → schema → adapter → factory → port-contract → service → controller → app.module 부착.

**Tech Stack:** Plan 11a와 동일 (drizzle-orm, db-bootstrap, NestJS 11, vitest, ES2023).

---

## File Structure

### pm-api (sim-pm-api 위)

```
simulations/enterprise-pm/services/pm-api/src/
├── pm/
│   ├── shared/{types.ts,errors.ts,port.ts}
│   ├── sqlite/{schema.ts,adapter.ts,adapter.test.ts}
│   ├── pg/{schema.ts,adapter.ts,adapter.test.ts}
│   ├── factory.ts + factory.test.ts
│   ├── port-contract.test.ts
│   ├── pm-db.module.ts
│   ├── project/{module,service,service.test,controller}
│   ├── task/{module,service,service.test,controller}
│   └── member/{module,service,service.test,controller}
└── drizzle/{sqlite,pg}/0001_init.sql
```

### approval-api (sim-approval-api 위)

```
simulations/enterprise-pm/services/approval-api/src/
├── approval/
│   ├── shared/
│   │   ├── types.ts                  # 5 entity 도메인 타입
│   │   ├── errors.ts
│   │   ├── port.ts                   # ApprovalRepository
│   │   ├── budget-state.ts           # determineStages + transitionRequest + applyDecision (순수)
│   │   └── budget-state.test.ts
│   ├── sqlite/{schema.ts,adapter.ts,adapter.test.ts}
│   ├── pg/{schema.ts,adapter.ts,adapter.test.ts}
│   ├── factory.ts + factory.test.ts
│   ├── port-contract.test.ts
│   ├── approval-db.module.ts
│   ├── budget/{budget.module,budget.service,budget.service.test,budget.controller}
│   ├── resource/{module,service,service.test,controller}
│   ├── timeoff/{module,service,service.test,controller}
│   └── expense/{module,service,service.test,controller}
└── drizzle/{sqlite,pg}/0001_init.sql
```

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/services/pm-api/src/main.ts \
     simulations/enterprise-pm/services/approval-api/src/main.ts \
     simulations/enterprise-pm/services/auth-api/src/auth/factory.ts && \
  grep -n "createConnection" packages/db-bootstrap/src/connection.ts
```

Expected: 모두 hit. Plan 10a (pm/approval 부팅) + Plan 11a (auth dual-target 패턴 확립) + Plan 04c db-bootstrap 완료.

- [ ] **Step 2: qa-sdk-postgres healthy + sim schema 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk/packages/infra-engine && \
  docker compose -f docker-compose.infra.yaml ps qa-sdk-db | grep healthy && \
  docker compose -f docker-compose.infra.yaml exec -T qa-sdk-db \
    psql -U postgres -d qa_sdk -tA -c "SELECT nspname FROM pg_namespace WHERE nspname='sim';"
```

Expected: healthy + `sim` 출력.

---

## Task 1: pm-api package + dep + types

**Files:**
- Modify: `simulations/enterprise-pm/services/pm-api/package.json`
- Create: `src/pm/shared/{types.ts,errors.ts,port.ts}`

- [ ] **Step 1: package.json — drizzle + db-bootstrap + better-sqlite3/postgres dep**

Plan 11a Task 1과 동일 패턴. dependencies: `drizzle-orm: catalog:`, `db-bootstrap: workspace:*` (이미 있음), peerDeps optional (`better-sqlite3`, `postgres`), devDeps에 양쪽 + `drizzle-kit`.

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 2: shared/types.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

export type ProjectStatus = "draft" | "active" | "archived";
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type MemberRole = "lead" | "contributor" | "viewer";

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  departmentId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string | null;
  status: TaskStatus;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface ProjectCreate {
  name: string;
  ownerId: string;
  departmentId: string;
  status?: ProjectStatus;
}

export interface TaskCreate {
  projectId: string;
  title: string;
  assigneeId?: string;
  status?: TaskStatus;
  parentTaskId?: string;
}

export interface MemberCreate {
  projectId: string;
  userId: string;
  role: MemberRole;
}
```

- [ ] **Step 3: shared/errors.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

export class ProjectNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Project not found: ${id}`); this.name = "ProjectNotFoundError"; }
}
export class TaskNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Task not found: ${id}`); this.name = "TaskNotFoundError"; }
}
export class MemberAlreadyExistsError extends Error {
  constructor(public readonly projectId: string, public readonly userId: string) {
    super(`Member already exists: ${projectId}/${userId}`); this.name = "MemberAlreadyExistsError";
  }
}
```

- [ ] **Step 4: shared/port.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import type { Project, ProjectCreate, Task, TaskCreate, ProjectMember, MemberCreate } from "./types.js";

export interface PmRepository {
  // Project
  createProject(args: ProjectCreate): Promise<Project>;
  findProject(id: string): Promise<Project | null>;
  listProjectsByDepartment(departmentId: string): Promise<Project[]>;
  listProjectsByOwner(ownerId: string): Promise<Project[]>;
  updateProject(id: string, patch: Partial<ProjectCreate>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Task
  createTask(args: TaskCreate): Promise<Task>;
  findTask(id: string): Promise<Task | null>;
  listTasksByProject(projectId: string): Promise<Task[]>;
  listSubtasks(parentTaskId: string): Promise<Task[]>;
  updateTask(id: string, patch: Partial<TaskCreate>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Member
  addMember(args: MemberCreate): Promise<ProjectMember>;
  removeMember(projectId: string, userId: string): Promise<void>;
  listMembers(projectId: string): Promise<ProjectMember[]>;
  listProjectsForUser(userId: string): Promise<ProjectMember[]>;
}
```

- [ ] **Step 5: typecheck + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-pm-api typecheck
```

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/package.json \
          simulations/enterprise-pm/services/pm-api/src/pm/shared \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): pm domain shared — types + errors + port

design.md §3: Project/Task/ProjectMember 3 entity.
PmRepository는 owner/department 인덱스 + 부모/자식 task 조회.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: pm-api sqlite + pg adapter (TDD)

**Files:**
- Create: `src/pm/sqlite/{schema.ts,adapter.ts,adapter.test.ts}`
- Create: `src/pm/pg/{schema.ts,adapter.ts,adapter.test.ts}`

본 task는 Plan 11a Task 5/6 패턴 그대로 — sqlite 어댑터 단위 테스트(8건) + pg 어댑터 (env gate, 2건). 핵심 변경: 4 entity 대신 3 entity, table name `projects` / `tasks` / `project_members` (sqlite) / `pm_projects` / `pm_tasks` / `pm_project_members` (pg).

- [ ] **Step 1: sqlite/schema.ts**

```ts
// @def.boundary sim-pm-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  departmentId: text("department_id").notNull(),
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_proj_owner").on(t.ownerId),
  index("idx_proj_dept").on(t.departmentId),
]);

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  assigneeId: text("assignee_id"),
  status: text("status", { enum: ["todo", "in_progress", "done", "blocked"] }).notNull(),
  parentTaskId: text("parent_task_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_task_proj").on(t.projectId),
  index("idx_task_parent").on(t.parentTaskId),
]);

export const projectMembers = sqliteTable("project_members", {
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role", { enum: ["lead", "contributor", "viewer"] }).notNull(),
  joinedAt: text("joined_at").notNull(),
}, (t) => [
  primaryKey({ columns: [t.projectId, t.userId] }),
  index("idx_pm_user").on(t.userId),
]);

export const SIM_PM_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  owner_id TEXT NOT NULL, department_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proj_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_proj_dept ON projects(department_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL,
  assignee_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo','in_progress','done','blocked')),
  parent_task_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_proj ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_task_parent ON tasks(parent_task_id);

CREATE TABLE IF NOT EXISTS project_members (
  project_id TEXT NOT NULL, user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead','contributor','viewer')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);
`;
```

- [ ] **Step 2: sqlite/adapter.ts** (Plan 11a SqliteAuthRepository 패턴 — Project/Task/Member CRUD + listByX 쿼리들)

본 step은 11a adapter.ts와 동일 구조. 메서드는 port.ts 12개 모두 구현. randomUUID로 ID 생성, ISO-8601 timestamp, throw on not-found.

- [ ] **Step 3: sqlite/adapter.test.ts** (TDD — 8건)
  - createProject + findProject round-trip
  - listProjectsByDepartment / listProjectsByOwner
  - createTask + parent-child 관계 + listSubtasks
  - addMember + listMembers + removeMember
  - listProjectsForUser
  - updateProject status 전이
  - updateTask assignee 변경
  - deleteProject (orphan task는 별도 — 본 plan은 cascade 없음, 호출자 책임)

- [ ] **Step 4: pg/schema.ts** — `pgSchema("sim").table("pm_projects", ...)`, `pm_tasks`, `pm_project_members`. SIM_PM_PG_DDL 동일.

- [ ] **Step 5: pg/adapter.ts** — 11a PgAuthRepository 패턴 (await + isNull 처리).

- [ ] **Step 6: pg/adapter.test.ts** — env gate `QA_TEST_PG=1`, 2건 (createProject + listProjectsByDepartment).

- [ ] **Step 7: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api test -- pm/sqlite pm/pg
```

Expected: sqlite 8 + pg 2 (또는 skip) PASS.

- [ ] **Step 8: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/pm/sqlite \
          simulations/enterprise-pm/services/pm-api/src/pm/pg && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): SQLite + PG schema + adapter (Project/Task/Member)

design.md §3 그대로. Drizzle dual-target.
PG 테이블명: sim.pm_* prefix (도메인 격리).
parent_task_id로 sub-task 트리 + listSubtasks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pm-api factory + port-contract

**Files:**
- Create: `src/pm/factory.ts` + `factory.test.ts`
- Create: `src/pm/port-contract.test.ts`

Plan 11a Task 7과 동일 패턴 — factory dynamic import, port-contract.test.ts에 `describe.each([sqlite, pg])`로 동일 시나리오 (createProject + addMember + listProjectsForUser + parent/child task 4건). PG는 env gate.

- [ ] **Step 1~4**: 11a Task 7 step 그대로 — pm 도메인용으로 변경.

- [ ] **Step 5: 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_TEST_PG=1 QA_PG_HOST=localhost QA_PG_PORT=5434 QA_PG_DATABASE=qa_sdk_test \
  pnpm --filter @qa-sdk/sim-pm-api test -- factory port-contract
```

Expected: factory 2 + contract (4 × 2) = 10 PASS.

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/pm/factory.ts \
          simulations/enterprise-pm/services/pm-api/src/pm/factory.test.ts \
          simulations/enterprise-pm/services/pm-api/src/pm/port-contract.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): factory + port-contract (dual-target equivalence)

Plan 05c/11a 패턴. SQLite + PG 동일 4 시나리오.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: pm-api NestJS 모듈 — Project/Task/Member

Plan 11a Task 8 패턴 그대로 — `pm-db.module.ts` (`PM_REPOSITORY` provider) + 3 도메인 모듈 (project/task/member).

**컨트롤러 라우트**:
- `ProjectController`:
  - `POST /projects` — create
  - `GET /projects/:id` — find
  - `GET /projects?departmentId=X` — listByDepartment
  - `GET /projects?ownerId=X` — listByOwner
  - `PUT /projects/:id` — update
  - `DELETE /projects/:id`
- `TaskController`:
  - `POST /tasks` — create
  - `GET /tasks/:id`
  - `GET /tasks?projectId=X` — listByProject
  - `GET /tasks/:id/subtasks` — listSubtasks
  - `PUT /tasks/:id`
  - `DELETE /tasks/:id`
- `MemberController`:
  - `POST /members` — addMember
  - `DELETE /members?projectId=X&userId=Y`
  - `GET /projects/:projectId/members`
  - `GET /users/:userId/projects`

각 service는 2~3 단위 테스트 (create + 핵심 query).

- [ ] **Step 1: pm-db.module.ts** (11a auth-db.module 그대로 — `PM_REPOSITORY` symbol + AuthDbModule.forRoot 패턴)

- [ ] **Step 2: 3 도메인 모듈 작성** — 각 4 파일 (module/service/service.test/controller).

- [ ] **Step 3: typecheck + 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-pm-api typecheck && \
  pnpm --filter @qa-sdk/sim-pm-api test
```

Expected: typecheck 0, 전체 테스트 SQLite-only 30+ PASS.

- [ ] **Step 4: app.module.ts에 imports 추가**

```ts
import { PmDbModule } from "./pm/pm-db.module.js";
import { ProjectModule } from "./pm/project/project.module.js";
import { TaskModule } from "./pm/task/task.module.js";
import { MemberModule } from "./pm/member/member.module.js";

@Module({
  imports: [
    HealthModule,
    PmDbModule.forRoot(),
    ProjectModule, TaskModule, MemberModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: e2e 부팅 + REST 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-pm-test.sqlite \
  pnpm --filter @qa-sdk/sim-pm-api start &
PID=$!
sleep 3
echo "create project:"; curl -fsS -X POST http://localhost:4500/projects \
  -H "content-type: application/json" \
  -d '{"name":"E2E","ownerId":"u-1","departmentId":"d-1","status":"active"}'
echo
kill $PID 2>/dev/null || true
rm -f /tmp/sim-pm-test.sqlite
```

Expected: 201 + project JSON.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/pm-api/src/pm/pm-db.module.ts \
          simulations/enterprise-pm/services/pm-api/src/pm/project \
          simulations/enterprise-pm/services/pm-api/src/pm/task \
          simulations/enterprise-pm/services/pm-api/src/pm/member \
          simulations/enterprise-pm/services/pm-api/src/app.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-pm-api): NestJS 3 도메인 모듈 + app.module 부착

PmDbModule.forRoot() global. Project/Task/Member service + controller.
zod body 검증. e2e POST /projects 통과.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: approval-api package + types + state machine (TDD)

**Files:**
- Modify: `simulations/enterprise-pm/services/approval-api/package.json`
- Create: `src/approval/shared/{types.ts,errors.ts,port.ts,budget-state.ts,budget-state.test.ts}`

- [ ] **Step 1: package.json — Plan 11a 패턴 동일 (drizzle + db-bootstrap + peerDeps)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install
```

- [ ] **Step 2: shared/types.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

export type RequestStatus =
  | "draft" | "submitted" | "in_review"
  | "approved" | "rejected" | "revision_requested";

export type StepDecision = "approved" | "rejected" | "pending";

export interface BudgetRequest {
  id: string;
  projectId: string;
  amount: number;          // 원 단위
  requesterId: string;
  status: RequestStatus;
  currentStage: number;    // 1-based
  totalStages: number;     // determineStages(amount) 결과
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStep {
  requestId: string;
  stageNumber: number;
  approverId: string | null;  // 미할당 시 null
  decision: StepDecision;
  comment: string | null;
  decidedAt: string | null;
}

export interface ResourceRequest {
  id: string;
  projectId: string;
  requesterId: string;
  resourceType: string;       // "consultant" | "equipment" | "license" 등
  description: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimeOffRequest {
  id: string;
  requesterId: string;
  startDate: string;          // ISO date
  endDate: string;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseReport {
  id: string;
  requesterId: string;
  amount: number;
  category: string;
  description: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRequestCreate { projectId: string; amount: number; requesterId: string; }
export interface ResourceRequestCreate { projectId: string; requesterId: string; resourceType: string; description: string; }
export interface TimeOffRequestCreate { requesterId: string; startDate: string; endDate: string; reason: string; }
export interface ExpenseReportCreate { requesterId: string; amount: number; category: string; description: string; }
```

- [ ] **Step 3: shared/errors.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

export class RequestNotFoundError extends Error {
  constructor(public readonly id: string) { super(`Request not found: ${id}`); this.name = "RequestNotFoundError"; }
}
export class InvalidTransitionError extends Error {
  constructor(public readonly from: string, public readonly action: string) {
    super(`Invalid transition from ${from} via ${action}`); this.name = "InvalidTransitionError";
  }
}
export class StageMismatchError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`Stage mismatch: expected ${expected}, got ${actual}`); this.name = "StageMismatchError";
  }
}
```

- [ ] **Step 4: shared/budget-state.test.ts (test-first)**

```ts
import { describe, expect, it } from "vitest";
import {
  determineStages, transitionRequest, applyDecision,
  type BudgetRequestDraft,
} from "./budget-state.js";

describe("determineStages — design.md §3", () => {
  it("amount < 1,000,000 → 1 stage", () => {
    expect(determineStages(999_999)).toBe(1);
    expect(determineStages(1)).toBe(1);
  });
  it("1M ≤ amount < 10M → 2 stages", () => {
    expect(determineStages(1_000_000)).toBe(2);
    expect(determineStages(9_999_999)).toBe(2);
  });
  it("amount ≥ 10M → 3 stages", () => {
    expect(determineStages(10_000_000)).toBe(3);
    expect(determineStages(100_000_000)).toBe(3);
  });
  it("음수/0 → 1 stage (방어)", () => {
    expect(determineStages(0)).toBe(1);
    expect(determineStages(-1)).toBe(1);
  });
});

describe("transitionRequest — 상태 전이", () => {
  const draft = (status: string): BudgetRequestDraft => ({ status: status as any, currentStage: 1, totalStages: 2 });

  it("draft → submit → submitted", () => {
    expect(transitionRequest(draft("draft"), "submit").status).toBe("submitted");
  });
  it("submitted → review → in_review", () => {
    expect(transitionRequest(draft("submitted"), "review").status).toBe("in_review");
  });
  it("revision_requested → submit → submitted (재제출)", () => {
    expect(transitionRequest(draft("revision_requested"), "submit").status).toBe("submitted");
  });
  it("approved 상태에서 submit → InvalidTransitionError", () => {
    expect(() => transitionRequest(draft("approved"), "submit")).toThrow("Invalid transition");
  });
});

describe("applyDecision — 단계 진행", () => {
  it("1단계만 + approve → 즉시 approved", () => {
    const r: BudgetRequestDraft = { status: "in_review", currentStage: 1, totalStages: 1 };
    const next = applyDecision(r, "approved");
    expect(next.status).toBe("approved");
    expect(next.currentStage).toBe(1);
  });
  it("2단계 첫 승인 → currentStage++ + 여전히 in_review", () => {
    const r: BudgetRequestDraft = { status: "in_review", currentStage: 1, totalStages: 2 };
    const next = applyDecision(r, "approved");
    expect(next.status).toBe("in_review");
    expect(next.currentStage).toBe(2);
  });
  it("3단계 마지막 승인 → approved", () => {
    const r: BudgetRequestDraft = { status: "in_review", currentStage: 3, totalStages: 3 };
    const next = applyDecision(r, "approved");
    expect(next.status).toBe("approved");
  });
  it("어느 단계든 reject → 즉시 rejected", () => {
    const r: BudgetRequestDraft = { status: "in_review", currentStage: 2, totalStages: 3 };
    const next = applyDecision(r, "rejected");
    expect(next.status).toBe("rejected");
  });
});
```

- [ ] **Step 5: shared/budget-state.ts (실제 구현)**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { InvalidTransitionError } from "./errors.js";
import type { RequestStatus } from "./types.js";

/** state machine 입력에 필요한 최소 형태. */
export interface BudgetRequestDraft {
  status: RequestStatus;
  currentStage: number;
  totalStages: number;
}

/**
 * design.md §3 — amount-based stage 결정.
 *
 *   amount < 1,000,000   → 1 stage  (manager)
 *   1M ≤ amount < 10M    → 2 stages (manager → director)
 *   amount ≥ 10M         → 3 stages (manager → director → cfo)
 *
 * 방어: 음수/0은 1 stage.
 */
export function determineStages(amount: number): number {
  if (amount < 1_000_000) return 1;
  if (amount < 10_000_000) return 2;
  return 3;
}

const TRANSITIONS: Record<RequestStatus, Record<string, RequestStatus>> = {
  draft:                { submit: "submitted" },
  submitted:            { review: "in_review", cancel: "draft" },
  in_review:            { approve: "approved", reject: "rejected", request_revision: "revision_requested" },
  revision_requested:   { submit: "submitted", cancel: "draft" },
  approved:             {},
  rejected:             {},
};

export function transitionRequest(
  cur: BudgetRequestDraft,
  action: string,
): BudgetRequestDraft {
  const next = TRANSITIONS[cur.status]?.[action];
  if (!next) throw new InvalidTransitionError(cur.status, action);
  return { ...cur, status: next };
}

/**
 * 단계 결정 적용.
 *
 * - decision="approved":
 *   - currentStage < totalStages → currentStage++ + 상태 유지(in_review)
 *   - currentStage === totalStages → status = "approved"
 * - decision="rejected" → 즉시 status = "rejected" (단계 무관)
 *
 * 호출자(BudgetService)는 요청 status가 in_review여야 함을 확인.
 */
export function applyDecision(
  cur: BudgetRequestDraft,
  decision: "approved" | "rejected",
): BudgetRequestDraft {
  if (decision === "rejected") {
    return { ...cur, status: "rejected" };
  }
  // approved
  if (cur.currentStage >= cur.totalStages) {
    return { ...cur, status: "approved" };
  }
  return { ...cur, currentStage: cur.currentStage + 1 };
}
```

- [ ] **Step 6: shared/port.ts**

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import type {
  BudgetRequest, BudgetRequestCreate, ApprovalStep,
  ResourceRequest, ResourceRequestCreate,
  TimeOffRequest, TimeOffRequestCreate,
  ExpenseReport, ExpenseReportCreate,
  RequestStatus, StepDecision,
} from "./types.js";

export interface ApprovalRepository {
  // BudgetRequest
  createBudgetRequest(args: BudgetRequestCreate): Promise<BudgetRequest>;
  findBudgetRequest(id: string): Promise<BudgetRequest | null>;
  listBudgetRequestsByProject(projectId: string): Promise<BudgetRequest[]>;
  listBudgetRequestsByRequester(requesterId: string): Promise<BudgetRequest[]>;
  updateBudgetRequestState(id: string, status: RequestStatus, currentStage: number): Promise<BudgetRequest>;

  // ApprovalStep
  createApprovalSteps(requestId: string, totalStages: number): Promise<ApprovalStep[]>;
  recordDecision(requestId: string, stageNumber: number, approverId: string, decision: StepDecision, comment?: string): Promise<ApprovalStep>;
  listSteps(requestId: string): Promise<ApprovalStep[]>;

  // ResourceRequest
  createResourceRequest(args: ResourceRequestCreate): Promise<ResourceRequest>;
  findResourceRequest(id: string): Promise<ResourceRequest | null>;
  updateResourceRequestStatus(id: string, status: RequestStatus): Promise<ResourceRequest>;

  // TimeOffRequest
  createTimeOffRequest(args: TimeOffRequestCreate): Promise<TimeOffRequest>;
  findTimeOffRequest(id: string): Promise<TimeOffRequest | null>;
  updateTimeOffRequestStatus(id: string, status: RequestStatus): Promise<TimeOffRequest>;

  // ExpenseReport
  createExpenseReport(args: ExpenseReportCreate): Promise<ExpenseReport>;
  findExpenseReport(id: string): Promise<ExpenseReport | null>;
  updateExpenseReportStatus(id: string, status: RequestStatus): Promise<ExpenseReport>;
}
```

- [ ] **Step 7: 테스트 + 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/sim-approval-api test -- budget-state
```

Expected: determineStages 4 + transitionRequest 4 + applyDecision 4 = 12 PASS.

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/package.json \
          simulations/enterprise-pm/services/approval-api/src/approval/shared \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): shared types + budget state machine

determineStages(amount) — 1M/10M 경계.
transitionRequest — draft→submitted→in_review→(approved|rejected|revision).
applyDecision — currentStage++ 또는 final status. 순수 함수.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: approval-api sqlite + pg adapter (TDD)

**Files:**
- Create: `src/approval/sqlite/{schema.ts,adapter.ts,adapter.test.ts}`
- Create: `src/approval/pg/{schema.ts,adapter.ts,adapter.test.ts}`

5 entity (BudgetRequest, ApprovalStep, ResourceRequest, TimeOffRequest, ExpenseReport) — 모두 본 task에서 schema/adapter/test 부착.

- [ ] **Step 1: sqlite/schema.ts** (5 테이블)

```ts
// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export const budgetRequests = sqliteTable("budget_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  amount: real("amount").notNull(),
  requesterId: text("requester_id").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  currentStage: integer("current_stage").notNull(),
  totalStages: integer("total_stages").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_br_proj").on(t.projectId),
  index("idx_br_req").on(t.requesterId),
]);

export const approvalSteps = sqliteTable("approval_steps", {
  requestId: text("request_id").notNull(),
  stageNumber: integer("stage_number").notNull(),
  approverId: text("approver_id"),
  decision: text("decision", { enum: ["approved", "rejected", "pending"] }).notNull(),
  comment: text("comment"),
  decidedAt: text("decided_at"),
}, (t) => [
  primaryKey({ columns: [t.requestId, t.stageNumber] }),
]);

export const resourceRequests = sqliteTable("resource_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  requesterId: text("requester_id").notNull(),
  resourceType: text("resource_type").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const timeOffRequests = sqliteTable("time_off_requests", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const expenseReports = sqliteTable("expense_reports", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const SIM_APPROVAL_SQLITE_DDL = `
-- BudgetRequest
CREATE TABLE IF NOT EXISTS budget_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, amount REAL NOT NULL,
  requester_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  current_stage INTEGER NOT NULL, total_stages INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_br_proj ON budget_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_br_req ON budget_requests(requester_id);

-- ApprovalStep
CREATE TABLE IF NOT EXISTS approval_steps (
  request_id TEXT NOT NULL, stage_number INTEGER NOT NULL,
  approver_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','pending')),
  comment TEXT, decided_at TEXT,
  PRIMARY KEY (request_id, stage_number)
);

-- ResourceRequest
CREATE TABLE IF NOT EXISTS resource_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requester_id TEXT NOT NULL,
  resource_type TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- TimeOffRequest
CREATE TABLE IF NOT EXISTS time_off_requests (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- ExpenseReport
CREATE TABLE IF NOT EXISTS expense_reports (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  amount REAL NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
`;
```

- [ ] **Step 2: sqlite/adapter.ts** (Plan 11a 패턴)

핵심 메서드:
- `createBudgetRequest`: `determineStages(amount)`로 totalStages 계산 + status="draft" + currentStage=1 + insert + `createApprovalSteps(id, totalStages)` 호출 (모든 stage를 decision="pending"으로 미리 row 생성).
- `recordDecision`: ApprovalStep row update + decidedAt=now.
- `updateBudgetRequestState`: status + currentStage 갱신 + updatedAt.
- 나머지 entity의 CRUD + status 갱신.

- [ ] **Step 3: sqlite/adapter.test.ts** (TDD — 12건)
  - createBudgetRequest amount=500_000 → totalStages=1, currentStage=1, status="draft"
  - createBudgetRequest amount=5_000_000 → totalStages=2
  - createBudgetRequest amount=20_000_000 → totalStages=3
  - createApprovalSteps — totalStages 만큼 pending row
  - recordDecision — approver_id + decision 갱신
  - updateBudgetRequestState — status + currentStage
  - listBudgetRequestsByProject / Requester
  - createResourceRequest + updateResourceRequestStatus
  - createTimeOffRequest + status 변경
  - createExpenseReport + status 변경
  - findBudgetRequest non-existent → null
  - listSteps 정렬 (stage_number asc)

- [ ] **Step 4: pg/schema.ts + adapter.ts + adapter.test.ts** — `pgSchema("sim").table("approval_budget_requests", ...)`, `approval_steps` 등. PG adapter 2건 (createBudgetRequest amount-based stage + recordDecision).

- [ ] **Step 5: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api test -- approval/sqlite approval/pg
```

Expected: sqlite 12 + pg 2 (env gate) PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/sqlite \
          simulations/enterprise-pm/services/approval-api/src/approval/pg && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): SQLite + PG schema + adapter (5 entity)

createBudgetRequest가 determineStages(amount)로 totalStages 계산 +
ApprovalStep을 totalStages 만큼 pending으로 미리 생성.
PG 테이블명: sim.approval_* prefix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: approval-api factory + port-contract

Plan 11a Task 7 / Plan 11b Task 3와 동일 패턴 — factory.ts (dynamic import) + factory.test.ts (2건) + port-contract.test.ts (양쪽 동일 4건: amount-based stage 결정, recordDecision flow, ResourceRequest 생성, ExpenseReport 생성).

- [ ] **Step 1~3**: 11a/11b 패턴 그대로.

- [ ] **Step 4: 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_TEST_PG=1 QA_PG_HOST=localhost QA_PG_PORT=5434 QA_PG_DATABASE=qa_sdk_test \
  pnpm --filter @qa-sdk/sim-approval-api test -- factory port-contract
```

Expected: factory 2 + contract (4 × 2) = 10 PASS.

- [ ] **Step 5: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/factory.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/factory.test.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/port-contract.test.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): factory + port-contract (dual-target equivalence)

amount-based stage 결정과 recordDecision이 양쪽 dialect 동등.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: approval-api NestJS 4 모듈 (Budget/Resource/TimeOff/Expense)

Plan 11a Task 8 패턴 — `approval-db.module.ts` + 4 도메인 모듈.

**BudgetService 핵심 메서드** (state machine 통합):

```ts
@Injectable()
export class BudgetService {
  constructor(@Inject(APPROVAL_REPOSITORY) private readonly repo: ApprovalRepository) {}

  async submit(id: string): Promise<BudgetRequest> {
    const cur = await this.repo.findBudgetRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    const next = transitionRequest(
      { status: cur.status, currentStage: cur.currentStage, totalStages: cur.totalStages },
      "submit",
    );
    return this.repo.updateBudgetRequestState(id, next.status, next.currentStage);
  }

  async startReview(id: string): Promise<BudgetRequest> { ... transitionRequest(..., "review") }

  async decide(id: string, approverId: string, decision: "approved" | "rejected", comment?: string) {
    const cur = await this.repo.findBudgetRequest(id);
    if (!cur) throw new RequestNotFoundError(id);
    if (cur.status !== "in_review") throw new InvalidTransitionError(cur.status, "decide");

    // 1. step 기록
    await this.repo.recordDecision(id, cur.currentStage, approverId, decision, comment);

    // 2. 다음 상태 계산
    const next = applyDecision(
      { status: cur.status, currentStage: cur.currentStage, totalStages: cur.totalStages },
      decision,
    );
    return this.repo.updateBudgetRequestState(id, next.status, next.currentStage);
  }
}
```

**컨트롤러 라우트**:
- `BudgetController`:
  - `POST /budgets` — create (amount-based stage 자동)
  - `GET /budgets/:id` + `GET /budgets/:id/steps`
  - `POST /budgets/:id/submit`
  - `POST /budgets/:id/start-review`
  - `POST /budgets/:id/decisions` (body: approverId, decision, comment)
- 기타 3 모듈: 단순 CRUD + status 변경 endpoint.

- [ ] **Step 1: approval-db.module.ts** (Plan 11a auth-db.module 패턴, `APPROVAL_REPOSITORY` symbol)

- [ ] **Step 2: 4 도메인 모듈 작성**

각 4 파일. budget service는 transitionRequest + applyDecision 호출 핵심 — 단위 테스트 4건 (create amount=500K → totalStages=1; submit → submitted; decide approved 1단계 → approved; decide rejected → rejected).

- [ ] **Step 3: typecheck + 전체 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/sim-approval-api typecheck && \
  pnpm --filter @qa-sdk/sim-approval-api test
```

Expected: typecheck 0, 전체 SQLite-only 40+ PASS.

- [ ] **Step 4: app.module.ts 부착**

```ts
import { ApprovalDbModule } from "./approval/approval-db.module.js";
import { BudgetModule } from "./approval/budget/budget.module.js";
import { ResourceModule } from "./approval/resource/resource.module.js";
import { TimeOffModule } from "./approval/timeoff/timeoff.module.js";
import { ExpenseModule } from "./approval/expense/expense.module.js";

@Module({
  imports: [
    HealthModule,
    ApprovalDbModule.forRoot(),
    BudgetModule, ResourceModule, TimeOffModule, ExpenseModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 5: e2e 부팅 + budget flow 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/sim-approval-test.sqlite \
  pnpm --filter @qa-sdk/sim-approval-api start &
PID=$!
sleep 3

echo "create 5M budget (totalStages=2):"
B=$(curl -fsS -X POST http://localhost:4600/budgets \
  -H "content-type: application/json" \
  -d '{"projectId":"p-1","amount":5000000,"requesterId":"u-1"}')
echo "$B"
BID=$(echo "$B" | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)

echo "submit:"; curl -fsS -X POST http://localhost:4600/budgets/$BID/submit
echo
echo "start-review:"; curl -fsS -X POST http://localhost:4600/budgets/$BID/start-review
echo
echo "decide 1단계 approved:"; curl -fsS -X POST http://localhost:4600/budgets/$BID/decisions \
  -H "content-type: application/json" \
  -d '{"approverId":"mgr-1","decision":"approved"}'
echo
echo "decide 2단계 approved → final approved:"; curl -fsS -X POST http://localhost:4600/budgets/$BID/decisions \
  -H "content-type: application/json" \
  -d '{"approverId":"dir-1","decision":"approved"}'

kill $PID 2>/dev/null || true
rm -f /tmp/sim-approval-test.sqlite
```

Expected: 마지막 응답에 `status: "approved"`, `currentStage: 2`.

- [ ] **Step 6: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/services/approval-api/src/approval/approval-db.module.ts \
          simulations/enterprise-pm/services/approval-api/src/approval/budget \
          simulations/enterprise-pm/services/approval-api/src/approval/resource \
          simulations/enterprise-pm/services/approval-api/src/approval/timeoff \
          simulations/enterprise-pm/services/approval-api/src/approval/expense \
          simulations/enterprise-pm/services/approval-api/src/app.module.ts && \
  git commit -m "$(cat <<'EOF'
feat(sim-approval-api): NestJS 4 도메인 모듈 + budget state flow e2e

BudgetService.decide가 transitionRequest + applyDecision + recordDecision 결합.
amount=5M → 2단계 → 두 번째 approve 시 final approved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: drizzle config + migration (per-service)

Plan 11a Task 11 패턴을 pm-api와 approval-api 양쪽에 동일 적용.

- [ ] **Step 1: pm-api에 drizzle.sqlite/pg.config + 0001_init 4개**
- [ ] **Step 2: approval-api에 drizzle.sqlite/pg.config + 0001_init 4개**
- [ ] **Step 3: package.json scripts (`db:gen:sqlite`, `db:gen:pg`) 양쪽 추가**
- [ ] **Step 4: 커밋**

---

## Task 10: 회귀

- [ ] **Step 1: 9 시뮬 서비스 typecheck**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter "@qa-sdk/sim-*" typecheck 2>&1 | tail -10
```

Expected: 모두 0 error.

- [ ] **Step 2: workflow-smoke + def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli test 2>&1 | tail -3 && \
  node packages/cli/dist/index.js def validate 2>&1 | head -3
```

Expected: smoke PASS, def errors 0.

- [ ] **Step 3: 11a (auth) + 11b (pm + approval) 통합 부팅**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for svc in sim-auth-api sim-pm-api sim-approval-api; do
    QA_DB_DIALECT=sqlite QA_SQLITE_PATH=/tmp/${svc}.sqlite \
    pnpm --filter @qa-sdk/$svc start &
  done
sleep 5
for port in 4400 4500 4600; do
  echo "port $port:"; curl -fsS http://localhost:$port/health
  echo
done
pkill -f "node dist/main.js" || true
rm -f /tmp/sim-*.sqlite
```

Expected: 3 /health 200.

---

## Self-Review

- [ ] dual-target SSOT 패턴 (Plan 11a 복제) — pm + approval 양쪽 적용
- [ ] BudgetRequest state machine은 순수 함수 (DB 의존 없음)
- [ ] determineStages(amount) — 1M/10M 경계 design.md §3과 정확히 일치
- [ ] applyDecision — currentStage 진행 + final status
- [ ] BudgetService.decide가 transitionRequest + applyDecision + recordDecision 결합
- [ ] PG 테이블명: `sim.pm_*`, `sim.approval_*` (도메인 격리)
- [ ] ApprovalStep PRIMARY KEY (request_id, stage_number) — 단계당 1 row
- [ ] e2e: 5M budget 2단계 승인 → final approved 통과
- [ ] 9 시뮬 서비스 모두 typecheck 0
- [ ] console.log 0건

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| ApprovalStep approverId 자동 할당 (role-based) | auth 통합 필요 | Plan 12a |
| BudgetRequest cross-department 검증 | gateway/auth bitmap 통합 | Plan 12a |
| Resource/TimeOff/Expense state machine | BudgetRequest와 동일하게 transitionRequest 적용 가능 — 본 plan은 단순 status enum만 | Plan 13c (시나리오 6) |
| nested audit tracing 통합 | audit-recorder-store 연동 | Plan 12c |
| RLS 정책 (sim.pm_*, sim.approval_*) | Phase 3 §3 RLS plan | Phase 3 |
| seed 데이터 (sample projects + budgets) | seed runner는 09d, 도메인 데이터는 시나리오 작성과 함께 | Plan 13a |

---

## 의존·후속

- **Plan 10a** (pm/approval 부팅): 본 plan의 직접 전제.
- **Plan 11a** (auth dual-target 패턴): 본 plan이 패턴 그대로 복제.
- **Plan 04c** (db-bootstrap): `createConnection` + `dbEnvSchema` + `createPgTestFixture` 사용.
- **Plan 09b** (init.sql sim schema): PG adapter 동작 전제.
- **Plan 11c** (지원 도메인): 본 plan과 직렬 — 동일 패턴 복제.
- **Plan 12a** (gateway 라우팅): pm-api / approval-api 라우트 reverse proxy.
- **Plan 12c** (audit 연동): BudgetService.decide의 nested tree 영속.
- **Plan 13b/c** (시나리오 3, 4, 5): 본 plan의 budget flow를 e2e.
