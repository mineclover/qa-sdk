---
def:
  id: tier-redesign-tiers-entry
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: component
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: tier-definition
supersedes: -
superseded_by: -
sources:
  - docs/proposals/tier-redesign/03-decisions.md
  - docs/proposals/tier-redesign/rules/classification.md
  - docs/proposals/tier-redesign/mental-models.md
  - docs/proposals/tier-redesign/tiers/component.md
  - docs/specs/definition-catalog/definition-metadata-tier.spec.md
  - docs/specs/definition-catalog/definition-management/definition-mgmt-coordinates.spec.md
  - packages/definition-catalog/src/types.ts
  - packages/definition-catalog/src/frontmatter.ts
---

# STC Tier — Entry (ECS Entity 적응)

## 정의

**고유 ID가 여러 Component를 aggregates하는 canonical 식별자 문서.** ECS 정석의 Entity(= ID + Component 참조 집합) 모델을 따른다 — Component의 "instance"나 "projection"이 아니라, **어떤 Component들을 조합해 단일 ID 뒤에 묶는지 선언**한다.

```
예: system-root-layout (canonical 싱글톤 ID)
    ├── ref: ontology-pack-layout-component        (data-shape)
    ├── ref: layout-state-enum                     (state-enum)
    └── ref: layout-evidence-shape                 (evidence-shape)
  → "system-root-layout"이라는 ID가 위 3 Component들을 aggregates
```

> **ECS 정석과의 차이**: ECS Entity는 런타임 객체(ID만 보유, 모든 상태는 Component에)이지만 STC Entry는 **canonical ID의 문서화 대상**이다. 대부분의 런타임 Entity는 동적 생성/소멸되어 문서 대상이 아님 — 본 tier는 그 중 **singleton/canonical 형태만**을 담는다. 상세: [../mental-models.md § ECS 정석 vs STC 적응](../mental-models.md)

## ⚠️ R-2 조건부 존속 (정량 trigger 박제)

Entry는 **런타임 인스턴스** 성격이 강해 **문서로 서술할 대상이 희소**할 수 있다.

- 런타임 인스턴스는 일반적으로 문서화 대상이 아님 (동적 생성/소멸)
- Entry 문서의 합리적 후보는 "canonical/singleton 인스턴스 패턴" 정도 — 희소
- **Phase 1~3 동안 사용 신중**. 애매하면 Component tier로 분류.

### 존속 조건 (정량 trigger)

본 tier는 **Option A 확정 + Phase별 정량 trigger 박제** 상태. 하나라도 발동 시 Entry tier 제거(Option B):

| Phase | Trigger | 대응 |
|-------|---------|------|
| Phase 2 | 자동 분류 Entry 후보 < 3건 | Phase 3 진입 전 Option B 전환 개시 |
| Phase 3 | Pilot 실사용 건수 = 0 | Phase 4에 Option B 강제 적용 |
| Phase 4 | 최종 Entry 문서 < 5건 | Option B 제거 + Component 또는 System metadata로 흡수 |

**기대값**: R-2 약점(런타임 instance ≠ 문서 대상)을 고려하면 Phase 3 trigger 발동 확률 높음. Entry tier는 "안전 퇴로를 둔 조건부 제거"에 가까움.

상세 논의: [../03-decisions.md#R-2](../03-decisions.md)

## Entry 후보가 될 수 있는 경우

- 시스템 내 유일한 singleton ID (예: "the system-root layout")
- 특정 canonical 좌표를 점유하는 알려진 ID (예: "the default codec")
- 여러 Component를 aggregates하는 **명명된 조합 ID**가 문서화 가치 있는 경우 (archetype 유사)

## Entry가 아닌 경우 (대안)

- 단순 타입/스키마 → [Component](./component.md) (Entry는 타입이 아니라 ID aggregation)
- 여러 인스턴스의 공통 shape → [Component](./component.md) (= Entity가 가질 수 있는 Component 정의)
- 인스턴스 생명주기 전이 → System의 `lifecycle_ref`가 State Component + meta-semantic 참조 ([state-machine-delegation](../rules/state-machine-delegation.md))
- 동적 런타임 객체 (생성/소멸) → 문서 대상 아님 (코드 + DB row)

## 좌표 권장값

| 축 | 권장 |
|----|------|
| `tier` | `entry` |
| `scope` | 상황에 따라 (`data` / `state` 등) |
| `aspect` | 상황에 따라 |
| `layer` | 상황에 따라 |

## 전환 힌트 (level → tier)

- `leaf` + canonical singleton ID + 여러 Component aggregation → `entry` (**R-2 신중**)

우선순위 최하 — 다른 tier가 더 적합하면 그쪽으로.

상세 판단: [../rules/classification.md](../rules/classification.md)

## 예시

Pilot 단계에서는 의도적으로 Entry tier 예시를 만들지 않음. Pilot 관찰 결과에 따라 존속/제거 결정 후 예시 여부 결정.
