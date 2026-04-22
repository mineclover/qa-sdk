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
