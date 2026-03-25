---
def:
  id: form-builder-structure
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: form-builder-spec
      type: refines
---

# Form Builder 구조

## 목적 ^purpose

form-builder의 DOM 트리 모델, 트리 뷰, 속성 편집기 사이의 구조적 책임을 분리해 편집기 셸을 안정화한다.

## 구조 모델

- DOM 트리 모델은 저장 가능한 노드 구조와 편집기의 현재 선택 상태를 함께 표현한다.
- 트리 뷰는 DevTools 스타일 탐색기를 제공하되, 렌더링 결과와 직접 결합하지 않는다.
- 속성 편집기는 선택된 노드의 편집 폼을 만들고, 변경 결과를 공용 트리 상태에 반영한다.
