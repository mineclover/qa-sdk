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
| `fixtures.test.ts` / `seed.test.ts` | SQL ↔ JS drift 감지 | — |

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
