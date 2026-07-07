---
def:
  id: sim-erp-pm-coverage
  type: spec
  tier: component
  scope: flow
  aspect: quality_flow
  depth: specification
  lifecycle: draft
  layer: experience
  svc: qa-sdk
  tags: [simulation, coverage, validation, quality-gate]
  links:
    - target: authorization-ontology-bitmap-pipeline
      type: traces_to
    - target: authorization-ontology-resource-lifecycle
      type: traces_to
    - target: authorization-ontology-nested-audit-tracing
      type: traces_to
    - target: event-taxonomy-marginal-density
      type: traces_to
sources:
  - simulations/enterprise-pm/scripts/smoke.sh
  - scripts/sim-smoke-full.ts
  - simulations/enterprise-pm/test/regression/scenarios-1-to-8.smoke.test.ts
  - simulations/enterprise-pm/scenarios/src/cli.ts
  - simulations/enterprise-pm/scenarios/src/post-run/density-collector.ts
  - simulations/enterprise-pm/docs/operations.md
  - simulations/enterprise-pm/docs/operator-workflows.md
---

# Enterprise PM Simulation — Coverage Spec

## 목적 ^purpose

본 spec은 `simulations/enterprise-pm/`의 8 시나리오 실행으로 qa-sdk 본체의 5축(권한·이벤트·관측·로직·로깅)이 어떻게 end-to-end 검증되는지 매트릭스로 명시한다. 시뮬이 통과한 시나리오는 곧 qa-sdk 본체 기능의 품질 게이트 — 회귀 발견 시 본 spec의 매트릭스가 영향 범위 추적의 시작점이다.

## 구성 ^overview

5축 × 8 시나리오 매트릭스. 각 셀은 시나리오 실행 시 검증되는 qa-sdk 패키지의 구체 기능을 명시한다. Plan 14a의 density 측정은 본 spec의 9번째 열(정보 지표, gate 아님)으로 포함된다.

## 정의 ^defines

### 5축 정의

| 축 | qa-sdk 패키지 | 책임 |
|---|---|---|
| 권한 | weighted-index, permission-engine, resource-policy-store | 좌표 인코딩 + bitmap O(1) check + 인스턴스 lifecycle |
| 이벤트 | event-catalog, browser-codec, ingest-server | event 정의 + 인코딩 + 수집 + marginal density |
| 관측 | @qa-sdk/otel, audit-recorder-store, permission-engine.OtelAuditRecorder | OTel SDK + nested audit + cross-service trace |
| 로직 | resource-policy-store FSM, approval state machine | state transition + transaction 경계 |
| 로깅 | @qa-sdk/logger, IngestForwarder | structured log + ingest-server 전송 |

### 시나리오 × 축 매트릭스

| # | 시나리오 | 권한 | 이벤트 | 관측 | 로직 | 로깅 |
|---|---|---|---|---|---|---|
| 1 | login + bitmap 발행 | DisjointUnionIndex.encode + VersionedBitmap issuance | login event ingest | traceparent 신규 root | — | structured log |
| 2 | project create + owner 자동 권한 | AccessChecker 2-pass + UNREGISTERED FSM | project_created event | AccessChecker audit entry | resource-policy 생성 transition | O |
| 3 | 자기 부서 단일 승인 | AccessChecker Pass 1 + Pass 2 lifecycle allow | approval event | nested audit tree (3+ entry) | submitted→approved | O |
| 4 | cross-dept 단독 승인 → deny | Pass 2 lifecycle deny + RLS scoping | deny event | firstFailure decision replay | — | deny log |
| 5 | 3-stage 승인 (1500만원) | stage 별 AccessChecker × 3 | 3 transition event | OTEL cross-stage trace | 3-stage state machine | O |
| 6 | DELEGATED 외부 컨설턴트 | Pass 2 acl branch + evaluator.evaluateDelegated | delegate event | DELEGATED audit pass="acl" | REGISTERED→DELEGATED transition | O |
| 7 | bitmap refresh | §2 §4 refresh endpoint + fresh bitmap | refresh event | refresh trace | — | O |
| 8 | pub/sub invalidation | §2 §5 publish/subscribe + LRU flush | invalidation event | Redis pub trace | — | Subscriber log |

### 검증된 qa-sdk 기능 추적성

각 시나리오는 다음 qa-sdk 본체 패키지의 e2e 게이트 역할:

```
weighted-index/DisjointUnionIndex     → 1, 2, 3, 4, 5, 6 (모든 권한 시나리오)
permission-engine/AccessChecker       → 2, 3, 4, 5, 6
permission-engine/VersionedBitmap     → 1, 7
permission-engine/OtelAuditRecorder   → 3, 4, 5
resource-policy-store FSM             → 2, 3, 6
audit-recorder-store nested tree      → 3, 4, 5
audit-recorder-store firstFailure     → 4 (decision replay 핵심)
ingest-server key_observations        → 모든 시나리오 (event 수집)
@qa-sdk/otel propagation              → 1, 2, 3, 4, 5, 6, 7, 8 (cross-service)
@qa-sdk/logger IngestForwarder        → 모든 시나리오
sim-bitmap-cache pub/sub (§2 §5)      → 8
density (§5)                          → 8 시나리오 실행 후 측정
```

### 회귀 게이트로서의 시뮬

- `pnpm sim:smoke` — 8 시나리오 batch + density 측정 → exit code 0/1
- 1개라도 fail → qa-sdk 본체 회귀 의심 → 본 매트릭스에서 관련 패키지 추적
- 본 spec은 **회귀 영향 범위 분석의 시작점**

## 소비 ^consumes

- 운영자/QA가 회귀 분석 시 진입점
- CI gate (Phase 5)에서 `sim:smoke` 결과를 본 spec의 매트릭스와 cross-reference
- 시나리오 실행 후 실제 조사 절차는 `simulations/enterprise-pm/docs/operator-workflows.md`를 canonical runtime flow로 사용

## 위임 ^delegates

- 시나리오별 detail: [`/docs/proposals/auth-model-implementation-backlog/plans/13a-sim-scenario-runner-1-2.md`](../proposals/auth-model-implementation-backlog/plans/13a-sim-scenario-runner-1-2.md) ~ 13d
- 인프라: [Plan 09 시리즈](../proposals/auth-model-implementation-backlog/plans/09a-sim-workspace-bootstrap.md)
- 운영: [`/simulations/enterprise-pm/docs/operations.md`](../../simulations/enterprise-pm/docs/operations.md)
- operator runtime flow: [`/simulations/enterprise-pm/docs/operator-workflows.md`](../../simulations/enterprise-pm/docs/operator-workflows.md)

## 방법 ^method

### 회귀 검출 워크플로우

1. `pnpm sim:smoke` 실행
2. 시나리오 N번이 실패하면 본 매트릭스의 column N 확인
3. 해당 column에 hit인 패키지의 최근 변경(git log)을 review
4. 변경된 패키지의 단위 테스트 + port-contract 회귀 점검
5. 필요하면 scenario 출력의 operator handoff 또는 `operator-workflows.md`를 따라 audit / graph / retention evidence를 직접 확인
6. 수정 후 `pnpm sim:smoke` 재실행으로 회귀 검증

### 시나리오 추가 시

- design.md §4 매트릭스에 새 row 추가
- Plan 13x에 시나리오 구현
- 본 spec의 매트릭스에 column 또는 row 갱신

## 주의사항

- **시뮬은 e2e 게이트** — 시나리오 fail은 즉시 회귀 의심. 단순 flaky test로 치부 금지.
- **density는 정보 지표** — Plan 14a 시점에는 게이팅 아님. saturated 발견 시 capacity 검토(§5 §4 Phase 3에서 게이팅 도입).
- **시뮬 외 회귀** — 본 시뮬이 검증하지 않는 영역 (예: viz-web, decision-flow CLI)은 별도 회귀 자료 필요.

## 용어

- **5축**: 권한·이벤트·관측·로직·로깅. qa-sdk의 핵심 기능 분류.
- **시뮬 매트릭스**: 시나리오 × 축의 검증 카운트 표.
- **회귀 게이트**: 시뮬 실패 → qa-sdk 본체 회귀 의심 → 본 spec 추적 시작.
