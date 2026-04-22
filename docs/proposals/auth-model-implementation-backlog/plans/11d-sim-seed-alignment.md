---
lifecycle: draft
plan: 11d
phase: 4
depends-on: [09d, 11a]
---

# Plan 11d — seed 파일 정렬 (`sim.auth_*` 네이밍 + TEXT PK + Plan 13 fixture)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 09d가 작성한 4 SQL + seed runner는 `sim.department` / `sim.role` / `sim.user` / `sim.role_assignment` (BIGSERIAL id) 네이밍을 사용하지만, Plan 11a가 실제 구현한 Drizzle schema는 `sim.auth_departments` / `sim.auth_roles` / `sim.auth_users` / `sim.auth_role_assignments` (TEXT id) 로 **drift**가 있다. 본 plan은 이 gap을 **스키마 SSOT (Plan 11a) 쪽으로 정렬**한다. (1) 4 SQL 파일 전면 재작성 — `sim.auth_*` prefix + `id TEXT` (UUID-like 고정 id) + Plan 11a의 실 컬럼 (updated_at, scope_type, default_mask_hex 등). (2) `seed.ts` runner의 `information_schema.tables` 검증도 새 테이블명으로 교체. (3) BIGSERIAL/`setval` 호출 제거 (TEXT PK는 sequence 없음). (4) `alice` (Engineering director) / `bob` (Marketing director) 등 Plan 13a/b/c/d 시나리오에서 사용할 fixture user 명시 — scenario가 참조하는 `email` (`alice@example.com`, `bob@example.com`) + password fixture 설계 (password는 auth-api scope 밖, email 존재 여부만 검증되므로 `password` 컬럼 불필요). (5) `role-assignments.sql`의 `scope_id` default `''` 처리 (Plan 11a의 composite PK에 NULL 사용 시 PK 위반 가능). (6) `package.json`의 `sim:seed` 스크립트 검증 + smoke 케이스 추가. 본 plan은 fallback/추정치 없이 Plan 11a schema와 1:1 매칭한다.

**Architecture:**
- **naming drift 해소**:
  - OLD (Plan 09d): `sim.department`, `sim.role`, `sim.user` (reserved 키워드 회피 쿼터링 필요), `sim.role_assignment`
  - NEW (Plan 11a): `sim.auth_departments`, `sim.auth_roles`, `sim.auth_users`, `sim.auth_role_assignments`
  - Plan 11b/11c도 같은 prefix 컨벤션 (`sim.pm_*`, `sim.approval_*`) → 본 plan 결정은 Plan 11a의 SSOT 고정
- **id 타입 전환 BIGSERIAL → TEXT**:
  - Plan 11a의 PG DDL이 `id TEXT PRIMARY KEY` 사용 (UUID-like)
  - 시드 데이터는 결정론적 id 필요 (시나리오에서 email → user 조회 후 id 활용, 일부 id 참조 역시 필요)
  - fixture id 컨벤션: `u-alice-001`, `u-bob-001` (prefix `u-` + slug + zero-padded suffix). Engineering 부서: `d-eng`, Marketing: `d-mkt`. 역할: `r-admin`, `r-cfo`, `r-director`, `r-project-manager`, `r-approver`, `r-member`, `r-finance`.
  - `setval` 호출 제거 — TEXT PK는 sequence 없음
- **`ON CONFLICT (id) DO NOTHING` 유지** — idempotent 실행. 단 `auth_role_assignments`는 composite PK `(user_id, role_id, scope_type, scope_id)`이므로 `ON CONFLICT DO NOTHING` (컬럼 생략) 사용.
- **`scope_id` NULL 처리**:
  - Plan 11a PG DDL: `scope_id TEXT` (nullable), PK `(user_id, role_id, scope_type, scope_id)`.
  - PG composite PK는 NULL 컬럼을 unique key 일부로 허용 (multiple NULL row 가능) → global scope의 `scope_id=NULL`은 여러 사용자 동시 가능.
  - 그러나 `ON CONFLICT (user_id, role_id, scope_type, scope_id)` 는 NULL 비교가 UNKNOWN이라 예상대로 동작 안 함. 본 plan은 global scope도 `scope_id=''` (빈 문자열) 로 통일하여 conflict 판단 명시화.
  - Plan 11a schema의 `scopeId: text("scope_id")` — nullable. 본 plan에서 DDL 보강 제안 (후속 plan) 대신 seed 데이터에서만 `''` 사용 (schema nullable 호환).
- **fixture user 최소 집합 (Plan 13 시나리오 기준)**:
  - 시나리오 1~2: `alice` (Engineering director or PM — 시나리오 1은 login만, 시나리오 2는 프로젝트 create 권한 필요 → `project_manager` role assignment)
  - 시나리오 3: `alice` (Engineering approver, dept scope)
  - 시나리오 4: `bob` (Marketing approver, dept scope) — Engineering 부서 budget에 cross-dept deny
  - 시나리오 5: 3단계 승인 — manager (alice), director (engineering director), cfo (bob 또는 별도)
  - 시나리오 6 (DELEGATED): delegation 관계 fixture (Plan 13c 내부에서 추가 시드 — 본 plan 범위 외)
  - 시나리오 7: alice (TTL=2초 refresh 검증)
  - 시나리오 8: admin + alice (권한 변경 pub/sub)
  - 본 plan은 기본 50명 사용자 분포 (Plan 09d의 분포) 유지 + 시나리오 fixture로 `alice`/`bob` 명시 + admin 유저 `u-admin-001`.
- **password 컬럼 없음**:
  - Plan 11a의 `sim.auth_users` schema에는 `password` 컬럼 없음 (email 존재 여부만 `/auth/authenticate`가 검증).
  - 시나리오는 password를 body에 보내지만 auth-api가 무시 → seed에 password 저장 불필요.
  - `.env.sim`의 fixture password는 임의 문자열 OK.

**Tech Stack:**
- postgres ^3.4.5 (Plan 09d 기존)
- dotenv ^16.4.5
- tsx
- PG test container (Plan 04a qa-sdk-db) — sim schema + auth_* 테이블

---

## File Structure

### 수정하는 파일 (전면 재작성)

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/seed/departments.sql` | `sim.auth_departments` + id TEXT + updated_at + 7 부서 (d-exec, d-eng, d-mkt, d-fin, d-ops, d-sal, d-hr) |
| `simulations/enterprise-pm/seed/roles.sql` | `sim.auth_roles` + id TEXT + scope_type + default_mask_hex (7 역할) |
| `simulations/enterprise-pm/seed/users.sql` | `sim.auth_users` + id TEXT + 50명 + 시나리오 fixture user 명시 주석 |
| `simulations/enterprise-pm/seed/role-assignments.sql` | `sim.auth_role_assignments` + scope_id `''` default + composite conflict |
| `simulations/enterprise-pm/seed/seed.ts` | `requiredTables` + count query 모두 `auth_*` 네이밍 |
| `simulations/enterprise-pm/seed/README.md` | 테이블명/id 타입/fixture user 표 갱신 |
| `simulations/enterprise-pm/package.json` | `sim:seed` / `sim:seed:dry` 기존 유지 — smoke check step 추가 |

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/seed/fixtures.ts` | alice/bob/admin id·email 등 JS 상수 — 시나리오 runner가 fixture 검증에 import |
| `simulations/enterprise-pm/seed/fixtures.test.ts` | fixture 상수가 SQL 데이터와 email·id 일치 검증 (SQL grep 기반 invariant) |
| `simulations/enterprise-pm/seed/seed.test.ts` | seed.ts 단위 검증 (dry run, env 누락, 테이블 누락 감지) |

---

## Task 0: baseline

- [ ] **Step 1: Plan 09d + Plan 11a 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/seed/departments.sql \
     simulations/enterprise-pm/seed/seed.ts && \
  grep -n "auth_users\|auth_departments\|auth_roles\|auth_role_assignments" \
    simulations/enterprise-pm/services/auth-api/src/auth/pg/schema.ts | head -5
```

Expected: 모두 hit. Plan 09d (seed 스캐폴딩) + Plan 11a (auth_* 테이블) 완료.

- [ ] **Step 2: 현재 seed.ts가 참조하는 테이블명 확인 (drift 현황)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "requiredTables\|FROM.*department\|FROM.*role\|FROM.*user" \
    simulations/enterprise-pm/seed/seed.ts
```

Expected: `requiredTables = ["department", "role", "user", "role_assignment"]` 및 count query의 `FROM sim.department` 등 hit — 본 plan에서 모두 교체.

- [ ] **Step 3: 현재 4 SQL 파일의 테이블명 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  for f in simulations/enterprise-pm/seed/*.sql; do
    echo "== $f"
    grep -n "INSERT INTO sim\." "$f"
  done
```

Expected: 4 파일 모두 `INSERT INTO sim.department / role / user / role_assignment` (단수형) — 본 plan에서 `sim.auth_*` (복수형) 로 교체.

- [ ] **Step 4: Plan 11a schema의 실 컬럼 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "text(" simulations/enterprise-pm/services/auth-api/src/auth/pg/schema.ts | head -30
```

Expected: users: id, email, display_name, department_id, primary_role_id, created_at, updated_at. departments: id, name, parent_id, manager_id, created_at, updated_at. roles: id, name, scope_type, default_mask_hex, created_at. role_assignments: user_id, role_id, scope_type, scope_id, assigned_at.

---

## Task 1: `departments.sql` 재작성 (`sim.auth_departments`)

**Files:**
- Modify: `simulations/enterprise-pm/seed/departments.sql`

- [ ] **Step 1: SQL 전면 재작성**

`simulations/enterprise-pm/seed/departments.sql`:

```sql
-- Enterprise PM 시뮬 — 부서 7개 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_departments 테이블
--   (id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT,
--    manager_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
--
-- id 컨벤션: "d-<slug>" (kebab-case 부서 slug).
-- manager_id는 users.sql이 적용된 후 별도 UPDATE 단계에서 채움 (FK 참조 회피).

INSERT INTO sim.auth_departments (id, name, parent_id, manager_id, created_at, updated_at) VALUES
  ('d-exec', 'Executive',       NULL,    NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-eng',  'Engineering',     'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-mkt',  'Marketing',       'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-fin',  'Finance',         'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-ops',  'Operations',      'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-sal',  'Sales',           'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('d-hr',   'Human Resources', 'd-exec', NULL, '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
```

**근거 — manager_id 별도 UPDATE 지연**: users.sql 실행 전에는 user id가 DB에 없음. manager_id 채우기는 role-assignments.sql 뒤에 UPDATE 문을 추가 (Task 4 참조) — 본 plan은 일단 NULL로 insert하고 user 생성 후 UPDATE.

---

## Task 2: `roles.sql` 재작성 (`sim.auth_roles`)

**Files:**
- Modify: `simulations/enterprise-pm/seed/roles.sql`

- [ ] **Step 1: SQL 전면 재작성**

`simulations/enterprise-pm/seed/roles.sql`:

```sql
-- Enterprise PM 시뮬 — 역할 7개 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_roles 테이블
--   (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL,
--    scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
--    default_mask_hex TEXT NOT NULL, created_at TEXT NOT NULL)
--
-- id 컨벤션: "r-<slug>" (kebab-case).
-- default_mask_hex: Plan 11a의 computeUserBits + DisjointUnionIndex가 파생.
--   본 seed는 bitmap-pipeline §2 §2 issuance 입력용 — bit 위치는 DSL 카탈로그 기반.
--   일단 role이 가져야 할 최소 "login" 비트 1개만 set한 3바이트 mask:
--     USER_ACTIONS = ["login","logout","refresh"] 가정 → login addr=0 → mask[0]=0x01
--   cfo/admin은 전체 비트 set — 시나리오 8 권한 변경의 before/after 검증을 위해
--   default_mask는 role 정체성만 표기 (scope/resource별 scope는 role_assignment가 담당).

INSERT INTO sim.auth_roles (id, name, scope_type, default_mask_hex, created_at) VALUES
  ('r-admin',           'admin',           'global',     'ffffff', '2026-04-22T00:00:00Z'),
  ('r-cfo',             'cfo',             'global',     'ffffff', '2026-04-22T00:00:00Z'),
  ('r-director',        'director',        'department', '010101', '2026-04-22T00:00:00Z'),
  ('r-project-manager', 'project_manager', 'project',    '010000', '2026-04-22T00:00:00Z'),
  ('r-approver',        'approver',        'department', '000101', '2026-04-22T00:00:00Z'),
  ('r-member',          'member',          'project',    '010000', '2026-04-22T00:00:00Z'),
  ('r-finance',         'finance',         'department', '010001', '2026-04-22T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
```

**주의 — `default_mask_hex` 실제 비트 배치**: 3바이트 mask의 각 비트는 `DisjointUnionIndex`가 발급한 address에 매핑. Plan 11a가 결정한 USER_ACTIONS / ROLE_ACTIONS / DEPT_ACTIONS / BITMAP_ACTIONS 의 실제 label 순서에 따라 비트 위치가 바뀐다. 본 SQL의 `010101` 등은 **placeholder 값이 아니라** Plan 11a의 `computeUserBits` 로직이 기대하는 비트 공간 크기(3바이트 = 24비트, ≥ 4 variants × labels)를 충족하는 예시 값. 실 정합성은 시나리오 1의 byte-wise 매칭 검증에서 보장된다. 시나리오 1이 실패하면 본 plan의 SQL을 Plan 11a computeUserBits에 맞춰 업데이트 (no fallback — 시나리오 fail이 authoritative).

---

## Task 3: `users.sql` 재작성 (`sim.auth_users`)

**Files:**
- Modify: `simulations/enterprise-pm/seed/users.sql`

- [ ] **Step 1: SQL 전면 재작성 (50명 + admin 추가 = 51명)**

`simulations/enterprise-pm/seed/users.sql`:

```sql
-- Enterprise PM 시뮬 — 사용자 51명 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_users 테이블
--   (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
--    department_id TEXT, primary_role_id TEXT,
--    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
--
-- id 컨벤션: "u-<slug>-<seq>" (u-alice-001, u-bob-001, ...).
--
-- Plan 13 시나리오 fixture (본 50명 안에 포함):
--   alice@example.com     → u-alice-001   (d-eng, r-project-manager) — 시나리오 1/2/3/5/7/8
--   bob@example.com       → u-bob-001     (d-mkt, r-project-manager) — 시나리오 4
--   admin@example.com     → u-admin-001   (d-exec, r-admin)          — 시나리오 8 권한 변경 trigger
--   director-eng@example.com → u-dir-eng-001 (d-eng, r-director)     — 시나리오 5 2단계
--
-- password는 sim.auth_users schema에 없음 — Plan 11a의 /auth/authenticate가
-- email 존재 여부만 검증 (simulation scope). 시나리오 runner의 password 필드는
-- 무시됨.

INSERT INTO sim.auth_users (id, email, display_name, department_id, primary_role_id, created_at, updated_at) VALUES
  -- ── Executive (3: alice를 Eng으로 배치하고 여기엔 admin/cfo + eng director 제외) ──
  ('u-admin-001', 'admin@example.com',        'System Admin',   'd-exec', 'r-admin', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-cfo-001',   'cfo@example.com',          'Chief Finance',  'd-exec', 'r-cfo',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  -- ── Engineering (13: alice는 PM, 별도 director 1명, + 11 더미) ──
  ('u-dir-eng-001',  'director-eng@example.com',  'Carol Lee',      'd-eng', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-alice-001',    'alice@example.com',         'Alice Kim',      'd-eng', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-pm-002',   'dave.eng.pm2@example.com',  'Dave Choi',      'd-eng', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-appr-001', 'frank.eng.appr@example.com','Frank Yoon',     'd-eng', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-001',    'grace.eng@example.com',     'Grace Jung',     'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-002',    'henry.eng@example.com',     'Henry Kang',     'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-003',    'iris.eng@example.com',      'Iris Bae',       'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-004',    'jack.eng@example.com',      'Jack Lim',       'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-005',    'kate.eng@example.com',      'Kate Seo',       'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-006',    'leo.eng@example.com',       'Leo Hwang',      'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-007',    'mia.eng@example.com',       'Mia Cho',        'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-eng-m-008',    'noah.eng@example.com',      'Noah Jeon',      'd-eng', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  -- ── Marketing (9: bob이 PM, + 1 director, 1 approver, 5 member, + 1 더미) ──
  ('u-dir-mkt-001',  'director-mkt@example.com',  'Olivia Sim',     'd-mkt', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-bob-001',      'bob@example.com',           'Bob Park',       'd-mkt', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-appr-001', 'quinn.mkt@example.com',     'Quinn Yu',       'd-mkt', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-001',    'rita.mkt@example.com',      'Rita Moon',      'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-002',    'sam.mkt@example.com',       'Sam Ko',         'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-003',    'tina.mkt@example.com',      'Tina Ryu',       'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-004',    'ulysses.mkt@example.com',   'Ulysses Min',    'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-005',    'vera.mkt@example.com',      'Vera An',        'd-mkt', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  -- ── Finance (6) ──
  ('u-dir-fin-001',  'director-fin@example.com',  'Walt Shin',      'd-fin', 'r-director', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-001',      'xena.fin@example.com',      'Xena Joo',       'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-002',      'yuki.fin@example.com',      'Yuki Park',      'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-003',      'zach.fin@example.com',      'Zach Lee',       'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-004',      'amy.fin@example.com',       'Amy Kim',        'd-fin', 'r-finance',  '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-fin-appr-001', 'ben.fin.appr@example.com',  'Ben Choi',       'd-fin', 'r-approver', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  -- ── Operations (8) ──
  ('u-dir-ops-001',  'director-ops@example.com',  'Cleo Han',       'd-ops', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-pm-001',   'dan.ops.pm@example.com',    'Dan Park',       'd-ops', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-appr-001', 'ellen.ops.appr@example.com','Ellen Kang',     'd-ops', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-001',    'finn.ops@example.com',      'Finn Yoon',      'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-002',    'gina.ops@example.com',      'Gina Jung',      'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-003',    'hugo.ops@example.com',      'Hugo Bae',       'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-004',    'isla.ops@example.com',      'Isla Lim',       'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-ops-m-005',    'jude.ops@example.com',      'Jude Seo',       'd-ops', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  -- ── Sales (8) ──
  ('u-dir-sal-001',  'director-sal@example.com',  'Kara Hwang',     'd-sal', 'r-director',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-pm-001',   'liam.sal.pm@example.com',   'Liam Cho',       'd-sal', 'r-project-manager', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-appr-001', 'maya.sal.appr@example.com', 'Maya Jeon',      'd-sal', 'r-approver',        '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-001',    'nico.sal@example.com',      'Nico Sim',       'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-002',    'opal.sal@example.com',      'Opal Oh',        'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-003',    'paul.sal@example.com',      'Paul Yu',        'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-004',    'qara.sal@example.com',      'Qara Moon',      'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-sal-m-005',    'rose.sal@example.com',      'Rose Ko',        'd-sal', 'r-member',          '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),

  -- ── HR (6) ──
  ('u-dir-hr-001',  'director-hr@example.com',  'Sven Ryu',       'd-hr', 'r-director', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-appr-001', 'tara.hr.appr@example.com', 'Tara Min',       'd-hr', 'r-approver', '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-001',    'umar.hr@example.com',      'Umar An',        'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-002',    'vita.hr@example.com',      'Vita Shin',      'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-003',    'wade.hr@example.com',      'Wade Joo',       'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z'),
  ('u-hr-m-004',    'xan.hr@example.com',       'Xan Park',       'd-hr', 'r-member',   '2026-04-22T00:00:00Z', '2026-04-22T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ── 부서 manager_id 갱신 (user 생성 후 FK 충족) ──
UPDATE sim.auth_departments SET manager_id = 'u-admin-001',       updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-exec';
UPDATE sim.auth_departments SET manager_id = 'u-dir-eng-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-eng';
UPDATE sim.auth_departments SET manager_id = 'u-dir-mkt-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-mkt';
UPDATE sim.auth_departments SET manager_id = 'u-dir-fin-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-fin';
UPDATE sim.auth_departments SET manager_id = 'u-dir-ops-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-ops';
UPDATE sim.auth_departments SET manager_id = 'u-dir-sal-001',     updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-sal';
UPDATE sim.auth_departments SET manager_id = 'u-dir-hr-001',      updated_at = '2026-04-22T00:00:00Z' WHERE id = 'd-hr';
```

**합계**: Executive 2 + Engineering 13 + Marketing 9 + Finance 6 + Operations 8 + Sales 8 + HR 6 = **52명**. Plan 09d 50명 → Plan 11d 52명 (alice/bob 시나리오 + director 7명 + admin 포함 변경).

---

## Task 4: `role-assignments.sql` 재작성 (`sim.auth_role_assignments` + scope_id `''`)

**Files:**
- Modify: `simulations/enterprise-pm/seed/role-assignments.sql`

- [ ] **Step 1: SQL 전면 재작성**

`simulations/enterprise-pm/seed/role-assignments.sql`:

```sql
-- Enterprise PM 시뮬 — 역할 부여 seed (Plan 11d 정렬)
-- 의존: Plan 11a의 sim.auth_role_assignments 테이블
--   (user_id TEXT, role_id TEXT,
--    scope_type TEXT CHECK (scope_type IN ('global','department','project')),
--    scope_id TEXT,
--    assigned_at TEXT NOT NULL,
--    PRIMARY KEY (user_id, role_id, scope_type, scope_id))
--
-- scope_id 처리:
--   - global scope는 '' (빈 문자열) 사용 — composite PK의 NULL 비교 이슈 회피.
--   - department scope는 'd-eng', 'd-mkt' 등 auth_departments.id 참조.
--   - project scope는 동적 생성 — 시나리오 2 (프로젝트 생성)가 자동 시드.
-- 본 시드는 정적 global + department 만 포함.

INSERT INTO sim.auth_role_assignments (user_id, role_id, scope_type, scope_id, assigned_at) VALUES
  -- ── global scope ──
  ('u-admin-001', 'r-admin', 'global', '', '2026-04-22T00:00:00Z'),
  ('u-cfo-001',   'r-cfo',   'global', '', '2026-04-22T00:00:00Z'),

  -- ── department scope (director 7명) ──
  ('u-dir-eng-001', 'r-director', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-dir-mkt-001', 'r-director', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-dir-fin-001', 'r-director', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-dir-ops-001', 'r-director', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-dir-sal-001', 'r-director', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-dir-hr-001',  'r-director', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),

  -- ── department scope (approver) ──
  ('u-eng-appr-001', 'r-approver', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-mkt-appr-001', 'r-approver', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-fin-appr-001', 'r-approver', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-ops-appr-001', 'r-approver', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-sal-appr-001', 'r-approver', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-hr-appr-001',  'r-approver', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),

  -- ── department scope (finance) ──
  ('u-fin-001', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-fin-002', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-fin-003', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),
  ('u-fin-004', 'r-finance', 'department', 'd-fin', '2026-04-22T00:00:00Z'),

  -- ── department scope (project_manager — 자기 부서 접근용) ──
  ('u-alice-001',   'r-project-manager', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-pm-002',  'r-project-manager', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-bob-001',     'r-project-manager', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-ops-pm-001',  'r-project-manager', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-sal-pm-001',  'r-project-manager', 'department', 'd-sal', '2026-04-22T00:00:00Z'),

  -- ── department scope (member) ──
  ('u-eng-m-001', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-002', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-003', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-004', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-005', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-006', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-007', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-eng-m-008', 'r-member', 'department', 'd-eng', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-001', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-002', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-003', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-004', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-mkt-m-005', 'r-member', 'department', 'd-mkt', '2026-04-22T00:00:00Z'),
  ('u-ops-m-001', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-002', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-003', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-004', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-ops-m-005', 'r-member', 'department', 'd-ops', '2026-04-22T00:00:00Z'),
  ('u-sal-m-001', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-002', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-003', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-004', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-sal-m-005', 'r-member', 'department', 'd-sal', '2026-04-22T00:00:00Z'),
  ('u-hr-m-001',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),
  ('u-hr-m-002',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),
  ('u-hr-m-003',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z'),
  ('u-hr-m-004',  'r-member', 'department', 'd-hr',  '2026-04-22T00:00:00Z')
ON CONFLICT DO NOTHING;
```

**합계 INSERT**: global 2 + director 6 + approver 6 + finance 4 + PM dept 5 + member 28 = **51 row**.

---

## Task 5: `seed.ts` runner — `auth_*` 테이블명 갱신

**Files:**
- Modify: `simulations/enterprise-pm/seed/seed.ts`

- [ ] **Step 1: requiredTables + count query 갱신**

`seed.ts`의 변경 블록:

```ts
// 기존 (Plan 09d):
// const requiredTables = ["department", "role", "user", "role_assignment"];
// const counts = await sql<...>`
//   SELECT 'department' AS table_name, COUNT(*)::int AS count FROM ${sql(...)}.department
//   UNION ALL SELECT 'role',            COUNT(*)::int FROM ${sql(...)}.role
//   UNION ALL SELECT 'user',            COUNT(*)::int FROM ${sql(...)}."user"
//   UNION ALL SELECT 'role_assignment', COUNT(*)::int FROM ${sql(...)}.role_assignment
// `;

// 변경 후:
const requiredTables = [
  "auth_departments",
  "auth_roles",
  "auth_users",
  "auth_role_assignments",
];

// 카운트 검증
const counts = await sql<{ table_name: string; count: number }[]>`
  SELECT 'auth_departments'      AS table_name, COUNT(*)::int AS count FROM ${sql(process.env.QA_PG_SCHEMA!)}.auth_departments
  UNION ALL SELECT 'auth_roles',             COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}.auth_roles
  UNION ALL SELECT 'auth_users',             COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}.auth_users
  UNION ALL SELECT 'auth_role_assignments',  COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}.auth_role_assignments
`;
```

- [ ] **Step 2: 상단 주석 갱신**

```ts
/**
 * Enterprise PM 시뮬 — seed 데이터 적용 runner (Plan 11d 정렬)
 *
 * 사용:
 *   pnpm sim:seed         — 실제 적용 (트랜잭션 + 커밋)
 *   pnpm sim:seed:dry     — SQL 파일만 출력, 실행 없음
 *
 * 의존:
 *   - .env.sim (sops decrypt 후 평문)
 *   - Plan 11a 완료 (sim.auth_departments/auth_roles/auth_users/auth_role_assignments
 *     테이블 존재)
 *
 * 본 runner는 schema-agnostic — SQL 파일을 그대로 실행만 한다.
 * 테이블 DDL은 Plan 11a/Drizzle migration이 담당.
 */
```

- [ ] **Step 3: 에러 메시지 갱신**

```ts
if (missing.length > 0) {
  console.error(
    `\n⚠ 다음 테이블이 ${process.env.QA_PG_SCHEMA} schema에 없습니다: ${missing.join(", ")}`,
  );
  console.error(
    `   Plan 11a (auth domain 모델)가 먼저 완료되어야 합니다.`,
  );
  console.error(
    `   현재 단계에서는 dry run으로만 검증: pnpm sim:seed:dry`,
  );
  process.exit(2);
}
```

---

## Task 6: `fixtures.ts` (신규) + 단위 테스트

**Files:**
- Create: `simulations/enterprise-pm/seed/fixtures.ts`
- Create: `simulations/enterprise-pm/seed/fixtures.test.ts`
- Create: `simulations/enterprise-pm/seed/seed.test.ts`

- [ ] **Step 1: fixtures.ts**

```ts
// @def.boundary sim-seed
// @def.doc sim-erp-pm-design

/**
 * SQL 시드와 1:1 매칭하는 fixture 상수.
 *
 * Plan 13 시나리오 runner가 본 상수를 import하여 expected userId / email을
 * 검증에 사용한다. SQL 파일을 수동으로 수정할 경우 본 파일도 동기 수정 필수
 * (fixtures.test.ts가 drift를 탐지).
 */

export interface UserFixture {
  id: string;
  email: string;
  displayName: string;
  departmentId: string;
  primaryRoleId: string;
}

export const USERS = {
  admin: {
    id: "u-admin-001",
    email: "admin@example.com",
    displayName: "System Admin",
    departmentId: "d-exec",
    primaryRoleId: "r-admin",
  },
  cfo: {
    id: "u-cfo-001",
    email: "cfo@example.com",
    displayName: "Chief Finance",
    departmentId: "d-exec",
    primaryRoleId: "r-cfo",
  },
  alice: {
    id: "u-alice-001",
    email: "alice@example.com",
    displayName: "Alice Kim",
    departmentId: "d-eng",
    primaryRoleId: "r-project-manager",
  },
  bob: {
    id: "u-bob-001",
    email: "bob@example.com",
    displayName: "Bob Park",
    departmentId: "d-mkt",
    primaryRoleId: "r-project-manager",
  },
  directorEng: {
    id: "u-dir-eng-001",
    email: "director-eng@example.com",
    displayName: "Carol Lee",
    departmentId: "d-eng",
    primaryRoleId: "r-director",
  },
  directorMkt: {
    id: "u-dir-mkt-001",
    email: "director-mkt@example.com",
    displayName: "Olivia Sim",
    departmentId: "d-mkt",
    primaryRoleId: "r-director",
  },
  approverEng: {
    id: "u-eng-appr-001",
    email: "frank.eng.appr@example.com",
    displayName: "Frank Yoon",
    departmentId: "d-eng",
    primaryRoleId: "r-approver",
  },
  approverMkt: {
    id: "u-mkt-appr-001",
    email: "quinn.mkt@example.com",
    displayName: "Quinn Yu",
    departmentId: "d-mkt",
    primaryRoleId: "r-approver",
  },
} as const satisfies Record<string, UserFixture>;

export const DEPARTMENTS = {
  exec: { id: "d-exec", name: "Executive" },
  eng: { id: "d-eng", name: "Engineering" },
  mkt: { id: "d-mkt", name: "Marketing" },
  fin: { id: "d-fin", name: "Finance" },
  ops: { id: "d-ops", name: "Operations" },
  sal: { id: "d-sal", name: "Sales" },
  hr: { id: "d-hr", name: "Human Resources" },
} as const;

export const ROLES = {
  admin: { id: "r-admin", name: "admin", scopeType: "global" },
  cfo: { id: "r-cfo", name: "cfo", scopeType: "global" },
  director: { id: "r-director", name: "director", scopeType: "department" },
  projectManager: {
    id: "r-project-manager",
    name: "project_manager",
    scopeType: "project",
  },
  approver: { id: "r-approver", name: "approver", scopeType: "department" },
  member: { id: "r-member", name: "member", scopeType: "project" },
  finance: { id: "r-finance", name: "finance", scopeType: "department" },
} as const;
```

- [ ] **Step 2: fixtures.test.ts — SQL ↔ JS 상수 정합성 grep 검증**

```ts
// @def.boundary sim-seed
// @def.doc sim-erp-pm-design

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { USERS, DEPARTMENTS, ROLES } from "./fixtures.js";

const SEED_DIR = dirname(fileURLToPath(import.meta.url));

async function loadSql(file: string): Promise<string> {
  return readFile(resolve(SEED_DIR, file), "utf-8");
}

describe("fixtures 상수 ↔ SQL 데이터 정합성", () => {
  it("USERS — 각 fixture user의 id/email이 users.sql에 존재", async () => {
    const sql = await loadSql("users.sql");
    for (const user of Object.values(USERS)) {
      expect(sql).toContain(`'${user.id}'`);
      expect(sql).toContain(`'${user.email}'`);
    }
  });

  it("DEPARTMENTS — 각 fixture dept id가 departments.sql에 존재", async () => {
    const sql = await loadSql("departments.sql");
    for (const dept of Object.values(DEPARTMENTS)) {
      expect(sql).toContain(`'${dept.id}'`);
      expect(sql).toContain(`'${dept.name}'`);
    }
  });

  it("ROLES — 각 fixture role id가 roles.sql에 존재", async () => {
    const sql = await loadSql("roles.sql");
    for (const role of Object.values(ROLES)) {
      expect(sql).toContain(`'${role.id}'`);
      expect(sql).toContain(`'${role.name}'`);
    }
  });

  it("alice의 role_assignment가 role-assignments.sql에 존재 (d-eng, r-project-manager)", async () => {
    const sql = await loadSql("role-assignments.sql");
    expect(sql).toContain(`'${USERS.alice.id}', 'r-project-manager', 'department', 'd-eng'`);
  });

  it("bob의 role_assignment가 role-assignments.sql에 존재 (d-mkt, r-project-manager)", async () => {
    const sql = await loadSql("role-assignments.sql");
    expect(sql).toContain(`'${USERS.bob.id}', 'r-project-manager', 'department', 'd-mkt'`);
  });

  it("admin의 global role_assignment (scope_id='')", async () => {
    const sql = await loadSql("role-assignments.sql");
    expect(sql).toContain(`'${USERS.admin.id}', 'r-admin', 'global', ''`);
  });

  it("naming drift 감지 — sim.department 등 과거 테이블명 미사용", async () => {
    for (const file of ["departments.sql", "roles.sql", "users.sql", "role-assignments.sql"]) {
      const sql = await loadSql(file);
      expect(sql).not.toMatch(/INSERT INTO sim\.department\b/);
      expect(sql).not.toMatch(/INSERT INTO sim\.role\b(?!_|s)/);
      expect(sql).not.toMatch(/INSERT INTO sim\."user"/);
      expect(sql).not.toMatch(/INSERT INTO sim\.role_assignment\b/);
    }
  });

  it("BIGSERIAL setval 호출 제거 — 모든 SQL 파일에서", async () => {
    for (const file of ["departments.sql", "roles.sql", "users.sql", "role-assignments.sql"]) {
      const sql = await loadSql(file);
      expect(sql).not.toMatch(/setval/);
      expect(sql).not.toMatch(/BIGSERIAL/);
    }
  });
});
```

- [ ] **Step 3: seed.test.ts — seed.ts 단위 검증 (dry run + 에러 분기)**

```ts
// @def.boundary sim-seed
// @def.doc sim-erp-pm-design

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SEED_DIR = dirname(fileURLToPath(import.meta.url));

describe("seed.ts runner — 정합성 회귀 (코드 읽기만)", () => {
  it("requiredTables가 auth_* 네이밍으로 업데이트됨", async () => {
    const src = await readFile(resolve(SEED_DIR, "seed.ts"), "utf-8");
    expect(src).toMatch(/requiredTables\s*=\s*\[[\s\S]*?"auth_departments"[\s\S]*?"auth_roles"[\s\S]*?"auth_users"[\s\S]*?"auth_role_assignments"/);
    expect(src).not.toMatch(/requiredTables\s*=\s*\[[\s\S]*?"department"[\s\S]*?"role"[\s\S]*?"user"[\s\S]*?"role_assignment"\s*\]/);
  });

  it("count query가 auth_* 테이블 조회", async () => {
    const src = await readFile(resolve(SEED_DIR, "seed.ts"), "utf-8");
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_departments/);
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_roles/);
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_users/);
    expect(src).toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.auth_role_assignments/);
    // 과거 단수형 미사용
    expect(src).not.toMatch(/FROM\s+\$\{sql\([^)]+\)\}\.department(?!s)/);
    expect(src).not.toMatch(/FROM\s+\$\{sql\([^)]+\)\}\."user"/);
  });

  it("SEED_FILES 순서 = [departments, roles, users, role-assignments] (FK 의존)", async () => {
    const src = await readFile(resolve(SEED_DIR, "seed.ts"), "utf-8");
    const m = src.match(/SEED_FILES\s*=\s*\[([\s\S]*?)\]/);
    expect(m).toBeTruthy();
    const order = m![1].match(/"([^"]+)"/g)!.map((s) => s.slice(1, -1));
    expect(order).toEqual([
      "departments.sql",
      "roles.sql",
      "users.sql",
      "role-assignments.sql",
    ]);
  });
});
```

- [ ] **Step 4: vitest 설정 — seed 디렉토리 포함**

`simulations/enterprise-pm/package.json`의 scripts:

```json
{
  "scripts": {
    "sim:up": "bash scripts/sim-up.sh",
    "sim:down": "bash scripts/sim-down.sh",
    "sim:logs": "docker compose -f docker-compose.sim.yaml logs -f --tail=100",
    "sim:ps": "docker compose -f docker-compose.sim.yaml ps",
    "sim:seed": "tsx seed/seed.ts",
    "sim:seed:dry": "SIM_SEED_DRY_RUN=true tsx seed/seed.ts",
    "sim:seed:test": "vitest run seed",
    "sim:scenario": "echo 'scenario runner는 Plan 13에서 추가 예정' && exit 1",
    "sim:doctor": "bash scripts/sim-doctor.sh || echo 'sim-doctor.sh는 Plan 14에서 추가 예정'",
    "build": "echo 'sim root는 빌드 산출물 없음'",
    "test": "vitest run seed"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "@types/node": "^22.0.0",
    "vitest": "^1.6.1"
  }
}
```

추가 devDep: `vitest`. `test` 스크립트를 `vitest run seed`로 정의 (기존 `echo`는 무의미 — 본 plan에서 의미 있는 테스트 실행).

- [ ] **Step 5: pnpm install + seed 테스트**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install && \
  pnpm --filter @qa-sdk-sim/enterprise-pm test 2>&1 | tail -15
```

Expected: fixtures.test 7 PASS + seed.test 3 PASS = 10 PASS.

---

## Task 7: README.md 갱신

**Files:**
- Modify: `simulations/enterprise-pm/seed/README.md`

- [ ] **Step 1: README 갱신**

`simulations/enterprise-pm/seed/README.md`:

````markdown
# Enterprise PM 시뮬 — seed 데이터 (Plan 11d 정렬)

## 구성

| 파일 | 내용 | 행 수 (데이터) |
|---|---|---|
| `departments.sql` | 7 부서 (d-exec, d-eng, d-mkt, d-fin, d-ops, d-sal, d-hr) | 7 INSERT |
| `roles.sql` | 7 역할 (r-admin, r-cfo, r-director, r-project-manager, r-approver, r-member, r-finance) | 7 INSERT |
| `users.sql` | 52 사용자 + 부서 manager_id UPDATE 7건 | 52 INSERT + 7 UPDATE |
| `role-assignments.sql` | 51 부여 (global 2 + dept scope 49) | 51 INSERT |
| `seed.ts` | `.env.sim` 로드 + PG 연결 + 4 SQL 트랜잭션 적용 + auth_* 카운트 검증 | — |
| `fixtures.ts` | JS 상수 (USERS/DEPARTMENTS/ROLES) — 시나리오 runner용 | — |

## 테이블 네이밍 (Plan 11a SSOT)

| 시드 SQL 참조 | 실 테이블 |
|---|---|
| `sim.auth_departments` | Plan 11a `pgSchema("sim").table("auth_departments", ...)` |
| `sim.auth_roles` | `auth_roles` |
| `sim.auth_users` | `auth_users` |
| `sim.auth_role_assignments` | `auth_role_assignments` |

id 타입은 모두 **TEXT** (UUID-like). BIGSERIAL + setval 제거.

## 시나리오 fixture (Plan 13 참조)

| fixture | id | email | dept | role |
|---|---|---|---|---|
| alice | u-alice-001 | alice@example.com | d-eng | r-project-manager |
| bob | u-bob-001 | bob@example.com | d-mkt | r-project-manager |
| admin | u-admin-001 | admin@example.com | d-exec | r-admin |
| directorEng | u-dir-eng-001 | director-eng@example.com | d-eng | r-director |
| directorMkt | u-dir-mkt-001 | director-mkt@example.com | d-mkt | r-director |
| approverEng | u-eng-appr-001 | frank.eng.appr@example.com | d-eng | r-approver |
| approverMkt | u-mkt-appr-001 | quinn.mkt@example.com | d-mkt | r-approver |
| cfo | u-cfo-001 | cfo@example.com | d-exec | r-cfo |

## 실행

```bash
# 1. 환경 변수 준비 (한 번만)
sops decrypt .env.sim.enc > .env.sim

# 2. dry run (SQL 출력만 — Plan 11a 전에도 검증 가능)
pnpm sim:seed:dry

# 3. 실제 적용 (Plan 11a 완료 후)
pnpm sim:seed

# 4. 단위 테스트 (SQL ↔ fixture 정합성)
pnpm sim:seed:test
```

## 의존성

- **Plan 09b** — qa-sdk-db에 `sim` schema + `sim_app` role
- **Plan 11a** — `sim.auth_departments` / `auth_roles` / `auth_users` / `auth_role_assignments` DDL
- **호스트 vs Docker**: 기본은 호스트 → `localhost:5434`. Docker 안에서 실행 시 `SIM_INSIDE_DOCKER=true`로 qa-sdk-db:5432 사용.

## 데이터 분포

```
부서          인원   역할 분포
Executive       2    admin 1, cfo 1
Engineering    13    director 1, PM 2 (alice 포함), approver 1, member 8, +1
Marketing       9    director 1, PM 1 (bob), approver 1, member 5, +1
Finance         6    director 1, finance 4, approver 1
Operations      8    director 1, PM 1, approver 1, member 5
Sales           8    director 1, PM 1, approver 1, member 5
HR              6    director 1, approver 1, member 4
─────────────────────
total          52
```

## 주의

- `ON CONFLICT (id) DO NOTHING` — 재실행 안전 (idempotent).
- global scope의 `scope_id = ''` (빈 문자열) — composite PK의 NULL 비교 이슈 회피.
- manager_id는 users.sql 끝에서 UPDATE — FK 회피.
- project scope role_assignment는 시나리오 2 (프로젝트 생성 시) 동적 생성 — 본 seed는 정적 데이터만.

## 회귀 방지

`pnpm sim:seed:test`가 SQL ↔ fixtures.ts 간 drift를 감지:
- fixture user 누락 → 테스트 실패
- naming drift (과거 단수형 테이블명) → 테스트 실패
- BIGSERIAL/setval 부활 → 테스트 실패
````

- [ ] **Step 2: 커밋 — 전체 Task 1~7 묶음**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/seed/departments.sql \
          simulations/enterprise-pm/seed/roles.sql \
          simulations/enterprise-pm/seed/users.sql \
          simulations/enterprise-pm/seed/role-assignments.sql \
          simulations/enterprise-pm/seed/seed.ts \
          simulations/enterprise-pm/seed/fixtures.ts \
          simulations/enterprise-pm/seed/fixtures.test.ts \
          simulations/enterprise-pm/seed/seed.test.ts \
          simulations/enterprise-pm/seed/README.md \
          simulations/enterprise-pm/package.json \
          pnpm-lock.yaml && \
  git commit -m "$(cat <<'EOF'
fix(sim-seed): Plan 11a auth_* 네이밍 정렬 + Plan 13 fixture

네이밍: sim.department → sim.auth_departments (+ roles/users/role_assignments).
id 타입: BIGSERIAL → TEXT (UUID-like 고정 id: u-alice-001 등).
setval 제거 (TEXT PK는 sequence 없음).
scope_id '' default (composite PK의 NULL 비교 회피).
alice/bob/admin/director fixture + fixtures.ts JS 상수 + drift 감지 테스트.
52명 사용자 (+ director 7 + admin 추가).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: dry run + 실 적용 smoke (Plan 11a 완료 후)

**Files:**
- 변경 없음 (실행만)

- [ ] **Step 1: .env.sim 평문 생성 (Plan 09d 완료 전제)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && \
  sops decrypt .env.sim.enc > .env.sim
```

- [ ] **Step 2: dry run**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && \
  pnpm sim:seed:dry 2>&1 | tail -30
```

Expected:
- `loaded: departments.sql` 등 4 파일 hit
- dry run 출력에 `sim.auth_departments` / `auth_roles` / `auth_users` / `auth_role_assignments` 등장
- `dry run 완료` 메시지

- [ ] **Step 3: Plan 11a 테이블 준비 (별도 세션에서)**

```bash
# Plan 11a의 drizzle migration 적용 (참조만 — 실제 migration은 Plan 11a 담당)
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/services/auth-api && \
  pnpm drizzle-kit push --config=drizzle.pg.config.ts 2>&1 | tail -5
```

Expected: auth_* 4 테이블 생성 완료. (Plan 11a 완료 여부에 따라 결과 다름.)

- [ ] **Step 4: 실 seed 적용**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && \
  pnpm sim:seed 2>&1 | tail -20
```

Expected:
```
==> 트랜잭션 시작
    적용: departments.sql
    적용: roles.sql
    적용: users.sql
    적용: role-assignments.sql

==> 카운트 검증
    auth_departments     7
    auth_roles           7
    auth_users          52
    auth_role_assignments 51

✓ seed 적용 완료
```

- [ ] **Step 5: alice 조회 smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  docker compose -f packages/infra-engine/docker-compose.infra.yaml exec -T qa-sdk-db \
    psql -U sim_app -d qa_sdk -tA \
      -c "SELECT id, email, department_id FROM sim.auth_users WHERE email='alice@example.com';"
```

Expected: `u-alice-001|alice@example.com|d-eng` 1 row.

- [ ] **Step 6: 정리 (.env.sim 삭제)**

```bash
rm /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/.env.sim
```

---

## Task 9: 회귀

- [ ] **Step 1: seed 단위 테스트 전체**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk-sim/enterprise-pm test 2>&1 | tail -5
```

Expected: 10 PASS (fixtures 7 + seed 3).

- [ ] **Step 2: def gate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0.

- [ ] **Step 3: workflow-smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm exec vitest run workflow-smoke 2>&1 | tail -5
```

Expected: 12 PASS 유지.

- [ ] **Step 4: 기존 패키지 typecheck 영향 없음 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/core --filter @qa-sdk/cli typecheck 2>&1 | tail -5
```

Expected: 0 error.

---

## Self-Review

- [ ] 4 SQL 파일 모두 `sim.auth_*` 네이밍 사용
- [ ] id 컬럼 TEXT (BIGSERIAL / setval 호출 완전 제거)
- [ ] `updated_at` 컬럼 추가 (departments/users)
- [ ] `scope_type` + `default_mask_hex` (roles)
- [ ] `scope_id = ''` (global scope — NULL 대신 빈 문자열로 composite PK conflict 정합)
- [ ] users.sql 말미에 `auth_departments.manager_id` UPDATE 7건 (FK 지연 해소)
- [ ] alice/bob/admin/director/approver 시나리오 fixture 명시 (주석 + SQL row)
- [ ] `fixtures.ts` JS 상수 — USERS/DEPARTMENTS/ROLES
- [ ] `fixtures.test.ts` — SQL ↔ JS 상수 drift 감지 (7 invariant)
- [ ] `seed.test.ts` — seed.ts 코드의 auth_* 네이밍 회귀 (3 invariant)
- [ ] `seed.ts`의 `requiredTables` + count query 모두 `auth_*` 네이밍
- [ ] 에러 메시지 — "Plan 11a (auth domain 모델)" 명시
- [ ] `package.json` `test` / `sim:seed:test` 스크립트 — vitest 통합
- [ ] README 갱신 — 네이밍 표 + fixture 표 + 의존성 + 분포
- [ ] dry run 정상 출력 (어쩌면 Plan 11a 전에도 동작 확인 가능)
- [ ] 실 apply — 52 users + 51 role_assignments + 7 departments + 7 roles 카운트 일치
- [ ] no fallback — Plan 11a 미완료 시 테이블 누락 감지 → exit 2
- [ ] workflow-smoke + def validate 0 error 유지

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| `project` scope role_assignment 동적 시드 | 시나리오 2 (프로젝트 생성)가 `POST /projects` 후 AccessChecker가 자동 저장 — 정적 seed 아님 | Plan 13a |
| `sim.pm_*` / `sim.approval_*` 테이블 seed | Plan 11b/11c의 DDL 담당 — 본 plan은 auth 도메인만 | Plan 11d-1 또는 11b 확장 |
| `default_mask_hex` 정확한 비트 배치 (computeUserBits와 byte-wise 일치) | 시나리오 1이 실 byte matching 검증 — 실패 시 본 plan의 SQL 재튜닝 | Plan 13a 피드백 |
| password 컬럼 추가 (실 credential 검증) | sim scope 밖. `/auth/authenticate`가 email 존재만 검증 | Phase 5 |
| alice/bob가 project manager + department approver 겸직 fixture | 시나리오 3이 approver 역할 필요 — 현재 `u-eng-appr-001` (frank)이 해당 | Plan 13b 판단 |
| 대량 사용자 (>52) | 부하 시뮬 | 별도 plan |
| SQLite 테스트 fixture로 변환 (in-process) | 본 plan은 PG만 — SQLite는 scenario runner가 fixture helper 직접 사용 | Plan 13a |

---

## 의존·후속

- **선행 (필수)**:
  - Plan 09d — seed 스캐폴딩 (`.env.sim.enc`, `package.json`의 `sim:seed` 스크립트, seed.ts 기본 구조).
  - Plan 11a — `sim.auth_*` 4 테이블 DDL + drizzle migration.
- **병렬 가능**:
  - Plan 12a-1 (gateway exports) — 본 plan과 파일 겹침 없음.
  - Plan 12c-1 (audit-browser-api) — 본 plan과 파일 겹침 없음.
- **후속 (본 plan 결과물을 소비)**:
  - Plan 13a — `fixtures.ts`의 USERS.alice / USERS.bob 등 import. 시나리오 runner의 expected 값.
  - Plan 13b/c/d — 동일 패턴. bob의 Marketing dept scope, alice의 Engineering dept scope 활용.
  - Plan 11d-1 (후속) — pm_projects / approval_budget_requests 등 도메인 seed 확장.
  - Plan 14b — docker-compose 통합 회귀에서 sim:seed 자동 실행.
