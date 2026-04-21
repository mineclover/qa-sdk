---
def:
  id: dx-lifecycle-group
  tier: system
  address: def_document:v2:137218
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  svc: index-meta
  tags: [structural]
  links:
    - target: dx-lifecycle-tooling
      type: contains
    - target: dx-lifecycle-contract
      type: contains
    - target: index-meta-system
      type: depends_on
---

# Index Meta DX 라이프사이클 그룹

## 목적 ^purpose

index-meta 개발자 경험 문서를 도구 동선과 출력 계약으로 분리해 CLI에서 codegen까지의 흐름을 단계별로 설명한다.

## 구성 ^overview

- `dx-lifecycle-tooling`: 문제 정의, DX 전체 동선, CLI, codegen 흐름을 정리한 문서.
- `dx-lifecycle-contract`: 와이어 포맷, 타입 추론, 제약 조건을 정리한 문서.

원본: `docs/specs/indexing/index-meta/dx-lifecycle.spec.md` (`dx-lifecycle-spec`)
