---
def:
  id: spec-core-registry
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: definition-catalog-spec
      type: depends_on
    - target: spec-core-types
      type: refines
---

# Spec Core Types - Registry와 IR

## 목적 ^purpose

spec-core의 순수 TypeScript registry 서비스와 codegen IR이 어떤 역할로 커널 바깥 계층을 지원하는지 정리한다.

## Registry 역할

- core registry는 framework에 의존하지 않고 prefix/spec 메타데이터를 보관하고 조회하는 최소 서비스다.
- 이 레이어는 런타임 저장소가 아니라 in-memory 계약 모델에 가깝다.
- registry가 있어야 상위 서비스가 spec-core를 재계산하지 않고 안정적으로 소비할 수 있다.

## Codegen IR

- IR은 여러 언어/도구가 같은 spec 입력을 공통 변환 단계로 읽게 하는 중간 표현이다.
- 타입 정의와 식별자 규칙은 `spec-core-identifiers`, 변환 가능한 내부 구조는 이 문서가 맡는다.
- 상위 전파 파이프라인은 `spec-prop-system`에서 이어진다.
