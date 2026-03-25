---
def:
  id: pipeline-phase-flow
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  links:
    - target: ingest-api-spec
      type: depends_on
    - target: record-spec
      type: depends_on
---
# 파이프라인 Phase 1/2 흐름

## 목적 ^purpose

Phase 1(동기 저장: envelope 검증 → record 저장 → trace upsert)과 Phase 2(비동기 재구성: reconstruction → scenario verdict → 알림)의 처리 순서와 전이 조건.
