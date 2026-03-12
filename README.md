# qa-sdk

**Trace-based QA Observability Platform**

QA 세션이 주입된 실행 흐름의 trace를 수집하고,
Spec Graph와 Runtime Graph를 비교하여
시스템 동작이 의도한 로직·정책·행동 구조와 일치하는지 자동 검증하는 플랫폼.

---

## 모노레포 구조

```text
packages/
  core/               @qa-sdk/core             공유 타입 · 스키마 · 포트 · 유틸리티
  sdk/                @qa-sdk/sdk              이벤트 수집 SDK (브라우저/Node/Edge)
  engine/             @qa-sdk/engine           순수 연산 엔진 (reconstruction/matching/verdict)
  store/              @qa-sdk/store            Trace 저장소 (Drizzle/PostgreSQL adapter)
  ingest-server/      @qa-sdk/ingest-server    Envelope 수신 HTTP 서버
  registry-server/    @qa-sdk/registry-server  서비스·이벤트 메타데이터 Registry API
```

### 의존 관계

```text
core  ← 모든 패키지가 의존
  ├── sdk           (core만 의존, storage 무관)
  ├── engine        (core만 의존, storage 무관 — 순수 연산)
  ├── store         (core 포트를 Drizzle로 구현)
  ├── ingest-server (core + store + engine 조합)
  └── registry-server (독립 서비스)
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
