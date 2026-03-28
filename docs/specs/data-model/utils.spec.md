---
def:
  id: utils-spec
  address: def_document:v1:2681
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: storage-schema-spec
      type: depends_on
---
# Utils (ID + Clock)

## 목적 ^purpose

ULID 기반 prefix ID 생성 및 타임스탬프 유틸리티.

## 구성 ^overview

- **ID 생성 함수 7종**: txm_(Transmission), log_(Record), trc_(Trace), spn_(Span), qas_(Session), vrd_(Verdict), dlq_(Dead-letter) — 모두 `<prefix>_<ULID>` 포맷
- **ULID 특성**: 시간순 정렬 가능 (48-bit timestamp + 80-bit random), 동일 밀리초 내 유일성 보장
- **Clock 유틸**: `now()` — ISO-8601 UTC 문자열 반환, 모든 시각 기록에 사용
- **불변 원칙**: 모든 ID는 생성 후 변경 불가, prefix로 ID 종류 즉시 식별 가능

## 상태

implemented

## ID 생성

```typescript
function newTransmissionId(): string;  // "txm_<ULID>"
function newLogId(): string;           // "log_<ULID>"
function newTraceId(): string;         // "trc_<ULID>"
function newSpanId(): string;          // "spn_<ULID>"
function newQaSessionId(): string;     // "qas_<ULID>"
function newVerdictId(): string;       // "vrd_<ULID>"
function newDlqId(): string;           // "dlq_<ULID>"
```

### 동작

- 각 함수는 `<prefix>_<ULID>` 포맷의 문자열 반환
- ULID는 시간순 정렬 가능 (Crockford's Base32, 48-bit timestamp + 80-bit random)
- 동일 밀리초 내 생성 시에도 유일성 보장 (random part)

### Prefix 체계

| prefix | 용도 | 생성 주체 |
|---|---|---|
| `txm_` | Transmission Envelope | SDK (flush 시) |
| `log_` | Event Record | SDK (log/span 기록 시) |
| `trc_` | Trace | SDK (startTrace 시) |
| `spn_` | Span | SDK (startSpan/pushSpan 시) |
| `qas_` | QA Session | 외부 (테스트 프레임워크 등) |
| `vrd_` | Verdict | engine / orchestration |
| `dlq_` | Dead-letter item | engine / ingestion cleanup |

## Clock

```typescript
function now(): string;  // ISO-8601 UTC
```

### 동작

- `new Date().toISOString()` 반환
- SDK의 timestamp, span의 start_time/end_time 등에서 사용
- 모든 시각은 UTC ISO-8601 문자열

## 제약 조건

- 모든 ID는 immutable — 생성 후 변경 불가
- prefix로 ID 종류를 즉시 식별 가능
- `newVerdictId()`와 `newDlqId()`도 동일한 ULID ordering / uniqueness 규칙을 따른다
- `now()`는 시스템 시계 의존 — 테스트에서 mocking 필요 시 DI 고려
