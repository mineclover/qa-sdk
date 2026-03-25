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
    - target: codegen-spec
      type: contains
    - target: dsl-schemas-spec
      type: contains
    - target: address-context-spec
      type: contains
    - target: runtime-flows-spec
      type: contains
    - target: logger-spec
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

overview: 총 8개 멤버.
- `codegen-spec`: Registry의 SchemaSnapshot에서 protobuf 메시지 정의와 TypeScript 타입을 자동 생성하는 CLI codegen 파이프라인을 정의한다.
- `dsl-schemas-spec`: registry-service의 SchemaSnapshot 형식으로 Git, K8s, APM Signal 도메인 축과 composite를 정의한다.
- `address-context-spec`: EventRecord와 TransmissionEnvelope에 n차원 주소 컨텍스트를 부착하는 계약을 정의한다.
- `runtime-flows-spec`: 운영 시나리오를 동기 / 비동기 / 디버깅 3개 경로로 분리하여 정의한다.
- `logger-spec`: 이벤트 수집의 핵심 진입점.
- `collection-transport-spec`: SDK가 수집 envelope을 외부 수집기로 전달하는 전송 계층의 역할, 공통 인터페이스, 기본 구현 범위를 정의한다.
- `infra-logger-spec`: 구조화 JSON 로깅.
- `cli-contract-spec`: APM 스키마 관리, 좌표 연산, DKG 진단, 의사결정 흐름을 CLI로 제공하는 관측 도구.
