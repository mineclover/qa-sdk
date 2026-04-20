---
def:
  id: snapshot-io-spec
  level: leaf
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: snapshot-io
  tags: [runtime, codegen, contract]
  links:
    - target: apm-codegen-system
      type: refines
---
# snapshot-io

## 목적 ^purpose

SchemaSnapshot JSON 파일을 읽고 쓰고 검증하는 I/O 유틸리티. codegen과 registry publish 이전 단계에서 snapshot 파일을 안정적으로 다루기 위한 얇은 계층이다.

## 구성 ^overview

- snapshot 읽기
- snapshot 쓰기
- snapshot 기본 검증
- `codegen-core`와 결합되는 I/O 전용 역할

## 관련 소스

- `packages/snapshot-io/src/snapshot-io.ts`
- `packages/snapshot-io/src/index.ts`
