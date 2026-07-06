---
def:
  id: definition-client-spec
  tier: component
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-client
  tags: [contract, runtime, cross-scope]
  links:
    - target: definition-service-system
      type: refines
  sources:
    - packages/definition-client/src/client.ts
    - packages/definition-client/src/nestjs.ts
    - packages/definition-client/src/types.ts
    - packages/definition-client/src/index.ts
    - packages/definition-client/src/client.test.ts
---
# Definition Client

## 목적 ^purpose

definition-service의 REST surface를 타입 있는 클라이언트로 감싸는 패키지. 일반 HTTP client와 NestJS 연동 진입점을 함께 제공한다.

## 구성 ^overview

- `client.ts` — 기본 HTTP client
- `nestjs.ts` — NestJS 연동용 export
- `types.ts` — 요청/응답 타입
- 에러 규칙 — 외부 서비스 호출 실패는 throw가 기본
