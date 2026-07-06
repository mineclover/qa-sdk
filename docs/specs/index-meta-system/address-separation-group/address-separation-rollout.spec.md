---
def:
  tier: component
  id: address-separation-rollout
  address: def_document:v2:273537
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [decision]
  links:
    - target: address-spec
      type: constrains
    - target: address-separation-group
      type: refines
sources:
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/index-meta/src/meta-registry.test.ts
---

# Address Separation ADR - 도입 시점과 후속 설계

## 목적 ^purpose

address/registry 분리가 정당화되는 시점과 현재 구현된 도입 경로를 정리해 운영 기준선을 제공한다.

## 상태

implemented

## 언제 분리하는가

- address format이 versioned protocol이 되고, registry consumer가 브라우저/서비스/도구로 확장될 때 분리가 본격적으로 필요해진다.
- 따라서 "외부 소비자 등장"과 "프로토콜 독립 versioning"이 핵심 트리거다.
- 현재 구현은 이 트리거를 지난 상태다. layout address, text protocol, converter, runtime protocol lifecycle, schema-only consumer가 모두 source/test로 존재한다.

## 도입 경로

1. address config가 없으면 `MetaRegistry`는 기본 text protocol(`colon`)을 사용한다.
2. address config가 있으면 `MetaRegistry` 생성자가 schema/version mapping을 검증하고 `AddressProtocolManager`를 layout protocol 포함 상태로 만든다.
3. registry 소비자는 기존 `reg.serialize()`, `reg.parse()`, `reg.converter`, `reg.defaultProtocol` API를 그대로 사용한다.
4. 고급 소비자는 `reg.address`를 통해 loose parse, schema-only extraction, runtime protocol lifecycle을 직접 사용할 수 있다.
5. protocol migration은 `AddressProtocolManager`의 write/read/fallback 경로에서 관리하고, registry schema/capacity 변경과 섞지 않는다.

## 검증 시나리오

- address 미설정 registry는 text protocol로 생성되고 serialize/parse가 가능하다.
- address 설정 registry는 기본 protocol이 `layout:{format}`으로 바뀌며 UUID/int64 layout round-trip을 통과한다.
- invalid address config는 registry 생성 단계에서 `ValidationError`로 실패한다.
- `toInput()` round-trip은 address 설정을 보존한다.
- `reg.address`는 `AddressProtocolManager` 인스턴스이며, loose parse와 registry validated parse가 서로 다른 실패 모드를 갖는다.
