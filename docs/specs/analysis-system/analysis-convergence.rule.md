---
def:
  id: analysis-convergence-rule
  type: spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability]
  links:
    - target: analysis-convergence
      type: refines
  sources:
    - packages/convergence/src/index.ts
    - packages/convergence/src/usage-aggregator.ts
    - packages/convergence/src/metric-registry.ts
    - packages/ingest-server/src/lib/convergence-pipeline.ts
    - packages/ingest-server/src/lib/convergence-pipeline.test.ts
---

# Convergence Pipeline — 소비 규칙

## 목적 ^purpose

convergence-pipeline을 소비할 때 확인해야 하는 타입 제약, 포트 구분, 캐스팅 규칙을 정의한다.

---

## 소비 체크리스트

- `ConvergenceFunctions`: `Catalog`, `UsageData`, `MetricValue[]`, `ObservationNode[]` 사용. **`unknown` 금지**
- `OBS-PATTERN`: DKG ObservationNode 스키마 준수 (`subjects[]`, `finding`, `intent`)
- `GraphPort` vs `ConvergenceGraphPort`: 서비스는 최소 포트, CLI는 GraphRegistry(최대)
- `as unknown as ConcreteType`: 동적 import 구조적 캐스트. **`as any` 금지**

## 구현/검증 증거 ^implementation-evidence

이 규칙의 런타임 적용 지점은 ingest-server의 `ConvergencePipelineRunner`다. runner는
`ConvergenceFunctions`와 `ConvergenceGraphPort`를 좁은 port로 받고, 집계/metric/observation
함수의 public contract는 `@qa-sdk/convergence` export 표면이 소유한다. 프로덕션 파이프라인의
구조적 캐스트는 record adapter와 DKG observation adapter 경계에 한정되고, 테스트 mock의
`as any`는 이 소비 규칙의 금지 대상이 아니다.

검증 명령:

```bash
pnpm --filter @qa-sdk/convergence test
pnpm --filter @qa-sdk/ingest-server exec vitest run src/lib/convergence-pipeline.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
