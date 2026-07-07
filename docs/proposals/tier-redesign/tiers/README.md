---
def:
  id: tier-redesign-tiers-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  links:
    - target: tier-redesign-readme
      type: depends_on
    - target: tier-redesign-tiers-component
      type: refs
    - target: tier-redesign-tiers-entry
      type: refs
    - target: tier-redesign-tiers-system
      type: refs
    - target: tier-redesign-tiers-layout
      type: refs
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: tiers-index
sources:
  - docs/proposals/tier-redesign/00-design.md
  - docs/proposals/tier-redesign/03-decisions.md
  - docs/proposals/tier-redesign/rules/classification.md
  - docs/proposals/tier-redesign/rules/state-machine-delegation.md
  - docs/proposals/tier-redesign/rules/system-independence.md
  - docs/proposals/tier-redesign/tiers/component.md
  - docs/proposals/tier-redesign/tiers/entry.md
  - docs/proposals/tier-redesign/tiers/system.md
  - docs/proposals/tier-redesign/tiers/layout.md
  - docs/specs/definition-catalog/definition-metadata-tier.spec.md
  - docs/specs/definition-catalog/definition-management/definition-mgmt-coordinates.spec.md
  - packages/definition-catalog/src/types.ts
  - packages/definition-catalog/src/frontmatter.ts
---

# STC Tiers

STC(`Semantic Topological Coordinate`)의 `tier` 축은 **4가지 값**을 가진다 — 데이터·인스턴스·기능·배치의 구조적 분리. 각 tier는 독립 문서로 정의되며, 한 문서가 해당하는 tier는 frontmatter `tier` 필드로 선언한다.

> **Pivot 후 구조 (D-17)**: 이전에 5 tier(Component/Entry/FSM/System/Layout)였으나 FSM은 Pivot으로 제거됨. 상태 전이/원자 경계 등은 meta-semantic(`docs/specs/meta-semantic/`)에 위임. System이 상태 관리 시 [rules/state-machine-delegation.md](../rules/state-machine-delegation.md) 참조.

## 4개 Tier 요약

| Tier | 역할 | 성격 | 대표 질문 |
|------|------|------|-----------|
| [Component](./component.md) | 데이터 정의 | Shape/스키마, 여러 System이 공유 (State enum 포함) | "이 데이터 shape은 뭔가?" |
| [Entry](./entry.md) | 구체화 인스턴스 | 런타임 인스턴스 또는 canonical singleton | "이 인스턴스는 뭐지?" (R-2 신중) |
| [System](./system.md) | 기능 집합 | Operations + 독립 운용 + 상태 관리 시 meta-semantic 참조 | "이 기능 덩어리는 뭔가?" |
| [Layout](./layout.md) | 조직적 배치 | Systems의 도메인 그룹 | "이 도메인에 어떤 Systems가 있나?" |

## Tier 간 관계

```
Component ─────→ 데이터 shape / enum / facet 계약 (여러 System 공유)
   ▲
   │ aggregates (ECS 적응)
   │
Entry  (canonical singleton ID가 Component 집합 참조)

System ─────────→ operations / compute / 상태 관리
  │
  │ lifecycle_ref (상태 있을 때)
  ↓
meta-semantic 체계 (외부)
  - Data IR.lifecycle
  - PipeTransitionScope
  - TransitionDef

Layout ─────────→ Systems 조직 (refs, ECS 외 확장 축)
```

## 판단 순서

문서가 어느 tier인지 결정할 때는 [../rules/classification.md](../rules/classification.md)의 우선순위 5단계를 따른다.

## 상태 관리가 필요한 System

상태 전이를 가진 System은 FSM을 STC에 정의하지 않고, **meta-semantic에 위임**한다:

- State enum → **Component tier**로 분리
- Lifecycle 전이 규칙 → **meta-semantic pipe** (PipeTransitionScope 등)
- System 문서는 `lifecycle_ref`로 참조만
- 상태 없는 read-only projection은 `lifecycle_ref`를 생략한다

상세: [../rules/state-machine-delegation.md](../rules/state-machine-delegation.md)

## 관련 규칙

- [System 독립성, Inline 정의 금지](../rules/system-independence.md)
- [Classification — 판단 우선순위](../rules/classification.md)
- [State Machine Delegation](../rules/state-machine-delegation.md)

## 설계 근거

- Pivot 결정 (D-17): [../03-decisions.md](../03-decisions.md)
- meta-semantic 체계 참조: `docs/specs/meta-semantic/`
