---
def:
  tier: component
  id: address-separation-decision
  address: def_document:v2:273536
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [decision]
  links:
    - target: index-codec-spec
      type: constrains
    - target: address-separation-group
      type: refines
sources:
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/index-meta/src/meta-registry.test.ts
---

# Address Separation ADR - 결정과 근거

## 목적 ^purpose

address와 registry 책임을 분리해야 하는 맥락, 핵심 결정, 정당화 근거를 제약 문서 형태로 정리한다.

## 상태

implemented

## 결정

- 주소 포맷 관리와 registry 메타데이터 관리는 같은 변경 속도를 가지지 않으므로 별도 레이어로 다뤄야 한다.
- 분리하지 않으면 decode, schema evolution, consumer ergonomics가 한 클래스에 과도하게 결합된다.
- 따라서 address protocol은 독립 수명주기를 갖고, registry는 schema/version 의미 관리와 validated parse에 집중한다.

## 현재 구현

| 책임 | 구현 소유자 | 근거 |
|------|-------------|------|
| protocol 문자열 감지/parse/serialize/convert | `AddressProtocolManager` | registry 없이 loose VersionedValue를 만들고, runtime protocol register/unregister와 fallback을 관리한다. |
| address config 검증 | `MetaRegistry` 생성자 | 등록된 indexId/versionId가 address schema/version mapping에 포함되는지 먼저 검증한다. |
| validated parse | `MetaRegistry.parse()` | address manager의 parse 결과에 index/version 존재성과 WeightedIndex value 범위를 더한다. |
| entity encode/decode | `MetaCodec` | registry가 만든 codec이 entity ID와 VersionedValue 변환만 수행한다. |
| backward compatibility | `MetaRegistry.serialize/parse/converter/defaultProtocol` | 기존 registry API는 유지하되 내부 address manager로 위임한다. |

## 근거

- 가장 큰 근거는 외부 시스템 통합과 versioned protocol 관리 비용을 줄이는 데 있다.
- codec이나 resolver가 address 정책까지 떠안으면 변경 반경이 넓어진다.
- `reg.address.parse()`가 registry 검증 없는 loose parse로 동작하고, `reg.parse()`가 범위 초과를 `ParseError`로 막는 테스트가 분리의 핵심 증거다.
- 도입 기준과 운영 경로는 `address-separation-rollout`에서 이어진다.
