---
def:
  id: spec-core-types-group
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: spec-core-identifiers
      type: contains
    - target: spec-core-registry
      type: contains
---

# Spec Core Types 그룹

## 목적 ^purpose

spec-core 타입 정의를 공개 식별자/스키마 계약과 registry/IR 서비스로 나눠 순수 TypeScript 커널의 책임을 더 작게 설명한다.

## 구성 ^overview

overview: 총 2개 멤버.
- `spec-core-identifiers`: export surface, schema, PrefixSpec, spec document, 식별자 체계를 정리한 문서.
- `spec-core-registry`: core registry와 codegen IR 역할을 정리한 문서.

원본: `docs/specs/spec-engine/core-types.md` (`spec-core-types`)
