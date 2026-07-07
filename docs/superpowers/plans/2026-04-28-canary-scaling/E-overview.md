---
status: source-backed
sources:
  - simulations/enterprise-pm/scenarios/src/scenarios/scenario-9-canary-happy-promote.ts
  - simulations/enterprise-pm/scenarios/src/lib/assertions/decision-assertions.ts
  - simulations/enterprise-pm/scenarios/src/runner/sim-handles/index.ts
  - scripts/sim-canary.ts
  - scripts/sim-scale.ts
---

# Plan E — Scenarios + closing (단계 11·12·13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 본 사이클의 모든 검증 자산을 활성화한다 — 17 시나리오(기존 8 + 신규 9), 운영자 break-glass CLI, 인프라 검증 6종 게이트. 본 plan 완료가 곧 1차 사이클 마감.

**Architecture:** 본 plan은 spec set의 단계 11·12·13을 구현한다. 단계 11은 검증 매트릭스(`05 §3`)의 9 시나리오 코드화 — 각 시나리오의 단언이 controller 결정 객체(`01 §1`)의 verdict와 triggerCategory에 대해 작성되어, 결정 모델이 시뮬 검증의 1급 단위가 된다. 단계 12는 break-glass(`05 §2`) — 운영자가 자동 결정을 강제 override할 수 있는 4 명령(`sim:canary abort`, `force-promote`, `controller stop`, `sim:scale set`)을 audit 추적과 함께 제공. 단계 13은 인프라 검증(`05 §4`) 6종을 모두 활성화하고 사이클 완료 보고서를 작성해 마감을 선언한다.

**Tech Stack:** TypeScript ES2023, vitest, commander (break-glass CLI), ESLint custom rule (read DataSource 호출 차단), Plan A·B·C·D 결과 모두 사용. `pnpm sim:smoke:full` 통합 실행기 신설.

**Spec 인용 위치:** `docs/superpowers/specs/2026-04-28-canary-scaling/05-error-and-scenarios.md` §2·§3·§4 + `01-decision-model.md` §1 + `06-roadmap.md` §4·§5.

---

## File Structure (전체 인덱스)

| 단계 | 변경 영역 | 주요 산출물 |
|---|---|---|
| 11 | `simulations/enterprise-pm/scenarios/src/scenarios/scenario-9~17-*.ts` (신규 9) + `scenarios/src/runner/assertions/` (신규) + `cli.ts` `ALL_SCENARIOS` 갱신 | 9 시나리오 + assertion 헬퍼 (결정 객체 단언) |
| 12 | `scripts/sim-canary.ts` (신규) + `scripts/sim-scale.ts` (신규) + root `package.json` scripts | break-glass CLI 4 명령, dry-run 모드, audit 기록 |
| 13 | `.eslintrc` custom rule + `scripts/sim-smoke-full.ts` (신규) + `docs/superpowers/specs/2026-04-28-canary-scaling/완료-보고.md` (신규) | read DataSource 호출 차단 lint, 통합 smoke 실행기, 사이클 마감 보고서 |

상세 File Structure 표는 각 단계 절에 인라인.

---

## 단계 인덱스

| 단계 | 파일 | 줄수 |
|---|---|---|
| 11 | [시나리오 9~17 + assertion 헬퍼](./E-stage-11-scenarios.md) |      877 |
| 12 | [break-glass CLI 4 명령](./E-stage-12-break-glass.md) |      658 |
| 13 | [인프라 검증 게이트 + 마감 보고서](./E-stage-13-gates-closing.md) |      584 |

---

## Self-Review Checklist

**1. Spec coverage**
- [ ] `05-error-and-scenarios.md` §3 표의 9 시나리오 (#9~#17) 모두 단계 11 task에 매핑되었는가?
- [ ] 각 시나리오의 trigger / 단언이 결정 객체 verdict + triggerCategory에 대해 작성되었는가?
- [ ] §2 break-glass 표의 4 명령(abort / force-promote / controller stop / scale set)이 단계 12 task에 매핑되었는가?
- [ ] §4 인프라 검증 6종이 단계 13 cross-check 매트릭스에 모두 등장하는가?
- [ ] `06-roadmap.md` §4 후속 sub-project 5종이 단계 13 마감 보고서에 인덱싱되었는가?

**2. Placeholder 스캔**
- [ ] 부재 (`grep -n "TBD\|TODO\|FIXME" docs/superpowers/plans/2026-04-28-canary-scaling/E-scenarios-closing.md`)

**3. Type 일관성**
- [ ] 모든 시나리오 단언이 `SafetyDecision` / `ResourceDecision` 인터페이스 (Plan D 결과)에 대해 작성되는가?
- [ ] break-glass CLI가 Plan B `transitionState`, Plan C gateway `/admin/routing`, Plan D advisory lock release를 호출하는가?
- [ ] `assertSafetyVerdict`, `assertResourceVerdict`, `assertTriggerCategory` 헬퍼 시그니처가 모든 시나리오에서 동일한가?

**4. 명령 실행 가능성**
- [ ] `pnpm sim:scenarios run scenario-9-canary-happy-promote` 실행 가능
- [ ] `pnpm sim:canary abort` 실행 가능 + audit-recorder에 `operatorAction: true` 기록
- [ ] `pnpm sim:smoke:full` 통합 실행기가 17 시나리오 + 인프라 검증 6종 순차 실행

---

## Definition of Done (1차 사이클 마감)

본 plan의 DoD가 곧 1차 사이클 전체의 마감 기준 (`06-roadmap.md` §5).

- [ ] 13 단계(Plan A·B·C·D·E) 모두 main 브랜치 머지
- [ ] 17 시나리오 모두 PASS (`pnpm sim:scenarios run --all` CI green)
- [ ] 인프라 검증 6종 모두 통과 (단계 13 cross-check 매트릭스 모든 row가 PASS)
- [ ] break-glass CLI 4종 단위 테스트 PASS (dry-run 모드)
- [ ] controller 30s 사이클 24시간 연속 무중단 동작 (수동 스모크 보고서 첨부)
- [ ] 6개 spec 문서가 코드와 일치 (drift 없음) — `def-doctor` 또는 동등 검증으로 확인
- [ ] README + `00-overview.md`가 최종 변경 영향을 명시
- [ ] 후속 sub-project 5종이 별도 spec/plan으로 식별되어 다음 사이클 진입 준비 완료

---

## 다음 Plan과의 관계

- **본 plan 완료 = 1차 사이클 종료.**
- 다음 단계: 후속 sub-project 5종 (chaos 일반화, HTTP retry 표준화, k6 SLO 매트릭스, BFF lint 일반화, README 보강) 각자 별도 brainstorming → spec → plan 사이클로 진입한다 (`06-roadmap.md` §4).
