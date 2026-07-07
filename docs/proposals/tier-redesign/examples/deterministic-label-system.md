---
def:
  id: tier-redesign-examples-deterministic-label-system
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: pilot-draft
date: 2026-04-18
part_of: tier-redesign
role: system-example
supersedes: -
superseded_by: -
sources:
  - docs/proposals/tier-redesign/examples/README.md
  - docs/proposals/tier-redesign/examples/deterministic-label-record.md
  - docs/proposals/tier-redesign/examples/deterministic-label-record-state.md
  - docs/proposals/tier-redesign/tiers/system.md
  - docs/proposals/tier-redesign/rules/state-machine-delegation.md
  - docs/specs/definition-catalog/docs-control-plane.spec.md
  - docs/specs/definition-catalog/deterministic-label-stability-boundary.memo.md
  - docs/specs/definition-catalog/deterministic-label-stability.plan.md
  - packages/deterministic-label-registry/src/index.ts
  - packages/deterministic-label-registry/src/inventory.ts
  - packages/deterministic-label-registry/src/records.ts
  - packages/deterministic-label-registry/src/projection.ts
---

> **Pilot Draft — STC System tier 예시.** 현행 stateless projection과 D-17 historical lifecycle_ref pilot을 분리해 기록한다.
>
> 연관: [System tier 정의](../tiers/system.md) · [System 독립성 규칙](../rules/system-independence.md) · [State Machine Delegation](../rules/state-machine-delegation.md)

# Deterministic Label System

## 목적 ^purpose

문서 / 소스 / pack / PRD / evidence의 좌표 label을 read-only projection으로 생성한다.
현행 구현은 `packages/deterministic-label-registry/src/inventory.ts`의
`buildDeterministicLabelInventory()`와 `records.ts`/`projection.ts`의 record projection이 소유한다.

**Read-only 계약** — 모든 current operation은 source records, documents, PRDs, known-pack data를 수정하지 않는다.
`deterministic-label-stability-boundary` 결정 이후 state readiness, `currentState`, transition dry-run은
현행 패키지에서 제거되었다. 아래의 state Component/lifecycle_ref 서술은 STC 패턴을 검토하기 위한
historical pilot이며 현재 API 증거가 아니다.

## R-7 3-check 자가 검증

### Positive case (System tier 주장)

| 기준 | 만족 | 외부 증거 (externalizable) |
|------|-----|--------------------------|
| **명명 가능성** | ✓ | CLI 패키지명 `@qa-sdk/deterministic-label-registry` + `docs-control-plane.spec.md § sources`가 해당 경로 참조. consumer는 이 이름으로 import + invoke |
| **독립 운용** | ✓ | `buildDeterministicLabelInventory({options})` 단독 호출로 결과 산출 — CLI 없이 라이브러리 단독으로 사용 가능. Endpoint 역할 (caller ← return 결과). `docs-control-plane`은 consumer 중 하나일 뿐 |
| **Lifecycle 유무** | ✗ (current) / pilot-only | 현행 code는 상태 없는 projection. historical pilot은 `deterministic-label-record-state`를 lifecycle_ref 후보로 둔다 |

### Counter-test (System이 아니라면 어땠을까?)

R-7 3-check의 실질 구별력을 검증하기 위한 반례 검토:

| 시나리오 | 명명 | 독립 운용 | Lifecycle | 판정 |
|---------|------|---------|----------|------|
| `deterministic-label-system` (현재) | ✓ (고유 명명) | ✓ (단독 invoke) | ✗ (stateless projection) | **2/3 → System** |
| `deterministic-label-system` (historical lifecycle pilot) | ✓ | ✓ | ✓ (State Component + readiness 재계산 가정) | 3/3 → System pilot |
| 만약 Component + 헬퍼 함수 3개였다면 | ✗ (helper 모음은 도메인 명명 없음) | ✗ (항상 caller에 포함) | ✗ (state 변화 무관) | 0/3 → Component + 함수 |
| 만약 CLI command 1개였다면 (`docs label`) | ✓ (명령 이름) | ✗ (CLI 체계 내부) | ? (상태 관리 없음) | 1/3 → 내부 헬퍼 |
| 만약 순수 변환 (encode/decode)이었다면 | ✓ (`codec-*`) | ✓ (단독 invoke) | ✗ (stateless) | 2/3 경계 → trivial System 예외 적용 |

**결론**: deterministic-label-system은 현재도 명명 가능성과 독립 운용을 만족하므로 R-7 기준 2/3의
stateless read-only System이다. State Component + readiness는 현행 code contract가 아니라 historical
pilot 경계로 남긴다.

### self-reference 회피 주의

수정된 근거: **"state enum의 관찰 가능한 변화 + lifecycle_ref 보유"**가 Lifecycle 판단 기준. State Component가 있고 System이 이를 읽어 의미 있는 처리를 하면 만족. D-17 Pivot 후 FSM tier 개념 없이도 정의 가능.

## 상태 관리 경계 (historical lifecycle_ref) ^implements

현행 System은 상태를 관리하지 않는다. 아래 구조는 D-17 Pivot을 검토하던 historical pilot이다.

- **State Component**: `deterministic-label-record-state` (Component tier pilot)
  - 7 states 정의: `DRAFT / LINTED / RESOLVED / ACTIVE / DEPRECATED / ARCHIVED / BLOCKED`
- **pipe_refs**: `[]` — read-only projection이므로 meta-semantic pipe 불필요
- **Read-only**: historical pilot에서는 매 호출마다 readiness를 재계산한다고 가정했다

**SSOT 방향 (pilot-only)**: State Component 문서가 `states[]` SSOT가 되는 구조를 검토했다.
현행 code에는 `DeterministicLabelRecordState` enum이 없다.

**Write-mode 도입 시**: 각 전이 (DRAFT→LINTED 등)를 meta-semantic `PipeTransitionScope` 문서로 작성 + `pipe_refs` 추가.

## 소비 (depends_on) ^consumes

- [`doc-envelope`](../../../specs/definition-catalog/docs-control-plane.spec.md) — `DocumentEnvelope` 타입, family/scope/completed-record 감지, TODO 파싱
- [`ontology-pack-validate`](../../../specs/definition-catalog/docs-control-plane.spec.md) — pack load/validate + docs reader DI

## Current Operations (public API) ^defines

### 1. Inventory

```typescript
function buildDeterministicLabelInventory(
  options: InventoryOptions
): DeterministicLabelInventory
```

- **역할**: 문서 + pack + artifact envelope에서 label record list 생성
- **Read-only**: ✓ source 파일 touch 안 함
- **Invariants**: 결정론적(같은 input → 같은 output). Read-only projection 계약 준수 — source records/documents/PRDs 미변경

### 2. Record projection

```typescript
function projectDeterministicLabelRecordsFromDocuments(
  documents: readonly DocumentEnvelope[],
  options?: DeterministicLabelRecordProjectionOptions
): DeterministicLabelRecordProjection
```

- **역할**: DocumentEnvelope에서 deterministic label record, dependency/source/evidence refs, diagnostics를 투영
- **Read-only**: ✓ source 미변경
- **Current status**: `records.ts`의 `DeterministicLabelRecord`는 state/currentState를 갖지 않는다

### Dropped historical operations

`computeDeterministicLabelRecordReadiness()`와 `dryRunDeterministicLabelTransition()`은
`deterministic-label-stability-boundary`의 후속 단순화에서 제거되었다. 다시 필요하면
state/event terminology 기준의 별도 design과 package boundary에서 재개해야 한다.

## 구조 분할

본 System은 내부적으로 다음 모듈로 구성:

```
deterministic-label-registry/
├── coordinate.ts   — SemanticCoordinateCandidate 생성
├── projection.ts   — DocumentEnvelope → candidate projection
├── collision.ts    — candidate collision 감지
├── records.ts      — DeterministicLabelRecord projection
├── inventory.ts    — 조립
└── shared.ts       — 문자열/metadata primitive
```

**주의**: 이 분할은 **구현 세부** — 문서 tier로서는 하나의 System. 각 모듈은 별도 Component tier 문서 후보이지만, 현재는 단일 System 내 구현 모듈로 취급 (CRUD 경계가 불명확하면 분할 유보).

## Consumer 빠른 참고

- **"이 label이 어떤 상태가 될 수 있나?"** → 현행 code contract에는 상태 없음. historical state pilot은 `deterministic-label-record-state`
- **"전이 결과가 어떻게 되나?"** → 현행 code contract에는 전이 없음. Write-mode는 별도 future design 필요
- **"이 System은 무엇을 수정하지 않나?"** → read-only projection 계약상 source document/PRD/registry를 수정하지 않음

## 경계

- **읽기 전용 계약** — Write-mode transition controller는 **out of scope** (미래 PRD)
- `BLOCKED` state는 historical pilot에만 남아 있음 — 현행 System에서는 할당하지 않음
- Ontology pack은 consume만 — activation / registry 수정 없음

## Pilot 관찰

- [ ] System 내 모듈이 각자 Component tier로 승격할지 판단 (CRUD 경계 명확성 기준)
- [ ] `depends_on`이 2개만 있는데 실제 CLI 통합(`@qa-sdk/cli`)은 별도 Layout에서 조합되는 구조 — 적절한가?
- [ ] 현행 stateless projection을 "Trivial System 예외"로 볼지, R-7 2/3 System으로 충분한지 Phase 1.B에서 결정
