---
def:
  id: spec-linking-rules
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: spec-linking-standard
      type: refines
---

# Spec Linking 규칙

## 목적 ^purpose

스펙 문서, decision, prefix, axis 간 참조 형식과 문서 유형별 필수 연결 규칙을 분리해 링크 표준을 정리한다.

## 링크 표준

- 참조 형식은 문서에서 기계가 읽을 수 있는 ID와 사람이 읽는 제목을 동시에 유지해야 한다.
- 문서 유형별 필수 참조는 데이터, flow, interface가 어떤 방향으로 연결돼야 하는지 기준선을 제공한다.
- 새 문서 추가 시 체크리스트는 링크 누락보다 잘못된 방향의 연결을 먼저 막는 역할을 한다.
