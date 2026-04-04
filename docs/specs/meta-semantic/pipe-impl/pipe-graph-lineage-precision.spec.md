---
def:
  id: pipe-graph-lineage-precision
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-static-lineage
      type: refines
---

# Graph 계보 정밀 연결 — facetType + PortRef

## 목적 ^purpose

`deriveGraphLineage`의 cross-pipe chain을 이름 매칭 이상으로 정밀화하여 field/port 수준 연결을 제공한다.

## ^defines

- `PipeConnection.facetType` 기준으로 해당 타입의 필드만 cross-pipe chain에 연결한다
- `findFieldOriginInGraph(graph, pipeId, fieldName)`가 cross-pipe 역추적을 제공한다
- `summarizeGraphLineage(graph)`가 entry pipe 입력과 exit pipe 출력을 압축한다
- port 단위 정밀 연결은 `PortRef`와 `PipePort.facetType` 조합으로 확장 가능하다

## ^consumes

- `deriveGraphLineage` (`pipe-lineage.ts`)
- `PipeConnection`, `PortRef`, `PipePort` (`pipe-spec.ts`)
- `normalizeEndpointPipeIds` (`pipe-endpoint.ts`)
