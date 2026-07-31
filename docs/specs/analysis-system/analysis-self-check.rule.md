---
def:
  id: analysis-self-check-rule
  tier: component
  type: spec
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [observability, testing, error-handling]
  links:
    - target: analysis-self-check
      type: constrains
sources:
  - packages/cli/src/commands/dkg.ts
  - packages/convergence/src/metric-registry.ts
  - packages/convergence/src/self-check-analyzer.ts
  - packages/dkg/src/store/dkg-sqlite-store.ts
---
# Self-Check — 소비 규칙

## 목적 ^purpose

Self-check 결과를 수집·분석·출력할 때 error/failure 경로와 관측 증거가 사라지지
않도록 운영 규칙을 고정한다.

## 소비 체크리스트

- 빌드/테스트 결과는 `build_event`/`test_event`로 보존하고 failure, error,
  skipped 상태를 성공으로 정규화하지 않는다.
- `dkg self-check`의 분석 실패는 원래 build/test 결과를 가리지 않아야 하며,
  metrics와 flow 검증은 진단 가능한 warning/detail을 남긴다.
- `metrics`의 non-`ok` 항목은 metric ID, 상태, detail을 함께 출력한다.
- flow observation 회복은 현재 실행에서 endpoint가 실제 관측된 IntentLink에만
  적용하며, 재발 위반 또는 미관측 링크는 자동 해소하지 않는다.
- persisted flow evidence는 가장 최근 run 단위로만 읽고 24시간 freshness gate를
  통과한 경우에만 recovery 입력에 포함한다. stale evidence는 출력하되 정상 근거로
  사용하지 않는다.
- persisted flow evidence가 없으면 `evidence scope: none`과 함께 recovery 입력이
  self-check live records뿐임을 출력한다. evidence 부재를 정상 복귀로 해석하지 않는다.
- 현재 `ok`로 복귀한 metric의 과거 observation은 health 재계산 전에
  fixed point까지 recovered 상태로 반영하고, 실제 DKG 저장은 `--apply`에서만 수행한다.
- `--apply` 없이는 observation 해소·생성이나 usage snapshot 저장을 수행하지
  않는다.
- 패키지별 `build_event`, `test_event`, `contract_check`는 동일 package
  execution context로 합친 뒤 IntentLink를 검사한다.
- `--fast`는 build/test를 실행하지 않고 mock 결과를 사용하므로 coverage metric을
  측정하지 않는다. Phase B의 coverage 수치는 provisional로만 표시하며, full
  self-check 또는 runtime usage에서만 coverage warning을 판정한다.

## 구현·검증 증거 ^implementation-evidence

`packages/cli/src/commands/dkg.ts`가 CLI orchestration과 metrics/flow output을
담당하고, `packages/convergence/src/self-check-analyzer.ts`가 순수 좌표화·집계
분석을 담당한다. 실패 입력과 self-check 전체 경로는 대응 test 문서와 source
test에서 검증한다.

검증 명령:

```bash
corepack pnpm --filter @qa-sdk/cli typecheck
corepack pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js dkg self-check
```
