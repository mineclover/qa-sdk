# Enterprise PM Simulation — Operations Guide

운영자 / 디버거 참조 문서. 부팅 절차 + 환경 변수 + troubleshooting.

## 1. 시스템 개요

본 시뮬은 9 마이크로서비스 + Hono gateway + Redis + qa-sdk 본체 인프라(PG + ingest-server)로 구성된다. 8 시나리오를 실행하여 qa-sdk의 5축(권한·이벤트·관측·로직·로깅)을 검증한다.

상세 디자인: [`sim-erp-pm-design.md`](../../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md)

## 2. 부팅 절차

### 사전 조건

- Docker 24+
- pnpm 10+
- node 22+

### 단계

```bash
# 1. qa-sdk 본체 빌드 (workspace dep 활용)
cd /Users/junwoobang/workflow/qa-sdk
pnpm install
pnpm -r build

# 2. infra (qa-sdk-db) 부팅
cd packages/infra-engine
docker compose -f docker-compose.infra.yaml up -d qa-sdk-db
# 첫 부팅 시 init.sql 실행 — sim schema 자동 생성

# 3. sim 인프라 + 9 서비스 부팅 (.env.docker 자동 로드)
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
docker compose --env-file .env.docker -f docker-compose.sim.yaml up -d
# 30초 대기 (NestJS 부팅 + drizzle migration)

# 4. 9 서비스 health 확인
for port in 4400 4500 4600 4700 4800 4900 5100 8888 5200; do
  curl -fsS http://localhost:$port/health | jq .service
done
```

### 통합 smoke 한 번에

```bash
pnpm sim:smoke
```

## 3. 토폴로지

```
gateway (8888) — JWT bitmap embed + traceparent
   │
   ├─ auth-api (4400)         [bitmap 발급, RoleAssignment, BitmapInvalidationPublisher]
   ├─ pm-api (4500)           [Project / Task / Member]
   ├─ approval-api (4600)     [BudgetRequest / ApprovalStep]
   ├─ notification-api (4700)
   ├─ reporting-api (4800)    [Report / DailyMetric / GET /density]
   ├─ document-api (4900)
   └─ audit-browser-api (5100) [audit-recorder + authorization graph snapshot 조회 API]

sim-redis (6379) — pub/sub bitmap:invalidate
sim-metrics-collector (5200) — Prometheus exporter

qa-sdk 본체:
  qa-sdk-db (5434)            — PG 운영 DB
  ingest-server (3200)        — 모든 서비스 로그/event 수집 + density 소스
  sim.authorization_graph_snapshots — delegated graph snapshot persistence
```

## 4. 환경 변수

`.env.docker` 파일 (`docker-compose.sim.yaml`이 `--env-file`로 로드):

| 변수 | 용도 | default |
|---|---|---|
| `QA_DB_DIALECT` | sqlite / pg | `pg` |
| `QA_PG_HOST` | PG 호스트 | `qa-sdk-db` |
| `QA_PG_PORT` | PG 포트 | `5432` |
| `QA_PG_DATABASE` | DB 이름 | `qa_sdk` |
| `QA_PG_USER` | sim 도메인 user | `sim_app` |
| `QA_PG_PASSWORD` | (sops 암호화) | — |
| `QA_PG_SCHEMA` | sim 스키마 | `sim` |
| `SIM_REDIS_URL` | Redis URL | `redis://sim-redis:6379` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTel collector | `http://host.docker.internal:4318` |
| `QA_INGEST_URL` | IngestForwarder 대상 | `http://host.docker.internal:3200` |
| `JWT_SECRET` | gateway HS256 | (부팅 시 32+ char 강제) |

상세: [`/docs/CONVENTIONS.md`](../../../docs/CONVENTIONS.md) env var 표 참조.

## 5. 8 시나리오 실행

```bash
# 모든 시나리오
pnpm sim:scenarios run --all

# 특정 시나리오
pnpm sim:scenarios run scenario-3-self-dept-approval

# JSON 출력 (CI 통합용)
pnpm sim:scenarios run --all --json > /tmp/sim-results.json

# in-process 실행 (docker 없이 검증)
SIM_SCENARIO_INPROC=1 pnpm sim:scenarios run scenario-1-login
```

주의:
- 현재 in-process bootstrap 은 auth-api, pm-api, approval-api, audit-browser-api, gateway만 띄운다.
- notification/reporting/document API를 직접 때리는 흐름은 docker/http 모드를 기준으로 본다.
- 현재 시나리오 1~8은 이 subset으로 동작하도록 구성돼 있다.

각 시나리오:
- exit code 0 → 모든 시나리오 passed
- exit code 1 → 1+ 시나리오 실패
- 실패 시 stderr에 phase (setup/act/assert/teardown) + 에러 메시지

## 6. density 측정 워크플로우

```bash
# 1. 8 시나리오 실행으로 event 누적
pnpm sim:scenarios run --all

# 2. density 측정 (sim.bitmap 예시)
pnpm sim:scenarios density --prefix=sim.bitmap --version=uv1

# JSON 출력
pnpm sim:scenarios density --prefix=sim.bitmap --version=uv1 --json
```

threshold:
- `underutilized: density < 0.1` — 축이 거의 관측 안 됨 (설계 과잉 또는 트래픽 누락)
- `saturated: density > 0.9` — 축이 거의 다 관측 (capacity headroom 부족)

§5 spec: [`/docs/specs/event-vocab-system/event-taxonomy-marginal-density.plan.md`](../../../docs/specs/event-vocab-system/event-taxonomy-marginal-density.plan.md)

## 7. Troubleshooting

### Port 충돌

```bash
# 충돌 확인
for port in 4400 4500 4600 4700 4800 4900 5100 8888 5200 5434 6379; do
  echo "port $port:"; lsof -nP -iTCP:$port 2>&1 | head -2
done
# 충돌 시 docker compose down 후 재시도
```

### Redis 연결 실패

```bash
docker compose -f docker-compose.sim.yaml exec sim-redis redis-cli ping
# PONG이 안 오면 컨테이너 재시작
docker compose -f docker-compose.sim.yaml restart sim-redis
```

### 시나리오 실패 디버깅

```bash
# 실패한 시나리오의 traceId로 audit 조회
curl http://localhost:8888/audit/trace/<root-span-id> -H "Authorization: Bearer $TOKEN" | jq .

# firstFailure 조회
curl http://localhost:8888/audit/firstFailure/<root-span-id> -H "Authorization: Bearer $TOKEN" | jq .

# delegated graph snapshot 조회
curl http://localhost:8888/audit/graphs/<graph-root-id>/latest -H "Authorization: Bearer $TOKEN" | jq .

# delegated graph snapshot 목록
curl http://localhost:8888/audit/graphs/<graph-root-id> -H "Authorization: Bearer $TOKEN" | jq .

# delegated graph snapshot diff
curl http://localhost:8888/audit/graphs/diff/<from-snapshot-id>/<to-snapshot-id> -H "Authorization: Bearer $TOKEN" | jq .

# trace + firstFailure + latest graph snapshot composite view
curl http://localhost:8888/audit/context/<root-span-id>/<graph-root-id> -H "Authorization: Bearer $TOKEN" | jq .
```

기본 docker/PG 경로에서는 pm-api가 delegated graph snapshot을 `AuthorizationGraphStore` persistent adapter로 저장하고, audit-browser-api가 같은 table을 읽는다.

### NestJS 서비스 부팅 실패

```bash
# 로그 확인
docker compose -f docker-compose.sim.yaml logs sim-pm-api --tail 50

# 일반적 원인:
# - DB 연결 실패 → QA_PG_PASSWORD 또는 sim schema 미생성
# - Redis 연결 실패 → sim-redis 부팅 안 됨
# - OTel 부팅 실패 → OTEL_EXPORTER_OTLP_ENDPOINT 잘못됨 (선택 dep — fail-open)
```

### bitmap 검증 실패 (시나리오 1)

```bash
# auth-api에서 직접 bitmap 발급 테스트
curl -X POST http://localhost:4400/bitmap/issue \
  -H "content-type: application/json" \
  -d '{"userId":"alice-id"}'
# maskBase64가 비어있으면 — RoleAssignment 시드 누락 (seed.ts 확인)
```

### density 응답이 0으로만 나온다

- sqlite / in-process 경로는 기본적으로 in-memory keyObservationStore를 사용한다.
- docker 기본 경로(`QA_DB_DIALECT=pg`)에서는 reporting-api가 `ingest.key_observations`를 직접 조회한다.
- PG 경로에서도 0만 나오면 `qa-sdk-db`에 시나리오 실행 결과가 실제로 적재됐는지와 `QA_INGEST_URL`을 먼저 확인한다.

## 8. Teardown

```bash
# 9 서비스 + redis 종료
cd simulations/enterprise-pm && docker compose -f docker-compose.sim.yaml down

# 데이터 볼륨까지 삭제 (sim schema reset)
docker volume rm enterprise-pm_sim-redis-data

# qa-sdk-db는 유지 (다른 실험과 공유)
```

## 9. 추가 참조

- [Plan 14a — marginal density 측정](../../../docs/proposals/auth-model-implementation-backlog/plans/14a-sim-marginal-density-measurement.md)
- [§2 Bitmap pipeline spec](../../../docs/specs/authorization-ontology/authorization-ontology-bitmap-pipeline.spec.md)
- [§5 Marginal density plan](../../../docs/specs/event-vocab-system/event-taxonomy-marginal-density.plan.md)
- [sim-erp-pm-coverage.spec.md](../../../docs/specs/sim-erp-pm-coverage.spec.md) — 본 시뮬이 검증한 5축 매트릭스
