---
def:
  id: dsl-schema-versioning
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: dsl-schemas-spec
      type: refines
---

# DSL 스키마 버전 정책

## 목적 ^purpose

DSL 스키마의 payload 배치, 축 재사용, snapshot 공급 방식, 버전 관리 정책을 정리해 codegen과 저장 계약이 흔들리지 않게 한다.

## 공급과 배치

- Snapshot supply는 생성기와 런타임이 같은 축 정의를 보도록 단일 snapshot 공급원을 유지해야 한다.
- payload 배치는 운반 효율보다 재생성과 디버깅 가능성을 우선해 결정한다.
- 축 공유는 여러 DSL이 같은 의미 축을 재사용할 때만 허용하고, 임시 이름 복제는 피한다.

## 버전 관리

- 스키마 버전은 snapshot 단위로 승격하며 도메인별 임의 버전을 따로 두지 않는다.
- entry 추가/삭제는 codegen 산출물과 저장 스키마 영향 범위를 함께 검토해야 한다.
