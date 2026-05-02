# Plan 09d — .env.sim sops + seed 데이터 스캐폴딩

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시뮬 9 서비스가 공유할 환경 변수 (`.env.sim`)를 sops 암호화로 git에 보관하고, 도메인 본체(7 부서, 7 역할, 50 사용자, 사용자↔역할 매핑)를 SQL + TypeScript runner로 적용하는 seed 시스템을 구축한다. 도메인 모델 상세 (테이블 DDL)는 Plan 11이 담당하므로 본 plan은 **schema-agnostic seed pattern** + **데이터만 입력**한다 — Plan 11 완료 후 같은 seed.ts가 자동 적용된다.

**Architecture:**
- `.env.sim`: 디자인 §5 6개 핵심 변수 + Plan 09b의 sim_app 비밀번호 등 추가 변수. sops 암호화로 `.env.sim.enc` git 보관, 사용자가 `sops decrypt` 후 `.env.sim` 평문 사용.
- `seed/`: 4개 SQL (departments/roles/users/role-assignments) — 비즈니스 데이터만, 테이블 스키마는 Plan 11 의존. 본 plan은 SQL 파일 골격 + 실데이터.
- `seed/seed.ts`: TypeScript runner — `.env.sim` 읽고 PG 연결 + 4 SQL 순서대로 실행 + 트랜잭션 롤백/커밋. Plan 11이 테이블을 만들기 전까지는 "테이블 미존재" 에러 발생 — 본 plan에서는 dry-run 모드로만 검증.

**Tech Stack:**
- sops + age (qa-sdk monorepo가 이미 사용)
- postgres ^3.4.0 (또는 pg) — seed runner의 DB 클라이언트
- tsx (Plan 09a에서 devDep 추가됨)
- dotenv (런타임 환경 변수 로드)

---

## File Structure

### 새로 만드는 파일

| 경로 | 책임 |
|---|---|
| `simulations/enterprise-pm/.env.sim.enc` | sops 암호화 환경 변수 (git 보관) |
| `simulations/enterprise-pm/.env.sim.example` | 평문 예제 (변수명 + 더미값, git 보관) |
| `simulations/enterprise-pm/seed/departments.sql` | 7 부서 INSERT |
| `simulations/enterprise-pm/seed/roles.sql` | 7 역할 INSERT |
| `simulations/enterprise-pm/seed/users.sql` | 50 사용자 INSERT |
| `simulations/enterprise-pm/seed/role-assignments.sql` | 사용자 ↔ 역할 매핑 INSERT |
| `simulations/enterprise-pm/seed/seed.ts` | TypeScript runner — .env.sim 로드 + PG 연결 + 4 SQL 순서 적용 + 트랜잭션 |
| `simulations/enterprise-pm/seed/README.md` | seed 데이터 구조 + Plan 11 의존성 명시 |

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `simulations/enterprise-pm/package.json` | `dependencies`에 `postgres` + `dotenv`, `devDependencies` 그대로. `sim:seed:dry` 스크립트 추가 |
| `simulations/enterprise-pm/.gitignore` | `.env.sim` 평문 차단 확인 (Plan 09a에서 이미 추가) |

---

## Task 0: baseline 검증

- [ ] **Step 1: Plan 09a/09b/09c 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/package.json simulations/enterprise-pm/docker-compose.sim.yaml && \
  grep -c "QA_SDK_SIM_PASSWORD" packages/infra-engine/init/qa-sdk-db.sql && \
  grep -c "sim-gateway" packages/core/src/lib/service-ports.ts
```

Expected: 모두 hit.

- [ ] **Step 2: sops 도구 + age 키 확인**

```bash
which sops age && cat ~/.config/sops/age/keys.txt 2>/dev/null | head -1
```

Expected: sops + age 모두 PATH에 존재. age key 헤더 (`# created: ...`) 1줄. 키 미존재 → 새 키 생성 절차 (아래 Task 2 Step 1).

- [ ] **Step 3: .gitignore 확인**

```bash
grep -n "^\.env\.sim$" /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/.gitignore
```

Expected: hit (Plan 09a Task 1 Step 2에서 추가됨). 없으면 추가 필요.

---

## Task 1: `.env.sim.example` 작성 (평문, git 보관)

**Files:**
- Create: `simulations/enterprise-pm/.env.sim.example`

신규 contributor가 어떤 환경 변수가 필요한지 알 수 있도록 평문 예제 제공. 실제 값은 `.env.sim.enc` (sops 암호화).

- [ ] **Step 1: example 파일 작성**

`simulations/enterprise-pm/.env.sim.example`:

```bash
# Enterprise PM 시뮬 환경 변수 — 평문 예제 (실제 값은 .env.sim.enc에서 복호화)
#
# 사용 절차:
#   1. sops decrypt .env.sim.enc > .env.sim
#   2. (필요 시) .env.sim 편집
#   3. pnpm sim:up

# ── 데이터베이스 (qa-sdk-db 컨테이너) ──
QA_DB_DIALECT=pg
QA_PG_HOST=qa-sdk-db          # docker network 안에서는 컨테이너명, 호스트에서는 localhost
QA_PG_PORT=5432               # docker network 안 내부 포트 (호스트 노출은 5434)
QA_PG_DATABASE=qa_sdk
QA_PG_USER=sim_app            # Plan 09b에서 생성됨
QA_PG_PASSWORD=__from_sops__  # 실제 값은 .env.sim.enc — Plan 09b의 QA_SDK_SIM_PASSWORD와 동일
QA_PG_SCHEMA=sim

# ── 시뮬 인프라 ──
SIM_REDIS_URL=redis://sim-redis:6379

# ── 관측 (qa-sdk 본체로 forward) ──
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
QA_INGEST_URL=http://host.docker.internal:3200

# ── 시뮬 식별 ──
SIM_ENV=dev                   # dev | ci | demo
SIM_LOG_LEVEL=info            # debug | info | warn | error

# ── 게이트웨이 ──
SIM_JWT_SECRET=__from_sops__  # JWT 서명 키 (디자인 §2)
SIM_JWT_ISSUER=sim-auth-api
SIM_JWT_TTL_SECONDS=3600

# ── seed runner ──
SIM_SEED_DRY_RUN=false        # true → SQL 실행 안 하고 출력만
```

**근거 — `__from_sops__` placeholder**: example 파일은 평문 git 보관 가능해야 하므로 비밀값 제외. 사용자가 sops로 복호화 받기 전 example을 그대로 쓰면 명시적 에러 → 안전.

- [ ] **Step 2: example 파일 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && grep -c "^[A-Z_]\+=" .env.sim.example
```

Expected: 13건 (env 변수 행 개수).

---

## Task 2: `.env.sim.enc` 작성 (sops 암호화, git 보관)

**Files:**
- Create: `simulations/enterprise-pm/.env.sim.enc`

- [ ] **Step 1: age key 확인 (없으면 생성)**

```bash
ls ~/.config/sops/age/keys.txt 2>&1 || (mkdir -p ~/.config/sops/age && age-keygen -o ~/.config/sops/age/keys.txt)
PUBKEY=$(grep "public key" ~/.config/sops/age/keys.txt | awk '{print $NF}')
echo "Age pubkey: $PUBKEY"
```

기록: `$PUBKEY`. 다른 contributor와 공유 시 본인 pubkey도 sops 정책에 추가 필요 (`.sops.yaml` 갱신).

- [ ] **Step 2: 평문 .env.sim 작성 (임시)**

```bash
QA_SIM_PW="$(grep '^QA_SDK_SIM_PASSWORD=' /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker 2>/dev/null | cut -d= -f2-)"
if [[ -z "$QA_SIM_PW" ]]; then
  # Plan 09b의 .env.docker가 sops 암호화 상태 → 복호화 필요
  QA_SIM_PW=$(sops decrypt /Users/junwoobang/workflow/qa-sdk/packages/infra-engine/.env.docker 2>/dev/null | grep '^QA_SDK_SIM_PASSWORD=' | cut -d= -f2-)
fi
test -n "$QA_SIM_PW" || { echo "ERROR: QA_SDK_SIM_PASSWORD 추출 실패 — Plan 09b 확인"; exit 1; }

JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"

cat > /tmp/env-sim-plain.txt <<EOF
QA_DB_DIALECT=pg
QA_PG_HOST=qa-sdk-db
QA_PG_PORT=5432
QA_PG_DATABASE=qa_sdk
QA_PG_USER=sim_app
QA_PG_PASSWORD=${QA_SIM_PW}
QA_PG_SCHEMA=sim
SIM_REDIS_URL=redis://sim-redis:6379
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
QA_INGEST_URL=http://host.docker.internal:3200
SIM_ENV=dev
SIM_LOG_LEVEL=info
SIM_JWT_SECRET=${JWT_SECRET}
SIM_JWT_ISSUER=sim-auth-api
SIM_JWT_TTL_SECONDS=3600
SIM_SEED_DRY_RUN=false
EOF
```

- [ ] **Step 3: sops로 암호화**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && \
  sops --age "$PUBKEY" --encrypt --input-type dotenv --output-type dotenv /tmp/env-sim-plain.txt > .env.sim.enc && \
  shred -u /tmp/env-sim-plain.txt 2>/dev/null || rm -P /tmp/env-sim-plain.txt 2>/dev/null || rm /tmp/env-sim-plain.txt
```

**주의 — macOS shred 미존재**: `rm -P`로 1-pass overwrite 시도, 실패 시 단순 `rm`. 매우 짧은 노출 — JWT는 즉시 회전 가능.

- [ ] **Step 4: 복호화 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && sops --decrypt .env.sim.enc 2>&1 | head -5
```

Expected: 평문 환경 변수 출력. 에러 없음.

- [ ] **Step 5: 사용 절차 검증 (사용자가 .env.sim 평문 생성)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && sops decrypt .env.sim.enc > .env.sim && wc -l .env.sim
```

Expected: 16줄 (변수 16개).

- [ ] **Step 6: .env.sim git 차단 검증**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git check-ignore simulations/enterprise-pm/.env.sim 2>&1
```

Expected: `simulations/enterprise-pm/.env.sim` 출력 (gitignore 적용). 출력 없으면 .gitignore 점검.

---

## Task 3: seed SQL 4개 작성

**Files:**
- Create: `simulations/enterprise-pm/seed/departments.sql`
- Create: `simulations/enterprise-pm/seed/roles.sql`
- Create: `simulations/enterprise-pm/seed/users.sql`
- Create: `simulations/enterprise-pm/seed/role-assignments.sql`

**중요 — Plan 11 의존**: 본 SQL이 참조하는 테이블(`sim.department`, `sim.role`, `sim.user`, `sim.role_assignment`)은 Plan 11에서 만들어진다. 본 plan은 SQL 파일 골격 + 실데이터를 제공하고, 실행 검증은 dry-run으로 한다. Plan 11 완료 후 정상 적용된다.

- [ ] **Step 1: `departments.sql` 작성 (7 부서)**

`simulations/enterprise-pm/seed/departments.sql`:

```sql
-- Enterprise PM 시뮬 — 부서 7개 seed
-- 의존: Plan 11a의 sim.department 테이블 (id BIGSERIAL, name TEXT, parent_id BIGINT NULL, manager_id BIGINT NULL, created_at TIMESTAMPTZ DEFAULT now())

INSERT INTO sim.department (id, name, parent_id, manager_id) VALUES
  (1, 'Executive',           NULL, NULL),
  (2, 'Engineering',          1,   NULL),
  (3, 'Marketing',            1,   NULL),
  (4, 'Finance',              1,   NULL),
  (5, 'Operations',           1,   NULL),
  (6, 'Sales',                1,   NULL),
  (7, 'Human Resources',      1,   NULL)
ON CONFLICT (id) DO NOTHING;

-- BIGSERIAL sequence를 수동 INSERT 이후로 진행 — 다음 INSERT가 id=8부터
SELECT setval('sim.department_id_seq', (SELECT MAX(id) FROM sim.department));
```

- [ ] **Step 2: `roles.sql` 작성 (7 역할)**

`simulations/enterprise-pm/seed/roles.sql`:

```sql
-- Enterprise PM 시뮬 — 역할 7개 seed
-- 의존: Plan 11a의 sim.role 테이블 (id BIGSERIAL, name TEXT UNIQUE, description TEXT, created_at TIMESTAMPTZ DEFAULT now())

INSERT INTO sim.role (id, name, description) VALUES
  (1, 'admin',           '시스템 관리자 — global scope, 전체 권한'),
  (2, 'cfo',             '재무 책임자 — global scope, 모든 budget 승인'),
  (3, 'director',        '부서장 — department scope, 부서 내 모든 리소스'),
  (4, 'project_manager', '프로젝트 매니저 — project scope, 프로젝트 lead'),
  (5, 'approver',        '승인자 — department scope, 일반 승인 단계'),
  (6, 'member',          '구성원 — project scope, 일반 작업'),
  (7, 'finance',         '재무 담당자 — department scope (Finance), 비용 처리')
ON CONFLICT (id) DO NOTHING;

SELECT setval('sim.role_id_seq', (SELECT MAX(id) FROM sim.role));
```

- [ ] **Step 3: `users.sql` 작성 (50 사용자)**

`simulations/enterprise-pm/seed/users.sql`:

```sql
-- Enterprise PM 시뮬 — 사용자 50명 seed
-- 의존: Plan 11a의 sim.user 테이블 (id BIGSERIAL, email TEXT UNIQUE, display_name TEXT, department_id BIGINT REFERENCES sim.department(id), primary_role_id BIGINT REFERENCES sim.role(id), created_at TIMESTAMPTZ DEFAULT now())
--
-- 분포:
--   Executive   (id=1): 2명 (admin 1, cfo 1)
--   Engineering (id=2): 12명 (director 1, PM 2, approver 1, member 8)
--   Marketing   (id=3): 8명 (director 1, PM 1, approver 1, member 5)
--   Finance     (id=4): 6명 (director 1, finance 4, approver 1)
--   Operations  (id=5): 8명 (director 1, PM 1, approver 1, member 5)
--   Sales       (id=6): 8명 (director 1, PM 1, approver 1, member 5)
--   HR          (id=7): 6명 (director 1, approver 1, member 4)

INSERT INTO sim.user (id, email, display_name, department_id, primary_role_id) VALUES
  -- Executive (2)
  (1,  'alice.admin@sim.local',     'Alice Kim',      1, 1),
  (2,  'bob.cfo@sim.local',         'Bob Park',       1, 2),

  -- Engineering (12)
  (3,  'carol.eng.dir@sim.local',   'Carol Lee',      2, 3),
  (4,  'dave.eng.pm1@sim.local',    'Dave Choi',      2, 4),
  (5,  'eve.eng.pm2@sim.local',     'Eve Han',        2, 4),
  (6,  'frank.eng.app@sim.local',   'Frank Yoon',     2, 5),
  (7,  'grace.eng.m1@sim.local',    'Grace Jung',     2, 6),
  (8,  'henry.eng.m2@sim.local',    'Henry Kang',     2, 6),
  (9,  'iris.eng.m3@sim.local',     'Iris Bae',       2, 6),
  (10, 'jack.eng.m4@sim.local',     'Jack Lim',       2, 6),
  (11, 'kate.eng.m5@sim.local',     'Kate Seo',       2, 6),
  (12, 'leo.eng.m6@sim.local',      'Leo Hwang',      2, 6),
  (13, 'mia.eng.m7@sim.local',      'Mia Cho',        2, 6),
  (14, 'noah.eng.m8@sim.local',     'Noah Jeon',      2, 6),

  -- Marketing (8)
  (15, 'olivia.mkt.dir@sim.local',  'Olivia Sim',     3, 3),
  (16, 'peter.mkt.pm@sim.local',    'Peter Oh',       3, 4),
  (17, 'quinn.mkt.app@sim.local',   'Quinn Yu',       3, 5),
  (18, 'rita.mkt.m1@sim.local',     'Rita Moon',      3, 6),
  (19, 'sam.mkt.m2@sim.local',      'Sam Ko',         3, 6),
  (20, 'tina.mkt.m3@sim.local',     'Tina Ryu',       3, 6),
  (21, 'ulysses.mkt.m4@sim.local',  'Ulysses Min',    3, 6),
  (22, 'vera.mkt.m5@sim.local',     'Vera An',        3, 6),

  -- Finance (6)
  (23, 'walt.fin.dir@sim.local',    'Walt Shin',      4, 3),
  (24, 'xena.fin1@sim.local',       'Xena Joo',       4, 7),
  (25, 'yuki.fin2@sim.local',       'Yuki Park',      4, 7),
  (26, 'zach.fin3@sim.local',       'Zach Lee',       4, 7),
  (27, 'amy.fin4@sim.local',        'Amy Kim',        4, 7),
  (28, 'ben.fin.app@sim.local',     'Ben Choi',       4, 5),

  -- Operations (8)
  (29, 'cleo.ops.dir@sim.local',    'Cleo Han',       5, 3),
  (30, 'dan.ops.pm@sim.local',      'Dan Park',       5, 4),
  (31, 'ellen.ops.app@sim.local',   'Ellen Kang',     5, 5),
  (32, 'finn.ops.m1@sim.local',     'Finn Yoon',      5, 6),
  (33, 'gina.ops.m2@sim.local',     'Gina Jung',      5, 6),
  (34, 'hugo.ops.m3@sim.local',     'Hugo Bae',       5, 6),
  (35, 'isla.ops.m4@sim.local',     'Isla Lim',       5, 6),
  (36, 'jude.ops.m5@sim.local',     'Jude Seo',       5, 6),

  -- Sales (8)
  (37, 'kara.sal.dir@sim.local',    'Kara Hwang',     6, 3),
  (38, 'liam.sal.pm@sim.local',     'Liam Cho',       6, 4),
  (39, 'maya.sal.app@sim.local',    'Maya Jeon',      6, 5),
  (40, 'nico.sal.m1@sim.local',     'Nico Sim',       6, 6),
  (41, 'opal.sal.m2@sim.local',     'Opal Oh',        6, 6),
  (42, 'paul.sal.m3@sim.local',     'Paul Yu',        6, 6),
  (43, 'qara.sal.m4@sim.local',     'Qara Moon',      6, 6),
  (44, 'rose.sal.m5@sim.local',     'Rose Ko',        6, 6),

  -- HR (6)
  (45, 'sven.hr.dir@sim.local',     'Sven Ryu',       7, 3),
  (46, 'tara.hr.app@sim.local',     'Tara Min',       7, 5),
  (47, 'umar.hr.m1@sim.local',      'Umar An',        7, 6),
  (48, 'vita.hr.m2@sim.local',      'Vita Shin',      7, 6),
  (49, 'wade.hr.m3@sim.local',      'Wade Joo',       7, 6),
  (50, 'xan.hr.m4@sim.local',       'Xan Park',       7, 6)
ON CONFLICT (id) DO NOTHING;

SELECT setval('sim.user_id_seq', (SELECT MAX(id) FROM sim.user));
```

- [ ] **Step 4: `role-assignments.sql` 작성 (사용자↔역할 + scope)**

`simulations/enterprise-pm/seed/role-assignments.sql`:

```sql
-- Enterprise PM 시뮬 — 역할 부여 seed
-- 의존: Plan 11a의 sim.role_assignment 테이블
--   (id BIGSERIAL, user_id BIGINT REFERENCES sim.user(id), role_id BIGINT REFERENCES sim.role(id),
--    scope_type TEXT CHECK (scope_type IN ('global','department','project')),
--    scope_id BIGINT NULL,
--    granted_at TIMESTAMPTZ DEFAULT now())
--
-- 디자인 §3 권한 hierarchy 5계층:
--   global     — 모든 리소스 (admin, cfo)
--   department — 부서 전체 (director, finance, dept_approver)
--   project    — 단일 프로젝트 (PM, member) — 프로젝트는 Plan 11 후 별도 시드

INSERT INTO sim.role_assignment (user_id, role_id, scope_type, scope_id) VALUES
  -- ── global scope ──
  (1,  1, 'global',     NULL),  -- Alice → admin
  (2,  2, 'global',     NULL),  -- Bob → cfo

  -- ── department scope (director) ──
  (3,  3, 'department', 2),     -- Carol → Engineering director
  (15, 3, 'department', 3),     -- Olivia → Marketing director
  (23, 3, 'department', 4),     -- Walt → Finance director
  (29, 3, 'department', 5),     -- Cleo → Operations director
  (37, 3, 'department', 6),     -- Kara → Sales director
  (45, 3, 'department', 7),     -- Sven → HR director

  -- ── department scope (approver) ──
  (6,  5, 'department', 2),     -- Frank → Eng approver
  (17, 5, 'department', 3),     -- Quinn → Mkt approver
  (28, 5, 'department', 4),     -- Ben → Fin approver
  (31, 5, 'department', 5),     -- Ellen → Ops approver
  (39, 5, 'department', 6),     -- Maya → Sal approver
  (46, 5, 'department', 7),     -- Tara → HR approver

  -- ── department scope (finance) ──
  (24, 7, 'department', 4),     -- Xena → Fin
  (25, 7, 'department', 4),     -- Yuki → Fin
  (26, 7, 'department', 4),     -- Zach → Fin
  (27, 7, 'department', 4),     -- Amy → Fin

  -- ── department scope (PM이 자기 부서 접근권 — 프로젝트 외 리소스 조회용) ──
  (4,  4, 'department', 2),     -- Dave → Eng PM
  (5,  4, 'department', 2),     -- Eve → Eng PM
  (16, 4, 'department', 3),     -- Peter → Mkt PM
  (30, 4, 'department', 5),     -- Dan → Ops PM
  (38, 4, 'department', 6),     -- Liam → Sal PM

  -- ── department scope (member 역할 — 자기 부서 일반 조회) ──
  (7,  6, 'department', 2),  (8,  6, 'department', 2),  (9,  6, 'department', 2),
  (10, 6, 'department', 2),  (11, 6, 'department', 2),  (12, 6, 'department', 2),
  (13, 6, 'department', 2),  (14, 6, 'department', 2),
  (18, 6, 'department', 3),  (19, 6, 'department', 3),  (20, 6, 'department', 3),
  (21, 6, 'department', 3),  (22, 6, 'department', 3),
  (32, 6, 'department', 5),  (33, 6, 'department', 5),  (34, 6, 'department', 5),
  (35, 6, 'department', 5),  (36, 6, 'department', 5),
  (40, 6, 'department', 6),  (41, 6, 'department', 6),  (42, 6, 'department', 6),
  (43, 6, 'department', 6),  (44, 6, 'department', 6),
  (47, 6, 'department', 7),  (48, 6, 'department', 7),  (49, 6, 'department', 7),
  (50, 6, 'department', 7)
ON CONFLICT DO NOTHING;
```

**주의 — project scope role_assignment 미포함**: project entity는 Plan 11b에서 만들고, 13b 시나리오 2 (프로젝트 생성 + owner 자동 권한)에서 동적 생성. 본 seed는 정적 데이터만.

- [ ] **Step 5: SQL 파일 검증 (문법)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && for f in seed/*.sql; do
  echo "== $f"
  wc -l "$f"
  grep -c "^INSERT INTO" "$f" || true
done
```

Expected:
```
== seed/departments.sql      → ~15줄, INSERT 1건
== seed/role-assignments.sql → ~50줄, INSERT 1건
== seed/roles.sql            → ~15줄, INSERT 1건
== seed/users.sql            → ~65줄, INSERT 1건
```

---

## Task 4: `seed.ts` runner 작성

**Files:**
- Create: `simulations/enterprise-pm/seed/seed.ts`
- Modify: `simulations/enterprise-pm/package.json`

- [ ] **Step 1: package.json에 의존 + dry-run 스크립트 추가**

`simulations/enterprise-pm/package.json` 갱신:

```json
{
  "name": "@qa-sdk-sim/enterprise-pm",
  "version": "0.1.0",
  "private": true,
  "description": "Enterprise PM 시뮬 — qa-sdk 5축 검증용 9서비스 orchestration root",
  "type": "module",
  "scripts": {
    "sim:up": "bash scripts/sim-up.sh",
    "sim:down": "bash scripts/sim-down.sh",
    "sim:logs": "docker compose -f docker-compose.sim.yaml logs -f --tail=100",
    "sim:ps": "docker compose -f docker-compose.sim.yaml ps",
    "sim:seed": "tsx seed/seed.ts",
    "sim:seed:dry": "SIM_SEED_DRY_RUN=true tsx seed/seed.ts",
    "sim:scenario": "echo 'scenario runner는 Plan 13에서 추가 예정' && exit 1",
    "sim:doctor": "bash scripts/sim-doctor.sh || echo 'sim-doctor.sh는 Plan 14에서 추가 예정'",
    "build": "echo 'sim root는 빌드 산출물 없음'",
    "test": "echo 'sim root 자체 테스트 없음'"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "postgres": "^3.4.5"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=10.0.0"
  }
}
```

**근거**:
- `postgres` (porsager) — qa-sdk monorepo의 PG 표준. db-bootstrap도 동일 사용.
- `dotenv` — `.env.sim` 평문 파일 로드.
- `sim:seed:dry` — Plan 11 전 SQL 출력만 (테이블 미존재로 실행 실패 회피).

- [ ] **Step 2: seed.ts runner 작성**

`simulations/enterprise-pm/seed/seed.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Enterprise PM 시뮬 — seed 데이터 적용 runner
 *
 * 사용:
 *   pnpm sim:seed         — 실제 적용 (트랜잭션 + 커밋)
 *   pnpm sim:seed:dry     — SQL 파일만 출력, 실행 없음
 *
 * 의존:
 *   - .env.sim (sops decrypt 후 평문)
 *   - Plan 11a 완료 (sim.department/role/user/role_assignment 테이블 존재)
 *
 * 본 runner는 schema-agnostic — SQL 파일을 그대로 실행만 한다.
 * 테이블 DDL은 Plan 11a/Drizzle migration이 담당.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SIM_ROOT = resolve(SCRIPT_DIR, "..");

// ── 환경 변수 로드 ──
const envPath = resolve(SIM_ROOT, ".env.sim");
loadEnv({ path: envPath });

const required = [
  "QA_PG_HOST",
  "QA_PG_PORT",
  "QA_PG_DATABASE",
  "QA_PG_USER",
  "QA_PG_PASSWORD",
  "QA_PG_SCHEMA",
] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[seed] 환경 변수 ${key} 누락 — .env.sim 점검 (${envPath})`);
    process.exit(1);
  }
}

const isDryRun = process.env.SIM_SEED_DRY_RUN === "true";

// ── 호스트/도커 차이 흡수 ──
// .env.sim의 QA_PG_HOST=qa-sdk-db는 docker network 안용. 호스트에서 실행 시 localhost + 5434.
const isInsideDocker = process.env.SIM_INSIDE_DOCKER === "true";
const pgHost = isInsideDocker
  ? process.env.QA_PG_HOST!
  : process.env.QA_PG_HOST_OVERRIDE ?? "localhost";
const pgPort = isInsideDocker
  ? Number(process.env.QA_PG_PORT)
  : Number(process.env.QA_PG_PORT_OVERRIDE ?? 5434);

// ── seed 파일 순서 (FK 의존성 순) ──
const SEED_FILES = [
  "departments.sql",
  "roles.sql",
  "users.sql",
  "role-assignments.sql",
] as const;

async function main() {
  console.log("==> Enterprise PM seed runner");
  console.log(`    PG host: ${pgHost}:${pgPort}`);
  console.log(`    PG db:   ${process.env.QA_PG_DATABASE}`);
  console.log(`    PG user: ${process.env.QA_PG_USER}`);
  console.log(`    schema:  ${process.env.QA_PG_SCHEMA}`);
  console.log(`    mode:    ${isDryRun ? "DRY RUN (no execution)" : "APPLY"}`);
  console.log("");

  const sqlFiles: { name: string; content: string }[] = [];
  for (const fname of SEED_FILES) {
    const fpath = resolve(SCRIPT_DIR, fname);
    const content = await readFile(fpath, "utf-8");
    sqlFiles.push({ name: fname, content });
    console.log(`    loaded: ${fname} (${content.split("\n").length} lines)`);
  }
  console.log("");

  if (isDryRun) {
    console.log("==> DRY RUN — SQL 파일만 출력, 실행 없음");
    for (const { name, content } of sqlFiles) {
      console.log(`\n--- ${name} ---`);
      console.log(content);
    }
    console.log("\n✓ dry run 완료 — 실제 적용은 pnpm sim:seed");
    return;
  }

  // ── PG 연결 ──
  const sql = postgres({
    host: pgHost,
    port: pgPort,
    database: process.env.QA_PG_DATABASE!,
    user: process.env.QA_PG_USER!,
    password: process.env.QA_PG_PASSWORD!,
    max: 1,
    onnotice: (notice) => console.log(`[pg notice] ${notice.message}`),
  });

  try {
    // ── 사전 점검 — 테이블 존재 확인 ──
    const requiredTables = ["department", "role", "user", "role_assignment"];
    const present = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ${process.env.QA_PG_SCHEMA!}
        AND table_name = ANY(${requiredTables})
    `;
    const presentNames = new Set(present.map((r) => r.table_name));
    const missing = requiredTables.filter((t) => !presentNames.has(t));
    if (missing.length > 0) {
      console.error(`\n⚠ 다음 테이블이 ${process.env.QA_PG_SCHEMA} schema에 없습니다: ${missing.join(", ")}`);
      console.error(`   Plan 11a (도메인 모델)가 먼저 완료되어야 합니다.`);
      console.error(`   현재 단계에서는 dry run으로만 검증: pnpm sim:seed:dry`);
      process.exit(2);
    }

    // ── 트랜잭션 ──
    console.log("==> 트랜잭션 시작");
    await sql.begin(async (tx) => {
      // search_path를 sim schema로 고정
      await tx`SET LOCAL search_path TO ${sql(process.env.QA_PG_SCHEMA!)}, public`;

      for (const { name, content } of sqlFiles) {
        console.log(`    적용: ${name}`);
        // postgres.js의 unsafe — 사용자 입력 아님 (정적 SQL 파일)
        await tx.unsafe(content);
      }
    });

    console.log("\n==> 카운트 검증");
    const counts = await sql<
      { table_name: string; count: number }[]
    >`
      SELECT 'department' AS table_name, COUNT(*)::int AS count FROM ${sql(process.env.QA_PG_SCHEMA!)}.department
      UNION ALL SELECT 'role',            COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}.role
      UNION ALL SELECT 'user',            COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}."user"
      UNION ALL SELECT 'role_assignment', COUNT(*)::int FROM ${sql(process.env.QA_PG_SCHEMA!)}.role_assignment
    `;
    for (const row of counts) {
      console.log(`    ${row.table_name.padEnd(20)} ${row.count}`);
    }

    console.log("\n✓ seed 적용 완료");
  } catch (err) {
    console.error("\n⚠ seed 실패:", err);
    throw err;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: seed/README.md 작성**

`simulations/enterprise-pm/seed/README.md`:

````markdown
# Enterprise PM 시뮬 — seed 데이터

## 구성

| 파일 | 내용 | 행 수 |
|---|---|---|
| `departments.sql` | 7 부서 (Executive, Engineering, Marketing, Finance, Operations, Sales, HR) | 7 INSERT |
| `roles.sql` | 7 역할 (admin, cfo, director, project_manager, approver, member, finance) | 7 INSERT |
| `users.sql` | 50 사용자 (각 부서별 분포) | 50 INSERT |
| `role-assignments.sql` | global 2건 + department-scope ~50건 | ~52 INSERT |
| `seed.ts` | TypeScript runner — `.env.sim` 로드 + PG 연결 + 4 SQL 트랜잭션 적용 | — |

## 실행

```bash
# 1. 환경 변수 준비 (한 번만)
sops decrypt .env.sim.enc > .env.sim

# 2. dry run (SQL 출력만 — Plan 11 전 검증)
pnpm sim:seed:dry

# 3. 실제 적용 (Plan 11a 완료 후)
pnpm sim:seed
```

## 의존성

- **Plan 09b** — qa-sdk-db에 `sim` schema + `sim_app` role
- **Plan 11a** — `sim.department`, `sim.role`, `sim.user`, `sim.role_assignment` 테이블 DDL
- **호스트 vs Docker**: 기본은 호스트 → `localhost:5434`. Docker 안에서 실행 시 `SIM_INSIDE_DOCKER=true` 환경 변수 필요 (qa-sdk-db:5432 사용).

## 데이터 분포 (디자인 §3)

```
부서          인원   역할 분포
Executive       2    admin 1, cfo 1
Engineering    12    director 1, PM 2, approver 1, member 8
Marketing       8    director 1, PM 1, approver 1, member 5
Finance         6    director 1, finance 4, approver 1
Operations      8    director 1, PM 1, approver 1, member 5
Sales           8    director 1, PM 1, approver 1, member 5
HR              6    director 1, approver 1, member 4
─────────────────────
total          50
```

## 주의

- `ON CONFLICT DO NOTHING` 패턴 — 재실행 안전 (idempotent).
- BIGSERIAL sequence는 `setval`로 max(id) 이후로 진행 — 다음 자동 INSERT 충돌 방지.
- project scope role_assignment는 동적 생성 (시나리오 2 — 프로젝트 생성 시).
````

- [ ] **Step 4: pnpm install로 새 의존 설치**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm install 2>&1 | tail -10
```

Expected: `postgres`, `dotenv`, `@types/node` 설치 + lockfile 갱신. 에러 없음.

---

## Task 5: dry run 검증

**Files:**
- 변경 없음 (실행만)

Plan 11a 완료 전이므로 실제 INSERT는 실패 — dry run으로만 검증.

- [ ] **Step 1: .env.sim 평문 생성**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && sops decrypt .env.sim.enc > .env.sim
```

- [ ] **Step 2: dry run 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && pnpm sim:seed:dry 2>&1 | tail -40
```

Expected:
```
==> Enterprise PM seed runner
    PG host: localhost:5434
    PG db:   qa_sdk
    PG user: sim_app
    schema:  sim
    mode:    DRY RUN (no execution)

    loaded: departments.sql (... lines)
    loaded: roles.sql (... lines)
    loaded: users.sql (... lines)
    loaded: role-assignments.sql (... lines)

==> DRY RUN — SQL 파일만 출력, 실행 없음

--- departments.sql ---
INSERT INTO sim.department ...

--- roles.sql ---
INSERT INTO sim.role ...

[중략]

✓ dry run 완료
```

실패 시 진단:
- `환경 변수 ... 누락` → .env.sim 복호화 또는 변수명 점검
- `SyntaxError` in tsx → typescript 버전 확인 (5.6+)

- [ ] **Step 3: 실제 적용 시도 (Plan 11a 미완료 → 안전한 실패)**

```bash
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm && pnpm sim:seed 2>&1 | tail -10
```

Expected:
```
==> Enterprise PM seed runner
    ...
    mode:    APPLY

⚠ 다음 테이블이 sim schema에 없습니다: department, role, user, role_assignment
   Plan 11a (도메인 모델)가 먼저 완료되어야 합니다.
   현재 단계에서는 dry run으로만 검증: pnpm sim:seed:dry
```

본 plan에서는 이 출력이 정상 (Plan 11 전 안전 가드 작동 확인).

- [ ] **Step 4: 정리 (.env.sim 평문 삭제)**

```bash
rm /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/.env.sim
```

평문 .env.sim은 사용자 워크스테이션에서 필요 시 다시 sops decrypt.

---

## Task 6: 회귀 점검

- [ ] **Step 1: 기존 패키지 영향 없음**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/core --filter @qa-sdk/cli typecheck 2>&1 | tail -5
```

Expected: 에러 없음.

- [ ] **Step 2: workflow-smoke**

```bash
cd /Users/junwoobang/workflow/qa-sdk && pnpm --filter @qa-sdk/cli test 2>&1 | grep -E "(passed|failed)" | tail -3
```

Expected: 통과 유지.

- [ ] **Step 3: pnpm-lock.yaml diff 검토**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git diff pnpm-lock.yaml 2>&1 | head -30
```

Expected: postgres, dotenv, @types/node 추가만. 다른 패키지 영향 없음.

- [ ] **Step 4: git status — .env.sim 평문 미트래킹 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git status simulations/enterprise-pm/ 2>&1 | grep -E "\.env\.sim($|\s)" | head -3
```

Expected: empty (평문 .env.sim은 .gitignore에 의해 untracked + 표시 안 됨). `.env.sim.enc`와 `.env.sim.example`는 staged/untracked로 보일 수 있음 (정상).

---

## Self-Review

- [ ] `.env.sim.example` — 13개 변수, 평문, git 보관
- [ ] `.env.sim.enc` — sops + age 암호화, git 보관
- [ ] 평문 `.env.sim`은 git 차단 (gitignore 확인)
- [ ] 4 SQL 파일 — departments(7) + roles(7) + users(50) + role-assignments(~52)
- [ ] BIGSERIAL setval로 sequence 동기
- [ ] ON CONFLICT DO NOTHING — idempotent
- [ ] seed.ts — 환경 변수 검증 + dry-run 모드 + 트랜잭션 + 사전 테이블 존재 점검 + 커밋 후 카운트 검증
- [ ] postgres + dotenv 의존 추가, pnpm install 성공
- [ ] dry run 정상 출력
- [ ] 실제 apply는 Plan 11a 전 안전한 에러 (테이블 미존재 가드)
- [ ] seed/README.md — 의존성 + 분포 + 실행 절차

---

## Defer (본 plan 범위 외)

| 작업 | 이유 | 후속 plan |
|---|---|---|
| `sim.department/role/user/role_assignment` 테이블 DDL | 본 plan은 데이터만, 스키마는 도메인 모델 plan | Plan 11a |
| project + budget 등 비즈니스 entity 시드 | 시나리오 안에서 동적 생성 (시나리오 2~5) | Plan 13a/b/c |
| seed 마이그레이션 (drizzle-kit migrate) | 스키마 진화는 Plan 11 책임 | Plan 11a/b/c |
| sops 정책 파일 (`.sops.yaml`) | 다중 contributor 환경에서 필요. 현재는 단일 키 | (확장 시) |
| seed 스냅샷 검증 (테이블 row count expected) | Plan 14b 통합 회귀에서 추가 | Plan 14b |
| performance dataset (대량 user/project) | 부하 시뮬은 별도 plan | (defer 영구) |

---

## 의존·후속

- **선행**:
  - Plan 09a (workspace + package.json 골격)
  - Plan 09b (qa-sdk-db sim_app role + QA_SDK_SIM_PASSWORD) — `.env.sim`이 동일 비밀번호 사용
  - Plan 09c (docker-compose.sim.yaml) — 본 plan은 .env.sim 위치 자체에는 영향 없음, 사용 시점만 충돌
- **병렬 가능**: Plan 09c — 두 plan은 다른 파일 작업
- **후속**:
  - Plan 10 (NestJS 서비스 스캐폴딩) — `.env.sim`을 컨테이너 env_file로 사용
  - Plan 11a (도메인 모델) — sim.department/role/user/role_assignment 테이블 DDL → 본 plan의 seed가 비로소 적용됨
  - Plan 13 (시나리오) — seed 사용자 50명을 역할별로 시나리오 actor로 활용
