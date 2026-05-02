# Server-side Admin Endpoints Design

> 시나리오 9~17 e2e PASS prerequisite 충족을 위해 sim-canary-controller / sim-gateway / sim-auth-api / sim-approval-api에 admin endpoint 16종 + 1 actor 변경 + FaultKind enum 2종 확장.

## 1. 목적과 범위

**목적**
- Plan E Stage 11의 12개 sim-handles factory가 호출하는 server-side endpoint를 구현해 enterprise-pm canary cycle DoD #2를 OK로 전환.
- 시나리오 9~17의 e2e 단언이 통과 가능한 server-side data backbone 제공.

**범위 안**
- 4 영역 16 endpoint (controller 11 + gateway 1 + auth-api 2 + approval-api 2).
- controller `ActionExecutor`가 gateway `RoutingPushSchema` 형태로 routing payload 변환 (#21).
- controller `FaultKind` enum 2종 확장: `pubsub-invalidate-drop` (시나리오 16), `perf-warn` (시나리오 17).
- 신규 공유 패키지 2개:
  - `packages/sim-internal-network/` — internal IP 검증 (NestJS Guard + Hono middleware).
  - `packages/sim-decision-view/` — controller 결정 객체 view DTO SSOT (controller producer + sim-handles consumer 공유).

**범위 밖 (별도 sub-project)**
- audit-recorder `/operator-actions` endpoint (break-glass CLI prerequisite, e2e와 무관).
- catalog HTTP endpoint (sim-canary force-promote prerequisite).
- 모노레포 build hygiene (#9, #15) — spec-core 빌드 fix 등.
- plan literal 잔여 cleanup (#22, #23, #25).
- 운영급 인증 hardening (admin token, mTLS) — 본 사이클은 internal IP 검증만.

## 2. 토폴로지 — 4 영역 → 4 stage

```
controller (5300)         11 endpoint   (Stage 1)
  ├─ GET  /v1/decisions               — audit-fetcher.queryDecisions
  ├─ GET  /v1/decisions/first         — audit-fetcher.queryFirstDecision
  ├─ GET  /v1/alerts/count            — audit-fetcher.countAlerts
  ├─ GET  /v1/cycles/recent           — wait-for-cycles
  ├─ GET  /v1/audit/trace             — audit-fetcher (composite trace)
  ├─ GET  /v1/catalog/states          — catalog-store.getStates
  ├─ POST /admin/fault/{kind}         — fault-injector (6 kind, 2 enum 확장 포함)
  ├─ GET  /admin/compose/replicas     — compose-handle.getReplicas (docker proxy)
  ├─ GET  /admin/scale/pin            — sim-scale CLI prerequisite
  ├─ POST /admin/scale/pin            — sim-scale --pin/--unpin
  └─ POST /admin/scale/replicas       — sim-scale --replicas

gateway (8888)            1 endpoint    (Stage 2)
  └─ GET  /admin/routing/sticky-consistency — gateway-sticky-consistency

auth-api (4400)           2 endpoint    (Stage 3)
  ├─ POST /admin/bitmap/bump-version   — bitmap-version-mutator
  └─ GET  /admin/bitmap/version        — bitmap-version-check

approval-api (4600)       2 endpoint    (Stage 4)
  ├─ POST /admin/outbox/insert         — outbox-client.insertEvents
  └─ POST /admin/outbox/dispatch       — outbox-client.waitForDispatch
```

**Stage 1이 critical path**: 모든 시나리오 9~17이 audit-fetcher + wait-for-cycles에 의존 (controller endpoint). Stage 2/3/4는 Stage 1 완료 후 병렬 가능 (sim-handles fetchImpl 주입으로 단위 테스트는 mutual independent).

## 3. 인증 — internal IP 검증

`packages/sim-internal-network/` 신규 패키지:

```
src/
├── is-internal-ip.ts        # gateway에서 추출한 isInternalIp(ip): boolean
├── nestjs-guard.ts          # NestJS @Guard (controller/auth-api/approval-api용)
├── hono-middleware.ts       # Hono middleware (gateway용 — 기존 코드 wrapper)
└── index.ts
```

- 외부 IP 요청 → **404 silent** (gateway escape hatch와 동일 동작 — 정보 누출 방지).
- 내부 docker network (172.x.x.x) 또는 localhost만 통과.
- 운영급 hardening (admin token, mTLS)은 별도 sub-project.

## 4. 응답 shape — view DTO 분리

controller internal `SafetyDecisionRecord` (timestamps, evidence, internal IDs 풍부) ≠ sim-handles이 기대하는 shape. **`packages/sim-decision-view/`** 신규 패키지에 view DTO를 SSOT로 정의:

```
src/
├── safety-decision-view.ts        # SafetyDecisionRecordView 타입
├── resource-decision-view.ts      # ResourceDecisionRecordView
├── alert-event-view.ts            # AlertEventView
├── audit-trace-view.ts            # 합성 trace view
├── conversion.ts                  # internal → view 변환 함수 (controller side에서 사용)
└── index.ts
```

producer(controller)와 consumer(scenarios/sim-handles) 모두 `sim-decision-view`에서 import → typecheck로 drift 차단.

```ts
// example
export interface SafetyDecisionRecordView {
  cycleId: string;
  decisionId: string;
  pass: "safety";
  verdict: SafetyVerdict;
  triggerCategory?: SafetyCategory;
  triggerSignals?: string[];
  cycleAt: string;
  // evidence/internal 필드는 노출 안 함
}

export function toSafetyDecisionView(internal: SafetyDecisionRecord): SafetyDecisionRecordView { ... }
```

## 5. 데이터 backbone — controller 자체 ring buffer

```ts
// canary-controller/src/decision/decision-ring-buffer.ts (신규)
class DecisionRingBuffer {
  private safetyRing: SafetyDecisionRecord[] = [];
  private resourceRing: ResourceDecisionRecord[] = [];
  private alertEvents: AlertEventRecord[] = [];
  private maxSize = 100;

  appendSafety(record): void
  appendResource(record): void
  appendAlert(event): void
  queryDecisions(filter): SafetyDecisionRecord[] | ResourceDecisionRecord[]
  queryFirst(filter): SafetyDecisionRecord | ResourceDecisionRecord | null
  recentCycleIds(limit): string[]
  countAlerts(filter): number
  trace(cycleId): TraceView | null
}
```

- Stage 9의 기존 `history` 변수를 ring buffer로 통합 — Pass 1 soft rollback 윈도우와 endpoint query 둘 다 같은 SSOT 사용.
- `CycleSchedulerService`가 매 사이클 끝에 `ringBuffer.append*()` 호출.
- restart 시 history 손실 — e2e 시나리오는 짧은 시간이라 무관, 24h soak는 별도 운영 결정.

## 6. controller endpoint 11종 응답 shape

```ts
// GET /v1/decisions?pass=safety&verdict=rollback&since=01HXX...&limit=10
{
  items: SafetyDecisionRecordView[],
  cursor?: string
}

// GET /v1/decisions/first?pass=resource&verdict=rejected
{ item: ResourceDecisionRecordView | null }

// GET /v1/cycles/recent?limit=10
{ cycleIds: string[], total: number }

// GET /v1/alerts/count?kind=scale-up-rejected&since=01HXX...
{ count: number, kind: string }

// GET /v1/audit/trace?cycleId=01HXX...
{ trace: {
    cycleId: string,
    cycleAt: string,
    decisions: { safety?: SafetyDecisionRecordView, resource?: ResourceDecisionRecordView },
    events: AlertEventView[]
  } }

// GET /v1/catalog/states?prefix=sim.svc.approval
{ stable: VersionTag, candidate: VersionTag | null, retired: VersionTag[] }

// POST /admin/fault/{kind}
// body: { enabled: boolean, params?: {...}, target?: string }
{ kind, active, params?, target? }

// GET /admin/compose/replicas
{ services: { "sim-approval-api-v1": 1, "sim-approval-api-v2": 1, ... } }

// GET /admin/scale/pin
{ pins: { "sim-approval-api-v2": 3 } }

// POST /admin/scale/pin
// body: { service, replicas?: number }   // replicas 미명시 = unpin
{ service, replicas: number | null }

// POST /admin/scale/replicas
// body: { service, replicas, source: "operator" }
{ service, prevReplicas, newReplicas }
```

## 7. controller actor #21 — RoutingPushSchema 변환

기존 (Stage 9 plan literal):
```ts
fetch(`${gatewayUrl}/admin/routing`, {
  method: "POST",
  body: JSON.stringify({ revision: 1, weight: 25 })
})
```

신규 (gateway `RoutingPushSchema` 정합):
```ts
const topology = await catalog.getCurrentTopology(`sim.svc.${serviceName}`);
const stableUpstream = portRegistry.getUpstream(`sim-${serviceName}-v${topology.stable.value}`);
const candidateUpstream = topology.candidate
  ? portRegistry.getUpstream(`sim-${serviceName}-v${topology.candidate.value}`)
  : null;

fetch(`${gatewayUrl}/admin/routing`, {
  method: "POST",
  body: JSON.stringify({
    services: {
      [serviceName]: {
        revision,
        stable: { version: buildVersionTag(topology.stable), upstream: stableUpstream },
        candidate: candidateUpstream
          ? { version: buildVersionTag(topology.candidate), upstream: candidateUpstream }
          : null,
        weight,
        stickyKey: "user_id",
      },
    },
  })
})
```

- `RoutingPushSchema` 타입은 gateway 패키지에서 export → controller가 import해서 typecheck 강제.
- catalog `getCurrentTopology` + `portRegistry`는 controller 모듈에 이미 wired.

## 8. FaultKind enum 2종 확장

```ts
// canary-controller/src/fault/types.ts
export const FAULT_KINDS = [
  "schema-break",
  "audit-anomaly",
  "replication-lag",
  "db-pool-pressure",
  "pubsub-invalidate-drop",  // NEW — 시나리오 16 (bitmap-cache-version-fallback)
  "perf-warn",                // NEW — 시나리오 17 (pass-priority-canary-blocks-scale)
] as const;
```

신규 fault class 2개 (기존 4 fault 패턴 동일):

### `pubsub-invalidate-drop` (시나리오 16)

- 효과: bitmap pub/sub `bitmap.invalidate` 채널 메시지를 controller proxy가 일정 비율 drop.
- body params: `{ dropRate: number /* 0~1 */ }`.
- 시나리오 16에서 `dropRate: 1.0` → TTL 만료 + version-check 시점에 fallthrough → refresh 검증.
- 위치: `canary-controller/src/fault/pubsub-invalidate-drop.ts`.

### `perf-warn` (시나리오 17)

- 효과: perf 카테고리에 인위적 WARN 신호 주입 → Pass 1이 hold 상태 (rollback 아님).
- body params: `{ severity: "warn" }`.
- 시나리오 17에서 RPS 폭증 + perf-warn 동시 발생 → Pass 1 hold → Pass 2 SKIP 검증.
- 위치: `canary-controller/src/fault/perf-warn.ts`.

## 9. Stage 2~4 endpoint 5종 응답 shape

### Stage 2 — gateway

```ts
// GET /admin/routing/sticky-consistency
{
  ratio: number,             // 0~1, 1 = 모든 user가 단일 version으로만 라우팅됨
  sample: number,            // 측정 사용한 decision 수
  inconsistentUsers: number, // 두 버전 모두 본 user 수
  window: { from: ISO, to: ISO }
}
```

구현: gateway routing decision을 메모리 ring buffer로 기록 (`{ user_id, version, at }`) + endpoint query 시 ratio 계산.

### Stage 3 — auth-api

```ts
// POST /admin/bitmap/bump-version
// body: { prefix?: string }   // default "sim.bitmap"
{ prefix, oldVersion: VersionTag, newVersion: VersionTag, bumpedAt: ISO }

// GET /admin/bitmap/version?prefix=sim.bitmap
{ prefix, version: VersionTag }
```

구현: auth-api catalog의 prefix version state를 stable → retired + 새 stable 추가. 시뮬용 monotonic counter 증가.

### Stage 4 — approval-api

```ts
// POST /admin/outbox/insert
// body: { events: OutboxEventInput[] }
{ inserted: number, idempotencyKeys: string[], ids: string[] }

// POST /admin/outbox/dispatch
// body: { replicaCount?: number /* 3 */, timeoutMs?: number /* 5000 */ }
{
  byReplica: { replicaId: string, dispatchedEventIds: string[] }[],
  totalDispatched: number,    // insert 수와 동일
  duplicates: number,         // 0이어야 PASS
  durationMs: number,
}
```

구현:
- `insert`: 단일 트랜잭션 N건 insert. idempotencyKey는 server측에서 grammar #12 빌드.
- `dispatch`: 같은 process 안에서 N개 worker promise 동시 실행 (각각 `FOR UPDATE SKIP LOCKED` 폴링) → 결과 집계.

## 10. 테스트 매트릭스 (3 layer × 4 stage)

| | Unit (mock store) | Integration (NestJS Test + Fastify inject) | Contract (sim-handles ↔ endpoint shape) |
|---|---|---|---|
| Stage 1 controller | ring buffer + view DTO 변환 | 11 endpoint × 200/400/404 케이스 | sim-decision-view 타입 import로 강제 |
| Stage 2 gateway | sticky ring buffer + ratio 계산 | 1 endpoint | sim-handles `gateway-sticky-consistency` 타입 import |
| Stage 3 auth-api | version bump 로직 | 2 endpoint | sim-handles `bitmap-version-*` 타입 import |
| Stage 4 approval-api | N-replica dispatch 시뮬 | 2 endpoint | sim-handles `outbox-client` 타입 import |

각 stage 단독 PR에 자기 unit + integration + contract test 포함. **e2e 시나리오 PASS 검증은 Stage 4 머지 후 사용자 환경에서 별도** (DoD #2).

## 11. error 처리 — RFC 7807 표준

```ts
interface AdminErrorResponse {
  type: string;          // "https://qa-sdk.dev/errors/validation"
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}
```

상태 코드:
- 200/201/204
- 400 — body 형식 위반 (zod validation fail)
- 404 — 외부 IP 또는 미등록 fault kind
- 409 — fault 이미 active, scale pin 이미 set 등 idempotent 위반
- 500 — store 장애

## 12. 마이그레이션 시퀀스 (4 PR)

```
PR-A (Stage 1): controller side
  ├─ 신규 패키지: packages/sim-internal-network/, packages/sim-decision-view/
  ├─ controller 11 endpoint + ring buffer + view DTO
  ├─ FaultKind enum 확장 + fault class 2종
  └─ ActionExecutor #21 fix
  검증: contract test PASS, RoutingPushSchema typecheck PASS

PR-B/C/D (Stage 2/3/4): 병렬 가능
  ├─ PR-B: gateway sticky-consistency endpoint
  ├─ PR-C: auth-api bitmap version endpoint 2종
  └─ PR-D: approval-api outbox admin endpoint 2종

(이후) e2e 검증 (사용자 환경)
  ├─ pnpm sim:up
  ├─ pnpm sim:scenarios run --all (시나리오 1~17)
  └─ DoD #2 OK
```

## 13. Definition of Done

- [ ] PR-A · PR-B · PR-C · PR-D 모두 main 머지
- [ ] 각 PR의 unit + integration + contract test PASS
- [ ] sim:smoke:full Stage 5 (sim-handles ↔ endpoint contract) 추가 — 모든 contract 통과
- [ ] (사용자 환경) 시나리오 9~17 e2e PASS → enterprise-pm canary cycle DoD #2 OK 전환
- [ ] follow-up sub-projects 등록: audit-recorder operator-actions endpoint, catalog HTTP endpoint, 운영급 admin 인증

## 14. 참조

- spec: `docs/superpowers/specs/2026-04-28-canary-scaling/01-decision-model.md` §1 (SafetyDecisionRecord/ResourceDecisionRecord)
- spec: `docs/superpowers/specs/2026-04-28-canary-scaling/06-roadmap.md` §4 (#21 routing payload, #24 sim-handles wiring)
- plan: `docs/superpowers/plans/2026-04-28-canary-scaling/D-stage-9-controller.md` (ActionExecutor 위치)
- plan: `docs/superpowers/plans/2026-04-28-canary-scaling/E-stage-11-scenarios.md` (sim-handles 시그니처)
- code: `simulations/enterprise-pm/scenarios/src/runner/sim-handles/` (consumer 측)
- code: `simulations/enterprise-pm/services/canary-controller/src/` (Stage 9 controller)

---

## §4 Clarification (2026-05-02 Stage 1a 실행 중 추가)

### Input 타입 vs View 타입 (역할 분리)

- **Input 타입** (`SafetyDecisionRecordInput`, `ResourceDecisionRecordInput`,
  `AlertEventRecordInput`, `AuditTraceInput`)
  - producer (canary-controller `DecisionBuilderService` 의 `SafetyDecisionRecord` /
    `ResourceDecisionRecord`) shape 을 그대로 mirror.
  - controller 어휘를 그대로 받음: safety action 은 `weight-update | noop`,
    resource action 은 `scale(reason) | noop`.
  - controller 가 직접 ring buffer / conversion 함수 입력으로 push 가능 (typecheck pass).

- **View 타입** (`SafetyDecisionRecordView`, `ResourceDecisionRecordView`,
  `AlertEventView`, `AuditTraceView`)
  - API consumer 친화 어휘: safety action 은 `weight-update | rollback | hold`,
    resource action 은 `scale | rejected | hold`.
  - HTTP API endpoint 응답 shape.

- **Conversion 함수** (`toSafetyDecisionView`, `toResourceDecisionView`,
  `toAlertEventView`, `toAuditTraceView`)
  - Input → View 의 단방향 normalize.
  - safety: `noop → hold`, `weight-update + verdict=rollback → rollback`.
  - resource: `noop + verdict=rejected → rejected`, `noop → hold`, `scale.reason → drop`.
  - reason 은 `triggerSignals[0]` 에서 파생, 없으면 verdict literal fallback.

이 설계는 controller 내부 어휘 변경 (예: `noop` 추가) 이 외부 API surface 에 직접 노출되는 것을 막고, normalize 단계에서 흡수한다.

### 기록 SSOT (DecisionRingBuffer)

`DecisionRingBuffer.appendSafety` / `appendResource` 는 Input 타입 (controller
record shape) 을 그대로 받는다. endpoint query 시점에 `toSafetyDecisionView` /
`toResourceDecisionView` 가 normalize 하여 응답한다.

상세는 plan defect log 참조: `docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1a-shared-and-decisions.md` §Defect Log.
