# Enterprise-PM Canary & Scaling — Error Policy & Scenarios

> 결정 지점별 fail 방향을 fail-closed/fail-open 원칙에 따라 고정하고, 17개 시나리오 + 인프라 검사로 카나리·스케일링 결정 모델 전체를 검증 단위로 환원한다.

## 1. Fail policy 매트릭스

CLAUDE.md "에러 처리 3계층 + fail-open 원칙"을 카나리/스케일링 컨텍스트에 적용하면, "결정 신호 부재"와 "결정 신뢰 저하"는 모두 fail-closed (보류·롤백) 방향으로 떨어뜨린다. 가용성 우선 fail-open은 read replica 같이 "약간 stale 한 응답이 5xx 거부보다 명백히 낫다"가 입증된 지점에만 적용한다.

| 지점 | Fail 방향 | 이유 |
|---|---|---|
| controller가 metrics scrape 실패 | **Fail-closed (결정 보류)** | 신호 부재 = 결정 못 함. 임의 promote/scale 위험. 다음 사이클까지 hold. |
| controller → gateway routing push 실패 | **Fail-closed + alert** | gateway가 stale routing 동작하면 weight 의도와 어긋남. retry (backoff 3회), 끝까지 실패하면 시나리오 단언 실패 + audit 기록. |
| controller → docker compose --scale 실패 | **Fail-closed (다음 사이클 재시도)** | replica 결정 보류. 기존 replica 유지 안전. |
| controller advisory lock 미보유 | **Standby silent** | 다른 instance가 leader. 결정 안 함. |
| gateway가 routing table 부재 (cold start) | **Fail-closed (502)** | bootstrap 시 controller에서 sync. sync 전 요청은 502. *시나리오 9는 sync 완료 후 traffic 발생하도록 wait.* |
| bitmap cache 조회 시 auth-api refresh 실패 | **Fail-closed (deny)** | 권한 정합성이 가용성보다 우선. 5xx 반환. |
| outbox dispatcher 발행 실패 | **Retry + DLQ** | event status='failed', retry_count++, exponential backoff. retry_count > 5 → DLQ 격리. 운영자 개입 신호. |
| read replica 연결 실패 | **Fail-open: primary로 fallback** | 가용성 우선. controller가 동시에 lag 신호 trigger → 다음 사이클 routing 갱신. |
| replication lag > FAIL 임계 | **Fail-closed: read 라우팅 disable** | stale data 노출보다 약간의 latency 증가 선호. |
| schemaCompatRate < 1.0 (compatibility hard fail) | **Hard rollback (즉시)** | §6 unified version 위반 = 정의상 차단. 평가 윈도우 무시. |
| audit critical anomaly | **Hard rollback (즉시)** | CON-005 (critical anomaly → auto observation) 위에 얹은 정책. |
| catalog state transition 실패 (승격 시점) | **Fail-closed + 카나리 freeze** | weight 100% 상태로 멈춤. 운영자 개입 신호 + audit 기록. *v1 stop은 catalog 전이 성공 후에만.* |

각 fail policy는 코드에서 `@FailPolicy("fail-closed")` 같은 데코레이터/주석으로 마킹 → 린트가 누락 검사. (이 데코레이터의 일관성도 `03-identifier-grammar.md` §"label key" / 정적 린트로 강제)

이 매트릭스는 두 축으로 읽는다. 첫째, "controller가 결정을 못 만드는 상태" (scrape 실패, lock 미보유, push 실패)는 모두 결정 보류·standby로 흡수한다 — 결정 모델 자체가 빈 슬롯을 만들지 않는다. 둘째, "결정 모델이 단호하게 차단해야 하는 상태" (compatibility, audit critical, replication lag FAIL)는 fail-open 후보가 아니라 hard rollback / read disable로 못 박는다. 두 축 사이의 회색지대 — 예: 부분적 metrics scrape 실패 — 는 §7 evidence weight 감쇠와 confidence 저하로 hold 분기에 자연스럽게 흡수된다 (`01-decision-model.md` §3 의사 코드).

fail-open 적용 후보로 보였지만 fail-closed로 정정한 항목 — bitmap cache deny. 권한 시스템에서 "잠시 허용"은 정의상 데이터 노출이고, 5xx 거부는 사용자가 retry 하면 회복된다. 가용성과 보안의 trade-off 자체가 비대칭이므로 fail-open 일반론을 적용하지 않는다.

retry + DLQ로 분류한 outbox dispatcher 실패는 두 분류의 합성이다. 단발 실패는 retry로 흡수 (transient 네트워크 단절·일시적 ingest 부하), 누적 실패(retry_count > 5)는 DLQ로 격리 → 운영자 개입을 강제하므로 사실상 fail-closed로 수렴한다. 시나리오 #15 (multi-dispatcher-lock)는 정상 retry 경로의 정합성을 검증하고, DLQ 경로 자체는 별도 운영 절차로 분리한다 — 첫 사이클에선 DLQ row 1건 발생 시 audit alert event 발행만 보장.

catalog state transition 실패는 hard rollback과 다른 처리다. weight=100 도달 후 catalog 전이가 실패하면 트래픽은 이미 v2로 100% 이동한 상태이므로 v1으로 돌아가는 것은 더 큰 위험을 만든다. 따라서 weight 100% 유지 + v1 stop 보류 + 운영자 개입 알림 — "freeze"라는 별도 상태로 명시한다. 이 freeze 상태는 escape hatch §2 force-promote / abort 양쪽 채널로 해소 가능하다.

### 1.1 fail policy의 결정 모델 진입 경로

§1 표의 fail-closed 분기는 모두 `01-decision-model.md` §1 결정 객체의 어떤 필드를 어떻게 채우느냐로 환원된다. 추상적인 "fail" 개념이 아니라 결정 record의 구체 값으로 표현된다.

| Fail 분기 | 결정 객체 표현 |
|---|---|
| 결정 보류 (scrape/lock 등) | SafetyDecision 자체를 write 하지 않음 (audit-recorder에 cycleId만 남고 pass=safety row 없음) |
| Hard rollback | `verdict="rollback"`, `triggerCategory ∈ {compatibility, auditSafety, perf}`, `action.weight=0` |
| Soft hold | `verdict="hold"`, `triggerSignals` 채움, `action={kind:"noop"}` |
| Scale rejected | `verdict="rejected"`, `rejectedBy="resourceHeadroom"`, alert event 별도 발행 |
| Catalog freeze | `verdict="hold"` + audit `evidence` 안에 `{kind:"external", source:"catalog-store", content:"transition-failed"}` |

이 매핑은 §3 시나리오 단언이 결정 객체 단일 인터페이스에서 모두 표현 가능함을 보장한다. 별도의 "에러 객체" 모델을 만들지 않는다. fail policy는 결정 모델의 _분기 선택_ 으로만 존재하며, 분기 외부의 부수효과 (alert, retry, DLQ)는 audit `evidence`에 데이터로 첨부된다.

## 2. 운영자 escape hatch (break-glass)

자동 결정이 잘못 작동할 때 사람이 강제 개입할 수 있는 경로:

| 작업 | 명령 |
|---|---|
| 카나리 즉시 중단 | `pnpm sim:canary abort` → controller에 weight=0 강제 push, controller는 hold 모드 |
| 카나리 강제 승격 (위험) | `pnpm sim:canary force-promote` → catalog 전이 + v1 stop, audit에 `forcedBy: operator` 기록 |
| controller 자체 정지 | `pnpm sim:canary controller stop` → standby로 전환, 자동 결정 일시 중단 |
| replica 수동 고정 | `pnpm sim:scale set --service approval-api-v2 --replicas 5 --pin` → controller가 pin 동안 scale 결정 skip |

모든 break-glass는 audit-recorder에 `operatorAction: true` + actor identity 첨부. 시나리오 검증과 운영 모드를 같은 레일에서 추적.

abort/force-promote/controller stop/replica pin 네 가지는 자동 결정 모델의 직접적 무력화 채널이므로, 각각 audit 레코드에 자동 결정과 동일한 `decisionId` grammar(`03-identifier-grammar.md` §"decision id")로 기록한다 — 사후 분석 시 사람이 끼어든 사이클과 자동 결정 사이클을 같은 trace 안에서 인접 노드로 본다.

abort는 controller hold 모드와 결합한다. force-promote 후 추가 사이클이 abort를 자동 발동하지 않도록 `holdUntil` 타임스탬프를 audit-recorder에 함께 적재. controller는 hold 만료 전까지 어떤 verdict도 promote/rollback으로 만들지 않는다.

force-promote는 §6 unified version compatibility hard rule을 우회한다는 점에서 위험 수준이 가장 높다. 시나리오 #10이 정상 차단을 검증하므로, force-promote 경로는 시뮬 환경 외에서는 별도 ACL을 요구하도록 향후 사이클에서 막는다 — 첫 사이클에선 audit `forcedBy` 기록만 강제.

replica pin은 controller Pass 2 결정을 SKIP시키는 채널이다. 운영자가 pin을 걸면 그 동안 Pass 2 결정 record는 `verdict="hold"` + `evidence:[{kind:"external", source:"operator-pin", content:{...}}]`로 남는다 — pin 자체가 결정 모델의 evidence로 들어가므로 사후 분석에서 "왜 RPS 폭증에도 scale-up이 안 됐나"를 추적 가능하다. pin 해제 시 다음 사이클부터 Pass 2가 정상 동작.

controller stop은 standby 전환 채널이다. PG advisory lock을 release 하므로 다른 인스턴스가 leader가 될 수 있다. 단일 인스턴스 시뮬 환경에서는 결정이 완전히 멈추는데, 이 상태는 "운영자 의도의 전 시스템 동결"이므로 §3.2 시나리오 격리와는 다른 의미를 가진다 — abort는 카나리 한 건만 멈추고, controller stop은 사이클 자체를 멈춘다.

네 break-glass 명령은 모두 멱등이다. abort를 두 번 실행해도 weight=0 두 번 push가 아니라 두 번째는 no-op이다 (`01-decision-model.md` §6 revision 단조 증가 + idempotent action 원칙). force-promote도 catalog가 이미 전이된 상태에서 다시 호출되면 catalog write를 skip 한다. 운영자가 같은 상황을 두 번 명령해도 상태가 진동하지 않는다.

## 3. 시나리오 검증 매트릭스 (전체 17개)

기존 8 + 신규 9. 다음 표 정확히 포함:

| # | 이름 | 트리거 | 단언 |
|---|---|---|---|
| 1 | login | (기존) | (기존) |
| 2 | project-create | (기존) | (기존) |
| 3 | self-dept-approval | (기존) | (기존) |
| 4 | cross-dept-deny | (기존) | (기존) |
| 5 | three-stage-approval | (기존) | (기존) |
| 6 | delegated-resource | (기존) | (기존) |
| 7 | bitmap-refresh | (기존) | (기존) |
| 8 | pubsub-invalidation | (기존) | (기존) |
| **9** | **canary-happy-promote** | v2 = v1 호환, 트래픽 자연 발생, 30s × N 사이클 | weight 5→25→50→100 단조 증가, 사용자별 sticky 일관성 100%, escape hatch 단언, catalog v3 retired·v4 stable 전이 1회 |
| **10** | **canary-rollback-compatibility** | v2가 outbox에 신규 필수 필드 추가 (호환 깨짐) | 첫 사이클 내 Pass1 rollback (hard), trigger=compatibility, weight=0, audit에 책임 카테고리/신호 기록, v3 stable 유지 |
| **11** | **canary-rollback-audit-spike** | v2가 stage skip → audit critical anomaly 발생 | Pass1 rollback (hard), trigger=auditSafety, weight=0, anomaly 1건 audit-recorder 기록 |
| **12** | **scale-up-load-pressure** | 시나리오 runner가 RPS 폭증 (k6 burst 또는 자체 generator) | Pass2 scale-up trigger=loadPressure, target.v2 += 1, p95 회복 (다음 사이클 PASS) |
| **13** | **scale-blocked-by-db-pool** | dbPool 인위적 압박 (pool=4, 동시 요청 ≥4 지속) | Pass2 verdict=rejected, rejectedBy=resourceHeadroom, replica 변동 0, alert 이벤트 1건 |
| **14** | **read-replica-lag-fallback** | lag-injector가 3000ms 주입 | replicationHealth=WARN, BFF read 라우팅 일시 primary fallback, 사용자 첫 조회 stale 1회 → 다음 polling 정상, controller 결정 trace 기록 |
| **15** | **outbox-multi-dispatcher-lock** | v2 replica=3, 5 이벤트 동시 INSERT | 5 이벤트 = 5 ingest 발행 (정확히), dispatcher별 처리 row 집합 disjoint, 락 경합으로 인한 추가 lag < 100ms |
| **16** | **bitmap-cache-version-fallback** | publisher가 invalidate 메시지 drop, version 진화 발생 | TTL 만료 또는 version-check 시점에 refresh 자동 발동, denyRate baseline 유지, 회복 시간 ≤ TTL+1cycle |
| **17** | **pass-priority-canary-blocks-scale** | 카나리 진행 중 RPS 폭증 동시 발생 | Pass1 hold (안정화 미충족), Pass2 SKIP, scale 결정 0건, audit에 SKIP 사유 기록 |

각 시나리오의 단언은 `assert(decision.verdict === ...)` + `assert(decision.triggerCategory === ...)` 같은 **결정 객체 자체에 대한 단언**으로 작성 → 결정 모델이 시뮬 검증 단위가 됨.

`decision.verdict` / `decision.triggerCategory` / `decision.categoryVerdicts` / `decision.action` 네 필드가 단언의 1차 입력이며, 이 필드의 정의는 `01-decision-model.md` §1 `SafetyDecision` / `ResourceDecision` 인터페이스를 그대로 인용한다 — 시나리오 코드가 별도의 검증 도메인을 만들지 않는다. 보조 단언 (replica 수, gateway routing weight, audit append count)은 결정 객체 단언이 통과한 뒤 부수효과를 확인하는 보강으로만 사용한다.

각 카테고리/검증 축 커버리지 표 추가:

| 검증 축 | 커버 시나리오 |
|---|---|
| 카나리 happy + escape | 9 |
| §6 unified version (compatibility) | 10 |
| Hard rollback (audit) | 11 |
| 스케일 happy | 12 |
| 자원 한계 신호 | 13 |
| Read replica + lag | 14 |
| Outbox 락 (#1) | 15 |
| Bitmap 캐시 회복 (#2) | 16 |
| 통합 결정 모델 (Pass 우선순위) | 17 |

커버리지 표는 신규 9개 시나리오가 한 축 = 한 시나리오로 1:1 대응함을 보인다. 두 축이 한 시나리오에 섞이면 단언이 두 가지 실패 사유를 모두 만족시켜야 해서 결정 모델 검증의 신호가 흐려진다 — 시나리오 #17만 의도적으로 두 축(카나리 hold + scale SKIP)을 동시에 검증한다. 이는 Pass 우선순위 자체가 검증 대상이기 때문이다 (`01-decision-model.md` §4 "Pass 1이 promote/stable이 아니면 SKIP" 조항).

**의도적으로 뺀 시나리오** (첫 사이클 범위 외):
- canary-decision-quality-rollback — #10 패턴과 거의 동일, 분리 가치 작음. #10에 흡수.
- canary-hold-low-confidence — corner case. 첫 사이클에선 #17이 hold 케이스 충분히 검증.
- scale-down-stability — scale-down 자체는 scale-up의 역순. 첫 사이클에선 #12 검증 안에서 cool-down 이후 scale-down 확인으로 흡수.

뺀 세 시나리오는 모두 "결정 모델 분기 자체는 같고, 트리거 신호만 다른" 케이스다. 첫 사이클 목표는 신호 → 카테고리 verdict → Pass verdict 변환의 정확성을 보이는 것이고, 같은 분기를 다른 신호로 두 번 검증해도 결정 모델 신뢰 증가가 작다. 다음 사이클에서 본 구현의 generality (모든 카테고리·신호 조합)을 회귀 테스트하고자 할 때 분리한다.

### 3.1 시나리오 단언 작성 패턴

시나리오 9 happy promote 단언 예시 (압축):

```ts
// 사이클 별 결정 객체 시퀀스 검증
const decisions = await audit.queryDecisions({ cycleId: in(cycleIds) });
const safety = decisions.filter(d => d.pass === "safety");

assert.deepEqual(
  safety.filter(d => d.verdict === "promote").map(d => d.action),
  [
    { kind: "weight-update", weight: 5,   revision: 1 },
    { kind: "weight-update", weight: 25,  revision: 2 },
    { kind: "weight-update", weight: 50,  revision: 3 },
    { kind: "weight-update", weight: 100, revision: 4 },
  ],
);

// catalog 전이 단언
const catalog = await catalogStore.getStates();
assert.equal(catalog.v3, "retired");
assert.equal(catalog.v4, "stable");
```

시나리오 10 hard rollback 단언 예시 (압축):

```ts
const safety = await audit.queryFirstDecision({ pass: "safety" });
assert.equal(safety.verdict, "rollback");
assert.equal(safety.triggerCategory, "compatibility");
assert.equal(safety.categoryVerdicts.compatibility, "FAIL");
assert.deepEqual(safety.action, { kind: "weight-update", weight: 0, revision: 1 });
```

세 가지 원칙. (a) 단언은 결정 객체 필드를 직접 비교한다 — 부수효과(gateway weight, replica count)는 결정 record가 옳다는 전제 위에서만 검증한다. (b) `cycleId` / `decisionId`는 grammar 검증과 함께 비교 — `03-identifier-grammar.md`의 round-trip parser로 파싱 가능한지까지 본다. (c) audit append-only 보장 — 같은 cycleId의 결정 row가 정확히 1건임을 매 시나리오 종료 후 점검 (`01-decision-model.md` §6 `(cycleId, pass)` unique 제약).

### 3.2 시나리오 환경 격리

17개 시나리오는 모두 `pnpm sim:e2e` 단일 진입점에서 실행한다. 각 시나리오는 독립 docker compose project name을 사용해 다른 시나리오의 PG/gateway/controller 인스턴스와 분리된다. catalog state는 시나리오 시작 시 초기화 (`v3=stable, v4=undeployed`). audit-recorder-store도 시나리오별로 fresh 한 in-memory + ephemeral PG 스키마를 사용해 시나리오 간 cross-talk이 발생하지 않는다.

`SIM_CONTROLLER_CYCLE_MS`는 시나리오별로 override 가능하다. 시나리오 9는 dwellTime/cooldown 단축을 위해 cycle=2s로 단축하고, 시나리오 14는 lag observation 안정화를 위해 cycle=10s로 둔다. 시나리오 코드는 cycle override를 그대로 audit `evidence` 안에 기록 — 사후 분석 시 어떤 cycle 길이에서 결정이 났는지 식별 가능.

시나리오는 "fixture seed → trigger 주입 → 사이클 N회 대기 → audit 단언" 4단계로 정형화된다. fixture seed는 `pnpm sim:fixture:reset`으로 catalog/PG/audit 스키마를 동시에 초기화하며, trigger 주입은 시나리오별 helper (`injectLag`, `burstLoad`, `dropInvalidate` 등)로 구현한다. 사이클 대기는 `await waitForCycles(n)` — controller 사이클 완료를 audit-recorder write 이벤트로 감지한다 (sleep polling 금지, `01-decision-model.md` §5 t=3s/4s 결정 write 시점을 신호로 사용).

### 3.3 시나리오와 fail policy의 매핑

§3 시나리오 매트릭스는 §1 fail policy 매트릭스의 행을 다음과 같이 커버한다.

| Fail policy 행 | 검증 시나리오 |
|---|---|
| metrics scrape 실패 | (인프라 검사 + 결정 모델 단위 테스트) |
| gateway routing push 실패 | 시나리오 9 — escape hatch abort 경로에 retry 검증 흡수 |
| compose --scale 실패 | 시나리오 12 — scale-up 직후 외부 force kill로 검증 (다음 사이클 재시도 단언) |
| controller advisory lock | (단위 테스트, 시나리오로는 비표현 — §4) |
| gateway routing 부재 cold start | 시나리오 9 bootstrap wait 단언 |
| bitmap cache deny | 시나리오 16 |
| outbox dispatcher 실패 | 시나리오 15 (정상 retry) + 별도 운영 절차 (DLQ) |
| read replica 연결 실패 | 시나리오 14 fallback 경로 |
| replication lag FAIL | 시나리오 14 lag injection |
| schemaCompatRate < 1.0 | 시나리오 10 |
| audit critical anomaly | 시나리오 11 |
| catalog 전이 실패 freeze | 시나리오 9 음의 케이스 — catalog write를 인위적 실패시켜 freeze 단언 (확장: 9b) |

`01-decision-model.md` §1 결정 객체 필드를 통해 모든 fail 분기가 단일 단언 인터페이스로 환원되므로, 시나리오 단언이 §1 fail policy 표를 직접 검증하는 도구가 된다 — 표와 시나리오 사이의 cross-reference가 결정 객체 매핑(§1.1)을 매개로 자동화 가능하다.

## 4. 인프라 검증 (시나리오 외)

시나리오로 표현하기 부적합한 항목 별도 검사:

| 검증 | 도구 |
|---|---|
| identifier-grammar 라운드트립 | `pnpm --filter @qa-sdk-sim/identifier-grammar test` (vitest property) |
| identifier-gate CI 통과 | `pnpm sim:lint:identifiers` |
| catalog ↔ compose ↔ env 4-way 정합성 | `pnpm sim:catalog:validate` |
| host.docker.internal 미사용 | `grep` 기반 negative lint (CI gate) |
| BFF 모듈에서 write DataSource import 없음 | ESLint custom rule |
| read DataSource로 INSERT/UPDATE/DELETE 호출 없음 | ESLint custom rule + 런타임 PG read-only 거부 |

인프라 검증은 시뮬 시나리오 결과와 무관하게 항상 실행한다. CI에서 시나리오는 매트릭스 job, 인프라 검증은 단일 job으로 분리하면 시나리오 실패와 인프라 정합성 실패를 빠르게 구분할 수 있다 — 17개 시나리오 중 다수가 같은 인프라 정합성 위반으로 실패하는 패턴을 막는다.

identifier-grammar round-trip은 vitest property test이며 `03-identifier-grammar.md`의 모든 grammar (`decision id`, `cycle id`, `label key`, etc.)에 대해 generator → parser → generator → parser 동치성을 보인다. property test가 실패한 grammar는 시나리오 단언(§3.1 (b))까지 연쇄로 실패하므로, 시나리오 실행 전 인프라 gate 단계에서 차단한다.

`pnpm sim:catalog:validate`는 catalog (services × prefixes × env requirements) ↔ docker-compose.yml service 정의 ↔ `.env.example` 변수 ↔ controller-config.yaml 임계 사이의 4-way 일관성을 본다. 한 쪽에만 새 서비스가 추가되면 시나리오는 다른 이유로 실패하는데 (예: 컨테이너가 안 떠서), 이 검증이 실패 사유를 끌어올린다.

`host.docker.internal` 검출은 grep negative lint이다. 시뮬은 docker compose 내부 네트워크로만 통신해야 하므로, 어떤 모듈도 호스트 루프백을 통한 우회 경로를 가지면 안 된다. CI gate에서 `grep -r host.docker.internal packages/sim apps/sim` → 매치 시 fail.

BFF / read-only DataSource ESLint rule은 CQRS 분리를 정적으로 강제한다. 런타임 read-only 거부는 PostgreSQL `default_transaction_read_only=on` 세션으로 보강 — 정적 lint를 우회한 import도 런타임에서 차단한다. 두 layer 모두 fail-closed (5xx) 반환이므로 시나리오 검증 #14에서 read 라우팅이 fallback할 때도 INSERT/UPDATE 시도가 없음을 같이 본다.

§4 인프라 검사는 §3 시나리오 검증의 _전제_ 다 — grammar/catalog/네트워크 전제가 깨진 상태에서는 시나리오 단언이 무엇을 의미하는지 정의되지 않는다. 따라서 CI는 인프라 gate → 시나리오 매트릭스 순서로 실행하며, 인프라 gate 실패 시 시나리오 매트릭스를 skip 한다.

### 4.1 인프라 검사가 다루는 결정 모델 외부 정합성

§4 항목은 모두 결정 객체에 진입하기 전에 보장되어야 하는 정합성이다. 다음 표가 각 검사의 도메인을 명시한다.

| 검사 | 도메인 | 깨졌을 때의 증상 |
|---|---|---|
| identifier-grammar 라운드트립 | decisionId/cycleId/labelKey 표현 | 시나리오 단언이 `decisionId` 비교에서 false negative — 실제 record는 옳은데 grammar가 흔들려 파싱 실패 |
| identifier-gate CI | 좌표·prefix·controller config 식별자 collision | 두 서비스가 같은 prefix를 주장 → audit-recorder write 충돌 |
| catalog 4-way 정합성 | catalog/compose/env/yaml 일관성 | 컨테이너 미기동 / env 미주입 → 시나리오가 카나리 결정 이전 단계에서 실패 |
| host.docker.internal grep | 네트워크 토폴로지 | 호스트 우회 경로가 controller→gateway 측정을 왜곡 (실제 latency 측정과 어긋남) |
| BFF write import lint | CQRS 분리 | BFF에서 INSERT 발생 시 read replica 단언 #14가 의도와 다른 path로 작동 |
| read DataSource 런타임 read-only | 런타임 보강 | lint 우회를 PG `default_transaction_read_only`로 차단 |

이 표는 §4 인프라 검사가 "코드 품질" 일반론이 아니라 본 사이클의 시나리오·결정 모델이 의미를 가지기 위한 _필요조건_ 임을 명시한다. 새 시나리오 추가 시 새 인프라 전제가 등장하면 §4에 검사를 함께 추가한다 (§5 매트릭스 갱신 절차).

### 4.2 lint 누락 검출 정책

`@FailPolicy("...")` 데코레이터 lint, identifier-grammar lint, BFF/read DataSource lint 세 가지는 "필요한 곳에 누락된" 것을 잡는 negative lint다. 단순 grep으로는 "있어야 하는데 없는" 것을 검출하기 어려우므로, 각 lint는 다음 패턴을 사용한다.

- `@FailPolicy` lint — fail policy 매트릭스 §1 표의 결정 지점에 해당하는 함수/클래스를 식별 (이름 규칙 + 호출 사이트 매칭) → 데코레이터 미부착 시 error.
- identifier-grammar lint — `decisionId` / `cycleId` 타입 변수를 사용하는 모든 사이트에서 `parseDecisionId(...)` / `parseCycleId(...)` 통과를 정적으로 보장.
- BFF write import lint — BFF 디렉터리(`apps/bff/**` 또는 `packages/sim-bff/**`)에서 write DataSource 모듈을 import 하는 statement를 매칭 → error. read DataSource 모듈에서 `Repository#save` 등 write 메서드 호출 호출 → error.

세 lint는 모두 CI gate에서 `--max-warnings 0` 강제. 시나리오 매트릭스 실행 전에 차단되므로, lint 회귀가 시나리오 실패로 위장되는 시간을 줄인다.

## 5. 매트릭스 갱신 절차

§1 fail policy / §3 시나리오 매트릭스는 다음 사이클 변경에서 다음 절차로 갱신한다.

1. 결정 지점 추가 — `01-decision-model.md` §1 결정 객체에 새 verdict/category가 들어가면 §1 fail policy 표에도 같은 결정 지점을 행으로 추가한다. fail 방향은 fail-closed/fail-open 중 어느 쪽인지 PR 본문에 근거를 명시한다.
2. 시나리오 추가 — 새 시나리오는 (a) 한 검증 축을 단독 커버하는지 (#9~#16 패턴) (b) 결정 모델 분기 자체를 검증하는지 (#17 패턴) 중 하나여야 한다. "신호 차이만 다른" 케이스는 §3 "의도적으로 뺀 시나리오" 정책에 따라 거부한다.
3. 인프라 검사 추가 — 시나리오로 표현 가능한 항목은 시나리오로, 결정 모델 외부의 정적 정합성은 §4 인프라 검사로 분리한다. 한 항목이 양쪽에 나타나면 시나리오 쪽을 우선하고 §4에서 제거한다.
4. fail policy 데코레이터 갱신 — §1 표 변경은 코드 `@FailPolicy("...")` 데코레이터 추가/변경을 동반한다. lint가 표와 코드의 누락/불일치를 잡는다.

이 절차는 매트릭스가 결정 모델·grammar·인프라 셋과 동시에 진화하도록 강제한다. 매트릭스만 추가하고 코드/lint를 못 따라가는 drift를 방지한다.

### 5.1 cross-document 동기화 책임

본 문서 §1·§3·§4는 다음 문서와 강한 종속을 가진다.

| 본 문서 항목 | 종속 문서 | 동기화 책임 |
|---|---|---|
| §1 fail policy 매트릭스 | `01-decision-model.md` §1 결정 객체 | 결정 객체 필드 추가/변경 시 §1 표 행과 §1.1 매핑 표 동시 갱신 |
| §1 catalog freeze | `02-canary-topology.md` §"catalog 상태 전이" | catalog state machine 변경 시 freeze 상태 명세 동기 |
| §3 단언 패턴 | `03-identifier-grammar.md` §"decision id"/"cycle id" | grammar 변경 시 §3.1 round-trip 단언 갱신 |
| §3 단언 결정 객체 인용 | `01-decision-model.md` §1 인터페이스 | TypeScript 인터페이스 변경 시 단언 코드 컴파일러가 1차 검출, 시나리오 fixture는 수동 갱신 |
| §4 인프라 검사 | `02-canary-topology.md`/compose 정의 | 새 서비스/컨테이너 추가 시 catalog 4-way 정합성 검사 갱신 |

cross-document 동기화는 단방향이 아니다. 예를 들어 `01-decision-model.md` §3 의사 코드의 분기 순서가 바뀌면 본 문서 §3 시나리오 #17 (Pass 우선순위)의 단언 의미도 바뀐다. PR 시 본 문서·결정 모델·grammar·토폴로지 네 문서를 한 PR에 묶도록 권장 — 분리 PR 시 reviewer가 cross-document 일관성을 수동 점검해야 한다.

### 5.2 사이클 외 회귀 점검

본 문서 매트릭스는 첫 사이클 범위로 정의된다. 다음 사이클에서 다음 항목을 회귀 점검한다.

- 시나리오 #9~#17이 다음 사이클의 결정 모델 변경 후에도 동일 단언으로 통과하는지
- §1 fail policy 매트릭스에 추가된 결정 지점이 모두 시나리오 또는 단위 테스트로 커버되는지 (§3.3 매핑 표가 비어 있지 않은지)
- §4 인프라 검사가 새 서비스 추가에 대응했는지 (catalog 4-way 정합성, BFF/read DataSource 디렉터리 구조)
- §3 "의도적으로 뺀 시나리오" 3건이 다음 사이클에 추가될 때 #9/#11/#12 시나리오와 단언이 중복되지 않는지

회귀 점검은 PR 본문에 체크리스트로 첨부하고, 본 문서에 새 매트릭스 행을 추가하는 PR은 위 항목 모두에 대해 명시적 OK/NA를 표기한다. 매트릭스가 늘어나면서 단언이 약화되는 drift를 방지하는 절차다.

### 5.3 매트릭스의 이름 규칙

§3 시나리오는 `<도메인>-<상태>-<결과>` 패턴으로 이름을 짓는다.

- 도메인 — `canary` / `scale` / `read-replica` / `outbox` / `bitmap-cache` / `pass-priority` 등 본 사이클에서 검증하는 큰 단위.
- 상태 — `happy` / `rollback` / `blocked` / `lag` / `multi-dispatcher-lock` / `version-fallback` 등 트리거하는 시스템 상태.
- 결과 — `promote` / `compatibility` / `audit-spike` / `load-pressure` / `db-pool` / `fallback` 등 단언이 검증하는 verdict.

이 패턴은 시나리오 이름 자체가 매트릭스 §1 fail policy 행과 §3.3 매핑 표를 잇는 식별자가 되도록 한다 — 새 시나리오 이름이 패턴에 안 맞으면 §3.3 매핑 표 작성이 어려워지고, 그 단계에서 patterning 부재가 드러난다.

`03-identifier-grammar.md` §"label key"의 시나리오 라벨 grammar는 위 패턴을 정규식으로 강제한다. 시나리오 코드의 `describe(...)` 라벨도 같은 grammar를 통과해야 하므로, identifier-grammar lint가 새 시나리오의 이름 일관성까지 보장한다.

## 6. 시나리오 단언 실패 시 분류 흐름

시나리오가 실패했을 때 운영자/개발자는 다음 분류 트리에 따라 원인을 좁힌다.

```
시나리오 단언 실패
  ├─ §4 인프라 검사 실패 동시 발생? 
  │     ├─ Yes → 인프라 정합성 문제 (catalog/grammar/네트워크)
  │     └─ No  → 다음 단계
  ├─ audit-recorder에 결정 record가 있나?
  │     ├─ No  → controller cycle이 안 돌았다 (advisory lock / scrape 실패 / 컨테이너 미기동)
  │     └─ Yes → 다음 단계
  ├─ 결정 record의 categoryVerdicts가 단언과 일치하나?
  │     ├─ No  → 신호 측정 문제 (metrics scrape / insights endpoint / audit anomaly 분류)
  │     └─ Yes → 다음 단계
  ├─ verdict 분기가 단언과 일치하나?
  │     ├─ No  → 결정 모델 §3/§4 의사 코드 회귀
  │     └─ Yes → 다음 단계
  └─ action 부수효과 (gateway weight / replica count) 가 단언과 일치하나?
        ├─ No  → action 실행 채널 회귀 (gateway routing push, compose --scale)
        └─ Yes → 단언 자체의 과/소 제약
```

이 트리는 결정 모델 단계 (cycle 실행 → 신호 측정 → categoryVerdict → verdict → action)와 정확히 같은 순서로 좁힌다. 한 단계 실패가 다음 단계 실패를 가리지 않도록 audit `evidence` 안에 각 단계의 raw 신호값을 남기는 §7 (`01-decision-model.md`) 규칙이 핵심이다 — evidence가 비면 트리에서 다음 단계로 못 내려간다.

분류 트리의 각 분기는 본 문서·결정 모델·토폴로지의 _다른_ 섹션을 가리킨다. 시나리오 실패 디버깅이 단일 문서 안에서 끝나지 않고 cross-document 추적을 강제하는 형태인데, 이는 본 사이클이 의도한 "결정 모델 = 검증 단위" 구조의 자연스러운 결과다.

### 6.1 분류 트리의 도구 매핑

분류 트리 각 단계에서 사용하는 진단 명령은 다음과 같다.

| 단계 | 명령 | 산출 |
|---|---|---|
| 인프라 검사 동시 실패 확인 | `pnpm sim:gate` | identifier/catalog/grammar lint 결과 요약 |
| 결정 record 존재 확인 | `pnpm sim:audit query --cycle-id <id>` | audit-recorder의 cycle별 결정 row |
| categoryVerdicts 비교 | `pnpm sim:audit explain --decision-id <id>` | evidence 배열 + 신호값 + 임계 비교 |
| verdict 분기 회귀 | `pnpm --filter @qa-sdk-sim/controller test --grep <branch>` | 결정 모델 단위 테스트 |
| action 부수효과 회귀 | `pnpm sim:gateway dump-routing` / `docker compose ps` | gateway/compose 실제 상태 |

각 명령은 identifier-grammar 라운드트립과 audit `evidence` raw 값에 기반하므로, 시나리오 실패가 어떤 raw 신호 차이에서 비롯됐는지를 결정 객체 단일 인터페이스로 추적한다. 별도의 디버깅용 데이터 스키마를 만들지 않는다.

### 6.2 단언 실패와 fail policy 매트릭스의 관계

단언이 의도와 다른 verdict 분기로 갈 때, fail policy 매트릭스 §1 위반이 동시 발생하는지가 중요한 분리 기준이다. 두 가지 패턴이 있다.

- 매트릭스 위반 _없음_ + 단언 실패 — 결정 모델 분기 회귀, 신호 측정 회귀, 또는 단언 과/소 제약. §3.1 단언 작성 패턴 (a)/(b)/(c) 위반을 점검한다.
- 매트릭스 위반 _발생_ + 단언 실패 — 매트릭스 위반이 원인일 가능성이 높다. fail-closed가 fail-open으로 잘못 동작하면 (예: scrape 실패에도 promote가 일어나면) 시나리오 #10·#11이 동시 회귀로 보인다. 이 경우 결정 모델 자체 코드보다 fail policy 데코레이터 누락 또는 lint 회귀를 먼저 확인한다.

두 패턴 분리는 first-pass 회귀 분석에서 가장 큰 시간 절약이다. fail policy 매트릭스 위반 여부는 audit-recorder의 `evidence[].source`에 `fail-policy:violation` 표시가 들어가는지로 식별 — `@FailPolicy` 데코레이터가 violation 시점에 자동으로 evidence를 첨부한다. 운영자는 매번 fail policy 표를 일일이 확인하지 않아도 evidence flag만 보면 패턴을 분류할 수 있다.

## 7. 매트릭스의 한계와 다음 사이클 후보

본 매트릭스는 첫 사이클의 카나리·스케일링 결정 모델 검증을 목표로 한다. 다음 항목은 의도적으로 본 사이클 범위 밖에 두고, 다음 사이클에서 매트릭스를 확장한다.

- **다중 controller 클러스터** — 현재는 active/standby 2-node를 advisory lock으로 보장한다. 3-node 이상에서의 leader election, split-brain 회복은 별도 시나리오 군이 필요하다.
- **catalog 다중 카나리** — v3 → v4 한 번의 카나리만 검증한다. v3 → v4와 v4 → v5가 겹치는 시나리오는 단언이 복잡해져서 별도 사이클로 분리한다.
- **시뮬-스테이징 격차** — RPS, replication lag, dbPool 임계는 시뮬 환경에서만 적용된다. 스테이징/프로덕션 임계 보정은 controller-config.yaml override로 표현되지만, 본 매트릭스는 임계 자체의 검증을 다루지 않는다.
- **외부 trigger 통합** — Argo Rollouts, Flagger 같은 외부 카나리 컨트롤러와의 inter-op은 본 사이클의 결정 모델 정의 외부 영역이다.
- **DLQ 회복 자동화** — outbox DLQ로 격리된 이벤트의 재처리는 운영자 수동 절차로 둔다. 자동 회복 시도는 retry 무한 루프 위험이 있어 별도 사이클에서 정책을 정의한다.

이 한계를 명시하는 이유는 본 매트릭스가 모든 카나리·스케일링 회귀를 잡는다고 오해하지 않게 하기 위함이다. 본 사이클은 "결정 모델이 의도대로 분기하고, 부수효과가 의도대로 적용되는가"를 검증하며, 그 외 운영 회복 절차 / 다중 노드 분산 합의 / 외부 시스템 통합은 다음 사이클 매트릭스에서 다룬다.

매트릭스 한계를 줄이는 방향과 매트릭스 깊이를 늘리는 방향은 trade-off다. 본 사이클은 17개 시나리오로 결정 모델의 한 번 수직 통과를 보이는 것을 우선했다. 다음 사이클에서 분산 합의·외부 통합을 추가하면 시나리오 수가 30개 안팎으로 늘어날 가능성이 높고, 그 시점에서 §3.3 / §6.2 같은 cross-cut 매핑 표가 매트릭스 통합 도구로 본격적으로 쓰인다.
