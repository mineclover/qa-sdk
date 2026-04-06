---
def:
  id: simulation-tests-spec
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: simulation-tests
  tags: [testing, integration, cross-scope]
  links:
    - target: system-support
      type: refines
    - target: facet-test-isolation
      type: depends_on
---
# Simulation Tests

## 목적 ^purpose

서비스 간 순수 로직 결합을 시뮬레이션으로 검증하는 통합 테스트 패키지. facet-tests보다 넓고 E2E보다 낮은 계층의 회귀를 담당한다.

## 구성 ^overview

- `vitest.config.ts` — 실행 설정
- `scenarios/gate-query-flow.test.ts` — 대표 통합 시나리오
- `__mocks__/` — 서비스 환경 stub
- `synced/` — 서비스 소스 입력

## 관련 소스

- `packages/simulation-tests/vitest.config.ts`
- `packages/simulation-tests/scenarios/gate-query-flow.test.ts`
