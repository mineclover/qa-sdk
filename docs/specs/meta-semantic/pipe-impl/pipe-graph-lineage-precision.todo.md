---
def:
  id: pipe-graph-lineage-precision
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: pipe-static-lineage
      type: depends_on
---

# Graph 계보 정밀 연결 — facetType + PortRef

## 목적 ^purpose

`deriveGraphLineage`의 cross-pipe chain을 정밀화한다.
현재 이름 매칭만으로 연결하지만, PipeConnection의 facetType과 PortRef를
활용하여 더 정확한 필드 수준 연결을 제공한다.

## ^defines

- [x] `PipeConnection.facetType` 기반 필드 필터링 — 해당 타입의 필드만 cross-pipe 연결
- [x] `findFieldOriginInGraph(graph, pipeId, fieldName)` — cross-pipe 역추적
- [x] `summarizeGraphLineage(graph)` → entry pipe 입력 → exit pipe 출력 압축
- [x] 테스트 3건: facetType 필터, cross-pipe 역추적, graph 요약
- [x] `PortRef` 기반 port 단위 정밀 연결 — `PipePort.facetType`으로 필드 식별 (향후)

## ^consumes

- `deriveGraphLineage` (pipe-lineage.ts)
- `PipeConnection`, `PortRef`, `PipePort` (pipe-spec.ts)
- `normalizeEndpointPipeIds` (pipe-endpoint.ts)
