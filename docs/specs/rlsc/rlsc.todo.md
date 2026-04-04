---
def:
  id: rlsc
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  level: module
  layer: mediation
  svc: rlsc
  tags: [runtime, structural]
---

# R.L.S.C.™ — 작업 항목

테스트 시나리오는 `rlsc-test.todo.md` 참조.

## Phase 1 — 버그 수정 ✓ 완료

- [x] **브라우저 환경 가드** — `collector.ts:collectLayout()` 진입부
- [x] **`encoder.ts:126` cellSize:120** — `cellSize: 0`으로 수정 (재계산 필요 시그널)
- [x] **`context.ts` {layers} 미교체** — `layersToText` import + `buildPrompt` layers 파라미터
- [x] **`encoder.ts:125` root 타입 cast** — `...(root ? { root } : {})` 로 교체
- [x] **`context.ts:18` 타입 핵** — `DEFAULT_SECTIONS` + 명시적 `??` 병합으로 교체

## Phase 2 — 테스트

테스트 시나리오: `rlsc-test.todo.md` 참조.

- [x] `encoder.test.ts` — 라운드트립, 이스케이프, address 필드, relations 없는 문서
- [x] `relations.test.ts` — 8종 기하 경계 케이스
- [x] `grid.test.ts` — cellSize 기본값, dominant, coverage, 빈 셀
- [x] `query.test.ts` — 조건 필터 4종, diff 5종
- [x] `context.test.ts` — 토큰 예산 truncate, accessibility-audit {layers} 검증

## Phase 3 — LayoutMonitor 구현

스펙: `rlsc-monitor.spec.md`

`LayoutMonitor`는 실시간 레이아웃 적합성 검증 루프의 핵심이다. 제거하지 않고 구현한다.

- [x] `monitor.ts` 생성 — `createLayoutMonitor` (MutationObserver + ResizeObserver + debounce)
- [x] `MonitorOptions` 타입 + `onConformanceChange` 콜백 — `types.ts` 추가
- [x] `index.ts` export 추가
- [ ] `monitor.test.ts` — 브라우저 가드 + debounce 단위 테스트

## Phase 5 — 설계 메트릭 + 패턴 어휘

스펙: `rlsc-metrics.spec.md`, `rlsc-pattern.spec.md`

- [x] `LayoutMetrics`, `ProximityGroup` 타입 — `types.ts` 추가
- [x] `metrics.ts` 생성 — `measureLayout` + 8종 측정 함수
- [x] `grid.ts:extractRegions` export 전환
- [x] `LayoutPattern` 및 하위 패턴 타입 5종 — `types.ts` 추가
- [x] `pattern.ts` 생성 — `classifyLayout`
- [x] `index.ts` export 추가 (`measureLayout`, `classifyLayout`, 타입 포함)
- [ ] `metrics.test.ts`, `pattern.test.ts` — 단위 테스트

## Phase 6 — 의도 선언 + 프레임 검증

스펙: `rlsc-intent.spec.md`

- [x] `LayoutPattern`, `GestaltPattern`, `ConformanceViolation`, `ConformanceResult` 타입 — `types.ts` 추가
- [x] `intent.ts` 생성 — `checkConformance` + `recognizeLayout` + 5종 내부 체커
- [x] `index.ts` export 추가
- [ ] `intent.test.ts` — 의도별 위반 탐지 + score 계산 테스트

## Phase 7 — 캔버스 렌더링

스펙: `rlsc-canvas.spec.md`

- [x] `CanvasRenderOptions` 타입 — `types.ts` 추가
- [x] `canvas.ts` 생성 — `renderToCanvas`, `renderToSVG`, `assignColors` + 오버레이 3종
- [x] `index.ts` export 추가
- [ ] `canvas.test.ts` — `renderToSVG` 단위 테스트 (DOM 없이)

## Phase 8 — 통합

- [x] **rlsc.html → npm 연결** — `platform-demo/src/pages/rlsc.ts`로 교체 (TypeScript, rlsc 패키지 import)
- [ ] **Inspector UI 업데이트** — metrics/conformance/canvas 결과를 Inspector에 추가
- [ ] **소비자 추가** — browser-sdk 또는 shop-web에서 사용 예시
