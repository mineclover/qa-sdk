---
def:
  id: otel-package-spec
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: otel
  tags: [observability, runtime, database]
  links:
    - target: system-support
      type: refines
    - target: apm-system
      type: depends_on
---
# @qa-sdk/otel

## 목적 ^purpose

OpenTelemetry 초기화, tracer 유틸리티, Drizzle instrumentation, SQL commenter를 묶는 observability 보조 패키지.

## 구성 ^overview

- `init` — OTel SDK 초기화
- `tracer` — tracer utility
- `drizzle-instrument` — Drizzle 계측
- `sqlcommenter` — SQL metadata 주석 부착
- 환경 설정 — OTel 관련 env 해석

## 역할 경계 ^constraint

- 이 패키지는 **서비스 관측 프로토콜/계측 계층**을 소유한다.
- OpenTelemetry span, exporter, SQL commenter, runtime instrumentation이 책임 범위다.
- 이 패키지는 `address_context`의 도메인 의미나 앱 데이터 taxonomy를 소유하지 않는다.
- semantic coordinate는 별도 계층에서 생성되며, OTEL은 그 위에 transport/instrumentation으로 결합될 수 있다.

## 관련 소스

- `packages/otel/src/init.ts`
- `packages/otel/src/tracer.ts`
- `packages/otel/src/drizzle-instrument.ts`
- `packages/otel/src/sqlcommenter.ts`
