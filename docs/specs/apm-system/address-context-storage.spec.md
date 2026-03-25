---
def:
  id: address-context-storage
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: address-context-spec
      type: refines
---

# Address Context 저장 계약

## 목적 ^purpose

`address_context`를 저장 스키마와 SDK 검증 체계에 연결하는 방법을 정리해 ingest와 codegen이 같은 필드 의미를 보도록 만든다.

## 저장 스키마

- 저장 계층은 `address_context`를 EventRecord 보조 필드가 아니라 좌표 해석의 canonical source로 취급한다.
- TransmissionEnvelope에서 받은 컨텍스트는 감사 저장소와 재구성 단계에서 그대로 조회 가능해야 한다.
- 기존 필드와의 관계는 중복 저장이 아니라 조회 편의용 projection으로 본다.

## SDK와 검증

- SDK 사용 패턴은 이벤트 생성 시점에 context를 만들고 transport 직전에 envelope에 합치는 흐름을 따른다.
- Zod 스키마 확장은 key 형태, 값 타입, 버전 호환 범위를 함께 검증해야 한다.
