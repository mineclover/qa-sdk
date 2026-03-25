---
def:
  id: system-data-flow
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: ingest-api-spec
      type: refines
    - target: browser-monitor-spec
      type: refines
---
# 데이터 흐름

## 목적 ^purpose

이벤트가 브라우저/서버에서 발생하여 ingest → 저장 → 재구성 → 판정 → 시각화되는 전체 데이터 흐름.

## 구성 ^overview

5단계: SDK emit → ingest 수집 → Phase 1 저장 → Phase 2 재구성/판정 → viz-web 시각화. 각 단계에서 address_context(좌표)가 이벤트에 부착된다.
