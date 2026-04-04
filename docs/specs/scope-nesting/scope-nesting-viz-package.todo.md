---
def:
  id: scope-nesting-viz-package
  scope: process
  aspect: quality_check
  depth: task
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

## 결정 필요

- A/B/C 중 방향 선택
- 패키지명: `viz-core` vs `viz-render` vs `viz-toolkit`
- pipe-svg 이동 시점: scope-nesting 시각화와 동시 vs 후속
