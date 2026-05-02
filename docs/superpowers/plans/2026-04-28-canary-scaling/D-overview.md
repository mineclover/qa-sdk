# Plan D — Controller (단계 9·10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카나리 promote/hold/rollback과 스케일 up/down 결정을 자동화하는 컨트롤 플레인 서비스(sim-canary-controller)를 도입하고, 시나리오가 결정 모델을 검증할 수 있도록 fault-injector 모듈을 함께 제공한다.

**Architecture:** 본 plan은 spec set의 단계 9·10을 구현한다. 단계 9는 결정 모델(`01` 전체)의 코드화 — NestJS 11 + Fastify 기반 신규 서비스, PG advisory lock으로 싱글톤 보장, 30s 사이클마다 metrics scrape → 8 카테고리 verdict → Pass 1(Safety) → 조건부 Pass 2(Resource) → action 실행. 결정 객체는 audit-recorder에 nested tree로 기록되어 사후 분석 가능. 단계 10은 controller 안의 fault-injector 모듈 — schema break / audit anomaly / replication lag / dbPool 압박 4종을 토글 가능하게 만들어, Plan E의 시나리오 10·11·13·14가 의도적 회귀를 일으킬 수 있게 한다.

**Tech Stack:** TypeScript ES2023, NestJS 11 + Fastify, postgres-js (PG advisory lock + pg_replication_slot_advance + pg_sleep), Plan A grammar 4종 (#7 decision-id, #8 cycle-id, #14 decision-category, #15 decision-signal), Plan B sim-service-catalog (`transitionState`), Plan C gateway `/admin/routing`.

**Spec 인용 위치:** `docs/superpowers/specs/2026-04-28-canary-scaling/01-decision-model.md` 전체 + `04-scaling-infra.md` §4.4 + `05-error-and-scenarios.md` §3.

---

## File Structure (전체 인덱스)

| 단계 | 신규 영역 | 주요 산출물 |
|---|---|---|
| 9 | `simulations/enterprise-pm/services/canary-controller/` (신규) + `controller-config.yaml` (신규) + docker-compose entry (port 5300) | NestJS 서비스, advisory lock, metrics scrape, 카테고리 verdict, Pass1/Pass2, action emit, 30s 스케줄러 |
| 10 | `services/canary-controller/src/fault-injector/` (신규) | schema break / audit anomaly / lag inject / dbPool 압박 4종 fault toggle + HTTP API |

상세 File Structure 표는 각 단계 절에 인라인.

---

## 단계 인덱스

| 단계 | 파일 | 줄수 |
|---|---|---|
| 9 | [sim-canary-controller (Pass1+Pass2+30s)](./D-stage-9-controller.md) |      950 |
| 10 | [fault-injector 4종](./D-stage-10-fault-injector.md) |      698 |

---

## Self-Review Checklist

**1. Spec coverage**
- [ ] `01-decision-model.md` §1 (결정 객체 구조)이 단계 9 Task 9.10에 매핑되었는가?
- [ ] §2 (8 카테고리 verdict 표)가 Task 9.7에 매핑되었는가?
- [ ] §3 (Pass 1 알고리즘)이 Task 9.8에 매핑되었는가?
- [ ] §4 (Pass 2 알고리즘)이 Task 9.9에 매핑되었는가?
- [ ] §5 (30s 사이클 흐름)이 Task 9.12에 매핑되었는가?
- [ ] §6 (advisory lock + revision-based push)이 Task 9.5, 9.11에 매핑되었는가?
- [ ] §7 (분류·측정 체계 근거)이 Task 9.4 controller-config.yaml의 임계 표에 매핑되었는가?
- [ ] `04-scaling-infra.md` §4.4 (lag-injector)가 단계 10 Task 10.4에 매핑되었는가?
- [ ] `05-error-and-scenarios.md` §3 시나리오 10·11·13·14가 요구하는 fault 4종이 단계 10 Task 10.2~10.5에 매핑되었는가?

**2. Placeholder 스캔**
- [ ] 부재 (`grep -n "TBD\|TODO\|FIXME" docs/superpowers/plans/2026-04-28-canary-scaling/D-controller.md`)

**3. Type 일관성**
- [ ] Plan A grammar `buildDecisionId`(#7), `buildCycleId`(#8), `buildDecisionCategory`(#14), `buildDecisionSignal`(#15)가 Plan D에서 import되어 raw 보간 0건인가?
- [ ] Plan A grammar `buildReplicationSlot`(#13)이 lag-injector에서 사용되는가?
- [ ] Plan B `transitionState`, `getCurrentTopology`가 controller에서 호출되는가?
- [ ] Plan C gateway `/admin/routing` API 호출이 controller action emit에서 일관되게 사용되는가?
- [ ] SafetyDecision/ResourceDecision 인터페이스가 spec 01 §1과 정확히 일치하는가? (필드명·verdict enum·triggerCategory·rejectedBy 모두)

**4. 명령 실행 가능성**
- [ ] sim-canary-controller가 `pnpm sim:up`에 통합되어 11번째 서비스로 healthy 됨
- [ ] advisory lock raw query (`pg_try_advisory_lock`) 실행 가능
- [ ] 30s 사이클이 NestJS `@Interval` 데코레이터로 동작

---

## Definition of Done (단계 9·10 통합 완료 정의)

- [ ] sim-canary-controller 부팅 OK + advisory lock 동작 (단위 테스트)
- [ ] Pass 1 단위 테스트 PASS — 모든 verdict 케이스 (promote / hold / soft-rollback / hard-rollback) 커버
- [ ] Pass 2 단위 테스트 PASS — scale-up / scale-down / hold / rejected 케이스 커버
- [ ] 30s 사이클 1회 실행 → audit-recorder에 SafetyDecision 1건 + (조건부) ResourceDecision 1건 nested tree로 기록
- [ ] gateway routing push 단위 테스트 PASS — revision 갱신 확인
- [ ] docker compose --scale 호출이 멱등 (현재-목표 비교 후 no-op)
- [ ] fault-injector 4종 (schema break / audit anomaly / lag / dbPool) 단위 테스트 PASS
- [ ] fault toggle HTTP API 호출 → 의도한 신호가 controller 카테고리 verdict에 반영됨 (단위 테스트)
- [ ] 기존 시나리오 1~8 무회귀 (controller 가동 상태에서 자동 결정이 happy path를 깨뜨리지 않음)

---

## 다음 Plan과의 관계

- **Plan E (단계 11)**: 시나리오 9~17 모두 본 plan의 controller 결정 객체에 대해 단언한다. 시나리오 10·11·13·14는 본 plan의 fault-injector를 enable하여 의도적 회귀를 일으킨 뒤 controller가 정확한 trigger category를 가진 결정을 만드는지 검증한다. 시나리오 17 (`pass-priority-canary-blocks-scale`)은 Pass 1 hold 시 Pass 2 SKIP 동작을 직접 검증한다.
- **Plan E (단계 12)**: break-glass CLI(`sim:canary controller stop`)가 본 plan의 advisory lock release를 호출한다.
