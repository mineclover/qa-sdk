---
lifecycle: review
status: implemented
sources:
  - docs/proposals/auth-model-implementation-backlog/README.md
  - docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md
  - docs/specs/sim-erp-pm-coverage.spec.md
  - simulations/enterprise-pm/README.md
  - simulations/enterprise-pm/scenarios/src/cli.ts
  - scripts/sim-smoke-full.ts
---

# Auth Model Implementation Backlog — Plans

`docs/proposals/auth-model-implementation-backlog/README.md`의 auth model 구현 작업을 phase별 plan으로 분해한 디렉토리. 초기에는 미구현 backlog였지만, 현재는 Phase 1~5가 구현 완료된 historical execution index로 남는다.

## 현재 상태

각 phase는 의존 그래프상 직전 phase 완료 후 시작했으며, 현재 구현 증거는 auth backlog README, Enterprise PM 시뮬레이션, `sim-erp-pm-coverage` spec, scenario runner에 연결되어 있다.

| Phase | Plan | 상태 |
|---|---|---|
| 1 | [01-audit-db-otel.md](./01-audit-db-otel.md), [02-ingest-audit-versioning.md](./02-ingest-audit-versioning.md), [03-coordinate-storage-validation.md](./03-coordinate-storage-validation.md) | 구현 완료 |
| 2 | `04a~07d` — SQLite/D1 → PostgreSQL dual-target 이행 | 구현 완료 |
| 3 | `15a~15e` — RLS shadow → enforce | 구현 완료 |
| 4 | `09~14` — Enterprise PM 시뮬 프로젝트 + 8 시나리오 | 구현 완료 |
| 5 | §2 Bitmap pipeline + §5 Marginal density | Phase 4에 흡수 |

## 현재 증거 표면 ^evidence

- `simulations/enterprise-pm/`는 9 services + scenario runner를 포함한다.
- `simulations/enterprise-pm/scenarios/src/cli.ts`는 시나리오 1~17 registry를 소유하며, 원래 8 시나리오 범위를 확장한 현재 runtime surface다.
- `docs/specs/sim-erp-pm-coverage.spec.md`는 5축 × 8 시나리오 회귀 매트릭스를 소유한다.
- `scripts/sim-smoke-full.ts`는 repo-level smoke entrypoint다.

## Phase 1 내부 의존

`02 → 03` 순서 권장: §4가 ingest-server의 `key_observations`/`key_observation_prefixes`를 `(prefix_id, version, address)` 복합 PK로 정리한 뒤 §6의 자동 검출이 위반 0으로 통과한다. §4 미적용 시 §6의 통합 테스트가 정상적으로 위반을 검출 → §4를 먼저 끝내거나 임시 exempt 주석으로 우회 가능.

`01`은 `02/03`과 독립. 병렬 머지 가능.

## 실행

각 plan은 자체 task 분해와 commit 단위를 포함한다. 실행 방식 두 가지:

1. **Subagent-Driven**: superpowers:subagent-driven-development — task별 fresh subagent 디스패치 + 단계별 review
2. **Inline Execution**: superpowers:executing-plans — 현 세션에서 batch 실행

선택은 plan 머리말 참조.

## 다음 phase 준비

Phase 2부터는 brainstorming이 선행 — 각 항목의 task 분리 시 수행.
