---
def:
  id: decode-service-spec
  type: spec
  tier: system
  scope: interface
  aspect: decode_contract
  depth: specification
  lifecycle: deprecated
  superseded_by: decode-service-system
  layer: mediation
  links:
    - target: decode-service-system
      type: depends_on
sources:
  - docs/specs/decode-service/decode-service-system.md
  - docs/specs/decode-service/decode-svc-api-contract.md
  - packages/decode-service/src/app.ts
---
# Decode Service Spec (Deprecated)

본 문서는 `decode-service-system`으로 통합되었습니다. 동일 역할을 이미 수행하던 umbrella 문서와 중복되어 2026-04-21 deprecated 처리.

## 목적 ^purpose
압축된 좌표 주소(URN)를 사람이 읽을 수 있는 메타데이터로 복원하는 디코딩 기능을 제공한다. **새 작업은 [decode-service-system](./decode-service/decode-service-system.md) 참조.**
