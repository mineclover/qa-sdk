---
def:
  id: platform-chain-system
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [structural, entry-point]
  links:
    - target: system-libraries
      type: refines
    - target: platform-core-spec
      type: contains
    - target: platform-codec-spec
      type: contains
    - target: platform-context-spec
      type: contains
    - target: platform-logger-spec
      type: contains
    - target: platform-sdk-spec
      type: contains
    - target: platform-sdk-user-scenarios
      type: contains
    - target: demo-snapshot
      type: contains
    - target: demo-types
      type: contains
    - target: demo-tests
      type: contains
---

# 플랫폼 의존 체인 — core → logger → codec → context → sdk

## 목적 ^purpose

QA 플랫폼의 핵심 라이브러리 5개가 단방향 의존 체인을 형성한다. 모든 서비스/SDK가 이 체인 위에서 동작한다.

## 정의 ^defines

- 의존 방향 규칙: core → logger → codec → context → sdk (역방향 금지)
- ServiceBootConfig이 서비스 정체성의 단일 진입점

## 위임 ^delegates

- **platform-core** → Catalog 타입, 런타임 함수, 에러 컨벤션, auth middleware
- **platform-logger** → 구조화 로깅 (pino), 디버그 WebSocket 전송
- **platform-codec** → dim-wire 인코딩/디코딩, typed SDK
- **platform-context** → QA 컨텍스트 프로바이더, CatalogProvider
- **platform-sdk** → 클라이언트 SDK (transport, dim-wire, 로깅 통합)

## 구성 ^overview

```
@qa-sdk/core (루트 — Catalog 타입 + 런타임)
  ↓
@qa-sdk/logger (구조화 로깅)
  ↓
@qa-sdk/codec (dim-wire 인코딩)
  ↓
@qa-sdk/context (컨텍스트 프로바이더)
  ↓
@qa-sdk/sdk (클라이언트 통합)
```
