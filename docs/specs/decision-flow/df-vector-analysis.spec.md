---
def:
  id: df-vector-analysis
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-observation-space
      type: depends_on
---
# Decision Flow 벡터 분석

## 목적 ^purpose

투영된 결정 벡터들의 분포, 차이, 이동, 패턴을 분석하는 기능. 개별 결정을 넘어서 "어떤 패턴으로 결정하고 있는가"를 벡터 공간에서 발견한다.

## 구성 ^overview

4개 분석 함수: diffInstances(벡터 차이), gateDistribution(차원별 분포), compareTimeRanges(시간별 이동), detectPatterns(반복 패턴 감지). ComparisonReport로 원인 추론(evidence-imbalance, exclusive-evidence, confidence-gap).

## diffInstances — 벡터 차이 비교 ^diff

`comparison.ts`의 `diffInstances(a, b, schema?)` — 동일 스키마의 두 인스턴스를 gate 단위로 비교한다.

- **입력**: 같은 schemaId를 가진 두 FlowInstance + 선택적 FlowSchema
- **gate 순서**: schema가 있으면 스키마 정의 순서, 없으면 두 인스턴스의 선택 순서를 합집합으로 사용
- **비교 단위**: `GateDiff` — gate별 `match/diverge` 판정

### GateDiff 구조

| 필드 | 설명 |
|------|------|
| gateId, gateName, phase | gate 식별 |
| weight | core/structural/tactical |
| emphasis | core gate면 `core`, 그 외 `standard` |
| status | `match` (같은 branch) / `diverge` (다른 branch) |
| evidenceDiff | 근거 비교 — shared, onlyInA, onlyInB, weight/confidence 차이 |

### InstancePairDiff 결과

- `divergencePoint` — 첫 번째 diverge gate (결정이 갈라진 지점)
- `coreDivergences` — 코어 gate에서의 divergence만 추출
- `matchCount / divergenceCount` — 일치/불일치 비율

## gateDistribution — 차원별 분포 ^distribution

`gateDistribution(store, schemaId, gateId)` — 완료된 인스턴스에서 특정 gate의 branch 선택 분포를 계산한다.

- 완료된 인스턴스(`status === "completed"`)만 집계
- **branch별 통계**: `BranchDistribution { branchId, count, ratio, averageConfidence, isDominant }`
- **지배적 branch**: ratio가 가장 높은 branch에 `isDominant: true` + `DominantBranchHint` 생성
- **evidence kind 상관 분석**: `EvidenceKindCorrelation` — 특정 evidence kind가 어떤 branch 선택과 함께 나타나는지
  - selection 단위로 evidence kind 수집 → branch별 count/ratio/avgConfidence

## compareTimeRanges — 시간별 이동 ^temporal

`compareTimeRanges(store, schemaId, rangeA, rangeB, options?)` — 두 시간 범위의 결정 분포 변화를 분석한다.

- **입력**: InstanceStore, schemaId, `rangeA`(from/to), `rangeB`(from/to), `TimeRangeComparisonOptions`(schema?, coreOnly?)
- **전제 조건**: 각 범위에 완료된 인스턴스 2건 이상 필요 (`assertSufficientSampleSize`). coreOnly 사용 시 schema 옵션 필수
- **GateDistributionShift**: gate별 branch 비율 변화 — `deltaRatio`, `shiftPercentage`
  - 지배적 branch가 A→B에서 바뀌면 의사결정 패턴이 전환된 것
- **경로 변화**: `emergedPaths`(B에서 새로 등장한 경로) / `disappearedPaths`(A에서 사라진 경로)
  - 경로 시그니처: gate 선택을 `{gateId}:{branchId}` 형태로 연결

## ComparisonReport — 종합 분석 ^report

`createComparisonReport(input)` — pairwiseDiff + distributions + temporalShifts를 종합하여 원인 추론 보고서를 생성한다.

### 차이 원인 추론 (DifferenceReasoning)

| reasonType | 설명 |
|-----------|------|
| `evidence-imbalance` | A와 B의 evidence 총 weight 차이가 큼 |
| `exclusive-evidence` | 한쪽에만 존재하는 evidence kind가 있음 |
| `confidence-gap` | 같은 gate에서 confidence 차이가 큼 |
| `missing-selection` | 한쪽에 해당 gate 선택이 없음 |

### 보고서 구조

- `whyDifferent` — diverge한 gate별 원인 추론
- `distributionInsights` — 지배적 branch 등 분포 인사이트
- `temporalInsights` — 시간에 따른 패턴 변화 인사이트
- `summary` — divergenceCount, dominantDistributionCount, temporalShiftCount + highlights 요약

## 패턴 감지와 정책 학습 ^pattern-learning

`detectPatterns(store, schemaId, options)` (`policy-learning.ts`) — 반복 패턴을 감지한다.

- context key/value별로 gate 선택 경로를 그룹핑
- `minFrequency` (기본 3) 이상 반복되는 패턴을 `DetectedPattern`으로 추출
- `PolicyCandidateWorkflow.proposeCandidates(patterns, options)` — 패턴에서 정책 후보 생성
- CLI `flow policy learn <schema-id>` — 패턴 감지 → 후보 생성 → `flow policy approve/reject`로 승인/거부

## CLI 통합 ^cli

`flow compare` 명령이 3가지 모드를 지원한다.

- `flow compare <instance-a> <instance-b>` — 두 인스턴스 pairwise 비교
- `flow compare --gate <gate-id> --schema <schema-id>` — 특정 gate의 branch 분포
- `flow compare --from <date> --to <date> --schema <schema-id> [--core-only]` — 시간 범위 비교
