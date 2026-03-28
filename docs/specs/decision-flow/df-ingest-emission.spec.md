---
def:
  id: df-ingest-emission
  address: def_document:v2:414850
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: qa-sdk-cli
  tags: [decision, ingest, event]
  links:
    - target: df-serialization
      type: depends_on
    - target: df-system
      type: implements
---
# Ingest 이벤트 전송

## 목적 ^purpose

FlowEngineListener를 통해 gate 선택/플로우 완료 이벤트를 ingest-server로 전송한다. 서버가 로컬이든 원격이든 같은 경로. convergence pipeline이 decision prefix를 자동 수집한다.

## 구성 ^overview

- **FlowIngestEmitter**: onGateSelected → `flow.gate.{id}`, onFlowCompleted → `flow.completed.{schemaId}`
- **전송 대상**: `INGEST_URL` 환경변수 또는 `http://localhost:3200` 기본값
- **fail-open**: 전송 실패해도 flow 진행 차단 안 함 (3초 timeout)
- **envelope 형식**: 기존 qa-sdk EventRecord 호환 (address_context + infra_context + payload)

## FlowIngestEmitter ^emitter

`packages/cli/src/stores/flow-ingest-emitter.ts`에 구현된 `FlowEngineListener`.

- `FlowEngine.addListener(new FlowIngestEmitter())` — CLI 초기화 시 등록
- URL 결정: `config.ingestUrl` → `process.env.INGEST_URL` → `http://localhost:3200`
- `warnOnFailure` 옵션 (기본 true): 전송 실패 시 console.warn 출력

### 이벤트 매핑

| FlowEngine 이벤트 | event_key | payload 주요 필드 |
|-------------------|-----------|-------------------|
| onGateSelected | `flow.gate.{gate.id}` | schemaId, instanceId, gateId, branchId, confidence, weight, evidenceKinds, durationMs |
| onFlowCompleted | `flow.completed.{schemaId}` | schemaId, instanceId, coordinateAddress, selectionCount, outcome |

## Envelope 형식 ^envelope

기존 qa-sdk ingest pipeline의 EventRecord 형식과 호환된다.

```typescript
{
  source: toTransmissionSource(serviceConfig, "decision-flow", "0.1.0"),
  build: { env: serviceConfig.env },
  records: [{
    trace_id: "flow-{timestamp}-{random}",
    event_key: "flow.gate.risk" | "flow.completed.test-needed",
    timestamp: ISO-8601,
    address_context: { decision_event: "decision_event:v1:42", ... },
    infra_context: { env, region, svc_name, namespace },
    payload_format: "json",
    payload_encoding: "raw",
    payload_masking_applied: false,
    payload_masked_fields: [],
    payload: { ...이벤트 데이터, flow_context: instance.context },
    qa_session_id: "flow-qa-sdk-cli",
  }]
}
```

- `source`: `createServiceBootConfig("qa-sdk-cli")` + `toTransmissionSource()` 사용
- `qa_session_id`: `"flow-{svc_name}"` — 세션 기반 Auto IL 분석에 사용
- `address_context`: FlowInstance에 캐시된 decision prefix 좌표 포함

## 전송 방식 ^transport

```typescript
fetch(`${ingestUrl}/v1/ingest`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(envelope),
  signal: AbortSignal.timeout(3_000),
}).catch(err => { if (warnOnFailure) console.warn(...); });
```

- **비동기 fire-and-forget**: `fetch()`의 Promise를 기다리지 않음. CLI 응답 지연 방지
- **3초 timeout**: `AbortSignal.timeout(3_000)` — 서버 무응답 시 빠른 실패
- **fail-open**: `.catch()`에서 경고만 출력. 전송 실패가 flow 진행을 차단하지 않음

## address_context 빌더 ^address-context

`ingest-adapter.ts`에서 FlowEngine 이벤트를 address_context로 변환하는 빌더 함수:

- `buildSelectionContext(flowType, phase, selection)` → `{ decision_event: "decision_event:v1:N" }`
- `buildPathContext(flowType, instance, scopeMode)` → `{ decision_path: "decision_path:v1:N" }`
- `buildEscalationContext(flowType, principle, phase)` → `{ escalation_event: "escalation_event:v1:N" }`
- `buildModelContext(modelId, reversibility, magnitude)` → `{ model_apply: "model_apply:v1:N" }`
- `buildForcingContext(questionId, evidenceKind, confidence)` → `{ forcing_response: "forcing_response:v1:N" }`
- `mergeContexts(...contexts)` — 여러 관찰 이벤트를 하나의 address_context로 병합
- `buildFlowCompletionContext(schema, instance, scopeMode)` — 플로우 완료 시 decision_path + 마지막 decision_event를 합산

## 수집 파이프라인 통합 ^pipeline

```
FlowEngine → FlowIngestEmitter → POST /v1/ingest → ingest-server Phase 1
  → EventRecord 저장 → Phase 2 convergence → decision prefix usage 집계
```

- ingest-server는 prefix 무관 범용 파이프라인 — decision prefix도 기존 이벤트와 동일하게 처리
- convergence pipeline이 usage 집계 시 decision_event/decision_path 등도 자동 포함
- Auto IL 분석에서 `qa_session_id` 기반으로 decision prefix 공출현 패턴 감지
