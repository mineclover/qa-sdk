---
def:
  id: test-phase-propagation-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: review
  layer: mediation
  links:
    - target: test-phase-propagation
      type: depends_on
---

# test_phase 전파 — 구현 TODO

## 목적 ^purpose

test_phase 분류체계의 데이터 모델 확장 현황을 추적한다.

## Phase 1: 데이터 모델 — 완료 (2026-04-05)

### 타입 정의

- [x] `TestPhase` 리터럴 유니온 + `TEST_PHASES` 상수
- [x] `TestCase.phase?: TestPhase` 추가
- [x] `TestSuite.phases?: TestPhase[]` 추가
- [x] `PhaseQualityMetrics` 인터페이스
- [x] `PipeQualityMetrics.phaseDistribution` + `uncoveredPhases` 추가

### TestRegistry 확장

- [x] `getCasesByPhase(phase)` 메서드
- [x] `getSuitesByPhase(phase)` 메서드
- [x] `computePhaseMetrics(phase, schemaUpdatedAt?)` 메서드
- [x] `computePipeMetrics` — phaseDistribution/uncoveredPhases 포함

### 주소 확장

- [x] `buildTestAddress` — phase 파라미터 추가 (5세그먼트)
- [x] `parseTestAddress` — phase 파싱 (하위 호환: 4세그먼트 → undefined)

### 테스트 (72파일 1126 tests, 회귀 없음)

- [x] 주소 빌드/파싱 라운드트립 + 하위 호환
- [x] getCasesByPhase 단위 테스트
- [x] getSuitesByPhase 단위 테스트 (phases 선언 + case fallback)
- [x] computePhaseMetrics (통과율/drift/커버리지)
- [x] computePipeMetrics phase 분포 검증

### 타입 SSOT 추출 — 완료 (2026-04-05)

- [x] `test-types` 패키지 신설 (TestPhase/TestKind/TestScope/TestLifecycle, zero-dep)
- [x] core → test-types re-export
- [x] test-scenario-store → test-types import (TestPhaseLabel = TestPhase alias)
- [x] CLI → test-types 직접 import (VALID_KINDS/SCOPES/PHASES)

## Phase 2: 소비자 연결 — 완료 (2026-04-05)

### CLI 전파

- [x] `parseTestsDeclaration` — frontmatter `tests[].phase` 파싱
- [x] `TestScenario.phase` — test-scenario-store 타입 + drizzle schema + 마이그레이션
- [x] `testStatus` — phase별 분포 출력
- [x] `testReport` — phase 커버리지 요약

### 시뮬레이션 연계 — 완료 (2026-04-05)

- [x] `PipeStep.testPhase?: string` — 명시 phase 힌트
- [x] `SimStep.phase` 전파 (simulate 시 PipeStep.testPhase → SimStep.phase)
- [x] `annotateSimPhases(result, customMap?)` 브릿지 함수
- [x] facet→phase 기본 매핑 (정의→arrange, 저장→fixture, 소비→act, 관리→act, 생산→observe)
- [x] `PhaseAnnotatedStep`, `SimPhaseResult` 타입
- [x] `FACET_PHASE_DEFAULTS` 매핑 테이블 노출
- [x] 커버리지: covered/uncovered/rate
- [x] 테스트 12건 (sim-phase-bridge.test.ts)

### definition-catalog frontmatter — 완료 (2026-04-05)

- [x] `FrontmatterTest` 인터페이스 (name, kind, scope, phase, intent, module, participants)
- [x] `extractTests(parsed)` 파서 함수
- [x] `ParsedDocument.tests` 필드
- [x] index.ts export (FrontmatterTest, extractTests)
