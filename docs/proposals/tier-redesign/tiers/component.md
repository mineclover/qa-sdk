---
def:
  id: tier-redesign-tiers-component
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
---

# STC Tier — Component (데이터 진입점)

## 정의

Component tier는 **모든 데이터 개념의 STC-level 진입점** (D-18). 데이터의 shape/role/schema/enum/상수가 여기로 들어온다. 내부적으로 **sub-type taxonomy**로 세분화되어 관리되며, meta-semantic이 다루는 Data 개념(Data IR, 5 facet 역할 등)은 Component sub-type 중 하나로 매핑된다.

> **역할 경계 (D-18)**:
> - **STC Component** = 문서 레벨 진입점 (tier taxonomy)
> - **meta-semantic** = 실행/runtime 구현 체계 (Data IR lifecycle, pipe 등)
> - 같은 "데이터" 개념의 다른 관점 서술 — 이중 소유 아님

여러 System이 공유하는 **계약**이므로 변경은 **breaking change**로 취급한다 (§1.1 공유 의존성 근거).

## Sub-type Taxonomy

Component tier의 6개 sub-type. `component_subtype` frontmatter 필드로 선언.

| Sub-type | 역할 | 대표 필드 | 예시 |
|---------|------|----------|------|
| `data-shape` (primary) | 타입/인터페이스/스키마 | `schema: {...}` | `LabelRecord`, `EventRecord` |
| `state-enum` | 전이 규칙 없는 상태 리스트 | `states: [...]` | `DeterministicLabelRecordState` |
| `evidence-shape` | 계산 결과 데이터 형상 | `shape: {...}` | `GuardEvidence`, `ReadinessEvidence` |
| `data-facet-role` | meta-semantic 5역할 매핑 | `facet_role: production\|consumption\|...` | 특정 역할의 데이터 문서 |
| `validation-rule` (후보) | data-shape의 validation 조건 | `rules: [...]` | zod schema 조건, 제약식 |
| `constant-literal` (후보) | 불변 상수 리스트 | `values: [...]` | 허용 값 열거 |

`validation-rule`, `constant-literal`은 초기엔 **후보** — data-shape의 하위로 충분할 수 있음. Pilot 관찰로 독립 sub-type 여부 결정.

### Sub-type 예시 — state-enum

```yaml
---
tier: component
component_subtype: state-enum
id: deterministic-label-record-state
---

# DeterministicLabelRecordState

## 상태 목록

- `DRAFT` — initial
- `LINTED` — intermediate
- `RESOLVED` — intermediate
- `ACTIVE` — intermediate
- `DEPRECATED` — terminal
- `ARCHIVED` — terminal
- `BLOCKED` — reserved (write controller 소유)

전이 규칙은 meta-semantic 참조 (System의 `lifecycle_ref.pipe_refs`).
```

### Sub-type 예시 — data-shape

```yaml
---
tier: component
component_subtype: data-shape
id: label-record
---

# LabelRecord

```ts
interface LabelRecord {
  id: string
  state: DeterministicLabelRecordState   // state-enum Component 참조
  ontologyPackId?: string
  ...
}
```
```

### Sub-type 예시 — data-facet-role

```yaml
---
tier: component
component_subtype: data-facet-role
id: production-role-of-label-data
facet_role: production
---

Label 데이터의 **생산 역할** 서술. meta-semantic의 데이터 패싯 5역할 중 하나.
```

## meta-semantic과의 매핑

| meta-semantic 개념 | Component sub-type | 문서 위치 |
|------------------|------------------|---------|
| `Data IR` (`meta-semantic-ir.spec.md` § lifecycle) | `data-shape` + lifecycle 참조 | meta-semantic 문서가 소유, Component에서 prose 참조 |
| Data facet 5역할 (`ms-concept-data-facets.spec.md`) | `data-facet-role` | 역할별로 Component 문서 가능 |
| PipeFlow 입출력 data | `data-shape` (pipe 소유) | pipe 문서 소유 |
| Evidence / Gate output | `evidence-shape` | System 문서 주변 |

**원칙**: meta-semantic 문서는 실행 체계 문서로 **meta-semantic 영역에 유지**. STC Component는 동일 개념을 tier taxonomy 관점에서 **분류**만 한다.

## 여러 System 공유 계약

Component는 여러 System이 공유한다 (§1.1). 따라서:

- 변경은 **breaking change**로 관리
- v1 → v2 전환은 신규 문서 + `superseded_by` 마킹

## 포함 금지

- Operations / 함수 구현 → [System tier](./system.md)
- 특정 인스턴스 값 → [Entry tier](./entry.md) 또는 코드 내부
- 상태 전이 규칙 → meta-semantic 참조 (System의 `lifecycle_ref`)

## Entry와의 관계 (ECS 적응 기반)

ECS 정석에서 Entity는 **고유 ID가 여러 Component를 aggregates**하는 식별자(OOP의 class / instance 관계 아님). STC Entry tier도 이 모델을 따른다:

- **Component** = 데이터 shape / enum / facet 역할의 **정의** (타입 정의가 아니라 **계약**)
- **Entry** = 특정 canonical ID가 **어떤 Component들을 aggregates하는지** 선언하는 문서 — ID 자체가 문서 대상

단, **문서 tier로서 Entry는 희소**하며 R-2 재평가 대상. 런타임 Entity 대부분은 동적 생성/소멸되어 문서 대상이 아님. canonical singleton만 Entry 후보. D-18로 State enum이 Component sub-type으로 자리 잡으면서 Entry tier 입지는 더 좁아짐 (예: 이전에 "DRAFT 상태 label 인스턴스"를 Entry로 고려했다면, 지금은 State Component로 충분히 서술됨).

상세: [../03-decisions.md#R-2](../03-decisions.md), [mental-models.md § ECS 정석 vs STC 적응](../mental-models.md)

## 변경 경로

Component 변경은 다음 권장 패턴:

1. v2 Component를 신규 문서로 작성 (예: `label-record-v2`)
2. 기존 v1 Component에 `superseded_by: label-record-v2` 표기
3. Consumer System들이 v1 → v2로 점진 이전
4. v1은 deprecated lifecycle로 이동

이 패턴은 **공유 의존성 원칙**을 보호 — 여러 System이 동시에 breaking change에 노출되지 않도록.

## 좌표 권장값

| 축 | 권장 | 허용 |
|----|------|------|
| `tier` | `component` | — |
| `scope` | `data` | `data` / `interface` (API 스키마일 때) |
| `aspect` | 상황에 따라 | `domain_data` / `system_data` / `external_data` / `prefix_schema` / `axis_catalog` / `api_contract` |
| `layer` | 상황에 따라 | `domain` / `operation` / `mediation` |
| `component_subtype` (D-18) | 위 6개 중 하나 | — |

## 전환 힌트 (level → tier)

- `leaf` + 데이터/스키마 정의 → `component` (data-shape)
- `leaf` + 상태 리스트만 → `component` (state-enum)
- `leaf` + evidence 형상 → `component` (evidence-shape)
- `module` + 데이터 집합이지만 operations 없음 → `component`

상세 판단: [../rules/classification.md](../rules/classification.md)

## 예시

- Pilot: [../examples/deterministic-label-record.md](../examples/deterministic-label-record.md) — `data-shape` sub-type 예시 (primary)
- Pilot: [../examples/deterministic-label-record-state.md](../examples/deterministic-label-record-state.md) — `state-enum` sub-type 예시
- Pilot: [../examples/approval-request-state.md](../examples/approval-request-state.md) — `state-enum` (write-mode 연결)
- 기존 qa-sdk 문서 중 대다수 "데이터 정의" 문서는 **data-shape** Component로 분류 예정 (Phase 2 자동 분류)
