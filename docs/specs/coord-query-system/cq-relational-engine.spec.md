---
def:
  id: cq-relational-engine
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  links:
    - target: cq-policy-resolver
      type: depends_on
    - target: cq-cross-index
      type: depends_on
    - target: cq-version-query
      type: depends_on
---
# RelationalEngine

## 목적 ^purpose

policy-resolver, cross-index-query, version-query를 통합하여 단일 질의 인터페이스를 제공하는 오케스트레이터. query-service의 핵심 런타임.

## 구성 ^overview

matchRanges: 범위 매칭 + gate 필터 합성.
composeQuery: 복합 질의 (policy + cross-index + gate).
resolve: 단일 좌표 해소.
