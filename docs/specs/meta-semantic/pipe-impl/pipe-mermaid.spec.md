---
def:
  id: pipe-mermaid
  level: leaf
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: mediation
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-zoom
      type: depends_on
  source: packages/viz-core/src/pipe-mermaid.ts
---

# PipeGraph → Mermaid 변환

## 목적 ^purpose

PipeGraph 또는 ZoomView를 Mermaid flowchart 문법 문자열로 변환한다.
줌 레벨에 따라 다른 상세도의 다이어그램을 생성한다.

## 정의 ^defines

- `pipeGraphToMermaid(graph, level?, options?)` — PipeGraph를 줌 레벨 적용 후 Mermaid 변환
- `zoomViewToMermaid(view, options?)` — ZoomView 직접 변환
- `MermaidOptions` — direction(TB/LR), foldedStyle

## 소비 ^consumes

- `ZoomView`, `ZoomNode`, `ZoomEdge` (pipe-zoom.ts)
- `computeZoomView` (pipe-zoom.ts) — 줌 레벨 적용
- `FoldLevel` (pipe-fold.ts)

## 시각 인코딩

| 요소 | Mermaid 표현 |
|------|-------------|
| 일반 노드 (strict) | `[label]` + 초록 배경, 실선 |
| 유연 노드 (flexible) | `(label)` + 주황 배경, 점선 |
| 접힌 노드 | `([label])` + 파랑 배경, 두꺼운 테두리 |
| next 연결 | `-->` |
| conditional | `-.->` + 조건 라벨 |
| event | `==>` |
| error | `--x` |
| feedback | `-.->` |

## 관련 소스

| 파일 | 역할 |
|------|------|
| `core/src/pipe/pipe-mermaid.ts` | 구현 |
| `core/src/pipe/pipe-mermaid.test.ts` | 테스트 (6 tests) |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe/pipe-mermaid.test.ts
```
