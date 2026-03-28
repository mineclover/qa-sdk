---
def:
  id: spec-core-types-group
  level: module
  address: def_document:v2:342032
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, tier-system]
  links:
    - target: spec-core-identifiers
      type: contains
    - target: spec-core-registry
      type: contains
    - target: system-design-tools
      type: depends_on
---

# Spec Core Types 그룹

## 목적 ^purpose

spec-core 타입 정의를 공개 식별자/스키마 계약과 registry/IR 서비스로 나눠 순수 TypeScript 커널의 책임을 더 작게 설명한다.

## 구성 ^overview

- `spec-core-identifiers`: export surface, schema, PrefixSpec, spec document, 식별자 체계를 정리한 문서.
- `spec-core-registry`: core registry와 codegen IR 역할을 정리한 문서.

원본: `docs/specs/spec-engine/core-types.md` (`spec-core-types`)
