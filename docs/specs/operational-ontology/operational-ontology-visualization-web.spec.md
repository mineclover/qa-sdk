---
def:
  tier: component
  id: operational-ontology-visualization-web
  type: spec
  scope: ui
  aspect: component
  depth: specification
  lifecycle: draft
  layer: experience
  tags: [frontend, visualization, observability]
  links:
    - target: operational-ontology-system
      type: traces_to
    - target: operational-ontology-persistence
      type: traces_to
    - target: operational-ontology-package-architecture
      type: traces_to
  sources:
    - packages/operational-ontology-web/package.json
    - packages/operational-ontology-web/src/main.ts
    - packages/operational-ontology-web/scripts/static-smoke.mjs
    - packages/operational-ontology-web/public/samples/event-store.json
---

# Operational Ontology Visualization Web — 수집 store 시각화

## 목적 ^purpose

operational ontology store JSON을 브라우저에서 읽어 snapshot, corridor, checkpoint, traversal, governance run을 시각적으로 탐색하는 독립 웹 패키지를 정의한다. 목표는 메타 프레임워크 본체를 UI 의존성 없이 유지하면서 수집 결과를 운영자가 빠르게 확인하게 하는 것이다.

## 구성 ^overview

`@qa-sdk/operational-ontology-web`는 다음을 제공한다.

- store JSON 업로드
- 샘플 store 로드
- object/projection/observation/governance metric
- lane 기반 topology view
- 선택 node inspector
- 최신 observation table

## 정의 ^defines

이 패키지는 operational ontology 데이터를 생성하지 않는다. `qa-sdk ontology ... --store`로 생성된 JSON이나 같은 shape의 API 응답을 읽는 read-only consumer다.

초기 입력 shape:

- `objects`
- `facets`
- `observations`
- `projections`

초기 lane:

- snapshot
- corridor
- checkpoint
- traversal
- governance
