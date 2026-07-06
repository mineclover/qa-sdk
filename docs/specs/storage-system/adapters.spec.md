---
def:
  tier: component
  id: storage-adapters-spec
  address: def_document:v2:343181
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [persistence, structural, runtime]
  links:
    - target: storage-schema-spec
      type: depends_on
    - target: scenario-store-spec
      type: depends_on
sources:
  - packages/store/src/index.ts
  - packages/store/src/adapters/drizzle/index.ts
  - packages/store/src/adapters/memory/index.ts
  - packages/store/src/adapters/drizzle/record.adapter.ts
  - packages/store/src/adapters/drizzle/trace.adapter.ts
  - packages/store/src/adapters/drizzle/session.adapter.ts
  - packages/store/src/adapters/drizzle/transmission.adapter.ts
  - packages/store/src/adapters/drizzle/scenario-spec.adapter.ts
  - packages/store/src/adapters/drizzle/graph.adapter.ts
  - packages/store/src/adapters/drizzle/verdict.adapter.ts
  - packages/store/src/adapters/drizzle/dlq.adapter.ts
  - packages/store/src/adapters/memory/record.adapter.ts
  - packages/store/src/adapters/memory/trace.adapter.ts
  - packages/store/src/adapters/memory/session.adapter.ts
  - packages/store/src/adapters/memory/transmission.adapter.ts
  - packages/store/src/adapters/memory/scenario-spec.adapter.ts
  - packages/store/src/adapters/memory/graph.adapter.ts
  - packages/store/src/adapters/memory/verdict.adapter.ts
  - packages/store/src/adapters/memory/dlq.adapter.ts
  - packages/ingest-server/src/lib/cleanup.ts
---

# Store Adapters

## 목적 ^purpose

core 포트의 Drizzle/PostgreSQL 및 In-Memory 구현체.

## 구성 ^overview

- **주요 Store 어댑터 8개**: RecordStore, TraceStore, SessionStore, TransmissionStore, ScenarioSpecStore, GraphStore, VerdictStore, DlqStore — 각각 Drizzle(PostgreSQL)과 InMemory 구현체 제공
- **공통 패턴**: Drizzle adapter는 `DbExecutor` 주입, InMemory adapter는 Map/배열 기반 테스트용이며, 모든 adapter가 core port interface를 구현
- **멱등 쓰기**: RecordStore는 `ON CONFLICT DO NOTHING`, TraceStore/SessionStore는 `ON CONFLICT DO UPDATE`로 중복 안전한 upsert 지원
- **커서 기반 페이지네이션**: RecordStore의 `findByTraceIdPaginated`/`findBySessionIdPaginated`는 `(timestamp, log_id)` 복합 커서 + `LIMIT+1` 패턴으로 hasMore 판정
- **CleanupStore**: cascade 없이 관련 record → graph → verdict → trace → orphan session 순서로 수동 삭제하는 전용 포트 (ingest-server 내부 정의)
- **DlqStore**: Dead Letter Queue — phase(`reconstruction`/`verdict`), 재시도 횟수 추적, resolved_at null이면 pending
- **제약 사항**: TransmissionStore는 insert only(감사 로그), ScenarioSpec은 JSONB 전체 저장(개별 필드 쿼리 불가), VerdictStore는 `(scenario_id, trace_id)` 복합 unique

## 상태

implemented

## 공통 패턴

- Drizzle adapter는 `DbExecutor` 인스턴스를 constructor에서 주입받음
- In-Memory adapter는 Map 또는 배열 기반, 테스트용
- 모든 adapter는 core port interface를 구현

---

## RecordStore

### DrizzleRecordStore

- `insertBatch`: `db.insert(eventRecords).values(records).onConflictDoNothing()` — 동일 log_id 중복 시 무시 (idempotent)
- `findByTraceIdPaginated`: `WHERE trace_id = ? AND (timestamp, log_id) > (cursor)` — `ORDER BY timestamp ASC, log_id ASC`, `LIMIT limit + 1`로 hasMore 판정
- `findBySessionIdPaginated`: `WHERE qa_session_id = ?` + 동일 cursor/limit 로직
- `findByTraceAndEventKey`: `WHERE trace_id = ? AND event_key = ?`, timestamp 오름차순

### InMemoryRecordStore

- 배열 기반, `insertBatch`: push (createdAt 자동 설정)
- pagination: filter → sort → cursor 이후 slice
- 대용량 테스트에 부적합 (선형 스캔)

---

## TraceStore

### DrizzleTraceStore

- `upsert`: `INSERT ... ON CONFLICT (trace_id) DO UPDATE` — recordCount 누적, firstTimestamp/lastTimestamp min/max 갱신, updatedAt = now()
- `findUnreconstructed`: `WHERE reconstructed = false ORDER BY created_at ASC LIMIT ?` (기본 100)
- `markReconstructed`: `UPDATE SET reconstructed = true, updated_at = now()`

### InMemoryTraceStore

- Map 기반, upsert: recordCount 합산, timestamp min/max 갱신
- 동시 쓰기 보호 없음 (단일 스레드 가정)

---

## SessionStore

### DrizzleSessionStore

- `upsert`: `INSERT ... ON CONFLICT (session_id) DO NOTHING` — idempotent
- `findById`: PK 조회
- `close`: `UPDATE SET closed_at = now()`

### InMemorySessionStore

- Map 기반, 이미 존재하면 무시

### 제약

- session 한 번 close 하면 재오픈 불가
- scenarioId, labels는 첫 upsert에서만 설정

---

## TransmissionStore

### DrizzleTransmissionStore

- `insert`: `db.insert(transmissions).values(params)` — receivedAt은 DB default

### InMemoryTransmissionStore

- 배열 기반, push

### 제약

- 현재 insert only (읽기 API 없음) — 감사 로그 용도
- 향후 목록 조회 필요 시 port에 find 메서드 추가

---

## ScenarioSpecStore

### DrizzleScenarioSpecStore

- `upsert`: `INSERT ... ON CONFLICT (scenario_id) DO UPDATE` — spec JSON 전체 덮어쓰기, version/domain/description 함께 갱신
- `findById`: scenario_id PK 조회 → spec JSONB를 ScenarioSpec으로 반환
- `findAll`: 전체 목록 조회
- `findByDomain`: `WHERE domain = ?` 필터
- `remove`: `DELETE WHERE scenario_id = ?` — 삭제 성공 여부 반환

### InMemoryScenarioSpecStore

- Map 기반, upsert: structuredClone으로 저장
- findByDomain: filter

### 제약

- scenario_id는 유일 (PK)
- spec JSON 전체를 JSONB로 저장 — 개별 필드 쿼리 불가

---

## GraphStore

### DrizzleGraphStore

- `upsert`: `INSERT ... ON CONFLICT (trace_id) DO UPDATE` — graph JSON 전체 덮어쓰기, nodeCount/edgeCount 함께 저장
- `findByTraceId`: graph JSONB를 RuntimeGraph로 파싱하여 반환

### InMemoryGraphStore

- Map 기반

### 제약

- RuntimeGraph는 JSON 직렬화 가능해야 함
- graph 크기가 클 수 있음 (수천 노드/엣지) — JSONB 성능 고려

---

## VerdictStore

### DrizzleVerdictStore

- `insert`: `db.insert(verdictReports).values(params)` — (scenario_id, trace_id) UNIQUE 제약
- `findByScenarioAndTrace`: 복합 조건 조회
- `findByTraceId`: trace_id 필터 (해당 trace의 모든 verdict)
- `findBySessionId`: qa_session_id 필터

### InMemoryVerdictStore

- 배열 기반, filter

### 제약

- (scenario_id, trace_id) 복합 unique — 재판정 시 기존 삭제 후 재삽입 필요
- report는 VerdictReport JSON 전체를 JSONB로 저장

---

## DlqStore

### DrizzleDlqStore

- `insert`: `db.insert(deadLetterQueue).values(params)` — id, traceId, phase, errorMessage 저장
- `findPending`: `WHERE resolved_at IS NULL ORDER BY created_at ASC LIMIT ?` (기본 100)
- `markAttempted`: `UPDATE SET attempt_count = attempt_count + 1, last_attempted_at = now()`
- `markResolved`: `UPDATE SET resolved_at = now()`

### InMemoryDlqStore

- Map 기반, insert: structuredClone으로 저장 (중복 id 시 에러)
- findPending: resolved_at === null 필터 → created_at 정렬 → slice

### 제약

- id는 유일 (PK)
- phase는 `"reconstruction"` 또는 `"verdict"`
- resolved_at이 null이면 pending 상태

---

## CleanupStore

cleanup 전용 포트. core port에 정의되지 않고 ingest-server 내부에서 정의.

### createDatabaseCleanupStore

- `listExpiredTraceIds`: `WHERE created_at < cutoff ORDER BY created_at ASC LIMIT ?`
- `deleteEventRecordsByTraceIds`: `DELETE FROM event_records WHERE trace_id = ANY(?)`
- `deleteRuntimeGraphsByTraceIds`: `DELETE FROM runtime_graphs WHERE trace_id = ANY(?)`
- `deleteVerdictReportsByTraceIds`: `DELETE FROM verdict_reports WHERE trace_id = ANY(?)`
- `deleteTracesByIds`: `DELETE FROM traces WHERE trace_id = ANY(?)`
- `listExpiredVerdictIds`: `WHERE computed_at < cutoff ORDER BY computed_at ASC LIMIT ?`
- `deleteVerdictReportsByIds`: `DELETE FROM verdict_reports WHERE id = ANY(?)`
- `listOrphanSessionIds`: `WHERE NOT EXISTS (SELECT 1 FROM traces WHERE traces.session_id = qa_sessions.session_id)`
- `deleteQaSessionsByIds`: `DELETE FROM qa_sessions WHERE session_id = ANY(?)`

### createInMemoryCleanupStore

- InMemory store의 private Map에 직접 접근하여 삭제 수행
- 테스트용

### 제약

- cascade 없음 — trace 삭제 전 관련 record/graph/verdict를 먼저 삭제해야 함
- orphan session 정리는 trace 삭제 후 수행
