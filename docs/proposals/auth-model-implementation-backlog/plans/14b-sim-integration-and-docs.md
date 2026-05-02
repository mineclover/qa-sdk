---
lifecycle: draft
plan: 14b
phase: 4
depends-on: [14a, 13d, 12c]
---

# Plan 14b — sim 통합 회귀 + 문서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plan 09~14a의 19 plan 결과물을 통합 회귀 + 문서화로 마무리한다. (1) **smoke 회귀** — `simulations/enterprise-pm/scripts/smoke.sh` — docker-compose 부팅 → 9 서비스 health → 8 시나리오 batch 실행 → density 측정까지 단일 명령. CI에서 (env gate로) 호출 가능. (2) **operations.md** — `simulations/enterprise-pm/docs/operations.md` 부팅 절차, 환경 변수, troubleshooting, 시나리오 실행, density 측정 가이드. (3) **README.md 갱신** — `simulations/enterprise-pm/README.md` 입문자용 (목적, 토폴로지, quickstart). (4) **시뮬-qa-sdk 연결 spec 문서** — `docs/specs/`에 `sim-erp-pm-coverage.spec.md` — 본 시뮬이 검증한 5축 (권한·이벤트·관측·로직·로깅) 매트릭스 + 8 시나리오 결과 + qa-sdk 본체와의 추적성. (5) **def sync + def validate** 통과 검증 — 신규 시뮬 spec 문서가 def-graph에 등록. (6) **workflow-smoke 회귀** — silent-empty CLI 회귀 12건 PASS 유지.

**Architecture:**
- **smoke.sh 단계**:
  1. docker-compose.sim.yaml + qa-sdk-db + sim-redis up (이미 부팅이면 skip)
  2. 9 서비스 health 폴링 (max 60초)
  3. seed 실행 (1회만 — checkpoint 파일)
  4. 8 시나리오 batch (--all)
  5. 결과 JSON 파싱 → 모두 passed면 0, 하나라도 fail이면 비-0
  6. density 측정 → JSON 출력
  7. teardown 옵션 (--keep-up이면 컨테이너 유지)
- **회귀 자동화 가능성**:
  - 본 plan은 스크립트 정의 + CI gate 추가는 deferred (Phase 5)
  - 본 plan의 smoke은 운영자 manual 실행 + Plan 14a의 measure-density.sh 통합
- **operations.md 구성** (8 섹션):
  - 1. 시스템 개요 (sim-erp-pm-design.md 요약)
  - 2. 부팅 절차 (docker-compose + .env.sim)
  - 3. 9 서비스 + 인프라 토폴로지 다이어그램
  - 4. 환경 변수 reference
  - 5. 8 시나리오 실행 가이드
  - 6. density 측정 워크플로우
  - 7. troubleshooting (port conflict, redis 연결 실패, etc.)
  - 8. teardown / cleanup
- **sim-erp-pm-coverage.spec.md 구조**:
  - frontmatter: lifecycle=draft, scope=feature, aspect=quality_attr, depth=specification, layer=experience, svc=qa-sdk
  - ^purpose: qa-sdk 5축이 sim에서 어떻게 검증되었는지
  - 5축 × 8 시나리오 매트릭스
  - 시나리오별 결과 (passed/failed) + 주요 metric (audit entry 수, trace_id 일관성)
  - qa-sdk 본체 패키지 → sim 검증 결과 추적성 (depends_on, traces_to)

**Tech Stack:**
- bash + docker-compose (smoke)
- markdown (문서)
- def CLI (validate + sync)

---

## File Structure

### 새로 만드는 파일

```
simulations/enterprise-pm/
├── README.md                              # 갱신 — quickstart + 토폴로지
├── docs/
│   └── operations.md                      # 신규 — 8 섹션 운영 가이드
├── scripts/
│   └── smoke.sh                           # 신규 — 통합 smoke
└── (기존 measure-density.sh, e2e-trace-smoke.sh)
```

```
docs/specs/
└── sim-erp-pm-coverage.spec.md             # 신규 — 5축 × 8 시나리오 매트릭스
```

### 수정하는 파일

| 경로 | 변경 |
|---|---|
| `docs/specs/README.md` | sim-erp-pm-coverage 링크 추가 |
| `docs/proposals/auth-model-implementation-backlog/README.md` | Plan 14b 완료 + 19 plan 종료 표기 |
| `package.json` (root) | `scripts.sim:smoke: "./simulations/enterprise-pm/scripts/smoke.sh"` |

---

## Task 0: baseline

- [ ] **Step 1: 선행 plan 완료 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ls simulations/enterprise-pm/scenarios/dist/cli.js && \
  ls simulations/enterprise-pm/scripts/measure-density.sh && \
  ls simulations/enterprise-pm/services/reporting-api/src/density/density.service.ts
```

Expected: Plan 13d (8 시나리오 cli.js) + Plan 14a (measure-density.sh + density.service.ts) 모두 hit.

- [ ] **Step 2: 현재 def graph 상태**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -5
```

Expected: errors 0. 본 plan 시작 baseline.

---

## Task 1: smoke.sh 통합 스크립트

**Files:**
- Create: `simulations/enterprise-pm/scripts/smoke.sh`
- Modify: `package.json` (root)

- [ ] **Step 1: smoke.sh 작성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts
```

`simulations/enterprise-pm/scripts/smoke.sh`:

```bash
#!/usr/bin/env bash
# Plan 14b — sim 통합 smoke
# 사용법: ./scripts/smoke.sh [--keep-up] [--skip-density]
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.sim.yaml"
INFRA_COMPOSE="docker compose -f ../../packages/infra-engine/docker-compose.infra.yaml"
KEEP_UP=0
SKIP_DENSITY=0
for arg in "$@"; do
  case "$arg" in
    --keep-up) KEEP_UP=1 ;;
    --skip-density) SKIP_DENSITY=1 ;;
  esac
done

echo "==> 1. infra (qa-sdk-db) 부팅"
$INFRA_COMPOSE up -d qa-sdk-db
sleep 5

echo "==> 2. sim 인프라 (redis + 9 서비스) 부팅"
$COMPOSE up -d
sleep 10

echo "==> 3. 9 서비스 health 폴링 (max 60초)"
SERVICES=(
  "sim-auth-api:4400"
  "sim-pm-api:4500"
  "sim-approval-api:4600"
  "sim-notification-api:4700"
  "sim-reporting-api:4800"
  "sim-document-api:4900"
  "sim-audit-browser-api:5100"
  "sim-gateway:8888"
  "sim-metrics-collector:5200"
)
for entry in "${SERVICES[@]}"; do
  name=${entry%:*}
  port=${entry#*:}
  ok=0
  for i in $(seq 1 30); do
    if curl -fsS "http://localhost:$port/health" > /dev/null 2>&1; then
      echo "  ✓ $name (:$port)"
      ok=1
      break
    fi
    sleep 2
  done
  if [ "$ok" -eq 0 ]; then
    echo "  ✗ $name (:$port) — health 응답 없음"
    [ "$KEEP_UP" -eq 0 ] && $COMPOSE down
    exit 1
  fi
done

echo "==> 4. 8 시나리오 batch 실행"
SCENARIOS_RESULT=/tmp/sim-smoke-scenarios.json
node scenarios/dist/cli.js run --all --json --gateway-url http://localhost:8888 > "$SCENARIOS_RESULT" 2>&1 || true
cat "$SCENARIOS_RESULT" | jq -r '.[] | "\(.status | sub("passed"; "✓") | sub("failed"; "✗")) \(.name) (\(.durationMs)ms)"'

PASSED=$(jq '[.[] | select(.status == "passed")] | length' "$SCENARIOS_RESULT")
FAILED=$(jq '[.[] | select(.status == "failed")] | length' "$SCENARIOS_RESULT")
echo "  → passed=$PASSED failed=$FAILED"

if [ "$SKIP_DENSITY" -eq 0 ]; then
  echo "==> 5. density 측정"
  node scenarios/dist/cli.js density --prefix=sim.bitmap --version=uv1 --reporting-url=http://localhost:4800 || \
    echo "  ⚠ density 측정 실패 (시나리오 결과로 인한 데이터 누락일 수 있음)"
fi

if [ "$KEEP_UP" -eq 0 ]; then
  echo "==> 6. teardown (--keep-up이면 skip)"
  $COMPOSE down
fi

if [ "$FAILED" -gt 0 ]; then
  echo "✗ smoke 실패: $FAILED 시나리오 fail"
  exit 1
fi
echo "✓ smoke 통과: $PASSED 시나리오 모두 passed"
```

```bash
chmod +x /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/scripts/smoke.sh
```

- [ ] **Step 2: root package.json scripts**

`package.json`에 추가:

```json
"scripts": {
  "...": "...",
  "sim:smoke": "./simulations/enterprise-pm/scripts/smoke.sh",
  "sim:smoke:keep": "./simulations/enterprise-pm/scripts/smoke.sh --keep-up"
}
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/scripts/smoke.sh package.json && \
  git commit -m "$(cat <<'EOF'
feat(sim): smoke.sh — 통합 회귀 (docker → 9 health → 8 scenario → density)

infra → sim 인프라 → 9 서비스 health 폴링 → 8 시나리오 batch → density.
--keep-up: 컨테이너 유지, --skip-density: density 단계 skip.
exit code: 0 (passed) / 1 (any fail or unhealthy).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: README.md 갱신 — 시뮬 입문자용

**Files:**
- Modify (또는 Create): `simulations/enterprise-pm/README.md`

- [ ] **Step 1: README.md 작성**

`simulations/enterprise-pm/README.md`:

```markdown
# Enterprise PM Simulation

qa-sdk 5축 (권한·이벤트·관측·로직·로깅) end-to-end 검증 시뮬.

## 목적

- 9 마이크로서비스 + Hono gateway 토폴로지 위에서 8 시나리오를 실행하여 qa-sdk의 핵심 기능을 검증
- weighted-index, permission-engine, audit-recorder-store, ingest-server, OTel 등 qa-sdk 본체 패키지가 실제 도메인에서 동작하는지 확인
- 디자인 문서: [`/docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md`](../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md)

## 토폴로지

```
                      gateway (8888) — Hono + JWT
                            │
   ┌──────────┬─────────────┼─────────────┬──────────────┐
   ↓          ↓             ↓             ↓              ↓
 auth-api   pm-api    approval-api   document-api   reporting-api
 (4400)    (4500)       (4600)         (4900)         (4800)
                            │
                            ↓
                  Redis (sim-redis:6379) — pub/sub
                            │
                            ↓
                  notification-api (4700)

qa-sdk 본체:
  ingest-server (3200)        ← 모든 서비스의 IngestForwarder
  audit-browser-api (5100)    ← audit-recorder-store 조회
  metrics-collector (5200)    ← Prometheus exporter
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

8 시나리오 batch + density 측정까지 자동 실행. `--keep-up`으로 부팅 상태 유지.

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

### 4. density 측정

```bash
pnpm sim:scenarios density --prefix=sim.bitmap --version=uv1
```

§5 marginal density 출력 — underutilized / saturated axes 알림.

## 8 시나리오

| # | 시나리오 | 검증 대상 |
|---|---|---|
| 1 | login + bitmap 발행 | §2 issuance, JWT embed |
| 2 | project create + owner 자동 권한 | resource-policy UNREGISTERED, 2-pass |
| 3 | 자기 부서 100만원 단일 승인 | state machine, audit nested tree |
| 4 | cross-dept 단독 승인 → deny | RLS scoping, decision replay (firstFailure) |
| 5 | 1500만원 → 3-stage 승인 | 다단계 transition, OTEL trace 일관성 |
| 6 | DELEGATED 외부 컨설턴트 위임 | resource-policy.delegate, Pass 2 acl branch |
| 7 | bitmap 만료 → refresh | §2 §4 refresh endpoint |
| 8 | 권한 변경 → pub/sub invalidation | §2 §5 Redis pub/sub, LRU flush |

## 운영 가이드

상세 절차, 환경 변수, troubleshooting → [`docs/operations.md`](docs/operations.md)

## 관련 plan

- Plan 09 (인프라): 09a/b/c/d
- Plan 10 (서비스 스캐폴딩): 10a/b/c
- Plan 11 (도메인 모델): 11a/b/c
- Plan 12 (cross-service 통합): 12a/b/c
- Plan 13 (시나리오): 13a/b/c/d
- Plan 14 (검증·마무리): 14a/b
- 디자인: [`sim-erp-pm-design.md`](../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md)
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/README.md && \
  git commit -m "$(cat <<'EOF'
docs(sim): README 갱신 — quickstart + 토폴로지 + 8 시나리오 매트릭스

pnpm sim:smoke / sim:scenarios run / density 명령 안내.
8 시나리오 검증 대상 표.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: docs/operations.md — 운영 가이드 8 섹션

**Files:**
- Create: `simulations/enterprise-pm/docs/operations.md`

- [ ] **Step 1: operations.md 작성**

```bash
mkdir -p /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm/docs
```

```markdown
# Enterprise PM Simulation — Operations Guide

운영자 / 디버거 참조 문서. 부팅 절차 + 환경 변수 + troubleshooting.

## 1. 시스템 개요

본 시뮬은 9 마이크로서비스 + Hono gateway + Redis + qa-sdk 본체 인프라 (PG + ingest-server) 로 구성된다.
8 시나리오를 실행하여 qa-sdk의 5축 (권한·이벤트·관측·로직·로깅)을 검증한다.

상세 디자인: [`sim-erp-pm-design.md`](../../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md)

## 2. 부팅 절차

### 사전 조건

- Docker 24+
- pnpm 9+
- node 22+ (시뮬 시나리오 runner 실행 시)

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

# 3. sim 인프라 + 9 서비스 부팅
cd /Users/junwoobang/workflow/qa-sdk/simulations/enterprise-pm
docker compose -f docker-compose.sim.yaml up -d
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
   └─ audit-browser-api (5100) [audit-recorder 조회 API]

sim-redis (6379) — pub/sub bitmap:invalidate
sim-metrics-collector (5200) — Prometheus exporter

qa-sdk 본체:
  qa-sdk-db (5434)            — PG 운영 DB
  ingest-server (3200)        — 모든 서비스 로그/event 수집
```

## 4. 환경 변수

`.env.sim` 파일 (`docker-compose.sim.yaml`이 자동 로드):

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
```

각 시나리오:
- exit code 0 → passed
- exit code 1 → 1+ 시나리오 실패
- 실패 시 stderr에 phase (setup/act/assert/teardown) + 에러 메시지

## 6. density 측정 워크플로우

```bash
# 1. 8 시나리오 실행으로 데이터 누적
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
```

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
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add simulations/enterprise-pm/docs/operations.md && \
  git commit -m "$(cat <<'EOF'
docs(sim): operations.md — 운영 가이드 8 섹션

부팅 절차 / 토폴로지 / 환경 변수 reference / 시나리오 실행 / density / troubleshooting / teardown.
운영자 + 디버거 + CI 통합 참조용.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: docs/specs/sim-erp-pm-coverage.spec.md — 5축 매트릭스 spec

**Files:**
- Create: `docs/specs/sim-erp-pm-coverage.spec.md`
- Modify: `docs/specs/README.md`

- [ ] **Step 1: sim-erp-pm-coverage.spec.md**

```markdown
---
def:
  id: sim-erp-pm-coverage
  type: spec
  tier: component
  scope: feature
  aspect: quality_attr
  depth: specification
  lifecycle: draft
  layer: experience
  svc: qa-sdk
  tags: [simulation, coverage, validation, quality-gate]
  links:
    - target: authorization-ontology-bitmap-pipeline
      type: traces_to
    - target: authorization-ontology-resource-lifecycle
      type: traces_to
    - target: authorization-ontology-nested-audit-tracing
      type: traces_to
    - target: event-taxonomy-marginal-density
      type: traces_to
---

# Enterprise PM Simulation — Coverage Spec

## 목적 ^purpose

본 spec은 `simulations/enterprise-pm/`의 8 시나리오 실행으로 qa-sdk 본체의 5축 (권한·이벤트·관측·로직·로깅) 이 어떻게 e2e 검증되는지 매트릭스로 명시한다. 시뮬이 통과한 시나리오는 곧 qa-sdk 본체 기능의 품질 게이트 — 회귀 발견 시 본 spec의 매트릭스가 영향 범위 추적의 시작점이다.

## 구성 ^overview

5축 × 8 시나리오 매트릭스. 각 셀은 시나리오 실행 시 검증되는 qa-sdk 패키지의 구체 기능을 명시한다.

## 정의 ^defines

### 5축 정의

| 축 | qa-sdk 패키지 | 책임 |
|---|---|---|
| 권한 | weighted-index, permission-engine, resource-policy-store | 좌표 인코딩 + bitmap O(1) check + 인스턴스 lifecycle |
| 이벤트 | event-catalog, browser-codec, ingest-server | event 정의 + 인코딩 + 수집 + marginal density |
| 관측 | @qa-sdk/otel, audit-recorder-store, permission-engine.OtelAuditRecorder | OTel SDK + nested audit + cross-service trace |
| 로직 | resource-policy-store FSM, approval state machine | state transition + transaction 경계 |
| 로깅 | @qa-sdk/logger, IngestForwarder | structured log + ingest-server 전송 |

### 시나리오 × 축 매트릭스

| # | 시나리오 | 권한 | 이벤트 | 관측 | 로직 | 로깅 |
|---|---|---|---|---|---|---|
| 1 | login + bitmap 발행 | ✓ DisjointUnionIndex.encode + VersionedBitmap issuance | ✓ login event ingest | ✓ traceparent 신규 root | — | ✓ structured log |
| 2 | project create + owner 자동 권한 | ✓ AccessChecker 2-pass + UNREGISTERED FSM | ✓ project_created event | ✓ AccessChecker audit entry | ✓ resource-policy 생성 transition | ✓ |
| 3 | 자기 부서 단일 승인 | ✓ AccessChecker Pass 1 + Pass 2 lifecycle allow | ✓ approval event | ✓ nested audit tree (3+ entry) | ✓ submitted→approved | ✓ |
| 4 | cross-dept 단독 승인 → deny | ✓ Pass 2 lifecycle deny + RLS scoping | ✓ deny event | ✓ firstFailure decision replay | — | ✓ deny log |
| 5 | 3-stage 승인 (1500만원) | ✓ stage 별 AccessChecker × 3 | ✓ 3 transition event | ✓ OTEL cross-stage trace | ✓ 3-stage state machine | ✓ |
| 6 | DELEGATED 외부 컨설턴트 | ✓ Pass 2 acl branch + evaluator.evaluateDelegated | ✓ delegate event | ✓ DELEGATED audit pass="acl" | ✓ REGISTERED→DELEGATED transition | ✓ |
| 7 | bitmap refresh | ✓ §2 §4 refresh endpoint + fresh bitmap | ✓ refresh event | ✓ refresh trace | — | ✓ |
| 8 | pub/sub invalidation | ✓ §2 §5 publish/subscribe + LRU flush | ✓ invalidation event | ✓ Redis pub trace | — | ✓ Subscriber log |

### 검증된 qa-sdk 기능 추적성

각 시나리오는 다음 qa-sdk 본체 패키지의 e2e 게이트 역할:

```
weighted-index/DisjointUnionIndex     → 1, 2, 3, 4, 5, 6 (모든 권한 시나리오)
permission-engine/AccessChecker       → 2, 3, 4, 5, 6
permission-engine/VersionedBitmap     → 1, 7
permission-engine/OtelAuditRecorder   → 3, 4, 5
resource-policy-store FSM             → 2, 3, 6
audit-recorder-store nested tree      → 3, 4, 5
audit-recorder-store firstFailure     → 4 (decision replay 핵심)
ingest-server key_observations        → 모든 시나리오 (event 수집)
@qa-sdk/otel propagation              → 1, 2, 3, 4, 5, 6, 7, 8 (cross-service)
@qa-sdk/logger IngestForwarder        → 모든 시나리오
sim-bitmap-cache pub/sub (§2 §5)      → 8
density (§5)                          → 8 시나리오 실행 후 측정
```

### 회귀 게이트로서의 시뮬

- `pnpm sim:smoke` — 8 시나리오 batch + density 측정 → exit code 0/1
- 1개라도 fail → qa-sdk 본체 회귀 의심 → 본 매트릭스에서 관련 패키지 추적
- 본 spec은 **회귀 영향 범위 분석의 시작점**

## 소비 ^consumes

- 본 spec은 운영자/QA가 회귀 분석 시 진입점
- CI gate (Phase 5)에서 `sim:smoke` 결과를 본 spec의 매트릭스와 cross-reference

## 위임 ^delegates

- 시나리오별 detail: [`/docs/proposals/auth-model-implementation-backlog/plans/13a-sim-scenario-runner-1-2.md`](../../docs/proposals/auth-model-implementation-backlog/plans/13a-sim-scenario-runner-1-2.md) ~ 13d
- 인프라: [`Plan 09 시리즈`](../proposals/auth-model-implementation-backlog/plans/09a-sim-workspace-bootstrap.md)
- 운영: [`/simulations/enterprise-pm/docs/operations.md`](../../simulations/enterprise-pm/docs/operations.md)

## 방법 ^method

### 회귀 검출 워크플로우

1. `pnpm sim:smoke` 실행
2. 시나리오 N번이 실패하면 본 매트릭스의 column N 확인
3. 해당 column에 hit인 패키지의 최근 변경 (git log)을 review
4. 변경된 패키지의 단위 테스트 + port-contract 회귀 점검
5. 수정 후 `pnpm sim:smoke` 재실행으로 회귀 검증

### 시나리오 추가 시

- design.md §4 매트릭스에 새 row 추가
- Plan 13x에 시나리오 구현
- 본 spec의 매트릭스에 column 또는 row 갱신

## 주의사항

- **시뮬은 e2e 게이트** — 시나리오 fail은 즉시 회귀 의심. 단순 flaky test로 치부 금지.
- **density는 정보 지표** — Plan 14a 시점에는 게이팅 아님. saturated 발견 시 capacity 검토 (§5 §4 Phase 3에서 게이팅 도입).
- **시뮬 외 회귀** — 본 시뮬이 검증하지 않는 영역 (예: viz-web, decision-flow CLI) 은 별도 회귀 자료 필요.

## 용어

- **5축**: 권한·이벤트·관측·로직·로깅. qa-sdk의 핵심 기능 분류.
- **시뮬 매트릭스**: 시나리오 × 축의 검증 카운트 표.
- **회귀 게이트**: 시뮬 실패 → qa-sdk 본체 회귀 의심 → 본 spec 추적 시작.
```

- [ ] **Step 2: docs/specs/README.md에 링크 추가**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  grep -n "sim-erp-pm" docs/specs/README.md || echo "링크 추가 필요"
```

`docs/specs/README.md`의 적절 섹션에 추가:

```markdown
- [sim-erp-pm-coverage.spec.md](sim-erp-pm-coverage.spec.md) — Enterprise PM 시뮬이 검증하는 5축 매트릭스
```

- [ ] **Step 3: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add docs/specs/sim-erp-pm-coverage.spec.md docs/specs/README.md && \
  git commit -m "$(cat <<'EOF'
docs(specs): sim-erp-pm-coverage.spec.md — 5축 × 8 시나리오 매트릭스

회귀 게이트로서의 시뮬 정의.
qa-sdk 본체 패키지 ↔ 시나리오 추적성 명시.
회귀 검출 워크플로우 + 시나리오 추가 가이드.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: def sync + def validate 통과 검증

- [ ] **Step 1: def sync — 신규 spec을 def DB에 등록**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def sync 2>&1 | tail -10
```

Expected: 신규 `sim-erp-pm-coverage` document 등록 메시지.

- [ ] **Step 2: def validate**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm --filter @qa-sdk/cli def validate 2>&1 | tail -10
```

Expected: errors 0. broken-link / circular-ref 없음.

- [ ] **Step 3: 만약 broken-link가 있으면**:
- 본 spec의 `links.target`이 실존 spec ID와 매치하는지 확인
- 없는 spec 참조 → 링크 제거 또는 해당 spec 작성

- [ ] **Step 4: 커밋 (def sync로 인한 DB 변경이 commit 대상이면)**

```bash
cd /Users/junwoobang/workflow/qa-sdk && git status
# def DB 파일이 변경되었으면 add
```

DB는 일반적으로 .gitignore — git 영향 없을 가능성. 변경 감지 시 별도 커밋 명시.

---

## Task 6: workflow-smoke 회귀

- [ ] **Step 1: workflow-smoke 12건 PASS 유지 확인**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  pnpm exec vitest run workflow-smoke 2>&1 | tail -10
```

Expected: 12 silent-empty regression PASS.

- [ ] **Step 2: 본 plan으로 인한 회귀 0**

본 plan은 신규 문서 + 스크립트 추가만 — 기존 코드/테스트 영향 없음. 회귀 0 보장.

---

## Task 7: 통합 smoke 시도 (옵션 — 실 docker 환경)

- [ ] **Step 1: smoke.sh 실행**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  ./simulations/enterprise-pm/scripts/smoke.sh
```

Expected:
- 9 서비스 health 모두 ✓
- 8 시나리오 batch 결과 (실 환경에서 시나리오별 detail 확인)
- density 측정 출력 (sim.bitmap)
- exit code 0

실패 시:
- 어느 phase에서 실패했는지 (인프라 / health / 시나리오 / density)
- operations.md의 troubleshooting 적용

- [ ] **Step 2: README에 smoke 결과 첨부 (옵션)**

본 plan은 smoke 결과를 git에 commit 안 함 (환경별 변동성). Plan 14b의 smoke은 운영자가 수동 실행하여 결과를 issue/PR comment에 첨부.

---

## Task 8: 19 plan 종료 표기

**Files:**
- Modify: `docs/proposals/auth-model-implementation-backlog/README.md`

- [ ] **Step 1: README.md 갱신**

`docs/proposals/auth-model-implementation-backlog/README.md`의 plan 진행 표를 갱신:

```markdown
## Plan 진행 (19 plan 전체)

| Plan | 책임 | 상태 |
|---|---|---|
| 04a~d | infra-engine PG container + db-bootstrap | ✓ |
| 05a~d | resource-policy-store dual-target | ✓ |
| 06a~c | audit-recorder-store dual-target | ✓ |
| 07a~d | ingest-server key_observations PG | ✓ |
| 09a~d | sim 인프라 부트스트랩 | ✓ |
| 10a~c | sim 9 서비스 스캐폴딩 | ✓ |
| 11a~c | sim 도메인 모델 | ✓ |
| 12a~c | sim cross-service 통신 + 권한 통합 | ✓ |
| 13a~d | sim 8 시나리오 구현 | ✓ |
| 14a/b | sim 검증·마무리 (density + 회귀 + 문서) | ✓ |

총 24 sub-plan (Phase 2 09 + Phase 4 15 = 24). Phase 5는 별도 backlog.
```

- [ ] **Step 2: 커밋**

```bash
cd /Users/junwoobang/workflow/qa-sdk && \
  git add docs/proposals/auth-model-implementation-backlog/README.md && \
  git commit -m "$(cat <<'EOF'
docs(proposals): 19 plan 종료 표기 — Phase 4 시뮬 완료

Plan 14b로 시뮬 회귀 + 문서 마무리.
다음 Phase 5는 별도 backlog (운영 도입 / 보안 강화 / 부하 시뮬).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- [ ] smoke.sh — docker → 9 health → 8 시나리오 → density 일관 자동화
- [ ] README.md 갱신 — quickstart + 토폴로지 + 8 시나리오 매트릭스
- [ ] operations.md — 8 섹션 (개요/부팅/토폴로지/env/시나리오/density/troubleshooting/teardown)
- [ ] sim-erp-pm-coverage.spec.md — 5축 × 8 시나리오 매트릭스 + 회귀 게이트 정의
- [ ] def sync + validate — errors 0
- [ ] workflow-smoke 12건 PASS 유지
- [ ] 19 plan 종료 표기 — README.md 갱신
- [ ] root scripts: pnpm sim:smoke / sim:smoke:keep
- [ ] no fallback — health 폴링 60초 후 실패 시 즉시 exit 1
- [ ] no approximation — 시나리오 결과 jq 파싱으로 정확 카운트

---

## Defer

| 작업 | 이유 | 후속 plan |
|---|---|---|
| smoke.sh를 GitHub Actions matrix로 통합 | CI 환경 (docker-in-docker) 검증 후 | Phase 5 CI plan |
| OTel collector (Tempo/Jaeger) 부팅 + trace 시각화 | 운영 도입 시점 | Phase 5 관측 |
| 부하 시나리오 (옵션 D — 100+ user 동시) | sim-erp-pm-design.md §8 후속 | 후속 |
| ACL 외부 협업자 시나리오 확장 | Q2 옵션 D | 후속 |
| 실제 사용자 데모용 SPA | scope 외 (CLI runner only) | 별도 프로젝트 |
| Density gating (§5 §4 Phase 3) | threshold 합의 후 | Phase 5 |
| sim-erp-pm-coverage.spec.md를 도구 자동화 (시나리오 결과 → 매트릭스 자동 갱신) | 인간이 plan 진행 시 갱신 — 자동화는 안정화 후 | 후속 |

---

## 의존·후속

- **Plan 09~14a**: 본 plan이 종합 — 모든 선행 plan 완료 시점.
- **Phase 5 (별도 backlog)**:
  - HMAC secret rotation, RS256 KID
  - registry-service marginal-density endpoint
  - OTel collector + Grafana 통합
  - 부하 시나리오 (100+ user)
  - CI matrix 통합

---

## 종료 메모

19 plan으로 Phase 4 (Enterprise PM Simulation) 종료. qa-sdk의 5축이 현실적 도메인에서 e2e 검증 가능한 상태. 다음 Phase 5는 운영 도입 + 보안 강화 + 부하 시뮬 — 별도 backlog로 분리.
