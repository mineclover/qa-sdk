---
def:
  tier: component
  id: analysis-self-check
  address: def_document:v2:68740
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
sources:
  - packages/convergence/src/self-check-analyzer.ts
  - packages/convergence/src/metric-registry.ts
  - packages/convergence/src/self-check-analyzer.test.ts
  - packages/cli/src/commands/dkg.ts
  - packages/cli/src/commands/dkg.e2e.test.ts
  - packages/spec-core/src/convergence/convergence.test.ts
  - packages/dkg/src/store/dkg-sqlite-store.ts
---
# Self-Check — 시스템 건강 상태

## 목적 ^purpose

좌표 시스템의 건강 상태를 자동 점검하는 기능. headroom 경고, capacity 위반, 직교성 의심, 미사용 축/prefix를 감지한다.

## 구성 ^overview

Self-Check는 `@qa-sdk/convergence`의 `analyzeSelfCheck()` 순수 함수로 구현된다. execSync 없음, Store 의존 없음. CI에서 결과를 JSON으로 저장 → 이 모듈로 분석 → CLI/테스트에서 소비하는 구조이다.

### 입출력

구현 진입점은 `packages/convergence/src/self-check-analyzer.ts:analyzeSelfCheck`이며,
CLI 실행·저장·출력 조정은 `packages/cli/src/commands/dkg.ts`가 담당한다.
입력은 빌드/테스트 결과와 catalog, 선택적 실행 ID이고, 출력은 인코딩된
`AddressContextRecord`, UsageData, coverage/health/invariant 보고서다.

### SelfCheckResult 입력

각 패키지의 빌드/테스트 결과를 표현한다. 필드와 허용 결과의 SSOT는
`packages/convergence/src/self-check-analyzer.ts:SelfCheckResult`다.
CLI는 여기에 테스트 모듈, 테스트 수, 통과/실패 수, 실행 시간을 추가해 전달한다.

### 분석 파이프라인 (6단계)

#### 1단계: 결과 → AddressContextRecord 인코딩

빌드/테스트 결과를 좌표로 인코딩한다:
- 빌드: `build_event` prefix — `qa_pkg` + `qa_module` + `build_result` 축 사용
- 테스트: `test_event` prefix — `qa_pkg` + `qa_module` + `test_result` 축 사용

#### 2단계: 합성 이벤트 시뮬레이션

`generateSyntheticEvents(catalog)`로 모든 prefix의 모든 axis entry를 최소 1회 관측하는 이벤트를 자동 생성한다.

**조합 폭발 방지 전략:**
- 첫 번째 axis의 모든 entry를 순회하고 나머지 axis는 첫 entry 고정
- 그 다음 두 번째 axis의 나머지 entry를 순회 (첫 axis는 첫 entry 고정)
- 총 이벤트 수 = sum(entries.length) — 곱이 아닌 합

prefix_ref dim은 refEntries의 첫 번째 값을 자동 주입. table_ref dim은 스킵.

#### 3단계: 집계

`aggregateUsageData(catalog, records)` → `UsageData` (entry/address/co-occurrence/version 사용량)

#### 4단계: convergence 분석

- `analyzeCollectionHealth(catalog, records)` → 수집 건전성 보고서
- `analyzeEntryCoverage(catalog, entryUsages, addressUsages)` → entry 커버리지 보고서

#### 5단계: invariant 검증

두 가지 불변조건을 자동 검증한다:

| 불변조건 | 위반 조건 |
|----------|----------|
| 빌드 실패 후 테스트 금지 | 빌드가 failure인데 테스트가 실행됨 |
| 테스트 실패 시 빌드 성공 선행 | 테스트가 failed인데 빌드가 success가 아님 |

CLI의 Phase E `IntentLink` 검증은 self-check가 생성한 단일 prefix 레코드를
그대로 비교하지 않는다. `event_key`의 `kind:pkg:scope` 규약으로 동일 패키지의
`build_event`, `test_event`, `contract_check`를 하나의 실행 컨텍스트로 합친 뒤
build script가 있는 패키지만 `IL-build-test` 대상으로 검사한다. 이렇게 해야
테스트 레코드 하나만 보고 build/contract가 누락됐다고 판정하는 false positive를
피할 수 있다. build script가 없는 패키지는 기존 invariant 검증의 대상이 아니다.
flow 결과는 Phase E에서 출력하지만, health metric이 과거 flow observation에
오염되지 않도록 같은 live context를 Phase B 전에 먼저 계산한다.

Phase B의 metrics 결과는 요약 수치뿐 아니라 non-`ok` 항목의 ID, 상태, detail을
함께 출력한다. `11 issues`처럼 개수만 남는 상태를 방지하고, 각 경고를 capacity,
coverage, overlap, health 등 실제 조치 대상으로 바로 연결할 수 있어야 한다.
Phase B metrics 계산 전 live flow records를 IntentLink와 대조해, 실제 endpoint가
관측된 링크의 과거 flow observation만 in-memory 회복 상태로 반영한다. 동일 실행에서
위반이 재발했거나 링크 자체가 관측되지 않았으면 해소하지 않는다.
runtime ingest가 저장한 `flow_evidence_records`가 있으면 가장 최근 batch를 추가 입력으로
읽는다. 24시간 freshness gate를 통과한 evidence만 flow recovery에 사용하고, stale
evidence는 관측 범위로 출력하되 현재 정상 근거로 사용하지 않는다. 저장된 evidence가
없으면 Phase E에 `evidence scope: none`을 출력하고 self-check live records만 recovery
입력으로 사용한다.
과거 metric observation이 현재 결과에서 회복되면 dependent health metric까지
재계산하고, recovery가 더 이상 없을 때까지 반복한 뒤 `--apply`에서 저장한다.
`--fast`에서는 build/test가 mock이므로 coverage metric을 생략하고, coverage 요약은
`provisional (--fast)`로 표시한다. 실제 coverage warning은 full self-check 또는
runtime usage를 입력으로 삼는 실행에서만 생성한다.

#### 6단계: 요약 생성

`analyzeSelfCheck()`의 반환 shape은
`packages/convergence/src/self-check-analyzer.ts:SelfCheckAnalysis`가 소유한다.
CLI는 이 결과를 address usage, health, coverage, metrics, IntentLink/DSL
검증으로 확장해 운영자 출력으로 만든다.

### 대상 패키지 목록

`SELF_CHECK_PKG_NAMES`에 정의된 패키지만 점검 대상이다:

```
spec-core, cli, sdk, demo-snapshot, weighted-index,
bit-index, permission-engine, index-meta, platform-demo,
ingest-server, registry-service, e2e,
core, engine, store,
gate-service, query-service, decode-service,
registry-client, apm, browser-sdk, event-catalog, pino,
viz-3d, viz-web, demo-tests, weighted-wasm
```

### headroom/capacity 건강 지표

self-check 결과에서 파생되는 convergence 분석이 headroom과 capacity를 점검한다:

| 상태 | 조건 | 조치 |
|------|------|------|
| ok | headroom > 1 | 정상 |
| warning | headroom ≤ 1 | capacity 확장 검토 |
| critical | headroom = 0 | 즉시 capacity 확장 필요 |

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli typecheck
corepack pnpm --filter @qa-sdk/cli build
node packages/cli/dist/index.js dkg self-check
node packages/cli/dist/index.js def validate
```

2026-07-31 기준 전체 self-check는 build `25/25`(2 skipped), test
`6853/6853`, collection health `100%`, IntentLink/DSL invariant 통과였다.
build/test coverage는 각각 `86%`/`82%`이며, dormant/error-path entry는 실패가
아니라 관측 범위에 대한 후속 backlog로 분류한다.

## 관련 소스

- `packages/convergence/src/self-check-analyzer.ts` — `analyzeSelfCheck()` 구현
- `packages/convergence/src/self-check-analyzer.test.ts` — pure analysis 검증
- `packages/spec-core/src/convergence/index.ts` — re-export
- `packages/cli/src/commands/dkg.ts` — CLI `dkg self-check` 명령, 패키지 컨텍스트 병합, metrics issue 출력
- `packages/dkg/src/store/dkg-sqlite-store.ts` — runtime flow evidence 저장·조회
- `packages/cli/src/commands/dkg.e2e.test.ts` — full self-check heavy smoke lane
