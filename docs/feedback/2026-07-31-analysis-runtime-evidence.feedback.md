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
정상으로 완료됐다. 당시 metrics는 9개 non-`ok`를 남겼다. 그래프 refresh 전 수치는
과거 baseline으로만 보존하고, 현재 authoritative 기준은 refresh 후 full self-check다.

- domain health 5개: 과거 `OBS-FLOW-*`와 `OBS-DSL-UNCOVERED`가 현재 health에 연결됨
- overlap warning 1개: `pattern_confidence` ↔ `confidence_band` 80% merge 후보
- 현재 bootstrap 기준 `OBS-DSL-UNCOVERED`는 22개 prefix를 가리킨다. 이 중 5개는
  기존 flow-schema 연결이 있고, 나머지 17개(`harness_*`, `quality_event`,
  `task_event`, `sdk_lifecycle`, `rpc_event`, `gate_execution`, `bundle_observation`,
  `transition_event`, `convergence_event`, `graph_event`, `test_scenario`, `ir_*`)는
  직접적인 flow-schema/domain 후보가 없다. decision-flow, definition harness, IR
  관측 영역의 DSL 소유 여부는 아직 결정하지 않았다.
후속 bootstrap은 각 미소속 prefix에 기존 `flow-schema`/`domain` 연결을
`ownershipCandidates` 메타데이터로 보존한다.

ownership 후보의 구체적 범위는 다음과 같다. `decision_event`, `decision_path`,
`escalation_event`, `model_apply`는 `coordinate-design`, `forcing-questions`,
`office-hours`, `ceo-review`, `eng-review`, `design-review`, `code-review`,
`investigation`, `build`, `ship`, `reflect`, `sprint-pipeline` flow-schema와
`decision-domain` 후보를 공유한다. `forcing_response`는 `office-hours`와
`decision-domain` 후보만 가진다. 나머지 17개는 현재 직접 후보가 없다.

confidence overlap의 소비자 근거도 확인했다. `pattern_confidence`는
`pattern_match`와 `classifyPattern()`이 세션 행동 패턴 분류의 신뢰도
(`exact/high/medium/low/unknown`)로 소비하고, `confidence_band`는
`decision_event`·`forcing_response`와 `decision-flow`의 `discretizeConfidence()`가
결정 근거의 확신도(`low/medium/high/exact`)로 소비한다. 값 이름은 일부 같지만
소유 시스템·입력·출력 계약·축 cardinality가 다르고 두 축을 함께 쓰는 prefix도
없다. 따라서 현재 근거는 `keep-separate` 쪽을 지지하지만, merge하지 않는다는
최종 DecisionNode 기록은 아직 남아 있다.

DSL ownership은 prefix별 1개 decision unit으로 관리한다. 현재 unit은
flow/domain 후보가 있는 5개(`decision_event`, `decision_path`,
`escalation_event`, `model_apply`, `forcing_response`)와 직접 후보가 없는 17개
(`harness_transition`, `harness_guard`, `harness_process_step`, `quality_event`,
`task_event`, `sdk_lifecycle`, `rpc_event`, `gate_execution`, `bundle_observation`,
`transition_event`, `convergence_event`, `graph_event`, `test_scenario`, `ir_module`,
`ir_data`, `ir_pipe`, `ir_intent_path`)다. 각 unit은 다음 shape로 기록한다:
`target prefix → choice(DSL 귀속|의도적 독립) → owner DSL/domain 또는 none →
rationale → evidence(source/consumer/flow) → downstream consumer 영향`. 이 형식이
채워지기 전에는 `OBS-DSL-UNCOVERED`를 자동 해소하지 않는다.

그래프 refresh 직후의 `--fast` 재측정은 build/test mock 입력의 비대표성을 반영해
coverage metric을 생성하지 않으며 `263건, 6 issues`로 집계된다. coverage 요약은
`provisional (--fast)`로만 출력된다(`build_event 41%`, `test_event 39%`). 이전
`251건, 9 issues`는 refresh 전 stale graph 기준이다.

runner 수정 전 full self-check 재측정은 build `25/25`(2 skipped), test 집계 `6769/6769`,
records `1,226건`, metrics `319건 중 9 issues`, coverage `86%`/`84%`였다. 이
실행에서 `bit-index`와 E2E 7개 시나리오는 self-check 프로세스 오류로 보고됐지만,
`bit-index` 단독 테스트는 `62/62` 통과했다. E2E 오류는 `localhost:5230 already
used` 포트 충돌이며, 포트 점유 프로세스는 종료하지 않고 실행 환경 잔여 항목으로
보류한다.

self-check runner를 단일 Playwright 프로세스 + JSON report 시나리오별 집계로
수정한 뒤 재실행한 결과는 build `25/25`(2 skipped), test `6857/6857`, E2E
`31/31`, records `1,229건`, coverage `86%`/`82%`였다. 그래프 refresh와 IR
capacity 반영 후 최신 full 기준은 metrics `331건 중 6 issues`이며, schema 위반은
`0건`이다. 남은 6건은 domain health 5건(critical 3, warning 2)과 confidence
overlap warning 1건이다. self-check 종합 출력도 metric critical이 있으면
`⚠ 문제 감지`, warning만 있으면 `⚠ 잔여 경고`로 표시하도록 수정했다.
이 실행에서는 `bit-index` `62/62`와 E2E 8개 시나리오가 모두 통과했고, 실행 오류가
없었다. 이전 포트 충돌은 자동화 경로에서 해소됐다. 다만 당시 self-check는 metric
non-`ok`를 종합 상태에 반영하지 않아 정상으로 표시했으며, 현재는 이 표시 버그도
수정됐다.

`dsl-bundle-spec` closure는 permission policy rule, event observability rule 및
각 테스트 source evidence를 연결한 뒤 `closed`(missing 0, diagnostics 0)로
전환됐다. 이는 문서 책임의 근거가 닫혔다는 뜻이며, 22개 prefix의 DSL 귀속 또는
의도적 독립 사용을 자동으로 결정했다는 뜻은 아니다.

카테고리 감사의 실제 위반 2건(`ir_module`, `ir_pipe`)도 규칙/카탈로그 근거를
대조해 해소했다. `ir_module`은 서비스 런타임이 아닌 정의 공간 자기 관측 예외로
명시했고, `ir_pipe`의 `ir_call_kind`를 action-related event 축으로 인정했다.
이후 schema audit는 `68/68` 통과다.

Q5 capacity warning 3건은 `ir_pipe_state`, `ir_retention`, `ir_storage_type`의
capacity를 각각 `4 → 8`로 올려 해소했다. 각 축은 entries 3개이므로
`nextPowerOf2(3 × 2) = 8`이며, DKG에 세 capacity decision을 기록했다. impact
분석 결과 `ir_pipe_state`는 `ir_pipe`, `ir_intent_path`, 나머지 두 축은 `ir_data`의
stride를 변경하고 `migrationRequired=true`를 반환한다. 따라서 정적 headroom은
닫혔지만 기존 주소 소비자의 migration 확인은 별도 후속 항목이다.

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
| IR 주소 migration | capacity `4 → 8` 변경으로 기존 주소 stride가 달라짐 | `ir_pipe`, `ir_intent_path`, `ir_data` 소비자의 기존 주소 snapshot/backfill 정책 확인 |
| axis overlap 1건 | 두 confidence 축의 의미가 실제로 병합 가능한지 사람 판단 필요 | merge 또는 `DEC-SEP` 수용 결정과 downstream consumer 확인 |
| `OBS-DSL-UNCOVERED` | 22개 prefix의 DSL 소유·포함 여부가 설계 판단. bootstrap은 기존 flow-schema/domain 후보만 제시 | 각 prefix의 DSL 귀속 또는 의도적 비소속 결정 기록 |

## 종료 조건

- runtime raw flow evidence가 저장되고 ingest flush 결과에 관측 범위가 표시된다. ✅
- self-check가 최신 evidence를 읽고 24시간 freshness gate로 관측 부재와 정상 복귀를 구분한다. ✅
- category audit가 `68/68` 통과하고 IR headroom 경고가 사라진다. ✅
- capacity 변경은 DKG decision 및 semantic-change impact를 기록했다. ✅
- 기존 IR 주소 소비자 migration/backfill 정책을 확인한다.
- overlap 및 DSL 소유 판단이 DecisionNode/스펙으로 기록된다.
- 후속 self-check에서 자동 해소된 observation과 의도적으로 남은 warning의 이유가
  각각 출력된다.
