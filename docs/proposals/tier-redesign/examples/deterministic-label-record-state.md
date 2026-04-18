---
status: pilot-draft
date: 2026-04-18
part_of: tier-redesign
role: component-example
supersedes: -
superseded_by: -

# STC frontmatter (예시용)
tier: component
component_subtype: state-enum
id: deterministic-label-record-state
scope: state
aspect: domain_state
layer: mediation
---

> **Pilot Draft — STC Component (state-enum sub-type) 예시.** D-18 반영: Component의 sub-type 체계 실증.
>
> 연관: [Component tier 정의](../tiers/component.md) · [System 예시](./deterministic-label-system.md) · [State Machine Delegation](../rules/state-machine-delegation.md)

# Deterministic Label Record State

## 목적 ^purpose

`deterministic-label-record`가 가질 수 있는 상태 리스트를 **state-enum Component**로 정의. [deterministic-label-system](./deterministic-label-system.md)의 `lifecycle_ref.state_component`가 본 문서를 참조.

**포함**:
- 상태 enum 리스트
- 각 state의 역할 (initial / intermediate / terminal / reserved)
- 각 state의 간단한 description

**미포함** (meta-semantic이 소유):
- 상태 간 전이 규칙
- Guard pre-condition
- Transition 실행 흐름
- Evidence 상세

## 상태 목록 ^defines

### DRAFT
- **Role**: initial
- **설명**: 좌표 후보가 생성된 직후. syntax/frontmatter/schema/doc-type validation 미확인

### LINTED
- **Role**: intermediate
- **설명**: 문서 shape validation 통과. 외부 참조(dependency/source/evidence) 해소 미확인

### RESOLVED
- **Role**: intermediate
- **설명**: dependency/source/evidence refs 모두 projection 내 해소. Pack docs/source-map readiness 확인

### ACTIVE
- **Role**: intermediate (운영 가능)
- **설명**: drift-free + required evidence + role-quality + pack runtime 모두 통과

### DEPRECATED
- **Role**: terminal (경고)
- **설명**: 더 이상 권장되지 않음. 신규 참조 금지, 기존 참조 유지
- **진입 조건**: `document.metadata.lifecycle === "deprecated"`

### ARCHIVED
- **Role**: terminal (최종)
- **설명**: 역사적 reference로만. Active inventory 제외
- **진입 조건**: `document.metadata.lifecycle === "archived"` 또는 archive path

### BLOCKED
- **Role**: **reserved (현재 할당 안 됨)**
- **설명**: 향후 write-mode transition controller가 소유할 상태. 현재 read-only projection에서는 절대 할당되지 않음
- **실패 surface**: 실패한 전이는 `deterministic-label-readiness-blocked` diagnostic으로 표시

## SSOT 매핑

본 State Component의 `states[]`는 code enum의 **SSOT**:

```
Component State enum (본 문서)     → TypeScript enum
  states: [DRAFT, LINTED, ...]        DeterministicLabelRecordState = "DRAFT" | "LINTED" | ...
```

코드 구현: `packages/deterministic-label-registry/src/...`  
검증: `def validate`가 Component states ↔ code enum 일치 확인 (Phase 1.B)

## 소비 System

본 State Component를 `lifecycle_ref.state_component`로 참조하는 System:

- [deterministic-label-system](./deterministic-label-system.md) — read-only projection
- (향후) write-mode transition controller — 아직 없음

## meta-semantic 매핑

본 State Component는 meta-semantic의 **Data IR lifecycle**과 대응되는 STC-level 표현:

| meta-semantic | STC |
|--------------|-----|
| `Data IR.lifecycle` (label record의 상태 진행) | 본 Component `states[]` |
| 전이 규칙 (producedBy / consumedBy) | System의 `lifecycle_ref.pipe_refs` (현재 read-only라 비어 있음) |

## Pilot 관찰 사항

- [ ] `states[]`에 `BLOCKED` 포함은 코드 enum에는 있지만 할당 안 되는 상태. `def validate`가 이를 "문서 OK, 코드 runtime 미할당"으로 인식할 수 있나
- [ ] state description의 크기 — 현재 1~2줄. 더 길어지면 data-shape sub-type으로 분리 고려
- [ ] Role 분류 (initial/intermediate/terminal/reserved)가 표준화 가능한가 — Phase 1.B에서 schema 필드로 승격 검토
- [ ] D-18 sub-type이 실제로 Component tier의 이해를 돕는가 (meta-semantic 학습 부담 완화 효과)

## Consumer 빠른 참고

- **"label의 가능한 상태는?"** → 위 7개 목록
- **"상태 간 전이 규칙은?"** → 본 문서 아님 — System의 `lifecycle_ref` 또는 meta-semantic pipe
- **"BLOCKED은 언제 할당되나?"** → 현재 read-only projection에서는 할당 안 됨. future write-mode
