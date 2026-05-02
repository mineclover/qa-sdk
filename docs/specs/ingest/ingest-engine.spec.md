---
def:
  id: ingest-engine
  type: spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: engine
  tags: [pipeline, runtime]
  links:
    - target: pipeline-system
      type: refines
  source: packages/engine/src/index.ts
---

# @qa-sdk/engine — ingest 파이프라인 엔진

## 목적 ^purpose

ingest 파이프라인의 reconstruction, match, verdict 처리 엔진. 이벤트 스트림을 Phase 1(수집) → Phase 2(재구성/판정)로 처리하는 순수 로직 라이브러리. ingest-server 서비스가 소비하며 convergence/verdict 판정의 핵심 알고리즘을 소유한다.
