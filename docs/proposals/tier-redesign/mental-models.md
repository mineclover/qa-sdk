---
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: mental-models
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/tier-redesign/`의 일부. STC 제안의 **읽기 지도** 역할 — 설계를 여러 mental model로 투영해 독자가 배경에 맞는 모델을 선택할 수 있게 함.

# STC Mental Models — Taxonomy 기반 읽기 지도

## 목적

STC 제안은 **3가지 mental model**의 교차로 읽을 수 있다. 모델은 모두 **taxonomy 형식**으로 정의되며 (qa-sdk 컨벤션 준수), 각자 직교적이다. **관점(perspective)**은 이 taxonomy들을 어떻게 조회하느냐의 질의 패턴.

> **Pivot 후 구조 (D-17)**: 이전에 Model 2로 "FSM 내부 sub-taxonomy"가 있었으나 제거됨. 상태 전이 체계는 STC 외부의 **meta-semantic**(`docs/specs/meta-semantic/`)이 소유. System이 상태 관리 시 meta-semantic 참조로 연결 — 상세 [rules/state-machine-delegation.md](./rules/state-machine-delegation.md).

- 모델은 **구조**를 정의 (taxonomy 축과 값)
- 관점은 **질의**를 정의 (축의 조합으로 subset 필터링)
- 모델 + 관점 = STC 문서 공간을 탐색하는 두 축

---

## Model 1 — ECS 적응 (tier taxonomy)

ECS(Entity/Component/System) 패턴에서 차용한 **tier 축의 값 체계**. STC 신규 축.

### Taxonomy

```
tier ∈ { component, entry, system, layout }
```

### 각 값의 의미

| 값 | 역할 | 특징 |
|----|------|------|
| `component` | **데이터 진입점** (모든 데이터 개념의 STC-level 진입) | 6 sub-type(data-shape / state-enum / evidence-shape / data-facet-role / validation-rule / constant-literal) taxonomy. 여러 System 공유 계약. meta-semantic Data 개념의 매핑 지점. (D-18) |
| `entry` | 구체 instance | R-2 조건부 존속 (canonical singleton만). D-18로 입지 축소 |
| `system` | Operations 집합 | R-7 3-check, 독립 운용, 상태 관리 시 meta-semantic 참조 |
| `layout` | systems의 조직적 배치 | `refs` 기반, inline 정의 금지 |

### 상태 기반 시스템

상태 전이가 필요한 System은 **meta-semantic 체계에 위임** (D-17 Pivot):
- State enum → Component tier 분리
- Lifecycle 전이 → meta-semantic (`PipeTransitionScope`, `Data IR.lifecycle`)
- System은 `lifecycle_ref`로 참조만

상세: [rules/state-machine-delegation.md](./rules/state-machine-delegation.md)

### ECS 정석 vs STC 적응 — 변형점 공식화

STC는 ECS를 **그대로 재현하지 않는다**. "ECS 적응"이라는 라벨의 정확한 범위는 아래 표로 박제:

| 항목 | ECS 정석 | STC 적응 | 변형 근거 |
|------|---------|---------|---------|
| **Entity** | 고유 ID가 **Component를 aggregates**. 런타임 객체. ID 자체에 데이터 없음 | `Entry` tier. **canonical singleton ID**만 문서화 대상 (런타임 Entity 대부분은 동적 생성/소멸이라 문서 아님) | 문서 체계 특성상 동적 인스턴스는 tier 대상 아님. R-2 신중 |
| **Component** | 순수 데이터 (behavior 없음) | `Component` tier + 6 sub-type (data-shape / state-enum / evidence-shape / data-facet-role / validation-rule / constant-literal) | D-18. 데이터 진입점으로 타입/상태/역할 모두 수용 |
| **System** | 전역 순수 로직. Entity iteration + Component query | `System` tier. operations 집합 + R-7 3-check. 상태 관리는 **meta-semantic 외부 위임** (`lifecycle_ref`) | 이중 소유 회피 (D-17). ECS 정석에서는 State가 Component에만 있지만 STC는 "State enum Component + 전이 규칙 meta-semantic" 분리 |
| **Scene / World** | (ECS 정석 외) archetype/scene 개념 일부 프레임워크 | `Layout` tier. **ECS 정석 4번째 축이 아니라 확장 개념** | 문서 조직 단위 필요 — Layout 재귀로 System 배치 + Entry/Component/System 발견 |
| **"ECS 원칙 기반"** 표현 (이전) | — | **"ECS 적응 기반"**으로 통일 완료 (README / 00-design) | 본 표가 정확한 변형 범위 |

**핵심 변형**: STC는 ECS의 **3축(Entity/Component/System)** 을 문서 분류로 이식하되, (1) Layout 확장 / (2) Entity 문서화 대상 축소 / (3) State 관리 외부 위임 — 세 가지 변형을 가진다.

### 관련 문서

- [tiers/](./tiers/) — 각 tier 값의 독립 정의 문서
- [00-design.md §2](./00-design.md) — 전체 tier 체계
- [tiers/layout.md](./tiers/layout.md) — Layout이 ECS 외 확장인 이유

---

## Model 2 — 문서 유형 분리 (doc-type taxonomy)

같은 `id` 개념에 대해 **역할을 확장자로 분리**. qa-sdk 기존 convention. tier와 직교.

### Taxonomy

```
doc-type-ext ∈ { .spec, .rule, .todo, .plan, .test, .memo, .cases }
```

### 각 확장자의 역할

| 확장자 | 역할 | lifecycle 힌트 |
|-------|------|--------------|
| `.spec` | 완성 정의 | approved (변경 어려움) |
| `.rule` | 소비 규칙 (체크리스트/판별) | spec 따름 |
| `.todo` | 실행 항목 (체크박스) | draft |
| `.plan` | 방향 / 목표 | — |
| `.test` | 검증 기준 (test.ts 참조) | spec 따름 |
| `.memo` | 결정 맥락 | — |
| `.cases` | 시나리오 | — |

### tier × doc-type 직교성 (R-1)

같은 id 도메인에 대해 여러 확장자 공존 가능:

```
docs-control-plane.spec.md       (tier=system, .spec)
docs-control-plane.rule.md       (tier=system, .rule)
docs-control-plane.todo.md       (tier=system, .todo)
docs-control-plane.plan.md       (tier=system, .plan)
```

네 파일은 같은 `id: docs-control-plane` + 같은 `tier=system`이지만 **다른 역할**(확장자)로 독립 존재.

### 관련 문서

- [03-decisions.md R-1](./03-decisions.md) — tier ⊥ doc-type 직교성
- qa-sdk `docs/specs/system/doc-type-convention.spec.md` (정규 docs) — 컨벤션 원본

---

## Model 3 — Taxonomy 교차 단위 관점

여러 taxonomy가 동시 존재할 때 문서의 **identity = 모든 축의 특정 값 조합 (교차점)**. 분석 단위는 개별 축이 아닌 **교차 단위**.

### 전체 taxonomy 축

qa-sdk + STC에서 문서에 적용되는 모든 분류 축:

| 축 | 값 공간 | 소유 |
|----|--------|------|
| `tier` | Model 1 taxonomy (**4값**) | STC 신규 |
| `scope` | data / feature / flow / constraint / interface / state / ui | 기존 |
| `aspect` | scope별 허용 조합 (`docs/specs/system/` 참조) | 기존 |
| `layer` | domain / operation / mediation / experience | 기존 |
| `lifecycle` | draft / approved | 기존 |
| `doc-type-ext` | Model 2 taxonomy (7값) | 기존 |
| `tags` | StructuralTag / ConcernTag / ... | 기존 |

### 교차 단위 예시

하나의 문서 = 모든 축의 특정 값 교차점:

```
예: deterministic-label-system.spec.md의 교차 좌표
  tier           = system
  scope          = feature
  aspect         = func_def
  layer          = mediation
  lifecycle      = approved
  doc-type-ext   = .spec
  tags           = [contract, observability]

→ 이 7-tuple이 문서의 identity
→ 다른 축 값으로 교차점 이동 시 별개 문서
```

### 의미

- 같은 `id` + 다른 `doc-type-ext`는 다른 교차점 = 다른 단위
- 같은 `id` + 다른 `tier`는 논리적 모순 (tier는 id에 종속)
- 같은 `tier=system` + 다른 `scope`는 별개 단위 (e.g., domain-feature System vs interface-feature System)

### STC 제안의 기여

기존 좌표 공간(scope × aspect × layer × doc-type)에 **`tier` 축 신규 추가**로 교차 공간을 확장. 이전에 같은 교차점이었던 문서가 tier로 추가 구별됨.

---

## 관점 (Perspective) — Taxonomy 질의 조합

**관점**은 위 taxonomy들을 **어떤 조합으로 필터링해 조회하느냐**의 질의 패턴.

### 정의

```
perspective = filter(taxonomy_1, taxonomy_2, ...) over documents
```

각 관점은 **subset을 반환**. 다른 관점은 다른 subset.

### 예시 관점

```
## Perspective: "Active System Contracts"
filter: tier = system AND doc-type-ext = .spec AND lifecycle = approved
결과: 운영 가능한 System 계약 문서 (Consumer가 소비할 surface)

## Perspective: "Active Layouts"
filter: tier = layout AND lifecycle = approved
결과: 운용 중인 도메인 카탈로그

## Perspective: "Cross-scope Components"
filter: tier = component AND tags contains "cross-scope"
결과: 여러 scope 공유하는 데이터 shape (breaking change 주의 대상)

## Perspective: "State enum Components"
filter: tier = component AND has states[] field
결과: State enum 역할 Component (D-17로 분리된 상태 카탈로그)

## Perspective: "Stateful Systems"
filter: tier = system AND has lifecycle_ref
결과: 상태 관리를 하는 System (meta-semantic 참조 포함)

## Perspective: "Unfinished work"
filter: doc-type-ext = .todo OR lifecycle = draft
결과: 진행 중인 작업 (전 tier)

## Perspective: "Pilot 검증 대상"
filter: part_of = tier-redesign AND role = pilot-draft
결과: 본 제안 Pilot 예시들
```

### 관점의 실용 형태

관점은 Phase 1.B 이후 **도구 실행 형태**로 구현될 수 있음:

```bash
qa-sdk def query --tier system --doc-type spec --lifecycle approved
qa-sdk def query --tier system --has lifecycle_ref
qa-sdk def query --tier component --tags cross-scope
qa-sdk def query --tier component --has states
```

현재는 **설계 개념**으로만 존재 (도구 구현 전).

### 관점의 이점

같은 taxonomy 공간에서 여러 질의가 가능하므로:

- **Producer 질의**: "내가 구현할 System 계약" → `tier=system AND doc-type=.spec`
- **Consumer 질의**: "사용 가능한 System 목록" → `tier=system AND lifecycle=approved`
- **Maintainer 질의**: "미완 작업" → `doc-type=.todo OR lifecycle=draft`
- **Reviewer 질의**: "제안 전체" → `part_of=<proposal-name>`
- **상태 감사**: "State enum을 쓰는 System" → `has lifecycle_ref` + `tier=system`

각 역할의 **질의 조합**이 관점이며, 단일 문서 구조 안에서 다양한 뷰 제공.

---

## 세 모델의 관계

```
Model 1 (ECS) ──────────┐
                        │
                        │  Model 3이 전체를 교차 조회
Model 2 (doc-type) ─────┼─── (관점 = taxonomy 질의 조합)
                        │
기존 axes (scope/layer) ┘

상태 관리 필요 System:
  Model 1 System tier ──(lifecycle_ref)──→ meta-semantic (STC 외부)
                                            - Data IR.lifecycle
                                            - PipeTransitionScope
                                            - TransitionDef
```

- **Model 1 (ECS)** — tier 축 값 체계 (신규 축, **4값**)
- **Model 2 (doc-type)** — tier와 직교하는 역할 축 (기존)
- **Model 3 (교차 단위)** — 모든 축의 교차점을 단위로 보는 **관점의 기반**
- **관점(perspective)** — Model 3 위에서 taxonomy를 조합해 subset을 질의

세 모델은 **동시 성립 + 직교**. 독자는 자기 배경에 맞는 모델을 선택해 진입.

> **meta-semantic과의 관계**: 상태 기반 도메인은 meta-semantic 체계에 위임. STC는 "분류"만 소유, meta-semantic은 "실행/상태"만 소유 — 역할 분리 명확. 상세: [rules/state-machine-delegation.md](./rules/state-machine-delegation.md)

---

## 읽는 순서 권장

| 독자 배경 | 먼저 읽을 모델 |
|---------|-------------|
| ECS / 게임 엔진 / 백엔드 서비스 | Model 1 → Model 3 |
| 온톨로지 / 분류학 | Model 3 → Model 1 → Model 2 |
| 기존 qa-sdk 관례 따른 사람 | Model 2 → Model 3 → Model 1 |
| 도구/CLI 기반 접근 | 관점 섹션 → Model 3 → 나머지 |
| 상태 기반 도메인 관심 | Model 1 → [state-machine-delegation](./rules/state-machine-delegation.md) → meta-semantic |

---

## 연결 문서

- [00-design.md](./00-design.md) — 전체 설계 허브
- [tiers/](./tiers/) — Model 1 각 값의 정의
- [rules/state-machine-delegation.md](./rules/state-machine-delegation.md) — 상태 관리 위임 규칙
- [03-decisions.md](./03-decisions.md) — R-1 (tier ⊥ doc-type, Model 2 직교성), D-17 (Pivot)
- qa-sdk 기존: `docs/specs/system/doc-type-convention.spec.md` — Model 2 컨벤션 원본
- meta-semantic: `docs/specs/meta-semantic/` (상태/전이/원자성 체계)
