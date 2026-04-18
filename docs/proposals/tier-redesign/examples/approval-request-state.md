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
id: approval-request-state
scope: state
aspect: domain_state
layer: domain
---

> **⚠️ 가상 Write-mode Pilot (pair with [approval-system](./approval-system.md))**
>
> qa-sdk에 실재하는 도메인이 아님. D-17 Pivot + D-18 Component sub-type 패턴을 write-mode 맥락에서 시연하기 위한 Pilot. 긴장 3(Write-mode Pilot 부재) 부분 해소 목적.
>
> 연관: [Component tier 정의](../tiers/component.md) · [approval-system](./approval-system.md) · [State Machine Delegation](../rules/state-machine-delegation.md)

# Approval Request State

## 목적 ^purpose

`ApprovalRequest` entity가 가질 수 있는 상태 리스트를 **state-enum Component**로 정의. [approval-system](./approval-system.md)의 `lifecycle_ref.state_component`가 본 문서를 참조.

**포함**:
- 상태 enum 리스트
- 각 state의 역할 (initial / terminal)
- 각 state의 간단한 description

**미포함** (meta-semantic이 소유):
- 상태 간 전이 규칙 (`PENDING → APPROVED`의 실행 흐름)
- Guard 조건 (e.g., "요청자가 승인 권한 있는가")
- Transition 원자 경계 (DB tx + event + notification)
- Compensate 로직

## 상태 목록 ^defines

### PENDING
- **Role**: initial
- **설명**: 승인 요청 제출 직후. 의사결정자 응답 대기
- **진입 조건**: `submitRequest` operation 실행
- **나가는 전이**: → APPROVED / REJECTED / CANCELLED

### APPROVED
- **Role**: terminal (positive)
- **설명**: 의사결정자가 승인. 후속 operations(e.g., grant access)가 가능한 상태
- **진입 조건**: `approve` operation, approval-guard 통과
- **나가는 전이**: 없음 (terminal)

### REJECTED
- **Role**: terminal (negative)
- **설명**: 의사결정자가 거부. 재제출은 새 ApprovalRequest 생성 필요
- **진입 조건**: `reject` operation, rejection 사유 필수
- **나가는 전이**: 없음 (terminal)

### CANCELLED
- **Role**: terminal (user action)
- **설명**: 요청자가 스스로 취소. 의사결정자 액션 전에만 가능
- **진입 조건**: `cancel` operation, PENDING 상태에서만
- **나가는 전이**: 없음 (terminal)

## SSOT 매핑

본 State Component의 `states[]`는 code enum의 **SSOT**:

```
Component State enum (본 문서)  → TypeScript enum (가상)
  states: [PENDING, APPROVED, ...]  ApprovalRequestState = "PENDING" | "APPROVED" | ...
```

**Phase 1.B**: `def validate`가 Component states ↔ code enum 일치 확인.

## 소비 System

본 State Component를 `lifecycle_ref.state_component`로 참조하는 System:

- [approval-system](./approval-system.md) — write-mode (가상)

## meta-semantic 매핑

| meta-semantic | STC |
|--------------|-----|
| `Data IR.lifecycle` (ApprovalRequest의 상태 진행) | 본 Component `states[]` |
| 전이 규칙 (producedBy / consumedBy) | approval-system의 `lifecycle_ref.pipe_refs` → meta-semantic PipeTransitionScope |

## Write-mode 특성 주석

다른 State Component(`deterministic-label-record-state`, read-only)와의 차이:

| 특성 | deterministic-label-record-state | approval-request-state (본 문서) |
|------|---------------------------------|--------------------------------|
| Write-mode | ✗ (read-only projection) | ✓ (실제 전이 수행) |
| Terminal state 존재 | ✓ (ARCHIVED, DEPRECATED) | ✓ (APPROVED, REJECTED, CANCELLED) |
| Reserved state | ✓ (BLOCKED) | ✗ |
| Transition 필요 | 재계산만 | 실제 DB 변경 + event + notification |

## Pilot 관찰 사항

- [ ] 가상 도메인이 독자 이해에 부담을 주는가 — 실재 시스템이 아닌데 pattern 시연 효과 있나
- [ ] state roles(initial/terminal/user-action 등)의 meta data 필드화 검토
- [ ] 4 states로 충분한가 — 실제 approval workflow는 더 복잡할 수 있음 (ESCALATED, ON_HOLD 등)

## Consumer 빠른 참고

- **"ApprovalRequest 가능 상태는?"** → 위 4개 목록
- **"전이 규칙은?"** → 본 문서 아님 — [approval-system](./approval-system.md)의 `lifecycle_ref.pipe_refs`
- **"APPROVED 후 rollback 가능한가?"** → APPROVED는 terminal. rollback은 새 REQUEST 생성 (compensate ≠ rollback)
