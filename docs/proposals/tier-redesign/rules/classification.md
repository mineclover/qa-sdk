---
def:
  id: tier-redesign-rules-classification
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: classification-rules
supersedes: -
superseded_by: -
---

# Classification — level → tier 전환 기준 + 판단 우선순위

## 최상위 분류 (Top-Level Taxonomy): Design vs Knowledge (D-19)

모든 `definition-catalog` 문서는 `type` 필드를 통해 두 도메인 중 하나에 소속된다. 이는 문서의 본질을 결정하는 최상위 마스터 스위치다.

| 최상위 구분 (`type`) | 본질 | 핵심 질문 | 주권 축 (Sovereign Axis) | 허용 확장자 |
|:---:|:---|:---|:---|:---|
| **`design`** (또는 `spec`) | 행동적(Actionable) 자산 | "무엇을 어떻게 만들고 검증하는가?" | `doc-type-ext` | `.spec`, `.rule`, `.test`, `.plan`, `.cases` |
| **`knowledge`** (지식) | 맥락적(Contextual) 자산 | "왜 그렇게 결정했으며 맥락은 무엇인가?" | `knowledge_kind` | `.md`, `.memo`, `.todo` |

- **Design 영역**: 정밀한 좌표(`scope` × `aspect` × `depth`)와 `tier` 필드 **필수**. `knowledge_kind` 사용 금지.
- **Knowledge 영역**: `knowledge_kind` 필드 **필수**. 좌표는 포괄적이거나 생략 가능. `tier` 필드 면제. 설계용 확장자 사용 금지.

이후의 tier 판단은 **`type: design`**인 문서에 대해서만 강제된다.

---

## 판단 우선순위 (첫 매칭이 이기는 룰)

위에서부터 먼저 적용.

| 우선순위 | 판단 질문 | 해당 tier | 비고 |
|---------|----------|----------|------|
| 1 | `type: knowledge` 문서인가? (개념/철학/ADR/패턴) | tier 면제 | `knowledge_kind` 필드 사용 |
| 2 | Operations 집합 + R-7 3-check 2개 이상 충족? | [`system`](../tiers/system.md) | CRUD / read-only / event-driven / 변환 모두 포함. 상태 관리 시 meta-semantic 참조 (D-17) |
| 3 | 여러 system을 조직적으로 배치하는가? | [`layout`](../tiers/layout.md) | `refs`로 참조, `contains` 금지 |
| 4 | 데이터/스키마/상태/evidence/역할을 정의하는가? | [`component`](../tiers/component.md) | Breaking change 주의. D-18 sub-type 결정 필요 (data-shape / state-enum / evidence-shape / data-facet-role / validation-rule / constant-literal) |
| 5 | 잘 알려진 singleton 인스턴스 패턴인가? | [`entry`](../tiers/entry.md) | R-2 신중, 후보 0~2건이면 Phase 4 재평가 |

> **Pivot 후 (D-17)**: 이전 우선순위 2 "상태 전이를 선언적으로 정의하는가? → fsm"은 제거됨. 상태 전이가 있는 도메인은 System tier + Component tier (State enum) + meta-semantic(`PipeTransitionScope` 등) 참조로 표현. 상세: [state-machine-delegation.md](./state-machine-delegation.md)

## 예외 (향후 결정 대상)

### Operational instruction 면제 — positive list + scope creep 방지

**D-2 확장**: knowledge 예외와 유사한 tier 면제 대상을 **positive list**로 제한. Default는 tier 적용.

**허용 패턴 (잠정, Phase 1.A 조사에서 확정)**:
- `CLAUDE.md` (루트 + 각 package 레벨)
- `GEMINI.md`, `AGENTS.md`
- `.claude/skills/**/*.md` (skill 정의 문서)
- `~/.codex/skills/**/*.md`
- `docs/skills/**/README.md` (skill 인덱스)

**명시적 불허** (tier 적용 유지):
- `packages/*/README.md` (package 소개는 System tier 문서로 편입)
- `scripts/**/*.md` (스크립트 설명도 tier 적용)
- 기타 일반 문서

### Scope creep Exit Criteria

Phase 1.A 조사 결과 operational 예외 대상이 **> 150건 초과** 시 Exit Criteria trigger로 추가 — 예외가 너무 넓어지면 tier 체계가 실제 커버하는 문서 영역 협소화. 대응: positive list 재정의 또는 규칙 철회.

## 기존 level과의 대략 매핑

이관 힌트만. 최종 판단은 위 우선순위로 수행.

| 기존 level | 대응 tier 후보 |
|-----------|--------------|
| `leaf` | `component` / `entry` 중 하나 |
| `module` | `system` / `component` 중 하나 |
| `group` | `layout` / `system` 중 하나 |

## R-7 3-check (System 판단용)

우선순위 3의 "Operations 집합 + R-7 3-check 2개 이상"은 다음을 의미:

1. **명명 가능성** — Consumer가 고유 이름을 붙여 부르는가
2. **독립 운용** — 다른 System 없이 단독으로 의미 있는 결과를 내는가
3. **Lifecycle 유무** — 관리하는 Entry의 상태가 의미 있게 변화하는가

2개 이상 충족 시 `system`, 1개 이하 시 `component` + 함수 집합 또는 내부 헬퍼 분류. 상세: [../tiers/system.md](../tiers/system.md) § 외연 기준.

## Component sub-type 결정 (D-18)

Component tier가 확정된 후 sub-type 판단:

| 질문 | component_subtype |
|------|-------------------|
| 상태 리스트만 있고 전이 규칙 없는가? | `state-enum` |
| 계산 결과 데이터 형상인가? (guard/validation output) | `evidence-shape` |
| meta-semantic 5역할(생산/소비/정의/관리/저장) 중 하나인가? | `data-facet-role` |
| 타입/인터페이스/스키마 정의인가? (기본) | `data-shape` |
| data-shape의 validation 조건만 담는가? | `validation-rule` (후보 — data-shape 하위 검토) |
| 불변 상수 리스트만 담는가? | `constant-literal` (후보 — data-shape 하위 검토) |

## 애매 케이스 해소

다수 tier에 부합할 때는:

- **Component와 System 동시 후보** → 분리 또는 Component 우선 (System 부재 시)
- **System과 Layout 동시 후보** → **R-7 3-check** 로 판단 — 2개 이상이면 System, 아니면 Layout
- **State enum 소유 ambiguity** — State 리스트만 있으면 Component tier로 분리. System이 상태 관리까지 하면 System tier + Component(State enum) 조합 (state-machine-delegation.md 규칙)

실제 케이스: [../03-decisions.md § Sanity Check](../03-decisions.md)

## 근거

- Phase 0 결정: [../03-decisions.md#D-3](../03-decisions.md)
- 원칙: [../00-design.md §1](../00-design.md)
