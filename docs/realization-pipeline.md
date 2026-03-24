# Realization Plan: 파이프라인 실체화

> Status: **completed**
> DKG-Ref: OBS-MANUAL-service-mmz1ay93, OBS-MANUAL-service-mmz1n7ak, OBS-MANUAL-dsl-dev-mmzwyfbc, DEC-CAPACITY-dsl-dev-mmzyw4go
> Created: 2026-03-21
> Last verified: 2026-03-24
>
> **달성**: G1~G5 해결, R3/R5 완료. 현재 74축, 46 prefix, 225+ nodes, 472+ edges.
> **G5 해소**: flow-trace skill이 AddressContextRecord를 직접 소비 (CLI self-check + ingest convergence pipeline). 나머지 skill은 UsageData(집계 결과) 소비가 올바른 설계.

## 1. 배경

좌표 시스템(43축, 21 prefix)과 DKG(164 nodes, 263 edges)가 정의되어 있었지만, 실제 데이터가 파이프라인을 관통하지 않았다. convergence 분석 함수 18개가 있으나 입력 데이터가 없었고, self-check는 빌드/테스트 결과를 직접 versionUsage로 주입해 집계 경로를 우회했다.

## 2. 해소한 Gap 5건

| # | Gap | 해소 방법 | 검증 |
|---|-----|----------|------|
| G1 | aggregateUsageData 미경유 | `encodePrefixByValue` → `aggregateUsageData` 경유 | records 21건 → entryUsage 15, addressUsage 21 |
| G2 | convergence 함수 미연결 | `analyzeCollectionHealth` + `analyzeEntryCoverage` 호출 | 건전성 100%, build 88%, test 76% |
| G3 | 관측 자동 해소 없음 | self-check에서 이전 observation 조건 비교 + `resolveRecoveredMetrics` | auto-resolve 동작 확인 |
| G4 | dsl-dev 불변조건 미검증 | self-check에서 2개 불변조건 검사 | 통과. registry-service 실제 위반 감지 후 수정 |
| G5 | 전문 skill 실행 불가 | **해소** | flow-trace가 AddressContextRecord 직접 소비. CLI(dkg.ts:4068) + ingest(convergence-pipeline.ts:296) 연결 완료. |

## 3. 현재 파이프라인

```
dkg self-check [--apply]
  │
  ├── 빌드/테스트 실행 (12개 패키지, execSync)
  │
  ├── 좌표 인코딩 (encodePrefixByValue → build_event/test_event)
  │
  ├── 집계 (aggregateUsageData → entryUsage + addressUsage)
  │
  ├── convergence 분석 (읽기 전용)
  │   ├── analyzeCollectionHealth → 건전성
  │   └── analyzeEntryCoverage   → 커버리지
  │
  ├── invariant 검증 (읽기 전용)
  │   ├── "빌드 실패 후 테스트 금지"
  │   └── "테스트 실패 시 빌드 성공 선행"
  │
  ├── 해소/생성 후보 탐색 (읽기 전용)
  │   ├── 이전 observation 조건 비교 → 해소 후보
  │   └── 새 실패/위반 → 생성 후보
  │
  └── [--apply 시에만]
      ├── store.saveUsageSnapshot
      ├── observation 생성/해소 → DKG 상태 변경
      └── DEC-CAPACITY-dsl-dev-mmzyw4go: CLI 권한 분리 근거

dkg converge [--persist] [--verbose]
  │
  ├── usage snapshot 로드 (최근 5개)
  ├── collectMetrics → metric 수집
  ├── metricsToObservations → 결정적 ID 기반 observation
  ├── resolveRecoveredMetrics → ok 복귀 시 자동 해소
  ├── convergeChain → 축 중복/dormant/단순화/observation
  ├── systemHealthChain → constraint + domain + coverage
  └── [--persist] store 반영 + stale observation 정리
```

## 4. 구현 이력

### Phase A-D: 파이프라인 관통 (2026-03-21)

self-check가 `aggregateUsageData`를 경유하여 convergence 입력을 생성하고, 불변조건 검증과 관측 자동 해소가 동작하게 됨.

### 커버리지 확장 (2026-03-21)

패키지 9개 → 12개 (ingest-server, registry-service, e2e 추가). build 88%, test 76%.

### 빌드 에러 수정 (2026-03-21)

- **registry-service**: `result.changes` → `result.rowsAffected` (ExecuteResult 인터페이스 정합)
- **platform-demo**: `v2Data` → `curData` (미정의 변수 오타) + `new Set<string>` (리터럴 union 타입)
- dsl-dev invariant이 registry-service 불일치를 실제로 감지 — 파이프라인의 첫 실제 발견

### CLI 권한 분리 (2026-03-21)

DEC-CAPACITY-dsl-dev-mmzyw4go. CLI는 데이터 공급/탐색 인터페이스.
- `dkg self-check`: dry-run 기본, `--apply` 옵트인
- `dkg converge`: `--persist` 옵트인
- `dkg metrics`: 읽기 전용 (후보만 표시, 기록은 `dkg observe`로)

### observation 생명주기 강화 (2026-03-21)

- **intent 분류**: `action-needed` / `monitoring` / `completed` — health metric이 action-needed만 집계
- **결정적 ID**: `metricsToObservations`가 timestamp 없는 ID 생성 → upsert 멱등성
- **자동 해소**: `resolveRecoveredMetrics` — metric ok 복귀 시 OBS-METRIC 자동 resolve
- **DEC-SEP 수용**: overlap metric이 Decision 수용된 항목을 ok로 다운그레이드
- **테스트**: `observation-lifecycle.test.ts` — 멱등성 + auto-resolve + store 영속화 검증

### convergence 오케스트레이터 (2026-03-21)

`runConvergenceAnalysis()` — 5개 분석 서비스를 한 번에 실행:
1. `scanAxisOverlaps` + `comparePrefixes` → 구조 중복
2. `scanDecisionConflicts` → 결정 충돌
3. `discoverCausalityWithObservations` → 인과 후보 + observation
4. `scanAllSimplifications` → 단순화 대상
5. `recommendAll` → 통합 경계 추천

CLI: `dkg converge [--persist] [--verbose]`

### 의사결정 관리 + 카탈로그 격리 (2026-03-21)

- `dkg decisions export/import/list` — 의사결정 백업/복원/조회
- `catalog_id` 컬럼 — DkgSqliteStore에서 카탈로그별 데이터 격리
- `--catalog` 글로벌 옵션 + `setCatalogContext()` — 멀티 카탈로그 지원
- `qa-sdk init` — 새 카탈로그 프로젝트 스캐폴딩

## 5. 되돌림 조건

- self-check 실행 시간 > 60초 → 패키지 목록 축소 검토
- convergence 분석 false positive 대량 발생 → threshold 조정
- auto-resolve가 유효한 observation을 잘못 닫음 → `resolveRecoveredMetrics` 조건 강화

## 6. 현재 수치

```
DKG:        164 nodes, 263 edges (18 decisions, 26 observations)
spec-core:  34 test files, 328 tests
모노레포:   2771 tests (12개 패키지)
build:      11/11 success (1 skipped)
metrics:    30건, 0 issues
health:     건전성 100%, invariant 통과
```

## 7. 남은 작업

| # | 항목 | 우선순위 | 상태 |
|---|------|---------|------|
| G5 | self-check → 전문 skill 전달 (AddressContextRecord 경유) | 중 | **완료** — flow-trace skill이 직접 소비 |
| R2 | self-check 결과로 dsl-dev 외 DSL 불변조건 검증 | 중 | **완료** — validateDslInvariants() Phase F + converge 5.5 |
| R3 | coOccurrence 활용 (빌드+테스트 cross-event) | 낮 | 보류 |
| R5 | completed observation 수동 정리 | 낮 | **완료** — pruneResolvedObservations() + converge --persist 자동 실행 |
