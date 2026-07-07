---
status: source-backed
sources:
  - simulations/enterprise-pm/README.md
  - simulations/enterprise-pm/docker-compose.sim.yaml
  - simulations/enterprise-pm/services/canary-controller/package.json
  - simulations/enterprise-pm/services/gateway/src/app.ts
  - simulations/enterprise-pm/scenarios/src/runner/sim-handles/index.ts
---

# Enterprise-PM Canary & Scaling — Overview

> enterprise-pm 시뮬에 카나리 배포 + 스케일링 운영 컨트롤 플레인을 1급 시민으로 도입하고, 시뮬 자체를 qa-sdk 운영 결정 패턴의 응용 사례로 만든다.

## 1. 목적

enterprise-pm 시뮬에 **카나리 배포 + 스케일링 운영 컨트롤 플레인**을 1급 시민으로 도입한다. 시뮬 자체가 qa-sdk의 **decision-flow + version axis + audit-recorder + permission-engine Pass 1/2** 패턴을 운영 결정에 적용하는 응용 사례가 되게 한다.

## 2. 범위

### 2.1 포함

- **카나리 컨트롤 플레인** (`sim-canary-controller`) — 2-pass 결정 (안전성 → 자원), 30s 사이클, 8 카테고리 verdict.
- **v1/v2 동시 배포** (대상: `approval-api`) — qa-sdk catalog version axis 통합, gateway 단일 라우팅 책임.
- **수평 스케일링** — replica 자동 증감, dbPool 압박 신호 기반 거부.
- **Read replica + lag-injector** — slice별 DataSource 분리 (BFF/reporting → read).
- **인프라 보강**: outbox `SKIP LOCKED` + idempotency (이전 평가의 #1), bitmap TTL + version-check fallback (#2), `host.docker.internal` 제거 (#5).
- **시나리오 9개 추가** (총 17개).
- **식별자 합성 grammar + 린팅 체계**.

### 2.2 제외 (후속 sub-project로 분리)

- 이전 평가의 **#3 카오스 시나리오 일반화** — 본 사이클의 fault-injector가 1차 토대만 제공.
- **#4 HTTP retry 표준화**, **#6 k6 SLO**, **#7 BFF lint 일반화**, **#8 README 명시**.
- **카나리 대상 다른 서비스 확장** (auth-api 등).
- **DB 분리** (database-per-service).

## 3. 아키텍처 토폴로지

본 작업이 enterprise-pm 시뮬 토폴로지에 추가/변경하는 부분만 추려 다이어그램화한다. 미변경 컴포넌트(auth-api, pm-api, notification-api, document-api, audit-browser-api, metrics-collector, reporting-api 비즈니스 로직, ingest-server)는 다이어그램에서 생략한다.

```
                                 ┌─────────────────────────────────────────┐
                                 │  sim-canary-controller (NEW, :5300)     │
                                 │   ├─ Pass1: Safety  (cat 1·2·3·4·8)     │
                                 │   ├─ Pass2: Resource (cat 5·6·7)        │
                                 │   ├─ 30s cycle, decision-flow evidence  │
                                 │   └─ → audit-recorder-store + ingest    │
                                 └────────┬───────────────────┬────────────┘
                            (push routing)│       (push scale)│
                                          ▼                   ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  sim-gateway (CHANGED)                                           │
   │   ├─ Routing table: { v1: stable, v2: candidate, weight: 25 }    │
   │   ├─ Sticky: hash(user_id) % 100  +  x-canary-override header   │
   │   └─ Stamps  x-service-version: vN  on downstream requests       │
   └────────┬─────────────────────────────────────┬───────────────────┘
            ▼                                     ▼
   ┌─────────────────────┐               ┌─────────────────────┐
   │ approval-api-v1     │               │ approval-api-v2     │
   │ (image :v3 stable)  │               │ (image :v4 candidate)│
   │ replicas: M (scale) │               │ replicas: N (scale) │
   └────────┬────────────┘               └────────┬────────────┘
            │ writes                              │ writes
            ▼                                     ▼
   ┌────────────────────────────────────────────────────────┐
   │  qa-sdk-db (primary, write)                            │
   │   ├─ outbox: SELECT ... FOR UPDATE SKIP LOCKED         │
   │   └─ idempotency_key on event publish                  │
   └────────────────────┬───────────────────────────────────┘
                        │ streaming replication
                        ▼
   ┌────────────────────────────────────────────────────────┐
   │  qa-sdk-db-replica (NEW, read-only)                    │
   │   used by: reporting-api, all presentation/bff/*       │
   │   ↑ lag-injector (NEW, fault module) sits here         │
   └────────────────────────────────────────────────────────┘

   sim-redis (CHANGED config):
     bitmap cache: TTL=120s + version-check fallback
     pub/sub:      best-effort, TTL이 회복 보장
```

**노드별 1줄 설명**

- `sim-canary-controller` — 30초 주기로 카나리 안전성/자원 신호를 모아 2-pass로 평가하고 결정을 ingest/audit-recorder에 기록하는 신규 NestJS 서비스.
- `sim-gateway` — 단일 라우팅 진입점. weight·sticky·override·version stamp 책임을 모두 가진다.
- `approval-api-v1` / `approval-api-v2` — 동일 코드베이스에서 빌드된 stable / candidate 이미지. replica 수는 controller가 결정한다.
- `qa-sdk-db (primary)` — 쓰기 전용. outbox는 `SKIP LOCKED`와 idempotency_key로 다중 워커 안전성을 확보한다.
- `qa-sdk-db-replica` — 신규 read-only standby. reporting과 모든 presentation/bff slice의 read DataSource.
- `lag-injector` — controller 내부 모듈. 별도 컨테이너가 아닌 fault-injection hook으로 read replica lag을 의도적으로 주입한다.
- `sim-redis` — bitmap 캐시는 TTL + version-check fallback으로, pub/sub은 best-effort로 격하된다.

## 4. 신규/변경/유지 컴포넌트

### 4.1 신규 (3)

1. `sim-canary-controller` — NestJS 서비스 (`:5300`).
2. `qa-sdk-db-replica` — PG 16 standby.
3. `lag-injector` — controller 내부 모듈 (별도 컨테이너 아님).

### 4.2 변경 (4)

1. `sim-gateway` — 라우팅 테이블, sticky, version stamp.
2. `approval-api` — v1/v2 빌드 분리, DataSource 분리, outbox 락, version stamp.
3. `db-bootstrap` — `{ writeUrl, readUrl }` 동시 노출.
4. `sim-bitmap-cache` — TTL + version-check fallback.

### 4.3 신규 패키지 (2)

1. `packages/sim-identifier-grammar/` — 식별자 builder/parser/Zod.
2. `packages/sim-service-catalog/` — service version axis catalog 헬퍼.

### 4.4 유지 (변경 없음)

`auth-api`, `pm-api`, `notification-api`, `document-api`, `audit-browser-api`, `metrics-collector`, `reporting-api` 비즈니스 로직, `ingest-server`. 단, 컨테이너화는 변경된다.

## 5. 본 문서 군 안내

본 spec은 단일 문서로 다 담기에는 결정 단위가 많아 6개 sub-spec으로 분할한다. 각 문서는 자기 영역의 결정을 단독으로 증명할 수 있어야 한다.

| 문서 | 다루는 범위 |
|---|---|
| `01-decision-model.md` | 2-pass 결정 알고리즘, 8 카테고리 verdict, 사이클 흐름 |
| `02-canary-topology.md` | v1/v2 동시 배포, catalog version axis, gateway 책임 |
| `03-identifier-grammar.md` | 식별자 합성 문법, 린팅 체계 |
| `04-scaling-infra.md` | replica, read replica, outbox 락, bitmap TTL/version |
| `05-error-and-scenarios.md` | fail policy 매트릭스, 17 시나리오, break-glass |
| `06-roadmap.md` | 마이그레이션 13단계 + 후속 분리 |
