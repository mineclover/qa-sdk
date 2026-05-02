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

## 코드 진입점

- `src/index.ts` — public export
- `src/collector.ts`, `src/grid.ts`, `src/relations.ts`, `src/layers.ts` — 수집/구조 해석
- `src/metrics.ts`, `src/pattern.ts`, `src/intent.ts` — 분석 계층
- `src/query.ts`, `src/context.ts`, `src/monitor.ts` — 질의/요약/모니터링
- `src/canvas.ts`, `src/encoder.ts` — 렌더링/직렬화

## 실행

```bash
pnpm --filter rlsc build
pnpm --filter rlsc test
```
