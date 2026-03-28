---
def:
  id: logger-runtime-rules
  address: def_document:v1:2153
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: qa-sdk-cli
  tags: [observability, tier-system]
  links:
    - target: logger-spec
      type: refines
---

# 로거 런타임 규칙

## 목적 ^purpose

로거의 동작 조건, 실패 처리, 테스트 커버리지 기준을 분리해 수집 경로가 런타임 차이로 흔들리지 않게 만든다.

## 구성 ^overview

- `Fail-open 원칙`: 로거 에러가 호출자를 크래시시키지 않는 동작 규칙을 정의한다.
- `버퍼와 Flush 정책`: batchSize/flushInterval/maxBufferSize 3중 보호 메커니즘을 기술한다.
- `마스킹 규칙`: payload에서 민감 필드를 raw/mask/drop/hash 모드로 처리하는 규칙을 명시한다.
- `테스트 기준`: 설정 조합, 실패 경로, 런타임 차이 검증 방법을 정리한다.

## Fail-open 원칙

QaLogger는 이벤트 생성 경로를 **절대 차단하지 않는다**. 구체적인 fail-open 동작:

1. **flush 실패**: transport.send() 에러 시 레코드를 버퍼에 재삽입한다. 재삽입 후 maxBufferSize를 초과하면 oldest부터 드롭하고 `onError` 콜백으로 경고한다.
2. **동시 flush 방지**: `flushInProgress` 플래그로 interval flush와 batch-size flush가 동시에 실행되지 않도록 한다.
3. **컨텍스트 미생성**: activeContext가 없으면 자동으로 새 TraceContext를 생성한다 (ensureContext).
4. **리스너 에러 격리**: FlowEngine과 동일하게, 에러가 핵심 경로를 멈추지 않는다.

## 버퍼와 Flush 정책

3중 보호 메커니즘으로 데이터 손실을 최소화한다:

| 파라미터 | 기본값 | 역할 |
|----------|--------|------|
| `batchSize` | 50 | 레코드 수 도달 시 즉시 flush 트리거 |
| `flushIntervalMs` | 5,000ms | 시간 기반 주기적 flush (0이면 비활성) |
| `maxBufferSize` | 500 | hard cap — 초과 시 oldest 드롭 + 경고 |

flush 우선순위: **데이터 손실 방지 > 전송 지연**. 따라서:
- flush 실패 시 레코드를 재삽입한다 (버리지 않는다).
- 재삽입으로 maxBufferSize를 초과할 때만 oldest를 드롭한다.
- `shutdown()` 시 interval timer를 정리하고 마지막 flush를 수행한다.

## 마스킹 규칙

payload의 민감 필드를 4가지 모드로 처리한다 (logger/src/masking.ts):

| 모드 | 동작 | 결과 |
|------|------|------|
| `raw` | 마스킹 없음 | 원본 유지 |
| `mask` | 존재 여부만 기록 | `{ _masked: true, _present: boolean }` |
| `drop` | 필드 삭제 | 필드 없음 |
| `hash` | 비암호화 해시 | `"h_"` + 8자 hex (simpleHash) |

- `applyMasking(payload, rules)` → `{ masked, maskedFields }` 반환
- maskedFields 목록이 EventRecord.payload_masked_fields에 기록된다.
- 마스킹은 1단계 필드만 지원한다 (nested path는 미지원).

## 테스트 기준

1. **설정 조합**: batchSize=1 (즉시 flush), flushIntervalMs=0 (비활성), maxBufferSize=1 (극단 시나리오)
2. **실패 경로**: transport.send() reject 시 버퍼 재삽입 검증, maxBufferSize 초과 시 드롭 검증
3. **마스킹**: 각 모드별 payload 변환 정확성, maskedFields 목록 정확성
4. **런타임 차이**: 공통 계약 테스트(log/startSpan/metric 반환값)와 런타임별 얇은 어댑터 테스트 분리
5. **동시성**: flushInProgress 플래그 동작, interval + batch 동시 트리거 시 안전성
