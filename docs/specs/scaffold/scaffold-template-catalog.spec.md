---
def:
  id: scaffold-template-catalog
  type: spec
  tier: component
  level: leaf
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, template, architecture, learning]
  links:
    - target: scaffold-system
      type: refines
sources:
  - packages/architecture-schematics/src/catalog.ts
  - packages/architecture-schematics/src/catalog.test.ts
---

# scaffold template catalog

## 목적 ^purpose

템플릿 카탈로그는 스캐폴딩 결과물을 “파일 묶음”이 아니라 학습 가능한 아키텍처 문법으로 노출하는 metadata surface다.

## 구성 ^overview

- `DOMAIN_TEMPLATE_CATALOG`는 `domain` scaffold의 artifact, layer, responsibility, responsibility topology를 열거한다.
- artifact는 identity, domain state shape, domain behavior, domain behavior test evidence, command DTO, repository/outbox/transaction/logger/read-model port, Drizzle adapter/schema, outbox/transaction/unit-of-work/logger/read-model adapter, HTTP controller, optional BFF surface, OpenAPI fragment, governance metadata, Nest module을 포함한다.
- rule은 `domain-is-pure`, `application-uses-ports`, `presentation-calls-application`, `module-binds-port`, `metadata-ships-with-domain-slice`, `transaction-and-logging-are-ports`, `bff-does-not-expose-domain-entity`를 포함한다.
- `qa-scaffold catalog`는 카탈로그를 터미널에서 출력해 onboarding, 리뷰, 템플릿 변경 검토에 사용한다.

## 운용 규칙

- 새 템플릿이 추가되면 catalog artifact를 함께 추가한다.
- 표준 문법이 바뀌면 rule의 description/rationale을 함께 갱신한다.
- 카탈로그는 생성 코드가 왜 그런 구조를 갖는지 설명하는 학습용 SSOT로 취급한다.
