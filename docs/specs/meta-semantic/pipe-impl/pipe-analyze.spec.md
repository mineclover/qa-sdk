---
def:
  id: pipe-analyze
  level: leaf
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-path
      type: depends_on
---

# PipeGraph 분석 — 복잡도, 병목, 커버리지

## 목적 ^purpose

PipeGraph의 복잡도 메트릭, 병목 감지, 커버리지 분석을 제공한다.
경로 수(countPipePaths/countGraphPaths) 위에서 동작하는 상위 분석 계층.

## 관련 소스

- `packages/core/src/pipe-analyze.ts` — 3함수
- `packages/core/src/pipe-infra.test.ts` — 분석 테스트 6케이스

## API

### analyzePipeComplexity(graph) → PipeComplexity

| 메트릭 | 설명 |
|--------|------|
| pipeCount | 파이프 노드 수 |
| connectionCount | 연결 수 |
| totalPaths | 전체 경로 수 |
| pathsPerPipe | 파이프별 내부 경로 수 |
| mostComplexPipe | 가장 복잡한 파이프 |
| maxFlowDepth | 최대 중첩 깊이 |
| usedFlowKinds | 사용된 흐름 제어 종류 |
| usedConnectionKinds | 사용된 연결 종류 |

### findBottlenecks(graph, thresholds?) → BottleneckReport

| 감지 항목 | 설명 |
|----------|------|
| highFanIn | fan-in ≥ 임계값 |
| highFanOut | fan-out ≥ 임계값 |
| failurePoints | retry/fallback/circuit-breaker/compensate 포함 파이프 |
| latencyPoints | timeout 합산이 높은 파이프 |
| complexPipes | 경로 수 ≥ 임계값 |

### analyzeCoverage(graph, executedPipeIds) → CoverageReport

| 메트릭 | 설명 |
|--------|------|
| pipeCoverage | 파이프 커버리지 (%) |
| pathCoverage | 경로 커버리지 (%) |
| uncoveredPipes | 미실행 파이프 목록 |

## 검증

```bash
pnpm --filter @qa-sdk/core test -- src/pipe-infra.test.ts
```
