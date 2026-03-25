---
def:
  id: cq-policy-resolver
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: wi-api
      type: depends_on
---
# Policy Resolver

## 목적 ^purpose

PolicyRule 집합에서 특정 좌표에 적용되는 정책을 해소하는 함수. resolvePolicy(codec, entities, rules, strategy)로 공개 API, resolvePatternPolicy로 내부 API.

## 구성 ^overview

resolvePolicy: 공개 API, entity name + 와일드카드 매칭.
resolvePatternPolicy: 내부 전용, position 기반.
전략: first-match, highest-priority, most-specific.
