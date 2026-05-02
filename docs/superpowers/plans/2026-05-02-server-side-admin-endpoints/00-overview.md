# Server-side Admin Endpoints — Overview

> 시나리오 9~17 e2e PASS prerequisite 충족을 위해 sim-canary-controller / sim-gateway / sim-auth-api / sim-approval-api에 admin endpoint 16종 + 1 actor 변경 + FaultKind enum 2종 확장을 4 stage로 머지한다.

본 문서는 plan set의 색인이다. stage 단위 task 분해는 각 stage 파일에 위임하고, 여기서는 sub-project 전체의 목적·범위·토폴로지·머지 시퀀스·DoD를 한 곳에 모은다. 본문은 spec `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md` §1·§2·§12·§13을 그대로 인용한다.

## 1. 목적과 범위

**목적**
- Plan E Stage 11의 12개 sim-handles factory가 호출하는 server-side endpoint를 구현해 enterprise-pm canary cycle DoD #2를 OK로 전환한다.
- 시나리오 9~17의 e2e 단언이 통과 가능한 server-side data backbone을 제공한다.

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

## 2. 4 stage 토폴로지

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

**Stage 1이 critical path**: 모든 시나리오 9~17이 audit-fetcher + wait-for-cycles에 의존한다 (controller endpoint). Stage 2/3/4는 Stage 1 완료 후 병렬 가능하다 (sim-handles fetchImpl 주입으로 단위 테스트는 mutual independent).

**스테이지-사이클 매핑**:

- Stage 1 (controller 11 endpoint) — 시나리오 9~17 전체의 audit/decision/cycle 단언, fault 주입, scale/compose admin이 모두 여기에 묶인다.
- Stage 2 (gateway 1 endpoint) — sticky session 일관성 검증이 필요한 시나리오 (gateway sticky-consistency).
- Stage 3 (auth-api 2 endpoint) — 시나리오 16의 bitmap version fallback 단언.
- Stage 4 (approval-api 2 endpoint) — outbox dispatch 중복 0 단언 시나리오.

## 3. 신규/변경 컴포넌트 표

| 영역 | 종류 | 컴포넌트 | 변경 분류 |
|---|---|---|---|
| 공유 패키지 | 신규 | `packages/sim-internal-network/` | NestJS Guard + Hono middleware + isInternalIp |
| 공유 패키지 | 신규 | `packages/sim-decision-view/` | view DTO 5종 + internal→view 변환 |
| controller | 신규 | `canary-controller/src/decision/decision-ring-buffer.ts` | safety/resource/alert ring buffer |
| controller | 신규 | `/v1/decisions`, `/v1/decisions/first`, `/v1/cycles/recent`, `/v1/alerts/count`, `/v1/audit/trace` | endpoint 5종 (decision/audit query) |
| controller | 신규 | `/v1/catalog/states` | catalog-store 조회 endpoint |
| controller | 신규 | `/admin/fault/{kind}` | fault-injector endpoint (6 kind 통합) |
| controller | 신규 | `/admin/compose/replicas`, `/admin/scale/pin` (GET/POST), `/admin/scale/replicas` | compose/scale 4 endpoint |
| controller | 변경 | `ActionExecutor` (#21) | gateway `RoutingPushSchema` 형태로 payload 변환 |
| controller | 신규 | `canary-controller/src/fault/pubsub-invalidate-drop.ts` | FaultKind 확장 (시나리오 16) |
| controller | 신규 | `canary-controller/src/fault/perf-warn.ts` | FaultKind 확장 (시나리오 17) |
| gateway | 신규 | `/admin/routing/sticky-consistency` | sticky ring buffer + ratio 계산 endpoint |
| auth-api | 신규 | `/admin/bitmap/bump-version`, `/admin/bitmap/version` | prefix version mutate/read |
| approval-api | 신규 | `/admin/outbox/insert`, `/admin/outbox/dispatch` | outbox bulk insert + N-replica dispatch |

각 endpoint의 응답 shape 상세는 spec §6, §9 참조. RFC 7807 error 표준은 spec §11.

**공통 횡단 관심사** (4 stage 모두 적용):

- **인증** — `sim-internal-network` Guard로 외부 IP 요청 → 404 silent. 내부 docker network (172.x.x.x) 또는 localhost만 통과 (spec §3).
- **view DTO 분리** — controller internal `SafetyDecisionRecord` ≠ sim-handles이 기대하는 shape. `sim-decision-view`에서 producer/consumer 양쪽이 같은 타입 import → typecheck로 drift 차단 (spec §4).
- **데이터 backbone** — controller 자체 ring buffer가 SSOT. Pass 1 soft rollback 윈도우와 endpoint query 양쪽이 같은 ring buffer를 참조한다 (spec §5).
- **error 처리** — 모든 endpoint는 RFC 7807 표준 `AdminErrorResponse` 반환. 상태 코드는 200/201/204, 400 (zod validation fail), 404 (외부 IP 또는 미등록 fault kind), 409 (fault 이미 active, scale pin 이미 set 등 idempotent 위반), 500 (store 장애) 다섯 종으로 통일 (spec §11).

## 4. 의존성 그래프 + 머지 시퀀스

```
PR-A (Stage 1: controller)
   ├─ depends on: 없음 (sim-internal-network · sim-decision-view 자체 신규 패키지)
   ├─ blocks    : PR-B, PR-C, PR-D (모두 sim-internal-network Guard 재사용)
   │              그리고 Stage 11 e2e 시나리오 전부
   │
   ├─ PR-B (Stage 2: gateway)              ─┐
   ├─ PR-C (Stage 3: auth-api)              │  병렬 가능
   └─ PR-D (Stage 4: approval-api)         ─┘
              │
              └─ (사용자 환경) e2e 시나리오 9~17 PASS
                       └─ enterprise-pm canary cycle DoD #2 OK
```

Stage 1이 critical path이고, Stage 1 머지 후 Stage 2/3/4는 fetchImpl 주입 단위 테스트로 mutual independent하므로 병렬로 머지한다. Spec §12를 그대로 인용:

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

## 5. 본 plan set 안내

본 디렉터리는 4 PR을 5개 stage 문서로 쪼갠다. PR-A는 controller 작업량이 커서 1a (공유 패키지 + decision query) / 1b (admin/fault + compose/scale + #21) 두 문서로 나누되, 머지는 단일 PR-A로 묶는다.

| 파일 | 대응 PR | 주요 산출물 |
|---|---|---|
| `A-stage-1a-shared-and-decisions.md` | PR-A 전반부 | 신규 패키지 2 (sim-internal-network, sim-decision-view) + ring buffer + decision/cycle query endpoint 4종 (`/v1/decisions`, `/v1/decisions/first`, `/v1/cycles/recent`, `/v1/alerts/count`, `/v1/audit/trace`) |
| `A-stage-1b-admin-and-fault.md` | PR-A 후반부 | `/v1/catalog/states` + `/admin/fault/{kind}` + `/admin/compose/replicas` + `/admin/scale/*` 4 endpoint + ActionExecutor #21 routing payload 변환 + FaultKind enum 2종 확장 (`pubsub-invalidate-drop`, `perf-warn`) |
| `B-stage-2-gateway.md` | PR-B | gateway `/admin/routing/sticky-consistency` endpoint + sticky ring buffer + ratio 계산 |
| `C-stage-3-auth-api.md` | PR-C | auth-api `/admin/bitmap/bump-version` + `/admin/bitmap/version` 2 endpoint |
| `D-stage-4-approval-api.md` | PR-D | approval-api `/admin/outbox/insert` + `/admin/outbox/dispatch` 2 endpoint (N-replica `FOR UPDATE SKIP LOCKED`) |

각 stage 문서는 자체 unit + integration + contract test 묶음을 포함한다 (spec §10 테스트 매트릭스). e2e 시나리오 PASS 검증은 4 PR 모두 머지 후 사용자 환경에서 별도 진행한다 (DoD #2).

**stage 별 scope 요약** (각 stage 파일에서 task 단위로 상세화):

- **A-stage-1a-shared-and-decisions.md**
  - 신규 패키지 `packages/sim-internal-network/`: `is-internal-ip.ts`, `nestjs-guard.ts`, `hono-middleware.ts`, `index.ts`.
  - 신규 패키지 `packages/sim-decision-view/`: `safety-decision-view.ts`, `resource-decision-view.ts`, `alert-event-view.ts`, `audit-trace-view.ts`, `conversion.ts`, `index.ts`.
  - controller `canary-controller/src/decision/decision-ring-buffer.ts` 신규 — `safetyRing` / `resourceRing` / `alertEvents` (각 maxSize=100) + `appendSafety` / `appendResource` / `appendAlert` / `queryDecisions` / `queryFirst` / `recentCycleIds` / `countAlerts` / `trace`.
  - Stage 9의 기존 `history` 변수를 ring buffer로 통합. Pass 1 soft rollback 윈도우와 endpoint query가 같은 SSOT를 본다. `CycleSchedulerService`가 매 사이클 끝에 `ringBuffer.append*()` 호출.
  - 그 위에 endpoint 5종: `/v1/decisions`, `/v1/decisions/first`, `/v1/cycles/recent`, `/v1/alerts/count`, `/v1/audit/trace`.
- **A-stage-1b-admin-and-fault.md**
  - controller endpoint 6종: `/v1/catalog/states` (catalog-store 조회), `/admin/fault/{kind}` (6 kind 통합), `/admin/compose/replicas` (docker proxy), `/admin/scale/pin` (GET/POST), `/admin/scale/replicas`.
  - ActionExecutor #21 fix — 기존 `{ revision, weight }` plan literal을 gateway `RoutingPushSchema` (services map + stable/candidate `{ version, upstream }` + stickyKey `"user_id"`) 형태로 변환 (spec §7). `RoutingPushSchema` 타입은 gateway 패키지에서 export → controller가 import해서 typecheck 강제.
  - `FaultKind` enum 2종 확장 (spec §8):
    - `pubsub-invalidate-drop` (시나리오 16): body `{ dropRate: number }`, 효과는 bitmap pub/sub `bitmap.invalidate` 채널 메시지를 controller proxy가 일정 비율 drop. 위치 `canary-controller/src/fault/pubsub-invalidate-drop.ts`.
    - `perf-warn` (시나리오 17): body `{ severity: "warn" }`, 효과는 perf 카테고리에 인위적 WARN 신호 주입 → Pass 1이 hold (rollback 아님). 위치 `canary-controller/src/fault/perf-warn.ts`.
- **B-stage-2-gateway.md**
  - gateway `/admin/routing/sticky-consistency` 1 endpoint.
  - 구현: gateway routing decision을 메모리 ring buffer로 기록 (`{ user_id, version, at }`) + endpoint query 시 `ratio` / `sample` / `inconsistentUsers` / `window` 계산 (spec §9 Stage 2).
- **C-stage-3-auth-api.md**
  - auth-api endpoint 2종: `/admin/bitmap/bump-version` (default prefix `"sim.bitmap"`, prefix version state를 stable → retired + 새 stable 추가) + `/admin/bitmap/version`.
  - 시뮬용 monotonic counter 증가 로직 (spec §9 Stage 3).
- **D-stage-4-approval-api.md**
  - approval-api endpoint 2종: `/admin/outbox/insert` + `/admin/outbox/dispatch`.
  - `insert`: 단일 트랜잭션 N건 insert. idempotencyKey는 server측에서 grammar #12 빌드.
  - `dispatch`: 같은 process 안에서 N개 worker promise 동시 실행 (각각 `FOR UPDATE SKIP LOCKED` 폴링) → 결과 집계. `duplicates: 0` 단언이 PASS 기준이다 (spec §9 Stage 4).

**테스트 매트릭스** (spec §10):

| 영역 | Unit (mock store) | Integration (NestJS Test + Fastify inject) | Contract (sim-handles ↔ endpoint shape) |
|---|---|---|---|
| Stage 1 controller | ring buffer + view DTO 변환 | 11 endpoint × 200/400/404 케이스 | sim-decision-view 타입 import로 강제 |
| Stage 2 gateway | sticky ring buffer + ratio 계산 | 1 endpoint | sim-handles `gateway-sticky-consistency` 타입 import |
| Stage 3 auth-api | version bump 로직 | 2 endpoint | sim-handles `bitmap-version-*` 타입 import |
| Stage 4 approval-api | N-replica dispatch 시뮬 | 2 endpoint | sim-handles `outbox-client` 타입 import |

각 stage 단독 PR에 자기 unit + integration + contract test가 포함된다. e2e 시나리오 PASS 검증은 Stage 4 머지 후 사용자 환경에서 별도로 수행한다 (DoD #2).

cross-ref:
- spec 본문: `docs/superpowers/specs/2026-05-02-server-side-admin-endpoints-design.md`
- 인증 (internal IP): spec §3
- view DTO 구성: spec §4
- ring buffer: spec §5
- controller endpoint shape: spec §6
- ActionExecutor #21 변환: spec §7
- FaultKind 2종 확장: spec §8
- Stage 2~4 endpoint shape: spec §9
- 테스트 매트릭스: spec §10
- error 처리: spec §11
- 참조 문서: spec §14

## 6. Definition of Done

- [ ] PR-A · PR-B · PR-C · PR-D 모두 main 머지
- [ ] 각 PR의 unit + integration + contract test PASS
- [ ] sim:smoke:full Stage 5 (sim-handles ↔ endpoint contract) 추가 — 모든 contract 통과
- [ ] (사용자 환경) 시나리오 9~17 e2e PASS → enterprise-pm canary cycle DoD #2 OK 전환
- [ ] follow-up sub-projects 등록: audit-recorder operator-actions endpoint, catalog HTTP endpoint, 운영급 admin 인증

각 체크박스는 stage 파일에서 task 단위로 분해된다. 본 overview는 plan set의 색인 역할만 하므로, 구현 task 결정은 모두 stage 문서에 위임한다. spec과 어긋나는 결정 (예: ring buffer 크기 변경, RFC 7807 외 error 포맷, internal IP 외 인증 추가 등)은 본 sub-project 범위 밖이며, 필요해질 경우 별도 sub-project로 등록한다.
