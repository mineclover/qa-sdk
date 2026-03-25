---
def:
  id: df-ingest-emission
  scope: interface
  aspect: event_contract
  depth: specification
  lifecycle: approved
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
