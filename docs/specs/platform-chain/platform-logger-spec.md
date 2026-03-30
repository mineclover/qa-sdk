---
def:
  id: platform-logger-spec
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: logger
  tags: [observability]
  links:
    - target: platform-chain-system
      type: refines
    - target: platform-core-spec
      type: depends_on
---
# @qa-sdk/logger — 구조화 로깅

## 목적 ^purpose

pino 기반 구조화 JSON 로깅. 서비스별 `createLogger("서비스명")` 팩토리와 디버그 WebSocket 전송을 제공한다.

## 정의 ^defines

- createLogger(name) → QaLogger — 서비스 로거 팩토리
- QaLogger 인터페이스 (info/warn/error/debug + log for SDK events)
- debug-ws transport — WebSocket 디버그 스트리밍
- 에러 로깅 규칙: `logger.error({ err }, "설명")` — err 키 사용

## 소비 ^consumes

- @qa-sdk/core — ServiceBootConfig, AppError 타입

## 관련 소스

- `packages/logger/src/logger.ts` — QaLogger 구현
- `packages/logger/src/transport/debug-ws.ts` — WebSocket 전송
