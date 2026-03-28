---
def:
  id: apm-schema-system
  address: def_document:v1:2672
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: qa-sdk-cli
  tags: [structural, tier-system]
  links:
    - target: dsl-schema-domain-model
      type: contains
    - target: dsl-schema-versioning
      type: contains
    - target: address-context-format
      type: contains
    - target: address-context-storage
      type: contains
---

# APM 스키마 그룹

## 목적 ^purpose

APM DSL 스키마와 `address_context` 계약을 도메인 축, 버전 정책, 문자열 형식, 저장 스키마로 나눠 문서 경계를 분리한다.

## 구성 ^overview

- `dsl-schema-domain-model`: Git, K8s, APM signal 축과 composite가 snapshot에서 어떻게 표현되는지 정리한 문서.
- `dsl-schema-versioning`: 축 공유, payload 배치, 버전 고정처럼 스키마 운영에 필요한 제약을 정리한 문서.
- `address-context-format`: EventRecord와 TransmissionEnvelope에 넣는 주소 문자열/머지 규칙을 정리한 문서.
- `address-context-storage`: `address_context`의 저장 스키마, 기존 필드 관계, SDK/Zod 확장을 정리한 문서.

원본: `docs/specs/apm/dsl-schemas.spec.md` (`dsl-schemas-spec`), `docs/specs/apm/address-context.spec.md` (`address-context-spec`)
