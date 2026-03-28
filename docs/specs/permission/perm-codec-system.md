---
def:
  id: perm-codec-system
  level: module
  address: def_document:v1:536
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [structural, security, tier-backend]
  links:
    - target: perm-codec-stack
      type: contains
    - target: perm-codec-interop
      type: contains
    - target: perm-codec-spec
      type: refines
---

# Permission Codec 시스템

## 목적 ^purpose

PermissionCodec의 3-tier codec stack과 외부 코덱 상호운용 규칙을 분리해, text permission code와 정수 address/bitmask 사이의 계약을 안정적으로 관리한다.

## 구성 ^overview

- `perm-codec-stack`: PermissionCodec의 차원 순서, encode/decode/serialize/check API, Tier 1~3 경계를 정의한다.
- `perm-codec-interop`: PrefixCodec, SemanticAddress, MetaCodec과 주소 동등성을 맞추는 상호운용 계약과 구현 경계를 정의한다.

## 원본

분할 전 원본: `docs/specs/indexing/permission-engine/codec.spec.md` (perm-codec-spec)
