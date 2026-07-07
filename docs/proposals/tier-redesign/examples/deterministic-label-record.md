---
def:
  id: tier-redesign-examples-deterministic-label-record
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: component
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: pilot-draft
date: 2026-04-18
part_of: tier-redesign
role: component-example
supersedes: -
superseded_by: -
sources:
  - docs/proposals/tier-redesign/examples/README.md
  - docs/proposals/tier-redesign/examples/deterministic-label-record-state.md
  - docs/proposals/tier-redesign/examples/deterministic-label-system.md
  - docs/proposals/tier-redesign/tiers/component.md
  - docs/specs/definition-catalog/deterministic-label-stability-boundary.memo.md
  - packages/deterministic-label-registry/src/index.ts
  - packages/deterministic-label-registry/src/records.ts
  - packages/deterministic-label-registry/src/projection.ts
---

> **Pilot Draft — STC Component (data-shape sub-type) 예시.** D-18 반영: Component의 6 sub-type 중 가장 빈도 높은 `data-shape` 실증.
>
> state-enum Pilot ([deterministic-label-record-state](./deterministic-label-record-state.md))와 **같은 도메인을 다른 관점으로 분할**하는 패턴 시연:
> - `deterministic-label-record-state` (state-enum) — "어떤 상태들이 가능한가"
> - `deterministic-label-record` (data-shape, 본 문서) — "Record는 어떤 필드로 구성되는가"
>
> 연관: [Component tier 정의](../tiers/component.md) · [state Component](./deterministic-label-record-state.md) · [System 예시](./deterministic-label-system.md)

# Deterministic Label Record (shape)

## 목적 ^purpose

`deterministic-label-record` entity의 **field shape**을 data-shape Component로 정의한다.
현행 구현은 `packages/deterministic-label-registry/src/records.ts`의 `DeterministicLabelRecord`가
소유하며, 상태 enum/currentState는 `deterministic-label-stability-boundary` 결정에 따라 제거된
historical pilot 개념이다.

**포함**:
- Record의 field 구성 (type + optional)
- 각 field의 **역할 서술** (identity / physical refs / graph refs / diagnostics / metadata)
- 타 Component와의 참조 관계 (historical state-enum 등)

**미포함** (타 tier/체계 소유):
- 상태 전이 규칙 → meta-semantic pipe
- Operations (inventory/projection 등) → System tier
- 실제 인스턴스 값 → 코드 / DB

## 현행 코드 shape ^defines

```ts
interface DeterministicLabelRecord {
  readonly label: string;
  readonly kind: SemanticCoordinateLabelKind;
  readonly physicalRefs: readonly SemanticPhysicalRef[];
  readonly dependencyLabels: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly diagnostics: readonly SemanticCoordinateDiagnostic[];
  readonly candidate: SemanticCoordinateCandidate;
  readonly metadata: DocumentMetadata;
}
```

### Field 역할 분류

| 그룹 | 필드 | 역할 |
|-----|------|------|
| Identity | `label`, `kind`, `candidate` | deterministic semantic coordinate anchor |
| Physical refs | `physicalRefs` | source file/pointer 등 실제 위치 |
| Graph refs | `dependencyLabels`, `sourceRefs`, `evidenceRefs` | 문서/소스/증거 label 관계 |
| Diagnostics | `diagnostics` | projection 중 발견한 warning/error |
| Metadata | `metadata` | `DocumentEnvelope`에서 온 보조 metadata |

### Historical state pilot

초기 STC pilot은 `state: DeterministicLabelRecordState`, readiness evidence, transition dry-run을 함께
상정했다. 현행 패키지는 이를 제거했으므로, [deterministic-label-record-state](./deterministic-label-record-state.md)는
현재 code contract가 아니라 state-enum Component 패턴을 검토하기 위한 historical pilot이다.

## Sub-type 분리 근거

왜 `state`를 field로만 두지 않고 **별도 state-enum Component**로 분리했나:

- **재사용**: 같은 state 집합을 여러 Record type이 공유 가능
- **D-17 lifecycle_ref 연결점**: System의 `lifecycle_ref.state_component`가 참조하는 **단일 anchor**가 필요
- **SSOT 분리**: 상태 리스트 변경 ↔ shape 변경은 **독립 lifecycle**

evidence 필드도 동일 논리로 **evidence-shape sub-type**으로 분리 권장 (현행 record는 `evidenceRefs` label 배열만 보유).

## SSOT 매핑

현행 code type이 이 data-shape pilot의 **source evidence**다:

```
packages/deterministic-label-registry/src/records.ts
  → DeterministicLabelRecord
  → buildDeterministicLabelRecord()
  → projectDeterministicLabelRecordsFromDocuments()
```

`def validate`가 Component shape와 code type의 구조 일치를 강제하는 것은 아직 Phase 1.B 후속 범위다.

## 소비 System / Component

본 data-shape을 참조하는 것:

- **System**: [deterministic-label-system](./deterministic-label-system.md) — operations의 입출력 shape
- **state-enum Component**: [deterministic-label-record-state](./deterministic-label-record-state.md) — historical readiness/state pilot
- **evidence-shape Component (미작성)**: 현행 record의 `evidenceRefs`가 가리키는 target shape

## meta-semantic 매핑

| meta-semantic | STC |
|--------------|-----|
| `Data IR` (Record의 생산/소비 관계) | 본 data-shape Component + System projection |
| Data facet 5역할 (생산/소비/정의/관리/저장) | 본 shape을 `data-facet-role` sub-type에서 역할별로 재서술 가능 |

**원칙**: 본 문서는 shape만. facet 역할별 관점은 `data-facet-role` sub-type Component가 따로 소유.

## 변경 경로 (breaking change 관리)

Component는 여러 System이 공유하므로 shape 변경은 **breaking change**:

1. v2 shape Component 신규 문서 작성 (예: `deterministic-label-record-v2`)
2. 본 v1 문서에 `superseded_by: deterministic-label-record-v2` 표기
3. Consumer System이 v1 → v2 점진 이전
4. v1 deprecated 후 archive

이 패턴으로 **여러 System 동시 breaking 회피** (§1.1 공유 의존성 원칙).

## Pilot 관찰 사항

- [ ] state 필드 같은 "다른 Component 참조"의 표기가 타입 주석으로 충분한가 vs frontmatter 레벨 `references: [state-component-id]` 필드 필요한가
- [ ] evidence-shape sub-type Pilot이 없어 `*EvidenceRef` 참조 target이 vacuous — 별도 Pilot 작성 시점 결정 필요
- [ ] data-shape과 state-enum이 같은 도메인을 분할할 때 id 네이밍 컨벤션 (`<entity>-record` / `<entity>-record-state`)이 일관되게 적용 가능한가
- [ ] Record 필드 수가 많아지면 (>20) data-shape을 여러 문서로 쪼개야 하나, 한 문서 유지하나 (Phase 2 자동 분류 결정 대상)
- [ ] `component_subtype: data-shape` frontmatter + TS `interface` 블록의 이중 표현 — `def validate`가 둘 일치를 강제해야 하나

## Consumer 빠른 참고

- **"Record 필드 구성은?"** → 위 `DeterministicLabelRecord` TS interface
- **"가능한 state 값은?"** → 현행 code contract에는 없음. historical pilot은 [state Component](./deterministic-label-record-state.md) 참조
- **"readiness 계산 로직은?"** → 현행 code contract에는 없음. boundary memo에서 readiness/dry-run 제거 결정
- **"source 파일 참조?"** → `physicalRefs`, `sourceRefs`, `candidate.metadata` 조합. 상세 projection은 `projection.ts`와 `records.ts`
