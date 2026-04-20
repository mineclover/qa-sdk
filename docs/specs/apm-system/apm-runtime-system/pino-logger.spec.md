---
def:
  id: pino-logger
  type: spec
  tier: component
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: operation
  svc: pino
  tags: [logging, runtime]
  links:
    - target: apm-runtime-system
      type: refines
  source: packages/pino/src/index.ts
---

# @qa-sdk/pino — zero-dependency 구조화 로거

## 목적 ^purpose

`pino` 호환 API를 zero-dependency로 구현한 structured logger. Edge workers·서버리스 런타임처럼 Node 내장 모듈에 의존할 수 없는 환경에서 사용. `createLogger("<서비스명>")` 진입점을 유지해 `@qa-sdk/logger`와 drop-in 호환을 제공.
