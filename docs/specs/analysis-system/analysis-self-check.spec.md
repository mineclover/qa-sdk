---
def:
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
---
# Self-Check — 시스템 건강 상태

## 목적 ^purpose

좌표 시스템의 건강 상태를 자동 점검하는 기능. headroom 경고, capacity 위반, 직교성 의심, 미사용 축/prefix를 감지한다.

## 구성 ^overview

Self-Check는 `@qa-sdk/convergence`의 `analyzeSelfCheck()` 순수 함수로 구현된다. execSync 없음, Store 의존 없음. CI에서 결과를 JSON으로 저장 → 이 모듈로 분석 → CLI/테스트에서 소비하는 구조이다.

### 입출력

```typescript
function analyzeSelfCheck(
  results: SelfCheckResult[],  // 빌드/테스트 결과
  catalog: Catalog,            // DEMO_CATALOG
  runId?: string,              // 실행 식별자
): SelfCheckAnalysis;
```

### SelfCheckResult 입력

각 패키지의 빌드/테스트 결과를 표현한다:

```typescript
interface SelfCheckResult {
  pkg: string;           // 패키지 이름
  kind: "build" | "test";
  result: string;        // "success" | "failure" | "skipped" | "passed" | "failed"
  module?: string;       // 테스트 모듈명
  tests?: number;        // 테스트 총 수
  passed?: number;
  failed?: number;
  durationMs?: number;
}
```

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

#### 6단계: 요약 생성

```typescript
interface SelfCheckAnalysis {
  records: AddressContextRecord[];        // 인코딩된 레코드
  usage: UsageData;                       // 집계 결과
  health: CollectionHealthReport;         // 수집 건전성
  coverage: CoverageReport;              // entry 커버리지
  invariantViolations: InvariantViolation[];  // 불변조건 위반
  buildSummary: { success, failure, skipped, total };
  testSummary: { passed, failed, tests, total };
  bizRecords: number;                    // 합성 이벤트 수
}
```

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

## 관련 소스

- `packages/convergence/src/self-check-analyzer.ts` — `analyzeSelfCheck()` 구현
- `packages/spec-core/src/convergence/index.ts` — re-export
- `packages/cli/src/commands/dkg.ts` — CLI `dkg self-check` 명령
