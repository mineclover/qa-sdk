# POST /v1/ingest

> SDK로부터 Transmission Envelope을 수신하고 store에 저장.

## 상태

implemented

## 엔드포인트

```
POST /v1/ingest
Content-Type: application/json
```

### 요청

Body: `TransmissionEnvelope` (Zod `transmissionEnvelopeSchema`로 검증)

### 응답

- `202 Accepted` — `{ accepted: true, record_count: number }`
- `400 Bad Request` — envelope 검증 실패 또는 registry validation strict 모드 위반

## 처리 흐름

processEnvelope은 두 단계로 분리되어 있다 (향후 비동기 분리 대상):

```
1. body JSON 파싱
2. transmissionEnvelopeSchema.parse(body)
3. processEnvelope(envelope, deps)

   Phase 1 — storeEnvelope (응답 경로):
   3-1. Registry Validation (validateEnvelopeRecords)
        - mode=off 또는 validator 없음: skip
        - envelope 내 unique event key별로 validator.validateEvent 호출
        - 실패 이벤트 있을 때:
          - mode=strict: 400 Bad Request (전체 거부)
          - mode=warn: 경고 로깅 후 계속, registryWarning을 record에 첨부
        - validator 호출 자체가 실패하면 fail-open (valid: true 반환)
   3-2. TransmissionStore.insert(메타데이터)
   3-3. records를 trace_id별 그룹핑
   3-4. 각 trace에 대해 (persistTrace):
        - timestamps min/max 계산
        - records에서 qa_session_id 추출 (unique)
        - withTraceTransaction이 설정되면 트랜잭션 내에서 실행:
          - SessionStore.upsert(각 sessionId)
          - TraceStore.upsert(traceId, sessionId, serviceName, recordCount, timestamps)
          - RecordStore.insertBatch(records → RecordInsert[] 변환)
        - withTraceTransaction이 없으면 동일 작업을 트랜잭션 없이 실행
        - trace 저장 실패 시 해당 trace만 skip (에러 로깅), 다른 trace는 계속 진행
   3-5. RecordStreamBroker.publish(storedRecords) — 활성 SSE 구독자에게 즉시 전달

   Phase 2 — postIngestProcess (후처리):
   3-6. reconstructPendingTraces(deps)
        - TraceStore.findUnreconstructed() 배치 순회
        - RecordStore.findByTraceId(traceId)
        - reconstruct(traceId, records)
        - GraphStore.upsert(traceId, graph)
        - TraceStore.markReconstructed(traceId)
        - trace별 실패 시: 에러 로깅 + DlqStore에 phase="reconstruction" 항목 삽입
   3-7. computePendingVerdicts(deps, reconstructedTraceIds)
        - trace → session → scenarioId 조회
        - scenarioId 있으면 ScenarioSpecStore에서 spec 조회
        - compileSpec → matchGraphs → computeVerdict → VerdictStore.insert
        - 이미 verdict 존재 시 건너뜀 (idempotent)
        - verdict 계산 실패 시: 에러 로깅 + DlqStore에 phase="verdict" 항목 삽입

4. 응답 202
```

## Registry Validation

envelope 내 event_key + event_version이 registry에 등록된 이벤트인지 검증.

### 모드

| 모드 | 동작 |
|---|---|
| `strict` | 미등록 이벤트 포함 시 400 거부. 에러 메시지에 미등록 이벤트 목록 포함 |
| `warn` | 미등록 이벤트는 경고 로깅 후 저장 계속. record에 `registryWarning` 필드 첨부 |
| `off` | 검증 건너뜀 |

- 동일 envelope 내 중복 event_key+version은 한 번만 검증 (deduplicated)
- validator 호출 실패 시 fail-open (해당 이벤트를 valid로 취급)

### 설정

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `REGISTRY_VALIDATION_MODE` | `warn` | strict / warn / off |
| `REGISTRY_URL` | - | Registry 서버 URL (없으면 validator 미생성) |

## Trace Transaction

trace별 저장을 트랜잭션으로 묶어 부분 실패 시 rollback을 보장.

```typescript
type TraceTransactionRunner = <T>(
  fn: (stores: TracePersistenceStores) => Promise<T>,
) => Promise<T>;

interface TracePersistenceStores {
  recordStore: Pick<RecordStore, "insertBatch">;
  traceStore: Pick<TraceStore, "upsert">;
  sessionStore: Pick<SessionStore, "upsert">;
}
```

- `withTraceTransaction`이 IngestDeps에 제공되면 trace별로 트랜잭션 실행
- 미제공 시 트랜잭션 없이 순차 실행 (backward-compatible)
- 트랜잭션 범위: SessionStore.upsert + TraceStore.upsert + RecordStore.insertBatch

## DLQ 삽입

Phase 2 후처리에서 실패 시 DLQ 항목이 자동 생성된다:

- **reconstruction 실패**: `phase: "reconstruction"` — reconstruct 호출 중 예외
- **verdict 실패**: `phase: "verdict"` — verdict 계산 중 예외

DLQ 항목은 admin API (`POST /v1/admin/dlq/retry`)를 통해 재시도 가능.

## 의존 포트

```typescript
interface IngestDeps {
  recordStore: RecordStore;
  traceStore: TraceStore;
  graphStore: GraphStore;
  transmissionStore: TransmissionStore;
  sessionStore: SessionStore;
  verdictStore: VerdictStore;
  scenarioSpecStore: ScenarioSpecStore;
  dlqStore: DlqStore;
  recordStreamBroker: RecordStreamBroker;
  registryValidationMode?: RegistryValidationMode;  // 기본값: "warn"
  registryValidator?: RegistryEventValidator;
  withTraceTransaction?: TraceTransactionRunner;
  logger?: Logger;
}
```

## 제약 조건

- envelope 내 여러 trace가 포함될 수 있음 (trace_id별 그룹핑)
- 하나의 trace에 여러 session이 포함될 수 있음 (첫 번째 sessionId를 trace에 연결)
- Phase 1에서 trace 저장 실패는 해당 trace만 skip, 나머지는 계속 진행
- Phase 2에서 reconstruction/verdict 실패는 DLQ에 기록하고 다음 trace로 진행
- SSE 발행은 Phase 1 저장 성공 후 즉시 수행

## 테스트 커버리지

`packages/ingest-server/src/routes/ingest.test.ts`:
- 기본 202 응답, qa_session_id 세션 생성, invalid event_version → 400, validator throw → fail-open, strict 모드 거부

`packages/ingest-server/src/sdk-to-ingest.e2e.test.ts` (E2E):
- QaLogger(HttpTransport) → ingest → reconstruction → verdict 전체 파이프라인 자동 검증
- 7가지 체계적 시나리오 (`it.each`):
  1. required step 전체 발생 → `pass`
  2. required step 누락 → `fail` (missing_steps 포함)
  3. optional step 누락 → `warn`
  4. payload constraint 통과 → `pass`
  5. payload constraint 실패 → `fail` (missing_steps는 빈 배열)
  6. 시나리오 외 이벤트 발생 → `pass` 유지
  7. 백엔드 API 요청 흐름 수집 → `pass`
