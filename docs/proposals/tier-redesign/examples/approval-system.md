---
def:
  id: tier-redesign-examples-approval-system
  type: knowledge
  knowledge_kind: proposal
  lifecycle: pilot-draft
  owner_system: definition-catalog
  projection_plane: intent
status: pilot-draft
date: 2026-04-18
part_of: tier-redesign
role: system-example
supersedes: -
superseded_by: -
---

> **⚠️ 가상 Write-mode Pilot — 참조 3건 모두 가상**
>
> 본 문서는 패턴 시연 목적의 Pilot이며, 다음 **3 종류 참조가 전부 hypothetical**:
>
> 1. **approval-system 자체** — qa-sdk에 실재하지 않음
> 2. **`lifecycle_ref.pipe_refs`의 meta-semantic pipe** — `approval-pipe.spec.md` 문서 **미작성**. Phase 1.B 도구 준비 또는 실제 write-mode controller 구현 시 작성 예정
> 3. **`depends_on`의 System** — `notification-system`, `audit-log-system` **가상 인용**. 실재 qa-sdk 대응 System 없음
>
> 따라서 `def validate`는 현 시점 본 Pilot을 **실행 불가** (참조 target 부재). Phase 1.B 검증 실증은 실제 meta-semantic pipe 문서 + 실재 sub-System 작성 이후 가능.
>
> 목적:
> - D-17 hypothesis "System + meta-semantic 조합이 자연스럽다"의 **write-mode 패턴 시연**
> - 긴장 3 (Write-mode Pilot 부재) 부분 해소
> - schema 실효성 사전 점검 (실증 아님)
>
> 연관: [approval-request-state](./approval-request-state.md) · [System tier 정의](../tiers/system.md) · [State Machine Delegation](../rules/state-machine-delegation.md)

# Approval System (Virtual Pilot)

## 목적 ^purpose

`ApprovalRequest` entity의 전 생애 주기를 관리하는 System. 요청 제출 / 승인 / 거부 / 취소 operations을 제공하며, 각 write-mode 전이는 meta-semantic PipeTransitionScope에 위임해 **원자 경계 + compensate**를 보장.

STC 4 tier 내에서는 **기능 집합 + lifecycle_ref**로 표현되고, 실제 실행 흐름(DB tx + event + notification + rollback)은 meta-semantic pipe가 담당.

## R-7 3-check 자가 검증

### Positive case

| 기준 | 만족 | 외부 증거 |
|------|-----|---------|
| **명명 가능성** | ✓ | "approval-system" 고유 명명. Consumer가 이 이름으로 import + invoke |
| **독립 운용** | ✓ | submitRequest / approve / reject / cancel operations 단독 호출 가능. HTTP / CLI / event-driven 모두 endpoint 역할 |
| **Lifecycle 유무** | ✓ | `approval-request-state` (state-enum Component) 보유. 4 states 진행. `pipe_refs`로 실제 전이 실행 |

### Counter-test (이 구조가 System이 아니라면?)

| 시나리오 | 명명 | 독립 운용 | Lifecycle | 판정 |
|---------|------|---------|----------|------|
| `approval-system` (실제) | ✓ | ✓ | ✓ | **3/3 → System** |
| 만약 순수 CRUD util이라면 | ✗ | ✗ | ✗ | Component + 헬퍼 |
| 만약 state 없이 notification만 | ✓ | ✓ | ✗ | 2/3 경계 — trivial System? stateless processor? |
| 만약 transition controller의 내부 모듈 | ✗ | ✗ | ✓ | 내부 구현 분할 |

**3/3 만족으로 System tier 확정**. 내부 모듈은 depends_on으로 분리(notification-system 등).

## 상태 관리 (lifecycle_ref) ^implements

Write-mode System의 전형적 구조:

### State Component
[approval-request-state](./approval-request-state.md): 4 states (PENDING, APPROVED, REJECTED, CANCELLED)

### pipe_refs (가상 meta-semantic pipe 참조)

각 전이는 meta-semantic `PipeTransitionScope`로 위임. 원자 경계 + compensate 보장.

#### `approve-transition` (가상 pipe 문서)

```yaml
# meta-semantic/pipe-impl/approval-pipe.spec.md (가상) §approve-transition
transitionId: approve-transition
body:
  sequence:
    - step: validate-approver-permission        # Guard
    - step: db-update-status-to-approved         # DB write
    - step: emit-approval-event                  # Event emit
    - step: send-notification-to-requester       # Notification
events:
  - approval.approved
compensate:
  sequence:
    - step: revert-db-status
    - step: mark-event-as-invalid
    # notification은 역전 불가 — best-effort로 skip
```

#### `reject-transition` / `cancel-transition`

대칭 구조. 각자 compensate 포함.

### read_only_projection: false

Write-mode이므로 실제 상태 변경 발생. Consumer는 operations 호출로 실제 DB + event 영향.

## Operations (public API) ^defines

### 1. submitRequest

```typescript
function submitRequest(input: {
  requester: UserId
  target: string
  reason: string
}): Promise<ApprovalRequestId>
```

- **역할**: 새 ApprovalRequest 생성. PENDING 상태로 진입
- **pipe_refs**: 없음 — initial creation은 pipe 전이 아님 (state 진입만)
- **전이**: `(none) → PENDING`

### 2. approve

```typescript
function approve(
  requestId: ApprovalRequestId,
  approver: UserId,
  reason?: string
): Promise<ApprovalResult>
```

- **역할**: 승인 처리. DB 업데이트 + event 발행 + notification
- **pipe_refs**: `meta-semantic/pipe-impl/approval-pipe#approve-transition`
- **전이**: `PENDING → APPROVED`
- **Guard**: `approver`가 승인 권한 보유 (meta-semantic pipe 내 validate step)
- **Compensate**: 실패 시 DB rollback + event invalidate
- **Mutation targets**: `{ labels: false, documents: false, prds: false, registries: false, db: true, events: true, notifications: true }`

### 3. reject

```typescript
function reject(
  requestId: ApprovalRequestId,
  approver: UserId,
  reason: string  // 필수
): Promise<ApprovalResult>
```

- **역할**: 거부 처리. reason 필수
- **pipe_refs**: `approval-pipe#reject-transition`
- **전이**: `PENDING → REJECTED`

### 4. cancel

```typescript
function cancel(
  requestId: ApprovalRequestId,
  requester: UserId,
  reason?: string
): Promise<ApprovalResult>
```

- **역할**: 요청자 취소. PENDING 상태에서만 가능
- **pipe_refs**: `approval-pipe#cancel-transition`
- **전이**: `PENDING → CANCELLED`
- **Guard**: `requester`가 원 요청자여야 함

## 의존 관계 (depends_on)

- **notification-system** (가상) — 승인/거부 시 알림 발송
- **audit-log-system** (가상) — 모든 전이 이력 기록

D-17 System 독립성 원칙상 두 System은 **각각 독립 문서로 분리되어야 하나**, 본 Pilot에서는 가상 참조만 선언 — 실재 qa-sdk에 대응 System 없음 (배너 §3 참고). approval-system은 `depends_on`만 선언하고 실제 문서는 실존 write-mode controller 도입 시점에 함께 작성.

## 아키텍처 다이어그램

```
Consumer (HTTP / CLI / event)
       │
       │ invoke operation
       ↓
approval-system (STC System tier)
       │
       │ lifecycle_ref.pipe_refs[i]
       ↓
meta-semantic/pipe-impl/approval-pipe (가상)
  ├─ approve-transition
  │   body: [validate, db-write, emit, notify]
  │   compensate: [revert, invalidate]
  ├─ reject-transition
  └─ cancel-transition
       │
       ↓
       DB + Event Bus + Notification Service
       (notification-system / audit-log-system 등 sub-System)
```

## Read-only 변형 비교

[deterministic-label-system](./deterministic-label-system.md)과의 대비:

| 특성 | deterministic-label-system | approval-system (본 문서) |
|------|---------------------------|-------------------------|
| 모드 | Read-only projection | Write-mode |
| `pipe_refs` | `[]` (빈 배열) | 3개 (approve/reject/cancel) |
| `read_only_projection` | `true` | `false` |
| Mutation | source 변경 없음 | DB + event + notification 변경 |
| State 재계산 | 매 호출마다 | 실제 전이 실행 후 고정 |
| Compensate | 불필요 | 필요 (meta-semantic pipe 내 정의) |

두 Pilot 병치로 **Read-only ↔ Write-mode 스펙트럼 모두 demonstrate**.

## meta-semantic 연동 실증 공백 (한계)

- 가상 `approval-pipe.spec.md` 문서가 실제로 없음 — `pipe_refs`가 가리키는 target이 hypothetical
- Phase 1.B `def validate` 구현 시:
  - 실재 meta-semantic pipe 문서를 작성하거나
  - Pilot용 가상 pipe 문서를 함께 신설해야 validate 연동 가능
- 그 전까지는 **schema 패턴 시연**만 목적

## Pilot 관찰 사항

- [ ] 가상 Pilot이 실재 시스템이 없어 "실증"의 질이 부족한가 vs pattern 시연만으로 충분한가
- [ ] `read_only_projection: false` boolean만으로 write-mode 표현이 충분한가 vs `hybrid`(일부 전이만 write) 케이스에서 추가 필드 필요한가 — Phase 1.B 재검토 대상
- [ ] `pipe_refs` 경로 형식 (`meta-semantic/pipe-impl/<pipe>#<transitionId>`)이 실제 meta-semantic 문서 구조와 일치하나
- [ ] Compensate 로직을 Component로 promote해야 하는가 (evidence-shape sub-type의 확장?)
- [ ] "depends_on: notification-system, audit-log-system"은 가상 인용 — 실제 qa-sdk에 대응 System 없음

## Consumer 빠른 참고

- **"ApprovalRequest 상태는?"** → [approval-request-state](./approval-request-state.md) 4 states
- **"승인 시 실행 흐름은?"** → meta-semantic `approve-transition` (가상 pipe 문서, Phase 1.B 작성 예정)
- **"approve 실패 시 rollback?"** → compensate (DB revert + event invalidate)
- **"이 System을 어떻게 소비?"** → Operations 4개 (submitRequest / approve / reject / cancel)
- **"권한 체크는?"** → meta-semantic pipe body 내 validate step (Guard 역할)
