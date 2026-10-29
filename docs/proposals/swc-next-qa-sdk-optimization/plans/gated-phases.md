# Wave 2 — 측정 게이트 이후 트랙 (G2·G3·G5·G6)

이 문서는 진입 조건과 범위만 고정한다. bite-sized 구현 계획은 진입 조건을 만족한 뒤 측정 결과를 근거로 작성한다(원본 계획 R2 "최적화가 실제 병목이 아닌 위험"). 각 트랙 착수 시 이 디렉토리에 `G<n>-<slug>.md`를 추가한다.

## G2 — Hot path와 데이터 표현 (원본 Phase 2)

**진입 조건**
- Track C baseline이 `benchmarks/baseline/`에 있고, 같은 runner 하드웨어에서 3회 반복한 분산이 기록됨
- Track A 3-way parity·golden corpus 통과 (최적화 결과의 semantic equality 판정 기준)
- Track B envelope binding 머지 (batch envelope 확장의 기반)

**범위 후보** — baseline에서 상위 비용으로 확인된 것만 채택
- runtime numeric ID intern (`nameToId`/`idToName`, stride table 사전 계산) — core runtime은 호출마다 `getPrefixShape`를 다시 계산한다(00-code-inventory §1.1)
- `EventHotRecord`/`EventColdRecord` 분리, coordinate-only 경로의 payload lazy deserialize
- batch encode API
- `QaLogger` ↔ `IngestForwarder` buffer 통합(X-13), drop counter
- SQLite batch INSERT + 트랜잭션 (`D1RecordStore.insertBatch`는 레코드당 1회 INSERT)
- raw/derived 저장 분리 (`DrizzleInsightsStore`가 raw 테이블을 직접 읽음)
- feature flag로 legacy path 즉시 복귀

**완료 판정 입력:** baseline 대비 delta와 측정 조건, legacy ↔ optimized semantic equality (A corpus 재사용)

## G3 — 단계별 IR과 incremental convergence (원본 Phase 3)

**진입 조건**
- Track E: inline·queue 경로가 `runPostVerdictStages`로 수렴
- Track F: Clock 주입, observation provenance, 타입 drift 테스트
- Track C에 convergence wall time case 추가

**범위**
- IR 6종 명시. 이름 충돌 회피 필요: `TransitionRecord`·`ObservationRecord`·`DecisionVerdictRecord`가 이미 다른 패키지에 있다(00-code-inventory §3) → `Ingest*` 접두사 또는 namespace 분리
- cache key: `catalogSnapshotDigest`, `inputBatchDigest`, `verdictRuleVersion`, `transitionSpecVersion`(`TransitionRegistry`에 이미 있음), `algorithmVersion`(F Task 2)
- dirty set (prefix·axis·IntentLink·TransitionSpec 단위)
- transition 결과 저장 (현재 로그만 남음)
- U-6: transition metric 3종 배선 — Phase 2.5 `TransitionSessionResult`를 TransitionRecord IR로 convergence까지 운반하고 `transitionFlushToMetrics` 결과를 `collectMetrics`에 병합
- U-7: `runConvergenceAnalysis`를 full rebuild 진입점으로 흡수 (incremental 결과와의 differential test 기준). G3를 하지 않기로 하면 삭제
- full rebuild maintenance command와 full ↔ incremental differential test
- X-15·X-17 중복 구현 정리
- D-9: **운영 계층 동결** — scheduler 제거(runner 내부 max-wait로 대체)와 worker 모드 convergence 배선은 후순위로 보류한다. G3에서는 pure dirty-set 계산·결정론 proof만 다룬다 ([02-convergence-flush-review.md](../02-convergence-flush-review.md))

## G5 — Analyzer/plugin 계약 (원본 Phase 5, 범위 조정)

**진입 조건:** Track F 머지

**범위 (R-5·R-6 반영)**
- `PolicyCandidate extends FlowPolicy` 분리 → 별도 타입 + 영속화 + 승인자·근거 digest
- `PatternRule`·`FlowPolicy`·`IntentLink`에 version 필드 — `TransitionRegistry`(name→version) 패턴 재사용
- registry `pattern-rules` 응답의 schema·version 검증 (ingest `server.ts:166-180`은 bare `JSON.parse`)
- analyzer 결과에 input snapshot·analyzer version 기록, canonical graph 자동 승격 금지
- `CON-005` 하드코딩 edge target 제거

## G6 — 검증, canary, rollout (원본 Phase 6)

**진입 조건:** G2 또는 G3 중 하나 이상이 feature flag 뒤에 머지

**범위:** dual-read·shadow 비교, semantic diff 수집, rollback command, canary dashboard·alert(decode mismatch, dropped event, queue saturation, stale projection), snapshot registry backup/restore rehearsal, rollout runbook·incident response(`CatalogMismatch`, `CorruptEnvelope`, stale projection)
