---
def:
  id: test-scenario-store
  type: spec
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: test-scenario-store
  tags: [persistence, testing]
  source: packages/test-scenario-store/src/index.ts
---

# test-scenario-store — 시나리오 B 좌표 레지스트리

## 목적 ^purpose

테스트 시나리오의 축 좌표(B axis — behavior)를 SQLite 레지스트리로 저장·조회하는 라이브러리. 시나리오 정의가 prefix/axis 좌표를 갖도록 만들어, ingest pipeline이 발생 이벤트의 시나리오 소속을 결정론적으로 판정할 수 있게 한다.
