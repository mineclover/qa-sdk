# viz-core

`viz-core`는 SVG/Mermaid/D3 기반 재사용 렌더러를 담는 시각화 코어 패키지다.

## 먼저 볼 문서

- [scope-nesting-visualization.spec.md](../../docs/specs/scope-nesting/scope-nesting-visualization.spec.md) — 상위 시각화 계약
- [scope-nesting-timeline-renderer.spec.md](../../docs/specs/scope-nesting/scope-nesting-timeline-renderer.spec.md) — timeline renderer
- [concept-hierarchy-grid.spec.md](../../docs/specs/viz-system/viz-surface-system/concept-hierarchy-grid.spec.md) — concept grid
- [meta-semantic-pipe-impl.spec.md](../../docs/specs/meta-semantic/meta-semantic-pipe-impl.spec.md) — pipe-svg 관련 문맥

## 패키지 역할

- primitives, shapes, pipe-svg, scope-mermaid, scope-d3, concept-grid, timeline renderer를 제공한다.
- 시각화 알고리즘을 앱에서 분리한 reusable core다.
- `viz-web`, `platform-demo`, scope-nesting preview가 이 패키지를 소비한다.

## 코드 진입점

- `src/index.ts` — 루트 export
- `src/primitives.ts`, `src/shapes.ts` — 시각화 기본형
- `src/pipe-svg.ts`, `src/pipe-mermaid.ts` — 파이프 시각화
- `src/scope-mermaid.ts`, `src/scope-d3.ts`, `src/scope-nesting-timeline.ts` — scope nesting 계열
- `src/concept-grid.ts` — concept hierarchy grid

## 실행

```bash
pnpm --filter viz-core build
pnpm --filter viz-core test
pnpm --filter viz-core typecheck
```
