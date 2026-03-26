---
def:
  id: viz-surface-system
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  tags: [structural, tier-frontend]
  links:
    - target: viz-panel-layout
      type: contains
    - target: graph-renderer-pipeline
      type: contains
    - target: graph-renderer-live
      type: contains
---

# Viz 표면 구성 그룹

## 목적 ^purpose

패널 레이아웃과 그래프 렌더러를 시각 배치, 렌더링 파이프라인, 실시간 업데이트 문서로 나눠 UI 표면의 변경 범위를 줄인다.

## 구성 ^overview

- `viz-panel-layout`: scenario selector, event log, verdict panel의 배치와 제약을 정리한 문서.
- `graph-renderer-pipeline`: DAG 레이아웃과 SVG 렌더링 파이프라인을 정리한 문서.
- `graph-renderer-live`: 스타일 매핑과 실시간 업데이트 규칙을 정리한 문서.

원본: `docs/specs/visualization/panels.spec.md` (`viz-panels-spec`), `docs/specs/visualization/graph-renderer.spec.md` (`graph-renderer-spec`)
