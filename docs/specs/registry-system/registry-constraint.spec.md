---
def:
  id: registry-constraint
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: registry-api
      type: constrains
    - target: registry-services-api-spec
      type: constrains
    - target: registry-events-spec
      type: constrains
    - target: registry-client-spec
      type: constrains
---
# Registry 기술적 제약

## 목적 ^purpose

Registry 시스템의 기술적 불변 조건. DAG 순환 금지, capacity 불변(locked 이후), 단일 active 버전 규칙.

## 불변 조건 ^constraint

1. **DAG 순환 금지**: composite prefix의 DimRef가 순환 참조를 만들면 안 된다.
2. **capacity 불변**: locked 이후 capacity 변경 불가 — stride 계산의 안정성.
3. **단일 active**: prefix당 active 버전은 최대 1개.
4. **baseVersion 존재**: 새 버전의 baseVersionId는 기존 버전을 가리켜야 한다 (최초 제외).
5. **leaf 변경 → composite 재계산**: leaf의 capacity가 바뀌면 참조하는 모든 composite의 shape/stride/product를 재계산해야 한다.
