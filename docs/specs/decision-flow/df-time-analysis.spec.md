---
def:
  id: df-time-analysis
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: df-state-model
      type: depends_on
    - target: df-system
      type: implements
---
# 시간축 분석

## 목적 ^purpose

gate별 체류 시간을 자동 측정하고, 결정 소요 시간과 완료→판정 지연을 분석한다. 과정(active→completed)과 결론(verdict)의 시간축이 다름을 시스템이 인식한다.

## 구성 ^overview

- **durationMs 자동 측정**: CLI에서 이전 selection timestamp ~ 현재 시각으로 계산하여 FlowEngine에 전달
- **flow history**: 소요 시간 컬럼 (총 start~complete 시간)
- **flow verdict**: 총 소요, gate별 체류 시간, 완료→판정 지연 시간 표시
- **시간 기반 성공 기준**: "1주일 내 버그 미발생", "1개월 내 인시던트 없음" 등 시간 조건의 deferred 판정

## 시간 측정 지점 ^measurement-points

FlowInstance의 생명주기에서 4가지 시간 지점을 추적한다.

```
startedAt ──── selection[0].timestamp ──── selection[N].timestamp ──── completedAt ──── verdict.judgedAt
   │                    │                         │                        │                    │
   ├──── gate 체류 ─────┤                         │                        │                    │
   │                    ├──── gate 체류 ───────────┤                        │                    │
   ├────────────── 총 결정 소요 ───────────────────────────────────────────┤                    │
   │                                                                       ├── 판정 지연 ──────┤
```

- **startedAt**: `FlowEngine.startFlow()` 호출 시각 (ISO-8601)
- **selection.timestamp**: 각 gate 선택 시각
- **completedAt**: 모든 gate 통과 또는 `completeFlow()` 호출 시각
- **verdict.judgedAt**: `flow judge` 명령으로 판정 기록한 시각

## durationMs 자동 측정 ^duration-auto

CLI의 `flowSelect()` 함수가 gate별 체류 시간을 자동 계산한다.

```typescript
const lastTimestamp = instBefore.selections.length > 0
  ? instBefore.selections[instBefore.selections.length - 1].timestamp
  : instBefore.startedAt;
const durationMs = Math.max(0, Date.now() - new Date(lastTimestamp).getTime());
```

- 이전 selection의 timestamp ~ 현재 시각까지의 경과 시간
- 첫 번째 gate: `startedAt` ~ 현재 시각
- `selectBranch()`에 `{ durationMs }` 옵션으로 전달 → `GateSelection.durationMs`에 기록
- 라이브러리 레벨에서는 durationMs 기본값 0 (caller가 계산하여 전달하는 책임)

## flow history 시간 표시 ^history-time

`flowHistory()` 명령에서 각 인스턴스의 총 소요 시간을 표시한다.

- 계산: `completedAt - startedAt` (밀리초)
- 포맷: `formatDuration()` — ms를 초/분/시간으로 변환
- 진행 중(completedAt 없음): "진행중" 표시
- 출력 컬럼: ID, Schema, Status, Addr, **소요**, 시각

## flow verdict 시간 분석 ^verdict-time

`flowVerdict()` 명령에서 3가지 시간 분석을 수행한다.

1. **총 소요 시간**: `completedAt - startedAt` (또는 `Date.now() - startedAt` for active)
2. **gate별 체류 시간**: 각 `selection.durationMs` — 여정 표시에 포함
3. **완료→판정 지연**: `verdict.judgedAt - completedAt` — 과정과 결론의 시간 차이

출력 예시:
```
  소요: 2분 30초
  ...
  여정 (4 gates):
    ★ change-type    → new-feature   conf:0.90 [data,rule] 45초
    ◆ impact-scope   → system        conf:0.85 [data] 30초
    · coverage       → none          conf:0.80 [data] 15초
    · verdict        → add-e2e       conf:0.85 [rule] 1분
  ...
  완료→판정: 3일 2시간
```

## 시간 기반 성공 기준 ^time-criteria

`DEV_DECISION_UNITS`의 `successCriteria`에 시간 조건이 포함된다.

- test-needed: "판정 후 1주일 내 관련 버그가 발생하지 않음"
- stabilization: "조치 후 버그 빈도가 감소" + "안정 판정 후 1개월 내 인시던트 없음"
- architecture-decision: "선택 후 6개월 내 재선택(재설계) 없음"

이 기준들은 `flow judge` 시점에서 아직 검증할 수 없는 경우가 많다. 이때 `deferred` verdict를 사용한다.

```typescript
// evaluateDecision() — 일부만 충족 시
verdict = "deferred";
reason = `${criteriaResults.length}개 기준 중 ${metCount}개 충족 — 추가 검증 필요`;
```

- 시간 조건은 자연스럽게 deferred → 나중에 재판정하여 success/failure로 전환
- 판정 시점이 결정 시점과 분리되어야 하는 근본 이유

## InstanceStore 시간 범위 조회 ^time-query

`InstanceStore.findByTimeRange(query)` — 시작 시각 기준 범위 조회.

- `from`/`to`는 ISO-8601 문자열
- SQLite: `started_at >= ? AND started_at <= ?` 조건
- Memory: `compareTimestamps()` — `new Date().getTime()` 기반 비교 (문자열 비교 금지)
- `compareTimeRanges()` (comparison.ts): 두 시간 범위의 결정 분포 변화를 분석
