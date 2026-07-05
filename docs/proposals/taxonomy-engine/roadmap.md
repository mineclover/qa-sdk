---
def:
  id: taxonomy-engine-roadmap
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: roadmap
  tier: layout
  depth: overview
  sources:
    - docs/proposals/taxonomy-engine/concepts/lifecycle.md
    - docs/proposals/taxonomy-engine/concepts/semver-migration.md
    - docs/proposals/taxonomy-engine/concepts/decision-sync.md
    - docs/proposals/taxonomy-engine/concepts/decision-flow-bridge.md
    - docs/proposals/taxonomy-engine/plans/README.md
    - docs/proposals/taxonomy-engine/plans/v0.8.md
    - docs/proposals/taxonomy-engine/plans/v0.9.md
    - docs/proposals/taxonomy-engine/plans/v0.10.md
    - docs/proposals/taxonomy-engine/plans/v0.11.md
    - docs/proposals/taxonomy-engine/plans/v0.12.md
    - docs/proposals/taxonomy-engine/plans/v0.13.md
    - docs/proposals/taxonomy-engine/plans/v0.14.md
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: roadmap
supersedes: -
superseded_by: -
---

# Taxonomy Engine 진화 로드맵

## 목적 ^purpose

taxonomy-engine의 진화 흐름을 한 화면에서 찾게 하는 layout 문서다. 세부 spec과 구현 계획은
각 concept/plan 문서가 소유하고, 이 문서는 현재 상태, 읽는 순서, 남은 결정만 연결한다.

핵심 가치는 기록 자체가 아니라 **일관된 컨텍스트 제공으로 결정을 쉽게 만드는 것**이다.
현재 구현은 진화 중인 텍소노미를 lifecycle/semver/decision markdown/FlowSchema projection으로
연결한다.

## 현재 상태

| Stage | 라운드 | 핵심 산출물 | 상세 |
|-------|--------|-------------|------|
| 1 | v0.8 | entry/axis lifecycle, placeholderReason, decisionLink | [Lifecycle](./concepts/lifecycle.md), [v0.8](./plans/v0.8.md) |
| 2 | v0.9 | diff breakingLevel, migrationPlan, decisionImpact | [Semver + Migration](./concepts/semver-migration.md), [v0.9](./plans/v0.9.md) |
| 3 | v0.10 | decision markdown lifecycle sync, conflict options | [Decision Sync](./concepts/decision-sync.md), [v0.10](./plans/v0.10.md) |
| 4 | v0.11~v0.13 | FlowSchema projection, render, multi-gate markers | [Decision-Flow Bridge](./concepts/decision-flow-bridge.md), [v0.11](./plans/v0.11.md), [v0.12](./plans/v0.12.md), [v0.13](./plans/v0.13.md) |
| 5 | v0.14 | def_scope에 decision 추가 | [v0.14](./plans/v0.14.md) |

## 영역 매핑

| 영역 | 책임 문서 |
|------|-----------|
| entry-level lifecycle / TBD placeholder | [concepts/lifecycle.md](./concepts/lifecycle.md) |
| 결정과 taxonomy entry 연결 | [concepts/lifecycle.md](./concepts/lifecycle.md), [concepts/decision-sync.md](./concepts/decision-sync.md) |
| git 기반 변경 비교와 migration helper | [concepts/semver-migration.md](./concepts/semver-migration.md) |
| decision markdown sync | [concepts/decision-sync.md](./concepts/decision-sync.md) |
| decision markdown ↔ decision-flow projection | [concepts/decision-flow-bridge.md](./concepts/decision-flow-bridge.md) |
| def-catalog scope 확장 | [plans/v0.14.md](./plans/v0.14.md) |

## 사용자 케이스 매핑

lesson-builder 정리에서 드러난 요구는 아래처럼 stage에 대응된다.

| 사용자 요구 | 표현 방식 | Stage |
|-------------|-----------|-------|
| 확정/미정 항목을 같은 taxonomy에 두기 | `lifecycle`, `placeholderReason` | Stage 1 |
| 미정 항목을 decision 기록과 연결 | `decisionLink`, decision markdown | Stage 1 + Stage 3 |
| 변경이 breaking인지 판단 | `diff().breakingLevel`, `migrationPlan()` | Stage 2 |
| 결정 evidence와 outcome 추적 | decision markdown marker | Stage 3 |
| decision을 구조적으로 분석 | `toFlowSchema()`, `qa-sdk decision analyze` | Stage 4 |
| 여러 gate가 있는 결정 표현 | `^gate:<id>` marker | Stage 4 |

## 권장 읽기 순서

1. 개념 색인: [concepts/README.md](./concepts/README.md)
2. lifecycle와 placeholder: [concepts/lifecycle.md](./concepts/lifecycle.md)
3. semver/migration 영향도: [concepts/semver-migration.md](./concepts/semver-migration.md)
4. decision sync: [concepts/decision-sync.md](./concepts/decision-sync.md)
5. decision-flow bridge: [concepts/decision-flow-bridge.md](./concepts/decision-flow-bridge.md)
6. 라운드별 구현 계획: [plans/README.md](./plans/README.md)

## 남은 결정

- Web UI의 고급 decision chain/timeline 시각화는 현재 roadmap의 구현 완료 범위 밖이다.
- `def_scope: decision` 확장은 [v0.14](./plans/v0.14.md)가 소유한다.
- 외부 URL decisionLink fetch, `decision-flow://` URI 해소, `tax:` ref registry 해소는 현재 비목표다.

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine test
pnpm --filter taxonomy-decision-bridge test
pnpm --filter @qa-sdk/cli test decision.test
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
