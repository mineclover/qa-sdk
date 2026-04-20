---
def:
  tier: component
  id: spec-core-identifiers
  address: def_document:v2:342199
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [data, structural, runtime]
  links:
    - target: definition-catalog-spec
      type: depends_on
    - target: spec-core-types-group
      type: refines
---

# Spec Core Types - 공개 식별자와 스키마

## 목적 ^purpose

spec-core가 외부에 노출하는 식별자, schema, PrefixSpec, spec document 계약을 정리해 커널 타입 시스템의 입력/출력 경계를 설명한다.

## 공개 계약

- export surface는 외부 패키지가 spec-core를 어떤 이름으로 읽는지 결정하는 표면이다.
- schema와 PrefixSpec은 구조 정의와 prefix 명세를 담는 핵심 데이터 타입이며, 설계 문서와 직접 연결된다.
- 식별자 체계는 문서 ID, prefix ID, generated artifact 이름이 서로 어긋나지 않도록 통합 규칙을 제공한다.

## 책임 경계

- 이 문서는 타입의 정체성과 이름 체계에 집중한다.
- registry 서비스와 codegen용 중간 표현은 `spec-core-registry`에서 별도로 다룬다.
- 정의 카탈로그와의 연결은 `definition-catalog-spec`을 전제로 한다.
