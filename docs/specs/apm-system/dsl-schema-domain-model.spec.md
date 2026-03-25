---
def:
  id: dsl-schema-domain-model
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: dsl-schemas-spec
      type: refines
---

# DSL 스키마 도메인 모델

## 목적 ^purpose

Git, K8s, APM signal 도메인이 SchemaSnapshot 안에서 어떤 축과 composite 조합으로 표현되는지 공통 모델을 정리한다.

## 도메인 축

- Git DSL은 리포지토리, 브랜치, 커밋 흐름처럼 변경 이벤트를 좌표화하는 축 묶음이다.
- K8s DSL은 클러스터, 네임스페이스, 워크로드 상태를 snapshot 규약에 맞춰 다차원으로 표현한다.
- APM signal은 이벤트, 메트릭, 진단 신호를 동일한 스냅샷 인터페이스로 정규화해 codegen이 재사용할 수 있게 한다.

## composite 사용 원칙

- composite는 개별 축을 조합해 상위 의미를 만드는 용도이며, 도메인별 별도 포맷이 아니라 공통 구조를 따라야 한다.
- 도메인별 차이는 축/entry 집합에서 표현하고, snapshot shape 자체는 공유한다.
