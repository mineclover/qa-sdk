---
def:
  tier: component
  id: analysis-convergence
  type: spec
  address: def_document:v2:68737
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability]
  links:
    - target: analysis-prefix
      type: depends_on
    - target: analysis-transition
      type: depends_on
    - target: analysis-convergence-rule
      type: traces_to
  sources:
    - packages/convergence/src/index.ts
    - packages/convergence/src/usage-aggregator.ts
    - packages/convergence/src/metric-registry.ts
    - packages/convergence/src/convergence-runner.ts
    - packages/ingest-server/src/lib/convergence-pipeline.ts
    - packages/ingest-server/src/lib/convergence-pipeline.test.ts
    - packages/spec-core/src/convergence/pipeline-e2e.test.ts
---
# Convergence — 수렴 분석

## 목적 ^purpose

prefix 간 중복이나 낭비를 감지하는 수렴 분석. 유사한 축 조합을 가진 prefix를 찾아 병합 후보를 제안한다.

## 구성 ^overview

수렴 분석은 `@qa-sdk/convergence` 패키지에 구현된 순수 함수 체계로, ingest-server의 `ConvergencePipelineRunner`가 런타임에서 오케스트레이션한다.

### 파이프라인 구조

수렴 분석은 window-based 배치 처리로 동작한다.

1. **버퍼 축적** — Phase 2 완료된 traceId를 버퍼에 수집
2. **flush 트리거** — 건수 임계값(`recordThreshold`, 기본 100) 또는 타이머(`flushIntervalMs`, 기본 60초) 도달 시 실행
3. **레코드 조회** — `recordStore.findByTraceId()`로 address_context가 있는 레코드만 수집
4. **집계** — `aggregateUsageData(catalog, records)` → `UsageData` 생성
5. **metric 수집** — `collectMetrics(catalog, graph, usage)` → `MetricValue[]`
6. **observation 생성** — `metricsToObservations(metrics)` → `ObservationNode[]`
7. **자동 해소** — `resolveRecoveredMetrics()`로 ok 복귀한 metric의 기존 observation 해소
8. **DKG 저장** — `saveUsageSnapshotWithObservations(usage, observations)`

### 집계 계층 (Aggregation Layers)

| 함수 | 입력 | 출력 | 설명 |
|------|------|------|------|
| `aggregateUsageData` | `Catalog`, `AddressContextRecord[]` | `UsageData` | entry/address/co-occurrence/version 사용량 집계 |
| `aggregateByDsl` | `UsageData` | `ScopedUsage` | DSL 번들 단위 집계 |
| `aggregateByCategory` | `UsageData` | `ScopedUsage` | schema category 단위 집계 |
| `aggregateByService` | `UsageData` | `ScopedUsage` | 서비스 단위 집계 |

### 측정 계층 (Measurement)

| 함수 | 설명 |
|------|------|
| `analyzeDeploymentSkew` | 배포 스큐 분석 — prefix별 버전 사용 분포 편향 감지 |
| `analyzeEntryCoverage` | entry 커버리지 — axis별 실제 사용된 entry 비율 |
| `analyzeTemporalTrends` | 시계열 추세 — 시간대별 이벤트 분포, 이상 감지, SLA 위반 |

### 비교 계층 (Comparison)

| 함수 | 설명 |
|------|------|
| `compareAxes` / `comparePrefixes` | 축/prefix 간 유사도 비교 (공유 dim 분석) |
| `scanAxisOverlaps` | 축 중복 스캔 — 병합 가능한 유사 축 후보 |
| `discoverCausality` | 인과 관계 발견 — prefix 간 시간적 선후 관계 |
| `compareDecisions` / `scanDecisionConflicts` | 설계 결정 충돌 감지 |

### 추천 계층 (Recommendation)

| 함수 | 설명 |
|------|------|
| `analyzeSimplification` | 병합/제거 가능한 prefix 후보 제안 |
| `analyzeHeadroom` | headroom 부족 축 경고 (≤1 warning, 0 critical) |
| `optimizeCapacities` | capacity 최적화 — `nextPowerOf2(entries × 2)` 기준 |
| `recommendAll` | simplification + observation + causality 통합 추천 |

### 에러 격리 원칙

- convergence 실패가 Phase 2 verdict를 **절대 차단하지 않음**
- 패턴 분류 실패도 metric pipeline 결과를 차단하지 않음
- 각 단계는 독립 try-catch로 감싸여 있음

### 설정

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `recordThreshold` | 100 | 건수 기반 flush 임계값 |
| `flushIntervalMs` | 60,000 | 타이머 기반 flush 주기 (ms) |
| `maxBufferSize` | 10,000 | 버퍼 최대 크기 (메모리 cap) |

## 관련 소스

- `packages/convergence/src/` — 순수 분석 함수
- `packages/ingest-server/src/lib/convergence-pipeline.ts` — 런타임 오케스트레이터
- `packages/spec-core/src/convergence/pipeline-e2e.test.ts` — encode → aggregate → converge 소비자 검증

## 검증 명령 ^validation

```bash
pnpm --filter @qa-sdk/convergence test
pnpm --filter @qa-sdk/ingest-server exec vitest run src/lib/convergence-pipeline.test.ts
pnpm --filter @qa-sdk/spec-core exec vitest run src/convergence/pipeline-e2e.test.ts src/convergence/convergence.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
