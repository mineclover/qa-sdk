# Enterprise-PM Canary & Scaling — Decision Model

> 30초 사이클로 Pass 1(안전 카나리 제어) · Pass 2(자원 스케일링)을 순차 평가하고, 카테고리×신호×임계 매트릭스에서 산출한 verdict를 audit-recorder에 멱등적으로 적재하는 결정 모델.

## 1. 결정 객체 구조 (decision-flow 매핑)

decision-flow 라이브러리의 표준 결정 레코드(`evidence[]`, `confidence`, `verdict`, `action`)를 그대로 채택한다. Pass 1과 Pass 2는 같은 사이클 안에서 발생하지만 서로 다른 결정 노드로 기록되며, audit-recorder-store에 nested tree로 저장된다 (parent: cycleId). audit-browser-api에서 사이클별 결정 트리를 재구성할 수 있다.

식별자(decisionId, cycleId)는 `03-identifier-grammar.md` §"decision id" / "cycle id" grammar에 따른다 — 임의 문자열 금지.

```ts
interface SafetyDecision {
  decisionId: string;            // 03-identifier-grammar §"decision id"
  cycleId: string;               // 03-identifier-grammar §"cycle id"
  cycleAt: string;               // ISO-8601, compareTimestamps 비교 대상
  pass: "safety";
  verdict: "promote" | "hold" | "rollback";
  categoryVerdicts: {
    perf: "PASS" | "WARN" | "FAIL";
    compatibility: "PASS" | "WARN" | "FAIL";
    decisionQuality: "PASS" | "WARN" | "FAIL";
    auditSafety: "PASS" | "WARN" | "FAIL";
    replicationHealth: "PASS" | "WARN" | "FAIL";
  };
  triggerCategory?:
    | "perf"
    | "compatibility"
    | "decisionQuality"
    | "auditSafety"
    | "replicationHealth";
  triggerSignals: string[];      // 예: ["perf.errorRate", "perf.p95LatencyDelta"]
  evidence: Array<{
    kind: "data" | "rule" | "precedent" | "intuition" | "external";
    source: string;              // 예: "metrics-collector:prometheus"
    content: unknown;            // 측정값/룰 본문
    weight: number;              // 0..1
  }>;
  confidence: number;            // 0..1, < 0.6 → hold 강제
  action?:
    | { kind: "weight-update"; weight: 0 | 5 | 25 | 50 | 100; revision: number }
    | { kind: "version-pin"; version: string }
    | { kind: "noop" };
}

interface ResourceDecision {
  decisionId: string;
  cycleId: string;               // SafetyDecision.cycleId 와 동일
  cycleAt: string;
  pass: "resource";
  verdict: "scale-up" | "scale-down" | "hold" | "rejected";
  categoryVerdicts: {
    loadPressure: "PASS" | "WARN" | "FAIL";
    resourceHeadroom: "PASS" | "WARN" | "FAIL";
    stability: "PASS" | "WARN" | "FAIL";
  };
  rejectedBy?: "resourceHeadroom" | "stability";
  triggerSignals: string[];
  evidence: Array<{
    kind: "data" | "rule" | "precedent" | "intuition" | "external";
    source: string;
    content: unknown;
    weight: number;
  }>;
  confidence: number;
  action?:
    | { kind: "scale"; target: { v1: number; v2: number }; reason: string }
    | { kind: "noop" };
}
```

audit-recorder는 `(cycleId, pass)` 복합 키로 멱등 write 한다. Pass 2 결정의 `cycleId`는 항상 같은 사이클의 SafetyDecision과 일치하므로 audit-browser-api는 cycleId 기준으로 두 결정을 한 트리로 묶어 재구성한다.

## 2. 카테고리별 verdict 산출 규칙

각 카테고리는 1개 이상 신호로 구성된다. 각 신호는 PASS / WARN / FAIL 셋 중 하나로 분류되며, 임계값은 `controller-config.yaml`에 선언한다. 카테고리 verdict는 신호 verdict의 최악값으로 산출한다.

| 카테고리 | 신호 | PASS | WARN | FAIL |
|---|---|---|---|---|
| **perf** | errorRate (5xx ratio) | ≤ baseline×1.2 | ≤ baseline×1.5 | > baseline×1.5 |
| | p95LatencyDelta | ≤ +20% | ≤ +50% | > +50% |
| **compatibility** | schemaCompatRate (outbox event schemaHash) | = 1.0 | — | < 1.0 (즉시 FAIL, hard) |
| **decisionQuality** | denyRateDelta | \|Δ\| ≤ 5% | \|Δ\| ≤ 15% | \|Δ\| > 15% |
| | avgConfidenceDelta | ≥ -0.05 | ≥ -0.15 | < -0.15 |
| **auditSafety** | criticalAnomalyRate (audit-recorder 자동 분류) | = 0 | — | > 0 (즉시 FAIL, hard) |
| **replicationHealth** | replicationLagMs | ≤ 500 | ≤ 2000 | > 2000 |
| **loadPressure** | RPS (5min avg) | < 임계 | 임계×0.8~임계 | ≥ 임계 (scale-up trigger) |
| | p95LatencyDelta | ≤ +30% | ≤ +50% | > +50% |
| **resourceHeadroom** | CPU% (replica avg) | ≤ 60 | ≤ 80 | > 80 |
| | dbPoolUtilization | ≤ 60% | ≤ 80% | > 80% (scale-up reject) |
| **stability** | timeSinceLastReplicaChange | ≥ cooldown(60s) | < cooldown | — |

카테고리 verdict 산출 — 신호 중 가장 나쁜 것:

- 신호 중 하나라도 FAIL → 카테고리 FAIL
- FAIL 없고 WARN 있음 → 카테고리 WARN
- 모두 PASS → 카테고리 PASS

**Hard rule (즉시 FAIL, 평가 윈도우 무시)**:

- compatibility.schemaCompatRate < 1.0
- auditSafety.criticalAnomalyRate > 0
- perf.errorRate burst (60초 내 5xx ≥ 임계)

Hard rule은 단일 사이클 신호만으로 즉시 FAIL을 강제하며, 5분 윈도우/N=10 사이클 누적 검사를 우회한다. 정의상 차단 사유에 해당하므로 controller-config.yaml에서 임계 override를 허용하지 않는다 (§7 참조).

## 3. Pass 1 (Safety) 결정 알고리즘

Pass 1은 카나리 weight 진행/유지/롤백을 결정한다. 입력 신호의 카테고리 verdict가 산출된 직후 다음 의사 코드 순서로 평가한다.

```
inputs:  perf · compatibility · decisionQuality · auditSafety · replicationHealth

# Hard rollback first
if compatibility = FAIL OR auditSafety = FAIL OR perf.burst:
    verdict = "rollback"; triggerCategory = (해당)
    action = weight 즉시 0% (v2 → v1 강제)
    return

# Soft rollback (5분 윈도우, 최근 N=10 사이클 중 ≥3 사이클 FAIL)
if any(category) = FAIL in window:
    verdict = "rollback"; action = weight 0%
    return

# Hold
if confidence < 0.6 OR any(category) = WARN:
    verdict = "hold"; action = noop
    return

# Promote
if 모든 category = PASS AND timeSincePromotion >= dwellTime(120s):
    verdict = "promote"
    action = weight 다음 단계 (5 → 25 → 50 → 100)
    return

verdict = "hold"; action = noop
```

순서가 곧 우선순위다. Hard rollback은 단일 사이클 hard rule 트리거에 의해 발생하고, soft rollback은 윈도우 누적 FAIL을 검사한다. Hold는 confidence 미달과 WARN 카테고리를 모두 흡수하며, Promote 분기는 모든 카테고리가 PASS이고 dwellTime을 지났을 때만 도달한다.

승격 단계 시퀀스는 5 → 25 → 50 → 100 (단방향). 각 단계 진입 후 `dwellTime`(기본 120s) 동안 추가 사이클이 모두 PASS여야 다음 단계로 이행한다. weight=100 + dwellTime 추가 경과 시 catalog version 승격을 트리거한다. catalog 상태 전이 상세는 `02-canary-topology.md` §"catalog 상태 전이" 참조.

`triggerCategory`는 rollback 분기에서만 채워진다. Promote / hold 분기는 `triggerSignals`만 채우며 (예: WARN 발생 신호 enumerate) `triggerCategory`는 비워둔다.

## 4. Pass 2 (Resource) 결정 알고리즘

**Pass 1이 promote/stable이 아니면 SKIP**. rollback이나 hard hold 상태에서 동시에 자원 스케일링을 결정하면 카나리 위험을 가린 채 인스턴스 수를 늘리는 회귀가 발생할 수 있다.

```
inputs:  loadPressure · resourceHeadroom · stability

if stability = WARN:    # cool-down 내
    verdict = "hold"; return

# Resource cap — scale-up 거부
if loadPressure = FAIL AND resourceHeadroom = FAIL:
    verdict = "rejected"; rejectedBy = "resourceHeadroom"
    action = noop; alert event 발행
    return

# Scale up
if loadPressure = FAIL AND resourceHeadroom != FAIL:
    verdict = "scale-up"
    target = { current.v1, current.v2 + 1 }   # 카나리 진행 중이면 v2 우선
    action = compose --scale
    return

# Scale down
if loadPressure = PASS AND current_replicas > min AND timeSinceLastChange >= cooldown(180s):
    verdict = "scale-down"; action = replica -1
    return

verdict = "hold"
```

`rejected` verdict는 단순 hold가 아니라 명시적 거부 이벤트를 의미한다. resourceHeadroom이 막혀 자원이 모자란 상황은 운영자 개입이 필요하므로 alert event를 함께 발행한다.

scale-up 대상 선택 — 카나리 진행 중(weight ∈ {5, 25, 50})이면 v2 replica를 우선 증가시킨다. weight=100 (전환 완료) 또는 weight=0 (rollback 후 정리)이면 v1을 증가시킨다. scale-down은 항상 카나리에 참여하지 않는 쪽(통상 v1) replica를 우선 감소시킨다.

cooldown은 scale-up 60s / scale-down 180s 비대칭이다. scale-down은 부하 일시 감소에 과민 반응하지 않도록 더 길게 둔다.

## 5. 사이클 흐름 (30초 타임라인)

controller는 30초 주기로 단일 사이클을 실행한다. 사이클 내부 타임라인은 다음과 같다.

```
t = 0s    : metrics scrape (Prometheus + ingest insights + audit anomaly)
t = 1-3s  : 카테고리 verdict 산출 (병렬)
t = 3s    : Pass 1 결정 → audit-recorder write
t = 4s    : (조건부) Pass 2 결정 → audit-recorder write
t = 5s    : action 실행
            - safety.action → gateway routing table push
            - resource.action → docker compose --scale 호출
t = 6-29s : idle (다음 사이클 대기)

* 시나리오 spec에서 SIM_CONTROLLER_CYCLE_MS env로 override 가능
```

t=0s scrape는 세 종류 소스를 병렬 fetch 한다. metrics-collector는 Prometheus pull, ingest insights는 `/v1/insights/schema-compat` 등 ingest-server endpoint, audit anomaly는 audit-recorder-store의 anomaly 분류 결과를 직접 read 한다. 모든 fetch는 `AbortSignal.timeout(5_000)` 적용. 일부 source 실패 시 해당 카테고리는 evidence weight를 낮추고 confidence에 반영한다 (fail-open 원칙).

t=1-3s 카테고리 verdict 산출은 카테고리별로 병렬이며, 각 카테고리 내부 신호 평가는 단일 패스로 끝난다. 산출 결과는 in-memory에 모인 뒤 한 번에 Pass 1으로 전달된다.

t=3s / t=4s 결정 write는 별도 transaction이다. Pass 1 write 실패 시 Pass 2는 SKIP 한다 — 사이클 결정 트리의 root가 비어 있는 상태로 자식만 적재되는 일을 막기 위함.

t=5s action 실행 — gateway routing push와 compose scale은 서로 다른 부수 효과 채널이고, 한쪽 실패가 다른 쪽 결정 기록을 무효화하지 않는다. 실패 시 다음 사이클이 같은 결정을 다시 적용하므로 idempotent 해야 한다 (§6).

`SIM_CONTROLLER_CYCLE_MS` env로 시나리오 spec에서 cycle 길이를 override 할 수 있다. 단축한 경우 dwellTime, cooldown, 5분 윈도우 모두 사이클 수 단위로 환산된 의미를 유지하지 않으므로, 시나리오 환경에서만 사용한다.

## 6. 결정의 멱등성 / 동시 실행 안전성

controller는 운영 환경에서 active/standby 구성으로 배포된다. 동시 실행 시 두 인스턴스가 다른 결정을 내려 routing table이나 replica 수가 진동하는 회귀를 막아야 한다.

- controller 싱글톤 보장: PG advisory lock (`pg_try_advisory_lock(key='sim-canary-controller')`). standby instance는 결정 안 함.
- gateway routing push는 **버전 번호 포함**: `{ revision: N, weight, ... }`. gateway는 자기 현재 revision보다 큰 것만 적용.
- compose `--scale`은 현재-목표 비교 후 호출 (no-op 가능). 외부 운영자 수동 scale 변경 시 다음 사이클까지 controller가 수용.

advisory lock은 PG 세션이 살아 있는 동안만 보유된다. active controller가 죽으면 standby가 다음 사이클에 lock 획득에 성공하고, 그때부터 결정을 내린다. lock 획득에 실패한 standby는 metrics scrape는 하되 audit-recorder write와 action 실행을 모두 SKIP 한다 — read-only mode.

revision은 controller가 매 사이클마다 단조 증가시키는 정수다 (`(node_id, sequence)` 쌍으로 충돌 방지). gateway는 push 받은 revision이 자기 보유 revision보다 작거나 같으면 무시한다. 늦게 도착한 stale push가 weight를 되돌리는 회귀를 방지한다.

compose scale 호출은 항상 `target == current`이면 즉시 no-op 한다. 외부 운영자가 수동으로 replica 수를 바꾼 경우, 다음 사이클의 Pass 2는 변경된 현재 값을 입력으로 사용해 결정한다 — controller는 자기 결정을 강요하지 않고 다음 사이클에서 다시 평가한다 (state reconciliation 패턴).

audit-recorder write는 `(cycleId, pass)` 복합 키 unique 제약을 둔다. 사이클 재시도가 발생해도 동일 cycleId 결정은 한 번만 기록된다. 재시도 시 기존 record를 업데이트하지 않고, 다음 cycleId로 새 결정을 만든다 (append-only 원칙).

## 7. 분류·측정 체계 근거 (qa-sdk 자산 매핑)

각 신호의 측정원이 qa-sdk 어느 SSOT에서 오고, 임계가 왜 이 값인지, 사용자가 어디서 override 할 수 있는지 명시한다. hard rule에 해당하는 두 신호는 override를 허용하지 않는다.

| 카테고리.신호 | 측정원 | qa-sdk 자산 | 임계 근거 | override 위치 |
|---|---|---|---|---|
| perf.errorRate | metrics-collector Prometheus | RED 표준 | baseline×1.5 = 통상 카나리 회귀 임계 (Argo Rollouts/Flagger 관행) | controller-config.yaml `perf.errorRate.fail` |
| perf.p95LatencyDelta | metrics-collector | RED 표준 | +50% = 사용자 체감 명백한 회귀 | controller-config.yaml |
| compatibility.schemaCompatRate | ingest-server `/v1/insights/schema-compat` | §6 unified version + outbox schemaHash | < 1.0 = 정의상 호환성 위반, 평가 윈도우 무의미 → hard FAIL | (override 없음 — hard rule) |
| decisionQuality.denyRateDelta | audit-recorder-store `/decisions/permission` aggregate | permission-engine Pass 1/2 | denyRate ±5% = 정책 의도 보존 통상 | controller-config.yaml |
| decisionQuality.avgConfidenceDelta | audit-recorder + decision-flow evidence | decision-flow 라이브러리 | -0.15 = 결정 신뢰도 명백한 저하 | controller-config.yaml |
| auditSafety.criticalAnomalyRate | audit-recorder anomaly classification | CON-005 (critical anomaly → auto observation) | > 0 = 정의상 차단 사유 | (override 없음 — hard rule) |
| replicationHealth.replicationLagMs | PG `pg_stat_replication.replay_lag` | (시뮬 신규) | 500ms = read-after-write 사용자 체감 임계 / 2000ms = WARN 통상치 | controller-config.yaml |
| loadPressure.RPS | metrics-collector | RED 표준 | 임계는 환경별 — 시뮬 기본 100 RPS | env `SIM_LOAD_RPS_THRESHOLD` |
| resourceHeadroom.CPU | service `/metrics` cgroup | 컨테이너 표준 | 80% = scale 의사결정 통상 임계 | env `SIM_CPU_HIGH_PCT` |
| resourceHeadroom.dbPoolUtilization | service `/health` postgres-js pool stats | 시뮬 신규 측정 (db-bootstrap) | 80% = downstream pool 고갈 직전 — scale-up 거부 신호 | env `SIM_DB_POOL_HIGH_PCT` |
| stability.cooldownMs | controller 내부 timer | 통상 carrying capacity 안정화 시간 | scale-up 60s / scale-down 180s | env `SIM_SCALE_COOLDOWN_*_MS` |

이 표는 두 가지 의도를 가진다. 첫째, 신호별 측정원이 qa-sdk 안에 존재하는 SSOT (audit-recorder, ingest-server insights, permission-engine, decision-flow, CON-005 등)와 직결됨을 보임으로써 controller가 별도 측정 체계를 만들지 않고 기존 자산을 합성한다는 것을 명시한다. 둘째, override 가능 여부를 한 표에서 결정한다 — hard rule은 정의상 차단 사유이므로 override 없음, 나머지는 controller-config.yaml 또는 env로 환경별 조정이 가능하다.

env vs controller-config.yaml 구분 — RPS / CPU / dbPool / cooldown 처럼 환경(시뮬/스테이징/프로덕션)에 따라 자주 바뀌는 값은 env로, perf/decisionQuality/replicationHealth 처럼 한번 정한 뒤 거의 안 바뀌는 정책성 임계는 yaml로 둔다. yaml 변경은 controller 재시작 없이 SIGHUP으로 reload 한다.
