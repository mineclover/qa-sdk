# qa-sdk

**Trace-based QA Observability Platform**

QA 세션이 주입된 실행 흐름의 trace를 수집하고,
Spec Graph와 Runtime Graph를 비교하여
시스템 동작이 의도한 로직·정책·행동 구조와 일치하는지 자동 검증하는 플랫폼.

---

## Quick Start

로컬 풀스택 데모 환경은 루트 `docker-compose.yml` 기준으로 기동한다.
`postgres`, `redis`, 일회성 `migrations` 서비스가 먼저 올라온 뒤, `registry-server`, `ingest-server`, `worker`가 순서대로 시작된다.

```bash
cp .env.example .env
docker compose up --build
```

기동 후 엔드포인트:

- Registry Server: `http://localhost:3001/health/live`
- Ingest Server: `http://localhost:3002/health/live`

정리:

```bash
docker compose down -v
```

메모:

- 환경 변수는 루트 `.env.example`에 모두 문서화되어 있다.
- Compose 내부에서는 `postgres`, `redis` 서비스명을 호스트로 사용하므로 `REGISTRY_DATABASE_URL`, `TRACE_DATABASE_URL`, `REDIS_URL`의 기본값을 그대로 쓰면 된다.
- `TASK_QUEUE_ENABLED=true`면 ingest-server가 Phase 2를 BullMQ worker로 분리하고, `false`면 기존 동기 경로를 유지한다.
- `INGEST_REGISTRY_VALIDATION_MODE=warn`이 기본값이며, 인증은 게이트웨이에서 처리한다 ([ADR-001](docs/architecture-decisions.md#adr-001-게이트웨이-레벨-인증)).

## Skill Docs

skill 운영 가이드와 카탈로그는 아래에서 시작한다.

- `skills/` — 프로젝트 로컬 실제 skill 정의 원본 (`SKILL.md`)
- `docs/skills/README.md` — skill 운영 가이드 index
- `docs/specs/skill-catalog/skill-catalog-system.md` — skill 카탈로그 구조와 관계 문서

## Quality Gate Status

현재 quality claim audit으로 실제 gate 실행 + review 원장까지 닫힌 번들은 다음과 같다.

| Bundle | Claims | Gates | 상태 |
|---|---:|---:|---|
| `work-domain-quality-bundle` | 15 | 3 | verified |
| `decision-flow-quality-bundle` | 15 | 3 | verified |
| `ingest-quality-bundle` | 15 | 3 | verified |
| `query-quality-bundle` | 15 | 3 | verified |
| `decode-quality-bundle` | 15 | 3 | verified |
| `registry-quality-bundle` | 15 | 3 | verified |
| `definition-service-quality-bundle` | 15 | 3 | verified |
| `definition-quality-gates` | 18 | 3 | verified |

루트 `quality-gates-system`은 현재 24개 gate 문서를 포함하며 `quality bundle quality-gates-system` 기준 `verified` 상태다.
2026년 3월 30일 기준 대표 gate `gate-definition-quality-cli`를 다시 실행했고, 루트 상태 스냅샷은 `artifacts/quality-gates-system.json`으로 export했다.

문서 품질 평가 기준 현재 상태:

- `def audit`: 문서 `674`, purpose `674`, links `577`, tags `661`
- `def validate`: 그래프 검증 경고 `0`

대표 명령:

```bash
qa-sdk def sync
qa-sdk def validate
qa-sdk quality bundle quality-gates-system
qa-sdk quality claims quality-gates-system
qa-sdk quality status quality-gates-system
qa-sdk quality export quality-gates-system --output=artifacts/quality-gates-system.json
```

대표 라이프사이클:

1. `qa-sdk def sync`로 문서 그래프와 로컬 datasource를 맞춘다.
2. `qa-sdk def validate`로 링크/계층/분류 위반이 없는지 확인한다.
3. `qa-sdk quality show <gate-id>`로 대상 gate 계약과 현재 상태를 읽는다.
4. `qa-sdk quality run <gate-id> --json`으로 gate를 실행해 `quality-ledger`를 갱신한다.
5. `qa-sdk quality diagnose <gate-id> --json`과 `qa-sdk quality claims <bundle-id>`로 gate 진단과 claim verdict를 확인한다.
6. `qa-sdk quality bundle <bundle-id>`, `qa-sdk quality status quality-gates-system`, `qa-sdk quality export ...` 순서로 bundle/system 상태를 요약하고 artifact를 남긴다.

---

## 모노레포 구조

```text
packages/
  ── QA Observability ──
  core/               @qa-sdk/core             공유 타입 · 스키마 · 포트 · 유틸리티
  event-catalog/      @qa-sdk/event-catalog    Core Event 어휘 · Payload Guide (정적 데이터)
  sdk/                @qa-sdk/sdk              이벤트 수집 SDK (브라우저/Node/Edge)
  engine/             @qa-sdk/engine           순수 연산 엔진 (reconstruction/matching/verdict)
  store/              @qa-sdk/store            Trace 저장소 (Drizzle/PostgreSQL adapter)
  pino/               @qa-sdk/pino             구조화 JSON 로거
  registry-client/    @qa-sdk/registry-client  이벤트 레지스트리 검증 클라이언트 (TTL+LRU 캐시)
  ingest-server/      @qa-sdk/ingest-server    Envelope 수신 HTTP 서버
  registry-server/    @qa-sdk/registry-server  서비스·이벤트 메타데이터 Registry API

  ── Indexing & Encoding ──
  weighted-index/     weighted-index           n차원 가중 위치 기수법 (mixed-radix) 인코딩
  bit-index/          bit-index                차원별 비트 패킹 인덱스 (O(1) 추출)
  index-meta/         index-meta               메타-스키마 레지스트리 (DAG·버전·마이그레이션)
  permission-engine/  permission-engine        비트마스크 기반 권한 엔진

  ── Service Registry ──
  registry-service/   @qa-sdk/registry-service Prefix DAG·버전 라이프사이클·DraftWorkspace 서비스

  ── Demo & Test ──
  demo-snapshot/      demo-snapshot            데모 데이터 스냅샷 (축 카탈로그·도메인·쇼핑 시나리오)
  demo-tests/         @qa-sdk/demo-tests       통합 테스트 (cross-package 시나리오)
```

### 의존 관계

```text
── QA Observability 트리 ──
core  ← observability 패키지가 의존
  ├── event-catalog   (독립 정적 데이터 — 런타임 의존성 0)
  ├── pino            (독립 로거)
  ├── sdk             (core만 의존, storage 무관)
  ├── engine          (core만 의존, storage 무관 — 순수 연산)
  ├── store           (core 포트를 Drizzle로 구현)
  ├── registry-client (독립 HTTP 클라이언트)
  ├── ingest-server   (core + store + engine + registry-client 조합)
  └── registry-server (독립 서비스, event-catalog import 가능)

── Indexing & Encoding 트리 ──
weighted-index  ← 인코딩 패키지가 의존
  ├── bit-index          (weighted-index 의존)
  ├── index-meta         (weighted-index 의존 — 메타 스키마 + DAG)
  ├── permission-engine  (weighted-index + bit-index 의존)
  └── registry-service   (index-meta + weighted-index 의존)
```

---

## 아키텍처 컨벤션: Ports & Adapters

로직과 스토리지의 벤더 종속성을 최소화하기 위해 **Ports & Adapters** 패턴을 적용한다.

```text
core/ports/          ← 벤더 무관 인터페이스 (계약)
  RecordStore
  TraceStore
  GraphStore
  VerdictStore
  SessionStore
  TransmissionStore

store/adapters/drizzle/  ← PostgreSQL/Drizzle 구현체
  DrizzleRecordStore     implements RecordStore
  DrizzleTraceStore      implements TraceStore
  DrizzleGraphStore      implements GraphStore
  ...

ingest-server/server.ts  ← Composition Root: 포트에 어댑터를 바인딩
  recordStore: new DrizzleRecordStore(db)
  traceStore: new DrizzleTraceStore(db)
  ...
```

**규칙:**
- `engine`은 storage를 import하지 않는다 (순수 연산)
- 서버/오케스트레이션 레이어만 adapter를 주입한다
- 새 벤더(SQLite, DynamoDB 등)는 `store/adapters/` 에 추가하면 된다
- 테스트에서는 in-memory adapter를 만들어 주입한다

---

## 패키지 요약

### `@qa-sdk/core`

모든 패키지가 공유하는 **타입, Zod 스키마, 포트 인터페이스, 유틸리티**.

| 분류 | 내용 |
|---|---|
| types/ | `TransmissionEnvelope`, `EventRecord`, `ScenarioSpec`, `SpecGraph`, `RuntimeGraph`, `VerdictReport` 등 |
| schema/ | Zod 검증 — `transmissionEnvelopeSchema`, `eventRecordSchema`, `scenarioSpecSchema` |
| ports/ | Storage 계약 — `RecordStore`, `TraceStore`, `GraphStore`, `VerdictStore`, `SessionStore`, `TransmissionStore` |
| lib/ | ID 생성 (`txm_`, `log_`, `trc_`, `spn_`, `qas_`), `now()` |

의존: `zod`, `ulid`

---

### `@qa-sdk/sdk`

브라우저·Node·Edge 환경에 부착하는 **QA 로깅 SDK**.

| 모듈 | 역할 |
|---|---|
| `QaLogger` | 핵심 로거 — `log()`, `startSpan()`, `flush()`, `shutdown()` |
| `TraceContext` | trace_id / span stack / qa_session_id 관리 |
| `applyMasking()` | payload 마스킹 — raw, mask, drop, hash |
| `HttpTransport` / `NoopTransport` | 전송 계층 |

의존: `@qa-sdk/core`

상세 사용법: [`packages/sdk/README.md`](packages/sdk/README.md)

---

### `@qa-sdk/engine`

**순수 연산 엔진**. DB/HTTP 의존 없이 core 타입만으로 동작한다.

| 모듈 | 입력 → 출력 | 설명 |
|---|---|---|
| `reconstruction/` | `EventRecord[]` → `RuntimeGraph` | trace grouping, timestamp sort, span tree, edge 생성 |
| `spec-compiler/` | `ScenarioSpec` → `SpecGraph` | DSL을 기대 행동 그래프로 컴파일 |
| `matching/` | `SpecGraph` + `RuntimeGraph` → `MatchResult` | step 매칭, constraint 평가 |
| `verdict/` | `MatchResult` → `VerdictReport` | pass/fail/warn/degraded/unknown 판정 |

의존: `@qa-sdk/core` (타입만)

---

### `@qa-sdk/store`

Trace 데이터 **저장소 어댑터**. core 포트를 Drizzle/PostgreSQL로 구현한다.

| 테이블 | 역할 |
|---|---|
| `qa_sessions` | QA 세션 단위 식별 |
| `traces` | trace_id 메타데이터, reconstruction 상태 |
| `event_records` | SDK가 전송한 개별 이벤트 레코드 |
| `transmissions` | 수신한 envelope 메타 (감사용) |
| `runtime_graphs` | reconstruction 결과 (RuntimeGraph JSON) |
| `verdict_reports` | matching + verdict 결과 |

의존: `@qa-sdk/core`, `drizzle-orm`, `postgres`

---

### `@qa-sdk/ingest-server`

SDK로부터 **Transmission Envelope을 수신하고 store에 저장**하는 HTTP 서버.

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| POST | `/v1/ingest` | envelope 수신 → record/trace/session 저장 |

의존: `@qa-sdk/core`, `@qa-sdk/store`, `@qa-sdk/engine`, `hono`

---

### `@qa-sdk/event-catalog`

Core Event 어휘와 Payload Field Guide를 제공하는 **정적 데이터 패키지**.

| 모듈 | 역할 |
|---|---|
| `categories/*` | 8개 카테고리 60개 Core Event 정의 |
| `registry` | 전체 이벤트 집계, Map 인덱스, 조회 함수 |
| `payload-guides` | v1 핵심 20개 이벤트의 payload 필드 가이드 |
| `v1-minimal` | v1 핵심 20개 서브셋 |

의존: 없음 (런타임 의존성 0)

설계 결정: [`docs/architecture-decisions.md`](docs/architecture-decisions.md#adr-002-event-catalog-정적-데이터-패키지)

---

### `@qa-sdk/pino`

경량 **구조화 JSON 로거**. 외부 pino 라이브러리 대신 자체 구현.

의존: 없음

---

### `@qa-sdk/registry-client`

이벤트 레지스트리에 대한 **검증 HTTP 클라이언트**. TTL+LRU 캐시로 중복 호출 방지.

| 기능 | 설명 |
|---|---|
| `validateEvent()` | 이벤트 등록 여부 검증 |
| 캐시 | TTL 5분, LRU 1000개 |
| fail-open | 레지스트리 장애 시 이벤트 통과 |

의존: 없음 (자체 fetch)

---

### `@qa-sdk/registry-server`

서비스·이벤트 메타데이터를 관리하는 **Registry HTTP API**.

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| POST | `/services` | 서비스 생성 |
| GET | `/services/:serviceName` | 서비스 조회 |
| PATCH | `/services/:serviceId` | 서비스 수정 |
| POST | `/services/:serviceId/events` | 이벤트 생성 (버전 자동 발급) |
| GET | `/services/:serviceName/events/:eventKey` | 이벤트 버전 목록 |
| GET | `/services/:serviceName/events/:eventKey/versions/:eventVersion` | 특정 버전 조회 |
| PATCH | `/events/:eventId` | 이벤트 수정 |

---

## 전체 파이프라인

```text
@qa-sdk/sdk (QaLogger)
  → POST /v1/ingest  [@qa-sdk/ingest-server]
    → store: EventRecord 저장  [@qa-sdk/store]
      → engine: Trace Reconstruction  [@qa-sdk/engine]
        → engine: Spec Graph 컴파일
          → engine: Graph Matching
            → engine: Verdict 판정
              → store: VerdictReport 저장
```

---

## 개발

```bash
pnpm install
pnpm run build

# 개별 빌드
pnpm --filter @qa-sdk/core run build
pnpm --filter @qa-sdk/engine run build
pnpm --filter @qa-sdk/store run build
pnpm --filter @qa-sdk/ingest-server run build

# 서버 개발 모드
pnpm --filter @qa-sdk/registry-server run dev
pnpm --filter @qa-sdk/ingest-server run dev

pnpm run clean
```

---

## 기능 명세

각 패키지의 기능 명세는 `packages/<pkg>/specs/` 에서 **진입점 단위**로 관리한다.

```text
packages/<pkg>/specs/
  README.md              ← 패키지 스펙 인덱스
  <entry-point>.spec.md  ← 진입점별 기능 명세
```

컨벤션: [`docs/spec-convention.md`](docs/spec-convention.md)

---

## 설계 결정

횡단 아키텍처 결정은 [`docs/architecture-decisions.md`](docs/architecture-decisions.md)에서 관리한다.

| 결정 | 요약 |
|---|---|
| ADR-001 | 게이트웨이 레벨 인증 — 내부 서비스는 인증 수행 안 함 |
| ADR-002 | Event Catalog 정적 데이터 패키지 — 런타임 의존성 0 |
| ADR-003 | 패키지 경계 규칙 — 단방향 의존, 역할 분리 |
| ADR-004 | 내부 서비스 간 통신 — 인증 없는 plain HTTP, fail-open |

---

## 기술 스택

| 항목 | 선택 |
|---|---|
| 언어 | TypeScript (ES2022, NodeNext) |
| 패키지 매니저 | pnpm workspace |
| 아키텍처 | Ports & Adapters |
| 검증 | Zod |
| ID | ULID |
| HTTP 프레임워크 | Hono |
| DB | PostgreSQL |
| ORM | Drizzle |
