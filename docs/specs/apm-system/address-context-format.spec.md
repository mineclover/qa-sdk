---
def:
  id: address-context-format
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: address-context-spec
      type: refines
---

# Address Context 형식

## 목적 ^purpose

`address_context`가 EventRecord와 TransmissionEnvelope에 실리는 문자열 형식, 머지 규칙, 하위 호환 경계를 정리한다.

## 형식과 머지

- `address_context`는 n차원 주소를 key/value 형태로 싣되, 전송 경계에서 문자열 직렬화를 유지한다.
- 머지 규칙은 이미 계산된 주소를 보존하고, 추가 컨텍스트만 덧씌우는 방향으로 동작해야 한다.
- 주소 문자열 형식은 SDK와 서버가 같은 해석 규칙을 공유해야 하므로, 독자 포맷을 추가하지 않는다.

## 호환성

- 기존 필드와 중복되는 정보가 있어도 `address_context`가 canonical merge point가 된다.
- 하위 호환성은 새 key를 추가해 확장하고, 기존 key의 의미를 재정의하는 방식은 피한다.
