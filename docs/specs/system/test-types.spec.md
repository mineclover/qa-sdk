---
def:
  id: test-types
  tier: component
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: review
  layer: domain
  svc: test-types
  tags: [structural, testing]
---

# test-types — 테스트 분류 타입 SSOT

## 목적 ^purpose

테스트 분류 타입(TestPhase, TestKind, TestScope, TestLifecycle)의 단일 정의 원본. zero-dep 패키지로, 소비자가 이 정의를 참조하여 각자의 문서·타입·검증을 구성한다.

## 정의 ^defines

| 타입 | 값 수 | 원본 축 |
|------|-------|--------|
| `TestPhase` | 11 | `demo-catalog.test_phase` |
| `TestKind` | 8 | `demo-catalog.test_kind` |
| `TestScope` | 4 | `demo-catalog.test_scope` |
| `TestLifecycle` | 5 | (테스트 하네스 고유) |

각 타입에 대응하는 `TEST_PHASES`, `TEST_KINDS`, `TEST_SCOPES`, `TEST_LIFECYCLES` 상수 배열도 export.

## 소비자 (참조 방식)

| 소비자 | import 경로 | 용도 |
|--------|------------|------|
| `@qa-sdk/core` | `test-types` → re-export | TestCase.phase, PhaseQualityMetrics, sim-phase-bridge |
| `test-scenario-store` | `test-types` → `TestPhaseLabel` alias | TestScenario.phase, drizzle schema |
| `@qa-sdk/cli` | `test-types` → VALID_KINDS/SCOPES/PHASES | frontmatter 파싱 + 검증 |

소비자는 test-types에서 타입/상수를 import하고, 자신의 spec에서 활용 방식을 문서화한다.

## 설계 원칙

- **zero-dep**: 런타임 의존 0. 순수 타입 + 상수만
- **SSOT**: demo-catalog 축 entries와 동일 순서·값. 축이 변경되면 이 패키지도 함께 변경
- **re-export 허용**: 소비자가 `test-types`를 직접 import해도, 상위 패키지(core)를 통해 re-export해도 동일
- **별도 문서화 불필요**: 이 spec이 정의 원본. 소비자 spec에서는 "test-types에서 import"로 충분

## 구현 위치

`packages/test-types/src/index.ts` — 단일 파일. tsup dual format (ESM + CJS).
