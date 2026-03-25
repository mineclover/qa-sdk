---
def:
  id: ingest-interface-pipeline
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: ingest-api-spec
      type: refines
    - target: ingest-pipeline-flow
      type: refines
---

# Ingest 인터페이스 파이프라인

## 목적 ^purpose

ingest API가 registry validation, trace transaction, DLQ 삽입과 어떻게 연결되는지 후속 처리 경로를 분리해 설명한다.

## 후속 처리

- registry validation은 수신 직후 schema drift를 막는 첫 관문이다.
- trace transaction은 record 저장과 trace/session 갱신이 같은 단위로 묶여야 하는 구간을 설명한다.
- DLQ 삽입은 동기 응답을 깨지 않으면서 실패 배치를 보존하는 최종 fallback 경로다.
