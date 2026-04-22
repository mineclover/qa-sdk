# Enterprise PM 시뮬레이션 — 디자인

2026-04-22 · Phase 4 brainstorming 결과

qa-sdk의 5축(권한·이벤트·관측·로직·로깅)을 현실적 엔터프라이즈 도메인에서 end-to-end 검증하는 시뮬 프로젝트. 9 마이크로서비스 + CLI scenario runner. `simulations/enterprise-pm/`에 위치.

---

## 1. 스코프 & 포지셔닝

**목적**: qa-sdk의 5축을 현실적 도메인에서 end-to-end 검증하는 test harness. 실제 제품 아님.

**스코프**:
- **도메인**: Project Management + Approval Workflows (Budget/Resource/Time-off/Expense). HR·재무·인벤토리 진짜 ERP 모듈은 제외.
- **조직**: 단일 회사, 다중 department (Engineering/Marketing/Finance 등 5~7개), department-scoped 권한.
- **아키텍처**: 9개 NestJS 마이크로서비스 + Hono gateway. qa-sdk 실제 토폴로지(7 서비스)와 동일 규모 + 2개.
- **클라이언트**: CLI scenario runner (TypeScript). 브라우저 UI/Playwright 모두 제외.
- **위치**: `simulations/enterprise-pm/` (qa-sdk 모노레포). pnpm workspace에 `simulations/*` 추가.

**검증 대상 qa-sdk 기능**:
- 권한: weighted-index + permission-engine + resource-policy-store + §3 RLS → 2-pass AccessChecker
- 이벤트: event-catalog + browser-codec(CLI adapter) + ingest-server key_observations + §5 marginal density
- 관측: @qa-sdk/otel + audit-recorder-store + nested-audit-tracing
- 로직: state machine (ResourcePolicyRegistry) + transaction 경계
- 로깅: @qa-sdk/logger + IngestForwarder + structured log trace_id 연결

**성공 기준** (8 시나리오 all green):
- 8 CLI scenario 전체 통과
- OTEL trace에 모든 서비스 span 연결 (traceparent propagation)
- audit-recorder가 각 시나리오의 nested tree 영속
- deny 시나리오의 decision replay 정확
- bitmap 변경 → invalidation → 캐시 flush 검증

---

## 2. 서비스 토폴로지 + 포트 할당

**9개 서비스 + 인프라**:

```
                                   ┌─────────────────┐
                                   │ gateway (8888)  │  Hono — JWT bitmap embed, traceparent
                                   └────────┬────────┘
                                            │
   ┌──────────────────────────┬─────────────┼─────────────┬──────────────────────┐
   ↓                          ↓             ↓             ↓                      ↓
┌────────────┐   ┌────────────┐   ┌────────────────┐   ┌──────────────┐   ┌────────────────┐
│ auth-api   │   │ pm-api     │   │ approval-api   │   │ document-api │   │ reporting-api  │
│ 4400       │   │ 4500       │   │ 4600           │   │ 4900         │   │ 4800           │
└─────┬──────┘   └────────────┘   └───────┬────────┘   └──────────────┘   └───────┬────────┘
      │                                   │                                       │
      │ bitmap pub/sub                    │ event emit                            │ aggregate
      ↓                                   ↓                                       ↓
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Redis (6379) — pub/sub: bitmap:invalidate, event:domain.action                  │
└────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ↓
                              ┌─────────────────────────────┐
                              │ notification-api (4700)     │
                              └─────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────┐
   │ qa-sdk 본체 (수신측)                                        │
   │  ingest-server (3200) ← 모든 서비스의 IngestForwarder      │
   │  sim-audit-browser-api (5100) ← audit-recorder-store 조회  │
   │  sim-metrics-collector (5200) ← /metrics scrape            │
   └─────────────────────────────────────────────────────────────┘
```

**SERVICE_PORTS 추가** (4xxx 비즈니스 + 5xxx 시뮬 인프라):

```ts
// ── 시뮬레이션 — Enterprise PM ──
{ name: "sim-auth-api",            defaultPort: 4400, description: "시뮬: 사용자/role/department + bitmap 발행" },
{ name: "sim-pm-api",              defaultPort: 4500, description: "시뮬: Project/Task/Member" },
{ name: "sim-approval-api",        defaultPort: 4600, description: "시뮬: Budget/Resource/Time-off/Expense workflow" },
{ name: "sim-notification-api",    defaultPort: 4700, description: "시뮬: 알림·구독" },
{ name: "sim-reporting-api",       defaultPort: 4800, description: "시뮬: 분석·대시보드 (marginal density 측정)" },
{ name: "sim-document-api",        defaultPort: 4900, description: "시뮬: 첨부파일·코멘트·버전" },
{ name: "sim-gateway",             defaultPort: 8888, description: "시뮬: Hono gateway (JWT + traceparent)" },
{ name: "sim-audit-browser-api",   defaultPort: 5100, description: "시뮬: audit trace explorer API" },
{ name: "sim-metrics-collector",   defaultPort: 5200, description: "시뮬: Prometheus exporter" },
```

**서비스간 통신**:

| 패턴 | 사용처 | 기술 |
|---|---|---|
| HTTP REST | gateway → 비즈니스 API, 비즈니스 API 간 | Hono client / NestJS HTTP |
| JWT bitmap | auth-api 발행 → gateway embed → 모든 API 검증 | jose |
| Redis pub/sub | bitmap invalidation, event broadcasting | ioredis |
| OTEL traceparent | 모든 서비스간 호출 trace 연결 | W3C, @opentelemetry/api |
| IngestForwarder | 각 서비스 → ingest-server (3200) | qa-sdk/logger |

**서비스별 ownedPrefixes**:
- `sim-auth-api`: `sim.user`, `sim.role`, `sim.dept`, `sim.bitmap`
- `sim-pm-api`: `sim.project`, `sim.task`, `sim.member`
- `sim-approval-api`: `sim.budget`, `sim.resource`, `sim.timeoff`, `sim.expense`
- `sim-notification-api`: `sim.notif`, `sim.subscribe`
- `sim-reporting-api`: `sim.report`, `sim.metric`
- `sim-document-api`: `sim.doc`, `sim.comment`, `sim.attachment`

---

## 3. 데이터 모델 + 권한 hierarchy

**핵심 entity** (도메인별):

```
auth domain (auth-api):
  User           — id, email, displayName, departmentId, primaryRoleId
  Department     — id, name, parentId, managerId
  Role           — id, name (project_manager/member/approver/finance/admin/director/cfo)
  RoleAssignment — userId, roleId, scopeType (global|department|project), scopeId

pm domain (pm-api):
  Project        — id, name, ownerId, departmentId, status
  Task           — id, projectId, title, assigneeId, status, parentTaskId
  ProjectMember  — projectId, userId, role (lead|contributor|viewer)

approval domain (approval-api):
  BudgetRequest  — id, projectId, amount, requesterId, status, currentStage, totalStages
  ApprovalStep   — requestId, stageNumber, approverId, decision, comment, decidedAt
  ResourceRequest, TimeOffRequest, ExpenseReport — 유사 패턴

document, notification, reporting — §3 본문 참조
```

**권한 hierarchy 5계층**:

```
RoleAssignment.scopeType:
   global       → 모든 리소스 (admin, cfo)
   department   → 해당 부서 모든 리소스 (director, dept_manager)
   project      → 해당 프로젝트만 (project_lead, member, viewer)
```

**bitmap encoding** (DisjointUnionIndex per domain prefix):

```ts
// 예: auth domain
const authUnion = new DisjointUnionIndex([
  { kind: "user_action",  shape: [USER_ACTIONS.length, 1] },
  { kind: "role_action",  shape: [ROLE_ACTIONS.length, 1] },
  { kind: "dept_action",  shape: [DEPT_ACTIONS.length, 1] },
]);
```

bitmap mask는 user의 role × scope에서 derive. AccessChecker가 Pass 1에서 확인.

**state machine** (approval-api):

```
BudgetRequest:
  draft → submitted → in_review → (approved | rejected | revision_requested → submitted)

stages by amount:
  amount < 1,000,000     → 1 stage  (manager)
  1M ≤ amount < 10M      → 2 stages (manager → director)
  amount ≥ 10M           → 3 stages (manager → director → cfo)
```

**PG schema**: 단일 `sim` schema 안에 도메인별 테이블 prefix (`sim.pm_project`, `sim.approval_budget_request` 등). qa-sdk 본체의 4 schema와 격리, 1개 추가 = 6 schema 전체.

---

## 4. 8 시나리오 정의

| # | 시나리오 | 검증 대상 |
|---|---|---|
| 1 | 로그인 → bitmap 발행 → 프로젝트 list | §2 issue, JWT embed, computeUserBits |
| 2 | 프로젝트 생성 + owner 자동 권한 | resource-policy lifecycle (UNREGISTERED), 2-pass |
| 3 | 자기 부서 budget 100만원 승인 (1단계) | 단순 transition, Pass 2 |
| 4 | 타 부서 budget 단독 승인 시도 → deny | RLS scoping, deny path, decision replay |
| 5 | 1000만원 초과 → 3단계 승인 | nested audit tree, transaction 경계 |
| 6 | DELEGATED 리소스 (외부 컨설턴트 위임) | DELEGATED state, authorization-graph |
| 7 | bitmap 만료 → refresh | §2 refresh endpoint |
| 8 | 권한 변경 → pub/sub invalidation | §2 Redis pub/sub, LRU flush |

각 시나리오의 detailed steps + audit tree 예시는 `simulations/enterprise-pm/scenarios/<scenario>.md`에 별도 (Plan 13에서 작성).

**커버리지 매트릭스** (qa-sdk 기능 ↔ 시나리오):

| 기능 | 시나리오 |
|---|---|
| weighted-index DisjointUnionIndex | 1, 2, 3 (모든 시나리오 기반) |
| VersionedBitmap (issue/verify/refresh) | 1, 7 |
| Bitmap pub/sub invalidation (§2) | 8 |
| resource-policy-store state machine | 2, 3, 6 |
| AccessChecker 2-pass | 2, 3, 4 |
| audit-recorder nested tree | 3, 4, 5 |
| decision replay (firstFailure) | 4 |
| DELEGATED + authorization-graph | 6 |
| RLS (Phase 3 완료 후) | 4 (cross-department deny) |
| event emit + ingest → marginal density (§5) | 모든 시나리오 |
| OTEL traceparent cross-service | 1, 5, 8 |

---

## 5. Infrastructure — Docker, DB, 관측

**Docker Compose** (`simulations/enterprise-pm/docker-compose.sim.yaml`):

- `sim-redis` (6379) + 9 NestJS 서비스 (Dockerfile.service 공통)
- 의존: qa-sdk 본체의 `qa-sdk-db` (5434, Plan 04a) + `zitadel-db` + `ingest-server` 외부 참조

**DB**:
- dialect: PG (Phase 2 design 활용)
- `sim` schema (qa-sdk 본체 4 schema와 격리)
- Drizzle schema는 시뮬 자체에서 정의
- 시드 데이터: `simulations/enterprise-pm/seed/*.sql` + `seed.ts` runner
- 7 departments, 50 users, 7 roles, role_assignments, sample projects

**OTEL**:
- 모든 서비스가 `@qa-sdk/otel` `initTelemetry`
- OTLP exporter → Tempo/Jaeger 또는 qa-sdk collector
- gateway가 W3C traceparent 헤더 주입 → 서비스간 전파

**Ingest 흐름**:
- 모든 서비스 → `@qa-sdk/core` + `event-catalog` → `browser-codec` CLI adapter → ingest-server (3200)

**환경 변수** (`.env.sim`):
```
QA_DB_DIALECT=pg
QA_PG_HOST=qa-sdk-db
QA_PG_PORT=5432
QA_PG_DATABASE=qa_sdk
QA_PG_USER=sim_app
QA_PG_PASSWORD=<sops>
QA_PG_SCHEMA=sim
SIM_REDIS_URL=redis://sim-redis:6379
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
QA_INGEST_URL=http://host.docker.internal:3200
```

**Plan 04a init.sql 갱신 필요**:
- `CREATE SCHEMA sim`
- `CREATE ROLE sim_app WITH LOGIN PASSWORD :'sim_pw'`
- 권한 grant + qa_admin SELECT

---

## 6. Plan 분해 (19 plans)

```
Plan 09 — 인프라 부트스트랩 (4 sub-plan)
Plan 10 — 9 서비스 스캐폴딩 (3 sub-plan)
Plan 11 — 도메인 모델 + DB schema (3 sub-plan)
Plan 12 — Cross-service 통신 + 권한 통합 (3 sub-plan)
Plan 13 — 8 시나리오 구현 (4 sub-plan)
Plan 14 — 검증·마무리 (2 sub-plan)
```

**Phase 5 흡수**:
- §2 Bitmap pipeline의 refresh·pub/sub invalidation은 Plan 12b로 자연 흡수
- §5 Marginal density 측정은 Plan 14a로 자연 흡수
- → Phase 5의 §2 + §5 별도 plan 작성 안 함. 시뮬 완성으로 자동 검증.

**의존 그래프**:

```
Phase 2 (Plan 04~07) ── Phase 3 (§3 RLS) ── Plan 09
                                              ↓
                                  (Plan 09 후 10/11 병렬)
                                      ↓               ↓
                                    Plan 10        Plan 11
                                      ↓               ↓
                                      └────→ Plan 12 ←┘
                                               ↓
                                            Plan 13
                                               ↓
                                            Plan 14
```

**Plan 별 책임 (요약)**:

| Plan | 책임 |
|---|---|
| 09a | `simulations/enterprise-pm/` + pnpm workspace 통합 + root package.json |
| 09b | qa-sdk-db init.sql 갱신 (sim schema + sim_app role) + SERVICE_PORTS 9 entry |
| 09c | docker-compose.sim.yaml + Dockerfile.service + sim-redis |
| 09d | .env.sim + sops + seed/ + seed runner 스캐폴딩 |
| 10a | auth-api, pm-api, approval-api 스캐폴딩 (NestJS + /health + OTEL + logger) |
| 10b | notification-api, reporting-api, document-api, audit-browser-api 스캐폴딩 |
| 10c | gateway (Hono) + metrics-collector (Prometheus exporter) 스캐폴딩 |
| 11a | auth domain — User/Role/Department/RoleAssignment + bitmap encoding |
| 11b | pm + approval domain — Project/Task/BudgetRequest/ApprovalStep + state machine |
| 11c | notification + document + reporting domain |
| 12a | gateway JWT bitmap 발행/검증 + traceparent + 라우팅 |
| 12b | bitmap pub/sub invalidation (Redis) + LRU cache |
| 12c | OTEL 전파 검증 + IngestForwarder + audit-recorder 연동 |
| 13a | scenario runner 프레임워크 + 시나리오 1, 2 |
| 13b | 시나리오 3, 4 |
| 13c | 시나리오 5, 6 |
| 13d | 시나리오 7, 8 |
| 14a | §5 marginal density 측정 + reporting-api 노출 |
| 14b | 통합 회귀 + 문서 |

**병렬 가능성**:
- Plan 09a ⊥ 09b (병렬), 09c ⊥ 09d
- Plan 10a/b/c 모두 병렬
- Plan 11a → 11b → 11c (순차)
- Plan 12 시리즈 순차 (a → b → c)
- Plan 13 시리즈 순차
- Plan 14a, 14b 병렬

---

## 7. 용어·결정 요약

| 용어 | 의미 |
|---|---|
| **시뮬레이션 프로젝트** | qa-sdk 검증용 test harness with realistic domain |
| **Enterprise PM 도메인** | PM + Approval Workflows. 진짜 ERP 모듈 제외. |
| **scenario runner** | CLI TypeScript 스크립트. 8 비즈니스 흐름 자동 실행 |
| **sim schema** | qa-sdk_db의 6번째 schema (auth/audit/ingest/decision/definition/sim) |

**재협상 없이 따를 결정**:

- 9개 마이크로서비스 (NestJS 8 + Hono gateway)
- CLI runner only (UI 제외)
- 위치: `simulations/enterprise-pm/`
- DB: PG dual-target (Phase 2 패턴), `sim` schema 격리
- 8 시나리오 (golden + edge), 부하 시뮬은 별도 plan으로 defer
- 19 plan 분해 (09~14 시리즈)
- Phase 5 §2/§5는 본 시뮬에 흡수 (별도 plan 안 만듦)

---

## 8. 의존·후속

**선행 (필수 완료)**:
- Phase 2 (Plan 04~07): qa-sdk-db + db-bootstrap + 권한 도메인 PG 어댑터
- Phase 3 (§3 RLS): 시나리오 4의 cross-department deny가 RLS 활용 (RLS 없어도 application-level 검증은 가능, 단 검증 가치 약함)

**후속**:
- 부하 시나리오 (옵션 D): 100+ user 동시 액션 시뮬, marginal density 정밀 측정
- ACL 외부 협업자 시나리오 확장 (Q2 옵션 D)
- 실제 사용자 데모용 SPA 추가 (시뮬 외부 별도 프로젝트)
