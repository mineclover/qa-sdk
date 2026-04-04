---
def:
  id: scope-nesting-viz-package
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: scope-nesting-visualization
      type: depends_on
---

# 시각화 패키지 분리 검토

## 현황

core에 시각화 코드 1,464줄이 혼재:

| 파일 | 줄 | 본래 책임 |
|---|---|---|
| pipe-svg-primitives.ts | 126 | SVG 요소 빌더 |
| pipe-svg-shapes.ts | 603 | 도메인 도형 + 토큰 |
| pipe-svg.ts | 293 | PipeGraph → SVG/D3 |
| pipe-mermaid.ts | 130 | PipeGraph → Mermaid |
| scope-nesting-mermaid.ts | 163 | ScopeNesting → Mermaid |
| scope-nesting-d3.ts | 149 | ScopeNesting → D3 |

canvas-viewport는 이미 별도 패키지 (565줄). 이것은 올바른 분리.

## 문제

1. **core의 책임 과다** — core는 데이터/검증/타입이 본분인데 렌더링(SVG/D3/Mermaid)까지 포함
2. **소비자 분산** — viz-web, registry-ui, rlsc, scope-nesting-demo가 각각 다른 방식으로 렌더링
3. **토큰 중복** — ROLE_TOKENS, EDGE_TOKENS 등이 core에 있어서 순수 라이브러리인 core가 시각적 관심사를 가짐
4. **테스트 부담** — core의 테스트(1039건)에 SVG 출력 검증이 섞여 있음

## 분리 안

### A안: `@qa-sdk/viz-core` 신규 패키지

```
packages/viz-core/
├── src/
│   ├── primitives.ts        ← core/pipe-svg-primitives.ts 이동
│   ├── shapes.ts            ← core/pipe-svg-shapes.ts 이동
│   ├── tokens.ts            ← ROLE_TOKENS, EDGE_TOKENS 등 추출
│   ├── pipe-renderer.ts     ← core/pipe-svg.ts + pipe-mermaid.ts 이동
│   ├── scope-renderer.ts    ← scope-nesting-mermaid.ts + d3.ts + timeline 이동
│   └── index.ts
├── package.json              ← depends: @qa-sdk/core, canvas-viewport
└── tsconfig.json
```

의존 방향: `viz-core → core` (역방향 금지)

**장점**: core 순수화, 시각화 일관성, 토큰 중앙 관리
**단점**: 이동 범위 큼 (6파일 + 관련 테스트 + index.ts 재정렬), 기존 소비자(viz-web, registry-ui) import 경로 변경

### B안: core에 유지, `viz-core`는 scope-nesting 전용만

```
packages/viz-core/
├── src/
│   ├── scope-renderer.ts    ← scope-nesting 시각화만
│   ├── scope-timeline.ts    ← 통합 타임라인
│   └── index.ts
├── package.json              ← depends: @qa-sdk/core, canvas-viewport
```

pipe-svg는 core에 유지 (기존 소비자 무변경), scope-nesting 시각화만 분리.

**장점**: 이동 범위 최소, 기존 코드 무변경
**단점**: core의 시각화 코드 잔존, 점진적이지만 근본 해결 아님

### C안: 점진적 이동 (B → A)

1단계: B안으로 scope-nesting 시각화만 `viz-core`에 생성
2단계: pipe-svg를 `viz-core`로 이동 (core에서 re-export로 하위 호환)
3단계: re-export 제거, 소비자 import 경로 변경

**장점**: 단계별 안전, 각 단계에서 테스트 통과 확인 가능
**단점**: 중간 상태에서 re-export 관리 필요

## 결정 완료

- **C안 채택** (점진적 B→A)
- **패키지명**: `viz-core`
- **1단계 완료** (2026-04-05): primitives + shapes + pipe-mermaid + scope-mermaid + scope-d3 → viz-core 복사. core 원본 유지.

## 잔여 작업

- [x] 2단계: core 원본을 `viz-core` re-export로 전환 (하위 호환) — 2026-04-05 완료
  - viz-core tsup multi-entry + subpath exports 추가 (./primitives, ./shapes, ./pipe-mermaid, ./scope-mermaid, ./scope-d3)
  - core에 `viz-core: workspace:*` 의존성 추가
  - 5개 파일 → `export * from "viz-core/..."` 전환
  - core build 스크립트에 `rm -rf dist` 추가 (순환 의존 TS5055 방지)
  - 1039 tests 전부 통과 확인
- [x] 3단계: 소비자 import 경로 변경 — 2026-04-05 완료
  - viz-web/pipe-design.ts: shapes/tokens → `viz-core` import 전환
  - viz-web/pipe-preview.ts: `pipeGraphToMermaid` → `viz-core` import 전환
  - viz-web에 `viz-core: workspace:*` 의존성 추가
  - viz-core index.ts에 누락된 타입 export 추가 (RoleTokens, StandaloneNodeOptions 등)
  - registry-ui: 해당 없음 (시각화 import 미사용)
- [x] 4단계: core 공개 API에서 시각화 export 삭제 — 2026-04-05 완료
  - pipe/index.ts: Mermaid, SVG primitives, SVG shapes+tokens 섹션 제거
  - core/index.ts: scope-nesting-mermaid export + pipe 시각화 블록 제거
  - re-export 파일 자체는 유지 (pipe-svg.ts + test 파일이 내부 의존)
  - 1039 tests 전부 통과 확인
- [x] pipe-svg.ts (그래프 렌더러) → viz-core 이동 — 2026-04-05 완료
  - viz-core/src/pipe-svg.ts 생성 (import를 @qa-sdk/core + viz-core 내부로 전환)
  - viz-core export/subpath/tsup entry 추가
  - core/pipe/pipe-svg.ts re-export → 삭제
  - viz-web: pipeGraphToSvg/D3 import를 viz-core로 전환
  - core 공개 API에서 SVG/D3 export 제거
  - core의 6개 re-export 파일 삭제, viz-core를 devDependencies로 이동
  - core에 `summarizeFlowLineage` 공개 export 추가
  - 1039 tests 전부 통과 확인
- [x] scope-nesting-timeline.ts 신규 구현 → viz-core에 직접 생성 — 2026-04-05 완료
  - 타입: ScopeTimelineData, ScopeTimelineRow, TimelineBlock, D3TimelineData
  - 토큰: SCOPE_DEPTH_COLORS, CONTRACT_TYPE_COLORS, TIMING_COLORS
  - 함수: buildTimelineRows, scopeTimelineToSvg, scopeTimelineToD3
  - 행 4종: scope(depth 기반), contract(readiness), pipe(simulation step), delegation(gap)
  - viz-core export/subpath/tsup entry 추가
  - 10 tests 통과
- [x] viz-web/scope-nesting-preview 페이지 → viz-core + canvas-viewport 통합 — 2026-04-05 완료
  - scope-nesting.html: 사이드바(예제 선택) + 탭(Timeline/Mermaid/D3) + 행 필터 체크박스
  - scope-nesting-preview.ts: MountFlowBinding/validateMountFlow/simulate 올바른 API로 구현
  - viz-web tsc --noEmit 통과 확인
