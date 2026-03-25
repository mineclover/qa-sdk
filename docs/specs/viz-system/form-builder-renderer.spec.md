---
def:
  id: form-builder-renderer
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: form-builder-spec
      type: refines
---

# Form Builder 렌더링

## 목적 ^purpose

form-builder의 auto-layout, 폼 렌더러, 전체 데이터 흐름을 분리해 편집 결과가 프리뷰와 동기화되는 경로를 설명한다.

## 렌더링 규칙

- auto-layout은 Figma 스타일 배치 규칙을 노드 트리에 적용하는 계산 단계다.
- 폼 렌더러는 편집기 상태를 실제 입력 UI로 바꾸는 projection 레이어다.
- 프리뷰는 편집 트리와 같은 데이터를 소비하지만, 상호작용 이벤트는 별도 bridge가 담당한다.
