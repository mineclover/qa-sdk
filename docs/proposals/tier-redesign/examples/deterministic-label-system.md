---
def:
  id: tier-redesign-examples-deterministic-label-system
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

> **Pilot Draft — STC System tier 예시.** D-17 Pivot 반영: FSM implements 관계 제거, `lifecycle_ref`로 State Component + meta-semantic 참조.
>
> 연관: [System tier 정의](../tiers/system.md) · [System 독립성 규칙](../rules/system-independence.md) · [State Machine Delegation](../rules/state-machine-delegation.md)

# Deterministic Label System

## 목적 ^purpose

문서 / 소스 / pack / PRD / evidence의 좌표 label을 read-only projection으로 생성하고, state readiness를 계산하며, 전이를 dry-run 평가한다. State enum은 [`deterministic-label-record-state`](../tiers/component.md) Component에서 정의됨 (D-17).

**Read-only 계약** — 모든 operations는 source records, documents, PRDs, known-pack data를 수정하지 않는다. 전이는 실제로 수행되지 않으며, 매 호출마다 source에서 재계산.

## R-7 3-check 자가 검증

### Positive case (System tier 주장)

| 기준 | 만족 | 외부 증거 (externalizable) |
|------|-----|--------------------------|
| **명명 가능성** | ✓ | CLI 패키지명 `@qa-sdk/deterministic-label-registry` + `docs-control-plane.spec.md § sources`가 해당 경로 참조. consumer는 이 이름으로 import + invoke |
| **독립 운용** | ✓ | `buildDeterministicLabelInventory({options})` 단독 호출로 결과 산출 — CLI 없이 라이브러리 단독으로 사용 가능. Endpoint 역할 (caller ← return 결과). `docs-control-plane`은 consumer 중 하나일 뿐 |
| **Lifecycle 유무** | ✓ | `computeDeterministicLabelRecordReadiness`가 record의 `currentState`를 재계산. state enum의 변화가 관찰 가능 — lifecycle_ref의 State Component (`deterministic-label-record-state`)가 소유 |

### Counter-test (System이 아니라면 어땠을까?)

R-7 3-check의 실질 구별력을 검증하기 위한 반례 검토:

| 시나리오 | 명명 | 독립 운용 | Lifecycle | 판정 |
|---------|------|---------|----------|------|
| `deterministic-label-system` (실제) | ✓ (고유 명명) | ✓ (단독 invoke) | ✓ (State Component + readiness 재계산) | **3/3 → System** |
| 만약 Component + 헬퍼 함수 3개였다면 | ✗ (helper 모음은 도메인 명명 없음) | ✗ (항상 caller에 포함) | ✗ (state 변화 무관) | 0/3 → Component + 함수 |
| 만약 CLI command 1개였다면 (`docs label`) | ✓ (명령 이름) | ✗ (CLI 체계 내부) | ? (상태 관리 없음) | 1/3 → 내부 헬퍼 |
| 만약 순수 변환 (encode/decode)이었다면 | ✓ (`codec-*`) | ✓ (단독 invoke) | ✗ (stateless) | 2/3 경계 → trivial System 예외 적용 |

**결론**: deterministic-label-system은 3/3 만족으로 **강하게 System tier**. Counter-test의 반례들은 1~2개만 만족 → 실제로 구별력 있음.

### self-reference 회피 주의

수정된 근거: **"state enum의 관찰 가능한 변화 + lifecycle_ref 보유"**가 Lifecycle 판단 기준. State Component가 있고 System이 이를 읽어 의미 있는 처리를 하면 만족. D-17 Pivot 후 FSM tier 개념 없이도 정의 가능.

## 상태 관리 (lifecycle_ref) ^implements

본 System은 다음 구조로 상태를 관리 (D-17 Pivot):

- **State Component**: `deterministic-label-record-state` (Component tier 문서 — 미작성, Pilot 대기)
  - 7 states 정의: `DRAFT / LINTED / RESOLVED / ACTIVE / DEPRECATED / ARCHIVED / BLOCKED`
- **pipe_refs**: `[]` — read-only projection이므로 meta-semantic pipe 불필요
- **Read-only**: 매 호출마다 `computeReadiness`가 state 재계산

**SSOT 방향**: State Component 문서가 `states[]` SSOT. 본 System의 코드(`DeterministicLabelRecordState` enum)는 Component의 state 리스트를 구현. (D-9 계승)

**Write-mode 도입 시**: 각 전이 (DRAFT→LINTED 등)를 meta-semantic `PipeTransitionScope` 문서로 작성 + `pipe_refs` 추가.

## 소비 (depends_on) ^consumes

- [`doc-envelope`](../../../specs/definition-catalog/docs-control-plane.spec.md) — `DocumentEnvelope` 타입, family/scope/completed-record 감지, TODO 파싱
- [`ontology-pack-validate`](../../../specs/definition-catalog/docs-control-plane.spec.md) — pack load/validate + docs reader DI

## Operations (public API) ^defines

### 1. Inventory

```typescript
function buildDeterministicLabelInventory(
  options: InventoryOptions
): DeterministicLabelInventory
```

- **역할**: 문서 + pack + artifact envelope에서 label record list 생성
- **Read-only**: ✓ source 파일 touch 안 함
- **Invariants**: 결정론적(같은 input → 같은 output). Read-only projection 계약 준수 — source records/documents/PRDs 미변경

### 2. Readiness 계산

```typescript
function computeDeterministicLabelRecordReadiness(
  records: DeterministicLabelRecord[]
): DeterministicLabelRecord[]
```

- **역할**: 각 record의 `currentState`를 readiness 조건으로 재계산 (`DRAFT → LINTED → RESOLVED → ACTIVE`)
- **Read-only**: ✓ source 미변경, record copy에만 반영
- **Readiness 조건**: syntax/schema validation → dependency resolution → activation check 순차 평가

### 3. 전이 Dry-run (D-11)

```typescript
function dryRunDeterministicLabelTransition(
  request: DeterministicLabelTransitionRequest,
  records: DeterministicLabelRecord[]
): DryRunResult
```

- **역할**: 전이 요청의 accept/reject 판단 + evidence 반환. System operation으로 분류 (D-11 계승).
- **Read-only**: ✓ source records/documents/PRDs/registry 미변경 (read-only projection 계약)
- **Mutation targets**: 결과 metadata의 `mutationTargets`가 모두 `false`로 명시
- **Result shape**:
  ```typescript
  interface DryRunResult {
    mode: "dry-run"
    accepted: boolean
    decision: "accepted" | "rejected"
    currentState: DeterministicLabelRecordState
    nextState: DeterministicLabelRecordState
    blockers: string[]
    guardEvidence: GuardEvidence[]
    evidenceRefs: string[]
    metadata: {
      mutationTargets: {
        labels: false
        documents: false
        prds: false
        registries: false
      }
    }
  }
  ```

## 구조 분할

본 System은 내부적으로 5개 모듈로 구성:

```
deterministic-label-registry/
├── candidates.ts   — SemanticCoordinateCandidate 생성
├── records.ts      — DeterministicLabelRecord projection
├── packs.ts        — Ontology pack/artifact projection
├── fsm.ts          — Readiness gate 평가
└── inventory.ts    — 조립
```

**주의**: 이 분할은 **구현 세부** — 문서 tier로서는 하나의 System. 각 모듈은 별도 Component tier 문서 후보이지만, 현재는 단일 System 내 구현 모듈로 취급 (CRUD 경계가 불명확하면 분할 유보).

## Consumer 빠른 참고

- **"이 label이 어떤 상태가 될 수 있나?"** → State Component (`deterministic-label-record-state`, 미작성)
- **"전이 결과가 어떻게 되나?"** → 현재는 read-only projection. Write-mode 시 meta-semantic pipe 참조
- **"이 System은 무엇을 수정하지 않나?"** → Read-only projection 계약 / `mutationTargets: all false`

## 경계

- **읽기 전용 계약** — Write-mode transition controller는 **out of scope** (미래 PRD)
- `BLOCKED` state는 write-mode controller가 소유 — 본 System에서는 할당하지 않음
- Ontology pack은 consume만 — activation / registry 수정 없음

## Pilot 관찰

- [ ] System 내 5개 모듈이 각자 Component tier로 승격할지 판단 (CRUD 경계 명확성 기준)
- [ ] `depends_on`이 2개만 있는데 실제 CLI 통합(`@qa-sdk/cli`)은 별도 Layout에서 조합되는 구조 — 적절한가?
- [ ] "Trivial System 예외"가 아님 — `lifecycle_ref` 보유 (State Component + read_only_projection 명시)
