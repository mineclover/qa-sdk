---
def:
  id: apm-runtime-system
  tier: system
  address: def_document:v2:275456
  scope: constraint
  aspect: infra_constraint
  depth: overview
  lifecycle: approved
  layer: domain
  svc: cli
  tags: [structural]
  links:
    - target: runtime-flow-paths
      type: contains
    - target: runtime-flow-rollout
      type: contains
    - target: logger-contract
      type: contains
    - target: logger-runtime-rules
      type: contains
    - target: log-ingest-bridge
      type: depends_on
    - target: pino-logger
      type: contains
  sources:
    - packages/logger/src/logger.ts
    - packages/logger/src/transport/ingest-forwarder.ts
    - packages/ingest-server/src/routes/ingest.ts
    - packages/ingest-server/src/lib/phase-two-worker.ts
    - packages/ingest-server/src/lib/record-stream-broker.ts
---

# APM 런타임 그룹

## 목적 ^purpose

운영 중 관측 경로와 로거 계약을 동기/비동기 흐름, 도입 순서, 설정/제약 문서로 나눠 런타임 변경 범위를 줄인다.

## 구성 ^overview

- `runtime-flow-paths`: 동기, 비동기, 디버깅 경로와 내부 참여 모듈을 정리한 문서.
- `runtime-flow-rollout`: 구현 현황, 도입 순서, 운영 중 빠른 참조 규칙을 정리한 문서.
- `logger-contract`: QaLogger의 인터페이스, 설정, 파라미터 계약을 정리한 문서.
- `logger-runtime-rules`: 로거의 동작 제약과 테스트 커버리지 기준을 정리한 문서.
- `log-ingest-bridge`: pino 구조화 로그 중 좌표(`addressContext`)가 포함된 로그만 필터링하여 ingest 파이프라인에 EventRecord로 전달하는 브릿지.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/logger test ingest-forwarder
corepack pnpm --filter @qa-sdk/ingest-server test routes/ingest
corepack pnpm --filter @qa-sdk/ingest-server test phase-two-worker
```

원본: `docs/specs/operations/runtime-flows.spec.md` (`runtime-flows-spec`), `docs/specs/collection/logger.spec.md` (`logger-spec`)
