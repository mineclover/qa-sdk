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
- 신규 화면 분석 API는 `@qa-sdk/rlsc-analysis`가 소유하며, `rlsc/analysis`와 `rlsc/browser`는 하위 호환용 re-export 진입점이다.
- 3D Perspective 시각화는 `@qa-sdk/rlsc-perspective`가 소유한다. `rlsc`는 해당 viewer를 직접 포함하지 않는다.

## Compatibility Exports

The `rlsc` package remains the compatibility package for existing consumers. Imports from `rlsc`, `rlsc/analysis`, `rlsc/browser`, and `rlsc/rendering` are expected to keep working while newer code may import directly from split packages.

```ts
import { analyzeAreas, createNodeIndex, createScreenIdentifier } from 'rlsc';
import { detectAreaOverflow } from 'rlsc/analysis';
import { collectLayoutWithText, scanScreen } from 'rlsc/browser';
import { renderToSVG } from 'rlsc/rendering';
```

- `rlsc` → legacy RLSC collection/query/rendering APIs plus selected analysis helpers from `@qa-sdk/rlsc-analysis`
- `rlsc/analysis` → `@qa-sdk/rlsc-analysis`
- `rlsc/browser` → `@qa-sdk/rlsc-analysis/browser`
- `rlsc/rendering` → 기존 SVG/canvas 렌더링

Newer browser integrations should prefer `scanScreen()` from `rlsc/browser` or `@qa-sdk/rlsc-analysis/browser` when they need a complete document, layout metrics, issue detection, text occupancy, and node lookup helpers in one call.

```ts
const result = scanScreen(document.body, {
  includeText: true,
  collect: { addressAttribute: 'data-qa-address' },
});

const node = result.byXPath('/body[1]/main[1]/section[1]');
```

For documents that were already collected, use `createNodeIndex(doc)` to query by runtime id or stable metadata such as XPath, CSS selector, component id, and QA address.

## 코드 진입점

- `src/index.ts` — public export
- `src/analysis.ts` — `@qa-sdk/rlsc-analysis` compatibility export
- `src/browser.ts` — `@qa-sdk/rlsc-analysis/browser` compatibility export
- `src/rendering.ts` — SVG/canvas rendering subpath export
- `src/collector.ts`, `src/grid.ts`, `src/relations.ts`, `src/layers.ts` — 수집/구조 해석
- `src/metrics.ts`, `src/pattern.ts`, `src/intent.ts` — 분석 계층
- `src/query.ts`, `src/context.ts`, `src/monitor.ts` — 질의/요약/모니터링
- `src/canvas.ts`, `src/encoder.ts` — 렌더링/직렬화

## 실행

```bash
pnpm --filter rlsc build
pnpm --filter rlsc test
```
