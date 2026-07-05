---
def:
  id: apm-sdk
  type: spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: apm
  tags: [runtime, observability]
  links:
    - target: apm-system
      type: refines
  sources:
    - packages/apm/src/index.ts
    - packages/apm/src/apm-logger.ts
    - packages/apm/src/apm-logger.test.ts
    - packages/apm/src/address-ranges.ts
    - packages/apm/src/address-ranges.test.ts
    - packages/sdk/src/qa-context.test.ts
---

# @qa-sdk/apm — APM 지원 레이어

## 목적 ^purpose

주소 컨텍스트 계산과 메트릭 보조 유틸리티를 제공하는 SDK 런타임 레이어. `address_context` 필드 생성, 시그널/메트릭 태깅, 런타임 초기화 진입점을 패키지 단위로 격리한다. APM 체계(apm-system)의 실제 구현 surface를 담당.

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/apm test
corepack pnpm --filter @qa-sdk/sdk test qa-context
```
