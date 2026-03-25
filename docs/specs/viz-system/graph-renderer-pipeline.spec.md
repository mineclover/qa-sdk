---
def:
  id: graph-renderer-pipeline
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: graph-renderer-spec
      type: refines
---

# 그래프 렌더러 파이프라인

## 목적 ^purpose

`SpecGraph`를 DAG 레이아웃으로 배치하고 SVG로 렌더링하는 그래프 렌더러의 핵심 파이프라인을 정리한다.

## 레이아웃과 렌더링

- 레이아웃 단계는 노드/엣지 관계를 dagre 입력으로 정규화해 화면 배치 좌표를 계산한다.
- 렌더링 단계는 계산된 좌표를 SVG 노드, 엣지, 라벨 스타일로 변환한다.
- 스타일 매핑은 데이터 의미를 색상/선 굵기/아이콘으로 번역하되 layout 알고리즘과 분리한다.
