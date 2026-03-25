---
def:
  id: spec-temporal-infra
  scope: constraint
  aspect: infra_constraint
  depth: specification
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: temporal-relations
      type: refines
---

# Spec 시간 관계 인프라

## 목적 ^purpose

시간 관계 수집의 구현 우선순위, 인프라 요구사항, 불변식을 분리해 temporal relation 기능의 도입 규칙을 정리한다.

## 도입 규칙

- 구현 우선순위는 수집 가능성 검증, 저장 경계 설계, 분석 기능 연결 순으로 잡는다.
- 인프라 요구사항은 이벤트 순서 보존, 지연 허용 범위, 재계산 비용을 포함해야 한다.
- 불변식은 같은 trace/session에서 순서 정보가 뒤틀려도 복구 가능한 최소 단위를 정의한다.
