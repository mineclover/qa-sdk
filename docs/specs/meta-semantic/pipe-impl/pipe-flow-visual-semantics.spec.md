---
def:
  id: pipe-flow-visual-semantics
  type: design
  tier: component
  owner_system: meta-semantic-system
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: pipe-flow-catalog
      type: depends_on
sources:
  - packages/core/src/pipe/pipe-interpret.ts
  - packages/core/src/pipe/pipe-mermaid.ts
  - packages/core/src/pipe/pipe-svg.ts
---

# PipeFlow 시각 의미론

## 목적 ^purpose

각 `PipeFlow.kind`가 단독 `PipeSpec.flow`로 사용될 때
어떤 `role`, `concerns`, 기본 색상/도형으로 시각화되는지를 정의한다.

## 정의 ^defines

각 flow kind가 `classifyPipeRole` / `extractPipeConcerns`에서 도출하는 기본값.
`PipeSpec.produces`가 설정되면 일부 flow는 `transformer`로 승격될 수 있다.

| kind | role | concerns | 노드 색상 (fill/stroke) |
|------|------|----------|------------------------|
| step | consumer | — ¹ | #f3e5f5 / #6a1b9a |
| sequence | consumer | — | #f3e5f5 / #6a1b9a |
| branch | router | — | #fff8e1 / #f57f17 |
| optional | consumer | — | #f3e5f5 / #6a1b9a |
| parallel | consumer | concurrency | #f3e5f5 / #6a1b9a |
| race | consumer | concurrency | #f3e5f5 / #6a1b9a |
| await | consumer | latency | #f3e5f5 / #6a1b9a |
| retry | consumer | resilience | #f3e5f5 / #6a1b9a |
| fallback | consumer | resilience | #f3e5f5 / #6a1b9a |
| circuit-breaker | consumer | resilience | #f3e5f5 / #6a1b9a |
| loop | consumer | — | #f3e5f5 / #6a1b9a |
| feedback | consumer | — | #f3e5f5 / #6a1b9a |
| compensate | consumer | — | #f3e5f5 / #6a1b9a |
| transition-scope | consumer³ | resilience⁴ | #f3e5f5 / #6a1b9a |
| finally | consumer | — | #f3e5f5 / #6a1b9a |
| emit | producer | async-coupling | #e3f2fd / #1565c0 |
| timeout | consumer | latency | #f3e5f5 / #6a1b9a |
| map | consumer² | — | #f3e5f5 / #6a1b9a |
| reduce | consumer² | — | #f3e5f5 / #6a1b9a |
| buffer | consumer² | — | #f3e5f5 / #6a1b9a |
| filter | consumer | data-filtering | #f3e5f5 / #6a1b9a |
| throttle | consumer | — | #f3e5f5 / #6a1b9a |
| debounce | consumer | — | #f3e5f5 / #6a1b9a |
| split | consumer² | — | #f3e5f5 / #6a1b9a |
| enrich | consumer² | — | #f3e5f5 / #6a1b9a |
| tap | observer | observability | #fce4ec / #c62828 |
| resequence | consumer² | — | #f3e5f5 / #6a1b9a |
| window | consumer² | — | #f3e5f5 / #6a1b9a |
| dedup | consumer | data-filtering | #f3e5f5 / #6a1b9a |
| correlation | consumer | async-coupling | #f3e5f5 / #6a1b9a |

> ¹ `step`: timeout 필드가 있으면 latency, dataContract.accesses에 write/readwrite 있으면 data-mutation 추가
> ² `PipeSpec.produces` 설정 시 transformer (#e8f5e9 / #2e7d32) 로 승격
> ³ `transition-scope`: body 내용에 따라 역할 결정
> ⁴ `transition-scope`: compensate 필드가 있을 때만 resilience 추가

## 역할 색상표

| role | fill | stroke | 노드 모양 |
|------|------|--------|----------|
| producer | #e3f2fd | #1565c0 | 오른쪽 뾰족 오각형 |
| consumer | #f3e5f5 | #6a1b9a | 둥근 직사각형 |
| transformer | #e8f5e9 | #2e7d32 | 다이아몬드 컷 육각형 |
| router | #fff8e1 | #f57f17 | 마름모 |
| observer | #fce4ec | #c62828 | 타원 |

## 구현 참조

- `packages/core/src/pipe/pipe-interpret.ts` — `classifyPipeRole`, `extractPipeConcerns`
- `packages/core/src/pipe/pipe-mermaid.ts` — Mermaid 시각 표현 소비
- `packages/core/src/pipe/pipe-svg.ts` — SVG 시각 표현 소비
- `packages/core/src/pipe/pipe-zoom.ts` — zoom 노드 스타일/role 소비
