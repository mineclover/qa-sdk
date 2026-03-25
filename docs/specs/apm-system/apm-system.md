---
def:
  id: apm-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  svc: qa-sdk-cli
  tags: [entry-point, tier-system]
  links:
    - target: apm-codegen-system
      type: contains
    - target: apm-schema-system
      type: contains
    - target: apm-runtime-system
      type: contains
    - target: collection-transport-spec
      type: contains
    - target: infra-logger-spec
      type: contains
    - target: cli-contract-spec
      type: contains
---

## 목적 ^purpose

코드 생성, DSL 스키마, 주소 컨텍스트, 런타임 흐름, 로깅, CLI 등 APM 관측 인프라.

## 구성 ^overview

overview: 총 6개 멤버.
- `apm-codegen-system`: SchemaSnapshot 기반 codegen을 CLI 계약과 생성 산출물 규칙으로 분리한 그룹.
- `apm-schema-system`: DSL 축 설계와 `address_context` 형식을 도메인/저장 계약으로 분리한 그룹.
- `apm-runtime-system`: 런타임 흐름과 로거 계약을 경로/도입/제약으로 분리한 그룹.
- `collection-transport-spec`: SDK가 수집 envelope을 외부 수집기로 전달하는 전송 계층의 역할, 공통 인터페이스, 기본 구현 범위를 정의한다.
- `infra-logger-spec`: 구조화 JSON 로깅.
- `cli-contract-spec`: APM 스키마 관리, 좌표 연산, DKG 진단, 의사결정 흐름을 CLI로 제공하는 관측 도구.
