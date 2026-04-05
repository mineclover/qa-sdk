---
def:
  id: test-phase-propagation-plan
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: mediation
  links:
    - target: test-phase-propagation
      type: depends_on
    - target: test-phase-propagation-todo
      type: depends_on
---

# test_phase 전파 — Phase 1 구현 계획

## 목적 ^purpose

데이터 모델 확장의 구현 순서와 검증 기준을 정의한다.

## 구현 파일

| 파일 | 역할 |
|------|------|
| `packages/test-types/src/index.ts` | TestPhase, TEST_PHASES SSOT (zero-dep) |
| `packages/core/src/types/test-tracking.ts` | re-export + TestCase/Suite/Metrics 확장 |
| `packages/core/src/pipe/test-tracking.ts` | Registry 메서드 + 주소 함수 확장 |
| `packages/core/src/pipe/sim-phase-bridge.ts` | SimulationResult → TestPhase 브릿지 |
| `packages/core/src/pipe/test-tracking.test.ts` | phase 관련 테스트 |
| `packages/core/src/index.ts` | re-export |

## 단계

### P1: 타입 정의

1. `test-tracking.ts` (types)에 추가:
   - `TestPhase` 리터럴 유니온 (11종)
   - `TEST_PHASES` const 배열
   - `TestCase.phase?: TestPhase`
   - `TestSuite.phases?: TestPhase[]`
   - `PhaseQualityMetrics` 인터페이스
   - `PipeQualityMetrics` — phaseDistribution, uncoveredPhases 추가
2. tsc --noEmit 통과 확인

### P2: 주소 확장

1. `buildTestAddress` — phase 파라미터 추가 (5번째 세그먼트)
2. `parseTestAddress` — phase 파싱, 없으면 undefined (하위 호환)
3. 테스트: 라운드트립 + 하위 호환

### P3: TestRegistry 확장

1. `getCasesByPhase(phase)` — cases.filter
2. `getSuitesByPhase(phase)` — suites.filter (suite.phases 또는 suite.cases의 phase)
3. `computePhaseMetrics(phase, schemaUpdatedAt?)` — computeFacetMetrics와 대칭 구조
4. `computePipeMetrics` — phaseDistribution/uncoveredPhases 추가
5. 테스트: 각 메서드 단위 + 기존 테스트 회귀 없음

### P4: Export + 정리

1. index.ts re-export
2. 전체 core 테스트 + 타입 체크
3. spec/todo 갱신

## 검증 기준

| 기준 | 방법 |
|------|------|
| 타입 정합 | `tsc --noEmit` |
| 하위 호환 | 기존 테스트 전부 통과 (phase 없는 TestCase 허용) |
| phase 필터 | getCasesByPhase 정확 필터 |
| 지표 대칭 | PhaseQualityMetrics가 FacetQualityMetrics와 동일 구조 |
| 주소 호환 | 4세그먼트(기존) + 5세그먼트(신규) 모두 파싱 |

## 예상 규모

- 타입: ~30줄
- 로직: ~80줄 (Registry 메서드 + 주소)
- 테스트: ~150줄
