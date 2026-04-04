---
def:
  id: service-manifest-assembly
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: realization-service-control-plane
      type: depends_on
    - target: service-release-manifest
      type: depends_on
---
# Service Manifest Assembly — 잔여 구현 항목

## 목적 ^purpose

이미 존재하는 child component version을 선택해 deterministic한 release manifest를 조립하는 계약과 검증 규칙을 정의한다.

## 구현 항목

- [ ] `ManifestAssemblyRequest` 구조를 고정한다.
- [ ] child version 조합과 prefix pin set의 compatibility validation 규칙을 정한다.
- [ ] `manifests/assemble` API가 child component를 암묵적으로 수정하지 않는다는 원칙을 명시한다.
- [ ] `resolve`를 assembly 결과 기반 read-model API로 재정의한다.
- [ ] 동일 child version 조합 + 동일 prefix pin이면 동일 manifest semantics를 보장하는 규칙을 정한다.
