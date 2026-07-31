# FB-2026-07-31-03 — self-check 잔여 metric의 실행 근거·설계 판단

| 항목 | 값 |
|---|---|
| 상태 | `deferred` |
| 우선순위 | P1/P2 — 실행 근거 확보 후 순차 처리 |
| 등록일 | 2026-07-31 |
| 출처 | `dkg self-check --apply` 후속 리뷰 |
| 대상 | convergence metric, IntentLink flow trace, IR 축 capacity, DSL coverage |

## 현재 근거

전체 self-check 적용 실행 `#1938`은 build `25/25`(2 skipped), test `6853/6853`,
collection health `100%`, build/test coverage `86%`/`82%`, IntentLink·DSL invariant
정상으로 완료됐다. metrics는 9개 non-`ok`를 남겼다.

- domain health 5개: 과거 `OBS-FLOW-*`와 `OBS-DSL-UNCOVERED`가 현재 health에 연결됨
- headroom warning 3개: `ir_pipe_state`, `ir_retention`, `ir_storage_type` 모두 `3/4`
- overlap warning 1개: `pattern_confidence` ↔ `confidence_band` 80% merge 후보

현재 SQLite usage snapshot은 집계된 `addressUsages`만 보존하고 raw
`address_context`/session co-occurrence를 보존하지 않는다. 따라서 최신 flow trace가
정상이라는 이유만으로 과거 business flow observation을 자동 해소하면 관측 부재를
정상으로 오인할 수 있다.

## 처리된 범위

`resolveRecoveredFlowObservations()`를 추가해 다음 조건을 모두 만족할 때만 flow
observation을 회복 후보로 만든다.

1. 현재 실행 records에서 해당 IntentLink endpoint가 하나 이상 실제 관측된다.
2. 같은 실행에서 동일한 flow violation이 재발하지 않는다.
3. 실제 저장은 self-check `--apply`에서만 수행한다.

현재 self-check는 build/test/contract live context만 flow trace에 사용하므로, 위
조건을 만족하지 못한 과거 business flow observation 7건은 의도적으로 유지한다.

## 보류 항목과 재개 조건

| 항목 | 보류 이유 | 재개 조건 |
|---|---|---|
| `OBS-FLOW-*` health | raw business context가 없어 회복 여부 판정 불가 | ingest/store가 raw address context 또는 session-level flow evidence를 제공한 뒤 재실행 |
| IR headroom 3건 | capacity `4 → 8`은 주소 stride와 snapshot에 영향을 주는 semantic 변경 | capacity 결정 기록, impact 분석, catalog/codegen/주소 회귀 검증 완료 |
| axis overlap 1건 | 두 confidence 축의 의미가 실제로 병합 가능한지 사람 판단 필요 | merge 또는 `DEC-SEP` 수용 결정과 downstream consumer 확인 |
| `OBS-DSL-UNCOVERED` | 17개 prefix의 DSL 소유·포함 여부가 설계 판단 | 각 prefix의 DSL 귀속 또는 의도적 비소속 결정 기록 |

## 종료 조건

- raw flow evidence가 저장되고 관측 범위가 closure에 표시된다.
- capacity 변경은 semantic-change impact와 주소 회귀를 통과한다.
- overlap 및 DSL 소유 판단이 DecisionNode/스펙으로 기록된다.
- 후속 self-check에서 자동 해소된 observation과 의도적으로 남은 warning의 이유가
  각각 출력된다.
