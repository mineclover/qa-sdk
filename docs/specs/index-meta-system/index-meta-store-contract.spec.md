---
def:
  id: index-meta-store-contract
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: table-schema-spec
      type: depends_on
    - target: index-meta-store
      type: refines
---

# Index Meta Store - 저장 계약

## 목적 ^purpose

index-meta 저장소의 설계 목적, 역할 분리, 저장 타입, 인터페이스와 동작 규칙을 정리해 persistence 레이어의 계약을 고정한다.

## 계약 표면

- 저장소는 MetaRegistry와 런타임 소비자 사이에서 버전된 메타데이터를 보존하는 레이어다.
- 역할 분리는 schema 저장, address 해석 보조, decode 지원 데이터를 섞지 않도록 만드는 데 목적이 있다.
- 인터페이스는 구현체가 달라도 같은 key space와 lifecycle 규칙을 따르도록 좁게 유지해야 한다.

## 운영 규칙

- 저장 타입 선택은 읽기 패턴과 version lifecycle을 먼저 보고 결정한다.
- 동작 규칙은 "쓰기보다 읽기 안정성"을 우선하며, schema 변화가 기존 주소 해석을 깨지 않도록 설계한다.
- 구체 구현과 주소 해석 흐름은 `index-meta-store-resolution`에서 다룬다.
