# FB-2026-07-31-03 — self-check 잔여 metric의 실행 근거·설계 판단

| 항목 | 값 |
|---|---|
| 상태 | `in-progress` |
| 우선순위 | P1/P2 — 실행 근거 확보 후 순차 처리 |
| 등록일 | 2026-07-31 |
| 출처 | `dkg self-check --apply` 후속 리뷰 |
| 대상 | convergence metric, IntentLink flow trace, IR 축 capacity, DSL coverage |

## 현재 근거

초기 self-check 적용 실행 `#1938`은 build `25/25`(2 skipped), test `6853/6853`,
collection health `100%`, build/test coverage `86%`/`82%`, IntentLink·DSL invariant
정상으로 완료됐다. 당시 metrics는 9개 non-`ok`를 남겼다. 후속 재실행 기준은
build `27/27`, business 포함 1,140 records, metrics 319건 중 11 issues다.

- domain health 5개: 과거 `OBS-FLOW-*`와 `OBS-DSL-UNCOVERED`가 현재 health에 연결됨
- headroom warning 3개: `ir_pipe_state`, `ir_retention`, `ir_storage_type` 모두 `3/4`
- overlap warning 1개: `pattern_confidence` ↔ `confidence_band` 80% merge 후보
- 현재 bootstrap 기준 `OBS-DSL-UNCOVERED`는 22개 prefix를 가리킨다. 이 중 5개는
  기존 flow-schema 연결이 있고, 나머지 17개(`harness_*`, `quality_event`,
  `task_event`, `sdk_lifecycle`, `rpc_event`, `gate_execution`, `bundle_observation`,
  `transition_event`, `convergence_event`, `graph_event`, `test_scenario`, `ir_*`)는
  직접적인 flow-schema/domain 후보가 없다. decision-flow, definition harness, IR
  관측 영역의 DSL 소유 여부는 아직 결정하지 않았다.
후속 bootstrap은 각 미소속 prefix에 기존 `flow-schema`/`domain` 연결을
`ownershipCandidates` 메타데이터로 보존한다.

`--fast` 재측정은 build/test mock 입력의 비대표성을 반영해 coverage metric을
생성하지 않도록 변경했다. 그 결과 `251건, 9 issues`로 집계되며, coverage 요약은
`provisional (--fast)`로만 출력된다(`build_event 41%`, `test_event 39%`). full
self-check/runtime usage의 coverage metric과 기존 `319건, 11 issues` 기준은
이 변경의 대상이 아니며, 실제 coverage warning은 해당 경로에서만 판정한다.

변경 후 full self-check 재측정은 build `25/25`(2 skipped), test 집계 `6769/6769`,
records `1,226건`, metrics `319건 중 9 issues`, coverage `86%`/`84%`였다. 이
실행에서 `bit-index`와 E2E 7개 시나리오는 self-check 프로세스 오류로 보고됐지만,
`bit-index` 단독 테스트는 `62/62` 통과했다. E2E 오류는 `localhost:5230 already
used` 포트 충돌이며, 포트 점유 프로세스는 종료하지 않고 실행 환경 잔여 항목으로
보류한다.

self-check runner를 단일 Playwright 프로세스 + JSON report 시나리오별 집계로
수정한 뒤 재실행한 결과는 build `25/25`(2 skipped), test `6857/6857`, E2E
`31/31`, records `1,229건`, metrics `319건 중 9 issues`, coverage `86%`/`82%`였다.
이 실행에서는 `bit-index` `62/62`와 E2E 8개 시나리오가 모두 통과했고, 실행 오류가
없어 종합 판정도 정상으로 확인했다. 이전 포트 충돌은 자동화 경로에서 해소됐다.

기존 SQLite usage snapshot은 집계된 `addressUsages`만 보존하고 raw
`address_context`/session co-occurrence를 보존하지 않았다. 이번 후속 구현에서
ingest runtime flush는 payload를 복제하지 않고 raw 좌표와 trace/session/event 범위를
`flow_evidence_records`에 별도 저장하며, flush 결과에도 관측 prefix·범위를 남긴다.
CLI self-check는 이제 가장 최근 evidence batch를 읽어 flow trace에 보강한다. 단,
현재 실행 시각 기준 24시간 이내의 batch만 recovery 입력으로 사용하고, stale batch는
범위와 시점을 출력하되 정상 근거로 사용하지 않는다.

## 처리된 범위

`resolveRecoveredFlowObservations()`를 추가해 다음 조건을 모두 만족할 때만 flow
observation을 회복 후보로 만든다.

1. 현재 실행 records에서 해당 IntentLink endpoint가 하나 이상 실제 관측된다.
2. 같은 실행에서 동일한 flow violation이 재발하지 않는다.
3. 실제 저장은 self-check `--apply`에서만 수행한다.

현재 self-check는 build/test/contract live context와 freshness를 통과한 최신 runtime
evidence를 flow trace에 사용한다. 저장된 evidence가 없거나 stale인 실행에서는
business flow 관측을 정상으로 간주하지 않으며, 위 조건을 만족하지 못한 observation은
의도적으로 유지한다.

runtime ingest 경로에서는 `flow_evidence_records`로 raw 좌표 근거를 남기므로, 이후
재검토 시 어떤 trace/session/event가 어떤 prefix를 관측했는지 복원할 수 있다.

## 보류 항목과 재개 조건

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| `OBS-FLOW-*` health | 최신 batch만 사용하고 24시간 freshness gate를 적용함. 현재 self-check 실행에는 fresh business evidence가 없음 | 실제 business ingest flush 후 fresh batch로 self-check를 재실행해 recovered/retained 결과 확인 |
| IR headroom 3건 | capacity `4 → 8`은 주소 stride와 snapshot에 영향을 주는 semantic 변경 | capacity 결정 기록, impact 분석, catalog/codegen/주소 회귀 검증 완료 |
| axis overlap 1건 | 두 confidence 축의 의미가 실제로 병합 가능한지 사람 판단 필요 | merge 또는 `DEC-SEP` 수용 결정과 downstream consumer 확인 |
| `OBS-DSL-UNCOVERED` | 22개 prefix의 DSL 소유·포함 여부가 설계 판단. bootstrap은 기존 flow-schema/domain 후보만 제시 | 각 prefix의 DSL 귀속 또는 의도적 비소속 결정 기록 |

## 종료 조건

- runtime raw flow evidence가 저장되고 ingest flush 결과에 관측 범위가 표시된다. ✅
- self-check가 최신 evidence를 읽고 24시간 freshness gate로 관측 부재와 정상 복귀를 구분한다. ✅
- capacity 변경은 semantic-change impact와 주소 회귀를 통과한다.
- overlap 및 DSL 소유 판단이 DecisionNode/스펙으로 기록된다.
- 후속 self-check에서 자동 해소된 observation과 의도적으로 남은 warning의 이유가
  각각 출력된다.
