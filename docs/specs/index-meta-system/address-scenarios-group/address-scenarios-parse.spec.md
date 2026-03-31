---
def:
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
---

# Address 시나리오 - 파싱 경로

## 목적 ^purpose

registry 없는 loose parse와 검증된 parse를 분리해 주소 파싱이 어느 시점부터 강한 계약을 요구하는지 시나리오로 설명한다.

## 파싱 단계

- loose parse는 외부 입력을 우선 구조만 읽는 단계로, registry 없이도 주소를 임시 해석할 수 있어야 한다.
- validated parse는 실제 schema와 version 정보를 붙여 의미 있는 주소인지 확인하는 단계다.
- 두 단계는 실패 모드가 다르므로 같은 API로 숨기더라도 내부 책임은 분리해야 한다.

## 통합 포인트

- 외부 시스템 통합에서는 파싱 성공 자체보다 "언제 registry 검증을 강제하는가"가 더 중요하다.
- `AddressProtocolManager`는 이 경계에서 fallback과 strict mode를 조절하는 오케스트레이터 역할을 맡는다.
- 프로토콜 수명주기와 schema-only 소비는 `address-scenarios-runtime`으로 분리한다.
