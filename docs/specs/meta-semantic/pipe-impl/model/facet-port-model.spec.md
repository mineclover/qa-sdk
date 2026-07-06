---
def:
  id: facet-port-model
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-types
      type: refines
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-flow-catalog
      type: depends_on
sources:
  - packages/core/src/types/pipe-spec.ts
  - packages/core/src/pipe/pipe-port.ts
  - packages/core/src/pipe/pipe-port.test.ts
  - packages/core/src/pipe/pipe-endpoint.ts
  - packages/core/src/pipe/pipe-endpoint.test.ts
  - packages/core/src/pipe/pipe-validate.ts
  - packages/core/src/pipe/pipe-validate.test.ts
  - packages/core/src/pipe/pipe-interpret.ts
  - packages/core/src/pipe/pipe-interpret.test.ts
---

# Facet-Port 모델 — Feynman 인과 다이어그램 기반 Pipe 재설계

## 목적 ^purpose

PipeSpec에 typed port를 도입하여 vertex(노드)가 어떤 데이터 패싯을 받고 내보내는지 명시한다.
Feynman 다이어그램 대응: propagator line = typed data facet, vertex = transformation, external leg = trigger/produces.

## ^overview

3개 레이어 순서: 타입 시스템 → SVG 렌더링 → 스펙 재편.

- `PipePort` — typed input/output port 선언
- `PortRef` — port-level 연결 참조
- `resolvePorts` — 명시 ports 우선, 없으면 dataContract에서 도출
- `classifyPipeRole` — port shape 우선 + legacy fallback 역할 분류
- SVG port dot + facetType edge label + PortRef 기반 엣지 라우팅
- fold topology 30종 재분류 (14 topology)

## ^defines

### PipePort

```ts
interface PipePort {
  portId: string;
  direction: "in" | "out";
  facetType?: string;
  label?: string;
  required?: boolean;
}
```

`PipeSpec.ports?: PipePort[]` — optional, 하위 호환.

### PortRef

```ts
interface PortRef {
  pipeId: string;
  portId?: string;
}
```

`PipeConnection.from/to`를 `string | string[] | PortRef | PortRef[]`로 확장.
`PipeConnection.facetType?: string` — 이 edge가 운반하는 데이터 타입.

### Port 도출

| 함수 | 역할 |
|------|------|
| `inferPortsFromDataContract(pipe)` | dataContract.consumes/produces에서 PipePort[] 도출 |
| `resolvePorts(pipe)` | 명시 ports 우선, 없으면 infer. 병합(∪) 아님 |
| `dedupePorts(ports)` | direction:portId 기준 중복 제거, facetType/required 병합 |

### classifyPipeRole — port shape 우선 + legacy fallback

```
1. resolvePorts(pipe) 호출
2. input + output ports → transformer
3. output-only → producer
4. tap flow + !produces + !emit → observer
5. branch flow + no ports → router
6. legacy produces → transformer
7. emit → producer
8. fallback → consumer
```

TODO: ports 명시 시 port-only 판정 우선, legacy fallback 단계적 deprecation 예정.

### SVG 렌더링

| 함수 | 역할 |
|------|------|
| `drawPortDots(x, y, w, h, ports)` | 노드 경계에 typed port dot 렌더링 |
| `drawFacetBadge(...)` | edge 중간에 pill-style facetType 라벨 |
| `resolveEdgeAnchor(node, portIds, dir)` | PortRef 있으면 port dot 좌표에서 edge 출발/도착 |

port dot: 5.5px 원 + 삼각 방향 표시, facetType hash 기반 HSL 색상.
facetType badge: 반투명 흰색 rect, 10px monospace, edge 색상 계열.

## ^consumes

- `PipeFlow`, `PipeSpec`, `PipeGraph`, `PipeConnection` (pipe-spec.ts)
- `StepDataContract` (pipe-spec.ts)
- `collectFlowSteps` (pipe-fold.ts)
- `getChildFlows` (pipe-flow-utils.ts)
- `flowContainsKind` (pipe-interpret.ts)

## 구현 현황

| 항목 | 파일 | 상태 |
|------|------|------|
| PipePort, PortRef 타입 | `packages/core/src/types/pipe-spec.ts` | 완료 |
| inferPorts, resolvePorts | `packages/core/src/pipe/pipe-port.ts` | 완료 (4 tests) |
| classifyPipeRole | `packages/core/src/pipe/pipe-interpret.ts` | 완료 (26 tests) |
| SVG port dot | `packages/viz-core/src/pipe-svg.ts` | 완료 |
| SVG facetType badge | `packages/viz-core/src/pipe-svg.ts` | 완료 |
| PortRef edge routing | `packages/viz-core/src/pipe-svg.ts` | 완료 |
| design catalog | `viz-web/src/pipe-design.ts` | 완료 |
| fold topology 30종 | `pipe-flow-catalog.spec.md` | 완료 |
