---
def:
  tier: component
  id: address-scenarios-parse
  address: def_document:v2:70017
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [testing]
  links:
    - target: address-spec
      type: traces_to
    - target: address-scenarios-group
      type: refines
sources:
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/index-meta/src/meta-registry.ts
---

# Address 시나리오 - 파싱 경로

## 목적 ^purpose

registry 없는 loose parse와 검증된 parse를 분리해 주소 파싱이 어느 시점부터 강한 계약을 요구하는지 시나리오로 설명한다.

## 상태

implemented

## 기능 경계

| 기능 | 소유 API | 검증 범위 |
|------|----------|-----------|
| loose parse | `AddressProtocolManager.parse()` / `reg.address.parse()` | 등록된 protocol이 문자열을 VersionedValue로 복원하는지만 확인한다. registry의 index/version 존재성과 value 범위는 확인하지 않는다. |
| validated parse | `MetaRegistry.parse()` | loose parse 결과에 indexId/versionId 존재성과 WeightedIndex value 범위를 추가 검증한다. |
| schema-only extraction | `AddressProtocolManager.parseSchemaOnly()` | layout 설정이 있으면 raw address에서 schema 숫자만 역매핑하고, layout 설정이 없으면 text protocol parse 결과의 schema를 반환한다. |
| format conversion | `AddressProtocolManager.convert()` | 입력 protocol을 자동 감지해 SemanticAddress로 읽고 대상 protocol로 다시 serialize한다. |

## 시나리오

- §17-0: 같은 PK라도 `reg.address.parse()`는 value 범위를 검증하지 않아 통과하고, `reg.parse()`는 registry capacity를 확인해 `ParseError`를 던진다.
- §17-1: 로그 파서/감사 도구는 registry 없이 UUID 같은 layout address를 VersionedValue로 복원할 수 있다. 단, address config의 schema/version 숫자 매핑에 없는 값은 protocol parse 단계에서 실패한다.
- §17-2: 프록시/라우터는 `parseSchemaOnly()`로 schema만 추출해 서비스 라우팅을 결정한다. versions 매핑이 비어 있어도 schema 역매핑만 있으면 이 경로는 동작한다.
- §17-3: format converter는 UUID, colon, int64 같은 protocol 사이를 registry 없이 왕복 변환한다.

## 통합 포인트

- 외부 시스템 통합에서는 파싱 성공 자체보다 "언제 registry 검증을 강제하는가"가 더 중요하다.
- `AddressProtocolManager`는 protocol 문자열을 loose VersionedValue로 바꾸는 파싱 게이트웨이다.
- registry 검증, codec decode, capacity 확인은 `MetaRegistry`와 `MetaCodec` 경계에서 수행한다.
- protocol lifecycle, read/write 전환, fallback 운영은 `address-scenarios-runtime`으로 분리한다.
