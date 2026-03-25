---
def:
  id: graph-renderer-live
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: graph-renderer-spec
      type: refines
---

# 그래프 렌더러 실시간 규칙

## 목적 ^purpose

그래프 스타일 매핑과 SSE 기반 실시간 업데이트 규칙을 분리해 렌더러의 런타임 변경 비용을 줄인다.

## 업데이트 규칙

- 실시간 업데이터는 전체 그래프를 다시 그리기보다 변경된 노드/엣지만 갱신해야 한다.
- 스타일 매핑은 상태 변화가 잦아도 layout 결과를 무효화하지 않는 선에서 적용한다.
- 스트림 지연이나 순서 뒤틀림이 생겨도 마지막 일관된 상태를 유지하는 쪽을 우선한다.
