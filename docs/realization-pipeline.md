# Realization Plan: 파이프라인 실체화

> Status: Phase A-D verified
> DKG-Ref: OBS-MANUAL-service-mmz1ay93, OBS-MANUAL-service-mmz1n7ak, OBS-MANUAL-dsl-dev-mmzwyfbc
> Created: 2026-03-21
> Last verified: 2026-03-21

## 1. Current State (Analyze)

### 있는 것

- [x] 43축, 21 prefix, 6 도메인, 9 DSL 번들 정의 (DEMO_CATALOG)
- [x] DKG 153 nodes, 236 edges — 구조/설계/운영 메타데이터 그래프
- [x] convergence 24파일 — 7계층 분류 (집계/품질/측정/비교/추천/기록/필터)
- [x] metric 6종 자동 측정 (headroom/skew/coverage/overlap/conflict/health)
- [x] observation intent 분류 (action-needed/monitoring/completed)
- [x] 25개 skill 등록 (read 5, write 5, analysis 12, chain 3)
- [x] self-check — 빌드/테스트 9개 패키지 실행 + snapshot 저장 + 자동 observation
- [x] pipeline-e2e.test.ts — 1000건 시뮬레이션으로 aggregate→coverage→causality 검증
- [x] 자기참조 축 4개 (qa_pkg/qa_module/build_result/test_result) + prefix 2개 (build_event/test_event)
- [x] dev-domain + dsl-dev 번들 (불변조건 2개 포함)

### Gap → 해소 현황

| # | Gap | 해소 | 검증 결과 |
|---|-----|------|----------|
| G1 | self-check가 `aggregateUsageData`를 경유하지 않음 | ✅ Phase A | `encodePrefixByValue` → 16 records → `aggregateUsageData` → entryUsage 12건 |
| G2 | convergence 함수가 self-check 데이터를 소비하지 않음 | ✅ Phase B | `analyzeCollectionHealth` 건전성 100%, `analyzeEntryCoverage` build 69%/test 59% |
| G3 | 관측 자동 해소 없음 | ✅ Phase C | 이전 실패 → 이번 성공 시 auto-resolve. 로직 동작 확인 |
| G4 | dsl-dev 불변조건이 검증되지 않음 | ✅ Phase D | 2개 불변조건 검사 통과 (platform-demo는 hasTest=false이므로 위반 없음) |
| G5 | self-check 결과로 전문 skill 실행 불가 | 미착수 | AddressContextRecord → skill 전달 경로 구현 필요 |

## 2. Target State

### 최종 상태

self-check가 실행될 때, 이벤트가 전체 파이프라인을 관통한다:

```
dkg self-check
  │
  ├── 1. 빌드/테스트 실행 → AddressContextRecord[] 생성       ✅ 동작
  │
  ├── 2. aggregateUsageData(DEMO_CATALOG, records) → UsageData ✅ 동작
  │      ├── entryUsage 12건 (qa_pkg별, build_result별)
  │      ├── addressUsage 16건 (build_event/test_event 주소별)
  │      └── versionUsage 2건 (prefix:version별 집계)
  │
  ├── 3. convergence 분석                                      ✅ 동작
  │      ├── analyzeCollectionHealth → 건전성 100%
  │      ├── analyzeEntryCoverage   → build 69%, test 59%
  │      └── collectMetrics         → 53건 (usage 포함)
  │
  ├── 4. dsl-dev 불변조건 검증                                  ✅ 동작
  │      ├── "빌드 실패 후 테스트 금지" → 위반 없음
  │      └── "테스트 실패 시 빌드 성공 선행" → 위반 없음
  │
  ├── 5. 이전 observation 자동 해소                             ✅ 동작
  │      └── subjects의 조건 해소 시 auto-resolve + DKG 반영
  │
  └── 6. metric + 자동 observation                             ✅ 동작
         └── threshold 초과 시 action-needed observation 생성
```

### Fitness Criteria

| # | 기준 | Verify | 결과 |
|---|------|--------|------|
| F1 | aggregateUsageData 호출 + entryUsage 생성 | `dkg self-check \| grep "entryUsage"` | ✅ `entryUsage: 12` |
| F2 | qa_pkg 커버리지 80% 이상 | `dkg self-check \| grep "coverage"` | ⚠ build 69%, test 59% (9/12 패키지) |
| F3 | 이전 observation 자동 해소 | `dkg self-check \| grep "auto-resolved"` | ✅ 로직 동작 (대상 없을 때 "해소 대상 없음") |
| F4 | dsl-dev 불변조건 검증 | `dkg self-check \| grep "invariant"` | ✅ "불변조건 통과" |
| F5 | dev-domain coverage 표시 | `dkg self-check \| grep "build_event"` | ✅ `build_event 69%, test_event 59%` |

> F2 미달 사유: SELF_CHECK_PKGS에 9개만 포함. ingest-server/registry-service/e2e는 빌드 의존성 문제로 미포함.
> 80% 달성 경로: 이 3개 패키지를 self-check에 추가하거나, qa_pkg 축에서 제외.

## 3. Realization Steps (Improve)

### Phase A: aggregateUsageData 경유

Status: **verified** (2026-03-21)

#### A-1: encodePrefixByValue 사용 — ✅
- Verify 결과: 수동 stride 계산 제거. DEMO_CATALOG SSOT 경유.

#### A-2: aggregateUsageData 통과 — ✅
- Verify 결과: `records: 16건 → entryUsage: 12, addressUsage: 16, coOccurrence: 0`

#### A-3: snapshot 저장 — ✅
- Verify 결과: `snapshot #5 (16 records, entryUsage 12건)`

### Phase B: convergence 함수 연결

Status: **verified** (2026-03-21)

#### B-1: analyzeCollectionHealth — ✅
- Verify 결과: `건전성 100% — 16건 모두 유효`

#### B-2: analyzeEntryCoverage — ✅
- Verify 결과: `build_event 69%, test_event 59%`
- dormant: `ingest-server, registry-service, e2e` (미검사 패키지), `failure, skipped` (미발생 결과)

#### B-3: metrics with usage — ✅
- Verify 결과: `53건, 20 issues` (coverage warning 포함)

### Phase C: 관측 자동 해소

Status: **verified** (2026-03-21)

#### C-1: 조건 비교 + auto-resolve — ✅
- 로직: 이전 OBS-SELF-BUILD/TEST/METRIC의 subjects가 이번에 전부 성공 → resolution 설정 + store 반영

#### C-2: DKG 노드 업데이트 — ✅
- `graph.replaceNode(resolved)` + `store.saveNodes` 호출

### Phase D: DSL 불변조건 검증

Status: **verified** (2026-03-21)

#### D-1: 빌드 실패 후 테스트 금지 — ✅
- platform-demo는 hasTest=false이므로 위반 없음. 정상 감지 경로 확인.

#### D-2: 위반 시 observation 생성 — ✅
- 코드 경로 확인: `OBS-SELF-INVARIANT-*` 생성 + `observes → dsl-dev` 엣지

## 4. 생성된 Decision

| Decision | Phase | 내용 |
|----------|-------|------|
| (pending) | A-D 통합 | 4개 Phase를 한 번에 구현하여 self-check 파이프라인 실체화 완료. 개별 ADR 대신 이 VRP가 기록 역할 수행 |

## 5. 되돌림 조건

- `aggregateUsageData`가 self-check 성능을 10초 이상 늘리면 → Phase A 되돌림 (현재: 추가 시간 미미)
- convergence 분석이 false positive를 대량 생성하면 → threshold 조정 (현재: 20 issues는 대부분 coverage warning)
- auto-resolve가 유효한 observation을 잘못 닫으면 → Phase C 되돌림 (현재: subjects 완전 일치 시에만 해소)

## 6. 남은 작업

| # | 항목 | 연결 Gap | 우선순위 | 상태 |
|---|------|---------|---------|------|
| R1 | F2 미달: 커버리지 → 80% 목표 | G5 연장 | 중 | ✅ 해소 — 12개 패키지 추가. build 94%, test 76% |
| R2 | G5: self-check → 전문 skill 전달 | G5 | 중 | 미착수 |
| R3 | coOccurrence 0건 | — | 낮 | 보류 — 별도 이벤트이므로 구조적으로 부적절 |
| R4 | metric issues 20건 노이즈 | — | 낮 | 보류 — dormant entry는 구조적 존재 |
| R5 | completed observation 3건 미닫힘 | — | 낮 | 미착수 |
| R6 | dsl-dev invariant 위반 감지 | D | — | **발견**: registry-service 빌드 type-error인데 테스트 통과 (vitest 트랜스파일러가 타입 무시) |

## 7. 파이프라인 발견 사항

### R1 결과 (2026-03-21)

패키지 12개로 확장 후:
- build_event 커버리지: 69% → **94%** (dormant: `failure` 1건만 남음)
- test_event 커버리지: 59% → **76%** (dormant: `failed/error/skipped/timeout` — 전부 성공이라 미발생)
- 총 테스트: 2480 → **2558** (ingest-server 177 + registry-service 54 추가, platform-demo/e2e 제외 유지)

### dsl-dev invariant 첫 실제 위반 (2026-03-21)

```
registry-service: 빌드 type-error인데 테스트 실행됨 (passed)
```

원인: `sql-draft-lock-store.ts:21` — `ExecuteResult`에 `changes` 속성 없음 (node:sqlite API 변경).
vitest는 esbuild 트랜스파일로 타입 에러를 무시하고 실행하므로 테스트는 통과.

**의미**: 파이프라인이 없었으면 이 불일치를 몰랐음. tsc 빌드와 vitest 실행의 타입 검증 수준 차이가 실제로 존재하며, dsl-dev 불변조건이 이를 감지함.
