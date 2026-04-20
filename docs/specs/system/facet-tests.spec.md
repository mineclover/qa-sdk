---
def:
  id: facet-tests-spec
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: facet-tests
  tags: [testing, structural]
  links:
    - target: system-support
      type: refines
    - target: facet-test-isolation
      type: depends_on
---
# Facet Tests

## 목적 ^purpose

서비스 코드에서 환경 의존을 분리한 패싯만 추출해 빠르게 회귀를 검증하는 테스트 패키지. gate/query 계열의 순수 로직을 격리된 입력으로 검사한다.

## 구성 ^overview

- `vitest.config.ts` — mock alias와 실행 경계
- `__mocks__/` — 환경 의존 stub
- `synced/` — 동기화된 서비스 소스 입력
- gate/query 핵심 패싯 회귀 테스트

## 관련 소스

- `packages/facet-tests/vitest.config.ts`
- `packages/facet-tests/__mocks__/`
- `packages/facet-tests/synced/`
