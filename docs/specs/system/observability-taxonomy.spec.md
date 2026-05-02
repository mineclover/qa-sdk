---
def:
  id: observability-taxonomy
  type: spec
  tier: system
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope, structural, entry-point, observability]
  links:
    - target: tracking-three-axes
      type: contains
    - target: address-context-storage
      type: contains
    - target: otel-package-spec
      type: contains
    - target: infra-observe-stage
      type: contains
    - target: taxonomy-boundaries
      type: traces_to
---

# Observability Taxonomy — 관측 책임 경계

## 목적 ^purpose

qa-sdk의 관측 체계를 목적별로 분리한다. 앱 데이터 관측, semantic coordinate 관측, 서비스 프로토콜 관측, 인프라 배포/헬스 관측이 각각 무엇을 소유하는지 고정하여, 서로 다른 관측 층이 같은 문제를 두 번 소유하지 않게 하는 것이 목적이다.

## 방법 ^method

관측 taxonomy는 "무엇을 관측하는가"보다 먼저 "어느 층에서 무엇을 관측하는가"를 구분한다.

- 앱 데이터 관측은 사용자 행동과 데이터 흐름을 다룬다.
- semantic 관측은 address_context로 도메인 의미를 붙인다.
- protocol 관측은 OTEL 같은 서비스 계측 프로토콜을 다룬다.
- infra 관측은 deploy/health/rollout 같은 운영 이벤트를 다룬다.

## 위임 ^delegates

- `tracking-three-axes` → 앱 데이터 관측 taxonomy
- `address-context-storage` → semantic address_context 저장/전송 계약
- `otel-package-spec` → 프로토콜/계측 SDK 책임
- `infra-observe-stage` → 배포/헬스/운영 관측

## 구성 ^overview

| 관측 층 | 1차 질문 | 소유 개념 | 대표 문서 |
|---|---|---|---|
| app-data | 사용자가 무엇을 했고 데이터가 어떻게 흘렀는가 | event, facet, data classification | `tracking-three-axes` |
| semantic | 이 이벤트가 도메인 좌표상 어디에 속하는가 | `address_context` | `address-context-storage` |
| protocol | 서비스가 어떤 표준 계측 프로토콜로 외부에 노출되는가 | OTEL tracer/log exporter | `otel-package-spec` |
| infra | 서비스가 배포/검증/관측 파이프라인에서 어떤 상태인가 | deploy event, health event, monitor state | `infra-observe-stage` |

## 경계 규칙 ^constraint

- `tracking-three-axes`는 앱 데이터 관측 taxonomy다. decision-flow, CLI/DKG, infra deploy 관측을 소유하지 않는다.
- `address_context`는 semantic meaning layer다. OTEL transport 자체를 대체하지 않는다.
- OTEL은 서비스 관측의 프로토콜/계측 계층이다. 도메인 semantic taxonomy를 소유하지 않는다.
- infra observe는 운영/배포 관측을 소유한다. 앱 데이터 시나리오 taxonomy를 소유하지 않는다.

## 관련 소스

- `docs/specs/system/tracking-three-axes.spec.md`
- `docs/specs/apm-system/apm-schema-system/address-context-storage.spec.md`
- `docs/specs/system/otel-package.spec.md`
- `docs/specs/infra-engine/infra-observe-stage.spec.md`
