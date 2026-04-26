# Enterprise PM Simulation

> qa-sdk 5축(권한·이벤트·관측·로직·로깅)을 PM + Approval Workflow 도메인에서 end-to-end 검증하는 test harness.

## 목적

- 9 마이크로서비스 + Hono gateway 토폴로지 위에서 8 시나리오를 실행하여 qa-sdk의 핵심 기능 검증
- weighted-index, permission-engine, resource-policy-store, audit-recorder-store, ingest-server, @qa-sdk/otel 등 본체 패키지가 실제 도메인에서 동작하는지 확인
- 디자인 문서: [`/docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md`](../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md)

## 위치 및 범위

- 위치: `simulations/enterprise-pm/` (qa-sdk 모노레포 내부 workspace member)
- 9 NestJS 서비스 + Hono gateway + 1 Redis + qa-sdk 본체 (qa-sdk-db, ingest-server) 외부 참조
- CLI scenario runner only (UI 없음)

## 토폴로지

```
                      gateway (8888) — Hono + JWT bitmap embed + traceparent
                            │
   ┌──────────┬─────────────┼─────────────┬──────────────┐
   ↓          ↓             ↓             ↓              ↓
 auth-api   pm-api    approval-api   document-api   reporting-api
 (4400)    (4500)       (4600)         (4900)         (4800)
                            │
                            ↓
                  sim-redis (6379) — bitmap:invalidate pub/sub
                            │
                            ↓
                  notification-api (4700)

qa-sdk 본체:
  qa-sdk-db (5434)            — PG 운영 DB (sim schema)
  ingest-server (3200)        — 모든 서비스의 IngestForwarder 수신
  sim-audit-browser-api (5100) — audit-recorder-store 조회 API
  sim-metrics-collector (5200) — Prometheus exporter
```

## Quickstart

### 1. 인프라 부팅

```bash
# qa-sdk-db (PG) — 5434
cd packages/infra-engine && docker compose -f docker-compose.infra.yaml up -d qa-sdk-db

# sim 인프라 + 9 서비스
cd simulations/enterprise-pm && docker compose -f docker-compose.sim.yaml up -d
```

### 2. 통합 smoke

```bash
cd /Users/junwoobang/workflow/qa-sdk
pnpm sim:smoke
```

9 서비스 health → 8 시나리오 batch → density 측정까지 자동 실행. `--keep-up`으로 부팅 상태 유지.

### 3. 시나리오 단독 실행

```bash
# 모든 시나리오
pnpm sim:scenarios run --all

# 특정 시나리오
pnpm sim:scenarios run scenario-1-login
pnpm sim:scenarios run scenario-4-cross-dept-deny

# 시나리오 목록
pnpm sim:scenarios list
```

`--mode in-process`는 현재 auth-api, pm-api, approval-api, audit-browser-api, gateway만 부팅한다. 현재 시나리오 매트릭스는 이 subset으로 동작하지만, notification/reporting/document API 자체를 직접 검증하는 흐름은 docker/http 모드를 기준으로 본다.

### 4. density 측정

```bash
pnpm sim:scenarios density --prefix=sim.bitmap --version=uv1
```

기본 docker/PG 경로에서는 reporting-api가 `ingest.key_observations`를 직접 읽어 §5 marginal density를 계산한다. sqlite/in-process 경로는 ingest store 분리가 아직 없어 in-memory fallback이다.

## 서비스·포트

| 서비스 | 포트 | 역할 |
|---|---|---|
| sim-gateway | 8888 | Hono — JWT bitmap embed + traceparent 주입 |
| sim-auth-api | 4400 | User/Role/Department + bitmap 발행 |
| sim-pm-api | 4500 | Project/Task/Member |
| sim-approval-api | 4600 | Budget/Resource/Time-off/Expense workflow |
| sim-notification-api | 4700 | 알림·구독 |
| sim-reporting-api | 4800 | 분석·대시보드 + `GET /density` |
| sim-document-api | 4900 | 첨부·코멘트·버전 |
| sim-audit-browser-api | 5100 | audit trace explorer + authorization graph snapshot API |

`sim-authorization-graph-provider`는 `AuthorizationGraphStore`의 sim adapter다. 기본 docker/PG 경로에서는 pm-api와 audit-browser-api가 같은 persistent graph snapshot table을 통해 delegated graph를 공유한다.

`sim-audit-browser-api`는 최신 snapshot 조회뿐 아니라 graph별 snapshot 목록, snapshot diff, graph catalog, prune, trace+graph composite context를 제공한다.
| sim-metrics-collector | 5200 | Prometheus exporter |
| sim-redis | 6379 | bitmap pub/sub + event broadcast |

포트 할당: `docs/specs/infra-engine/infra-port-allocation.spec.md`.

## 8 시나리오 — 검증 매트릭스

| # | 시나리오 | 검증 대상 |
|---|---|---|
| 1 | login + bitmap 발행 | §2 issuance, JWT embed |
| 2 | project create + owner 자동 권한 | resource-policy UNREGISTERED, 2-pass |
| 3 | 자기 부서 100만원 단일 승인 | state machine, audit nested tree |
| 4 | cross-dept 단독 승인 → deny | RLS scoping, decision replay (firstFailure) |
| 5 | 1500만원 → 3-stage 승인 | 다단계 transition, OTEL trace 일관성 |
| 6 | DELEGATED 외부 컨설턴트 위임 | resource-policy.delegate, Pass 2 acl branch, graph snapshot lifecycle |
| 7 | bitmap 만료 → refresh | §2 §4 refresh endpoint |
| 8 | 권한 변경 → pub/sub invalidation | §2 §5 Redis pub/sub, LRU flush |

## 운영 가이드

상세 부팅·환경변수·troubleshooting → [`docs/operations.md`](docs/operations.md)
canonical operator flow → [`docs/operator-workflows.md`](docs/operator-workflows.md)

graph snapshot housekeeping CLI:

```bash
pnpm --filter @qa-sdk/sim-scenarios start -- housekeeping graph-retention --keep-latest 1
pnpm --filter @qa-sdk/sim-scenarios start -- housekeeping graph-retention --graph-id consultant-graph-123 --keep-latest 1
pnpm --filter @qa-sdk/sim-scenarios start -- housekeeping graph-retention --graph-id consultant-graph-123 --keep-latest 1 --with-insight
```

optional periodic housekeeping:

```bash
SIM_GRAPH_RETENTION_KEEP_LATEST=1 \
SIM_GRAPH_RETENTION_INTERVAL_MS=60000 \
pnpm --filter @qa-sdk/sim-audit-browser-api start
```

retention observability events:
- `sim.graph_retention.sweep`
- `sim.graph_retention.graph_pruned`
- `sim.graph_retention.failed`

ingest insight query:

```bash
curl "http://localhost:3200/v1/insights/graph-retention?limit=20" | jq .
curl "http://localhost:3200/v1/insights/graph-retention?graph_id=consultant-graph-123" | jq .
```

`GET /audit/context/:rootSpanId/:graphId`는 `QA_INGEST_URL`이 설정된 경우 `graphRetentionInsight`도 함께 반환한다.

operator composite CLI:

```bash
pnpm --filter @qa-sdk/sim-scenarios start -- audit context --root-span-id <root-span-id> --graph-id <graph-id>
pnpm --filter @qa-sdk/sim-scenarios start -- audit trace --root-span-id <root-span-id>
pnpm --filter @qa-sdk/sim-scenarios start -- audit first-failure --root-span-id <root-span-id>
```

## 외부 의존 (qa-sdk 본체 컨테이너)

- `qa-sdk-db` (5434) — `sim` schema
- `ingest-server` (3200) — IngestForwarder 수신 + `GET /density`의 ingest.key_observations 소스
- `host.docker.internal:4318` — OTEL collector (Tempo/Jaeger) (옵션)

## 관련 plan

- Plan 09 (인프라): 09a/b/c/d
- Plan 10 (서비스 스캐폴딩): 10a/b/c
- Plan 11 (도메인 모델): 11a/b/c
- Plan 12 (cross-service 통합): 12a/b/c
- Plan 13 (시나리오): 13a/b/c/d
- Plan 14 (검증·마무리): 14a/b
- 디자인: [`sim-erp-pm-design.md`](../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md)
- 5축 커버리지 spec: [`docs/specs/sim-erp-pm-coverage.spec.md`](../../docs/specs/sim-erp-pm-coverage.spec.md)

## Architecture Simulation Lab

`/Users/junwoobang/document/아키텍처`의 도메인 계층, CQRS, saga/outbox, OpenMetadata 거버넌스 개념은 `scenarios/src/architecture/architecture-manifest.ts`에서 시뮬레이션 slice로 매핑한다.

초기 slice:

- `assignment-command-write-model`: 목적형 command DTO, rich aggregate, repository port, transactional outbox.
- `assignment-read-model-sync`: outbox event 기반 read model sync와 QueryPort/back-query composition.
- `openmetadata-governance-seed`: OpenMetadata Domain/Team/Glossary/Lineage/Data Quality seed.
- `oa-sdk-openapi-merge-gate`: `contracts/openapi/src`의 domain별 OpenAPI fragment를 `/Users/junwoobang/workflow/oa-sdk` 병합 규칙으로 검증하는 계약 gate.

계약 fragment 위치:

```bash
simulations/enterprise-pm/contracts/openapi/src/domains/assignment/spec.yaml
```

`oa-sdk` 병합 관리 도구 연동은 `simulations/enterprise-pm/contracts/openapi/README.md`를 기준으로 진행한다.

## 라이선스 / 정책

본 시뮬은 qa-sdk 검증용 test harness이며 실제 제품이 아니다. 진짜 ERP의 HR·재무·인벤토리 모듈은 의도적으로 제외한다.
