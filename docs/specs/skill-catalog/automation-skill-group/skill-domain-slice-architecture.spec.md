---
def:
  id: skill-domain-slice-architecture
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [architecture, scaffold, domain-slice, contract, testing]
  links:
    - target: automation-skill-group
      type: refines
    - target: scaffold-domain-development-convention
      type: depends_on
    - target: scaffold-domain-schematic
      type: depends_on
    - target: skill-bdd-contract
      type: depends_on
    - target: skill-e2e-test
      type: depends_on
sources:
  - skills/domain-slice-architecture/SKILL.md
  - skills/domain-slice-architecture/references/workflow.md
  - skills/domain-slice-architecture/references/surface-map.md
  - skills/domain-slice-architecture/references/review-checklist.md
  - architecture-samples/domain-slice-monorepo
  - architecture-samples/domain-slice-monorepo/docs/source-architecture/current
---

# Skill — domain-slice-architecture

## 목적 ^purpose

Domain Slice Architecture의 도메인 분석, 계약 설계, 기능 구현, OpenAPI/로깅/CQRS/BFF/테스트/캐시/트랜잭션 경계를 재귀적으로 개선하는 skill을 정의한다.

이 문서는 skill-catalog entry다. 실행 정의는 `skills/domain-slice-architecture/SKILL.md`가 소유한다.

## 사용 맥락 ^context

새 도메인 slice를 만들거나 기존 slice를 확장할 때 사용한다. 특히 기존 도메인 데이터 모델링 분석, 데이터 스키마 추가, 기능 구현, OpenAPI 스펙 관리, 로깅 스펙 관리, 읽기/쓰기 캐시에 따른 CQRS 처리, 트랜잭션 API가 포함된 도메인 설계, 테스트 시나리오 관리, BFF/read model 경계 검토가 함께 필요한 경우에 적용한다.

## 설계 의도 ^intent

`domain-slice-architecture`는 scaffold 템플릿을 단순 파일 생성 도구로 쓰지 않고, 계약과 관측과 테스트를 포함한 반복 개선 루프로 운용하게 만든다. read model과 BFF는 둘 다 조회 shape를 만들 수 있지만, 하나는 데이터 처리/조회 최적화 책임이고 다른 하나는 UI composition 책임이므로 매 iteration에서 분리 여부를 검토한다.

## 피드백 규칙 ^feedback

- Domain entity가 OpenAPI/read model/BFF model로 직접 노출되면 contract drift로 본다.
- use case가 infrastructure adapter나 schema를 import하면 responsibility boundary 위반으로 본다.
- read model과 BFF model이 같은 shape를 공유하면 이유와 owner를 문서화한다.
- cache key가 코드 문자열 상수로만 존재하면 DSL/metadata 보강 대상으로 본다.
- logging assertion 없는 신규 transaction/write flow는 관측성 보강 대상으로 본다.

## 관련 소스

- `skills/domain-slice-architecture/SKILL.md`
- `docs/specs/scaffold/scaffold-domain-development-convention.rule.md`
- `architecture-samples/domain-slice-monorepo/README.md`
