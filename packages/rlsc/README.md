# rlsc

`rlsc`는 Relative Layout Structured Content 모델과 분석 도구를 제공한다. 중앙 spec이 잘 쪼개져 있으므로 README는 인덱스 역할만 한다.

## 먼저 볼 문서

- [rlsc.spec.md](../../docs/specs/rlsc/rlsc.spec.md) — 전체 진입점
- [rlsc-collector.spec.md](../../docs/specs/rlsc/rlsc-collector.spec.md) — DOM 수집
- [rlsc-pattern.spec.md](../../docs/specs/rlsc/rlsc-pattern.spec.md) — 패턴 분류
- [rlsc-intent.spec.md](../../docs/specs/rlsc/rlsc-intent.spec.md) — conformance/intention 해석
- [rlsc-test.spec.md](../../docs/specs/rlsc/rlsc-test.spec.md) — 테스트 범위 인덱스

## 패키지 역할

- DOM/문서 레이아웃을 수집하고 grid/layer/relation/pattern/intent를 해석한다.
- SVG/canvas/context/query/monitor 계열 도구를 함께 제공한다.
- 시각 구조를 좌표계 DSL로 다루는 핵심 분석 라이브러리다.

## 경량 진입점

분석과 렌더링은 subpath export로 분리한다.

```ts
import { analyzeAreas } from "rlsc/analysis";
import { collectLayoutWithText } from "rlsc/browser";
import { renderToSVG } from "rlsc/rendering";
```

- `rlsc/analysis`: DOM이나 렌더링 없이 `RLSCDocument`/`RLSCNode` 영역 분석, metrics, pattern, query를 사용한다.
- `detectAreaOverflow()`는 child rect가 parent rect를 넘어서는 계층 containment leak을 감지한다.
- `rlsc/browser`: 실제 브라우저 DOM 수집과 monitor만 포함한다.
- `rlsc/rendering`: 분석 결과를 SVG/canvas로 시각화한다.
- `rlsc`: 기존 통합 진입점으로 하위 호환을 유지한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/analysis.ts` — 경량 영역 분석 export
- `src/browser.ts` — 브라우저 DOM 수집/monitor export
- `src/rendering.ts` — SVG/canvas 렌더링 export
- `src/collector.ts`, `src/grid.ts`, `src/relations.ts`, `src/layers.ts` — 수집/구조 해석
- `src/metrics.ts`, `src/pattern.ts`, `src/intent.ts` — 분석 계층
- `src/query.ts`, `src/context.ts`, `src/monitor.ts` — 질의/요약/모니터링
- `src/canvas.ts`, `src/encoder.ts` — 렌더링/직렬화

## 실행

```bash
pnpm --filter rlsc build
pnpm --filter rlsc test
```
