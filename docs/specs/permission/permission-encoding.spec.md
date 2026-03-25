---
def:
  id: permission-encoding
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [security]
  links:
    - target: permission-model
      type: depends_on
---
# 권한 인코딩

## 목적 ^purpose

권한 데이터를 WeightedIndex(DB+범위 질의), BitIndex(인메모리 필터), IndexBridge(양쪽 호환)로 인코딩하는 데이터 구조. permission code 형식: `{service-ref}.{type}.{resource}.{action}`.

## 구성 ^overview

3가지 인코딩 전략: WeightedIndex(DB 저장 + 범위 질의), BitIndex(인메모리 빠른 필터), IndexBridge(양쪽 변환). resource 형식: 소문자, `/` 구분, depth ≤ 4.
