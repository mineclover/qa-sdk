---
status: draft
date: 2026-04-18
part_of: tier-redesign
role: delegation-rules
---

# State Machine Delegation — 상태 관리는 meta-semantic에 위임

## 목적

STC는 문서 **분류 축**을 제공한다. 상태 전이/원자 경계/이벤트 흐름 같은 **실행 체계**는 이미 존재하는 meta-semantic(`docs/specs/meta-semantic/`)에 소유된다. 따라서 System tier 문서가 상태 관리를 다룰 때는 **meta-semantic을 참조**하는 형태로 표현한다.

이 규칙은 [D-17](../03-decisions.md) (FSM tier Pivot) 구체 실행 가이드다.

## 규칙

### 규칙 1 — State enum은 Component tier (sub-type: `state-enum`)

도메인의 상태 리스트(`DRAFT`, `LINTED`, `APPROVED` 등)는 **독립 Component tier 문서**로 정의한다. D-18에서 이는 Component의 **`state-enum` sub-type**으로 분류됨. System 문서에 인라인하지 않는다.

```yaml
tier: component
component_subtype: state-enum   # D-18
id: <domain>-state
states: [...]
```

```
예: deterministic-label-record의 상태
  → Component tier 문서: deterministic-label-record-state.md
     - tier: component
     - id: deterministic-label-record-state
     - states: [DRAFT, LINTED, RESOLVED, ACTIVE, DEPRECATED, ARCHIVED, BLOCKED]
     - 역할: state enum/labels 선언만. 전이 규칙 없음
```

State enum Component는 **불변 상수 리스트**의 일종 — Component tier § 포함 대상과 일치.

### 규칙 2 — Lifecycle은 meta-semantic pipe

상태 간 전이 규칙, guard 조건, 원자 경계, compensate는 meta-semantic의 다음 개념으로 표현:

| 개념 | meta-semantic 위치 | 용도 |
|------|------------------|------|
| Data IR.lifecycle | `docs/specs/meta-semantic/meta-semantic-ir.spec.md` § `lifecycle` 필드 (~line 205) | Entity의 Data IR lifecycle (producedBy / consumedBy 등) |
| 데이터 패싯 5 역할 | `docs/specs/meta-semantic/concepts/ms-concept-data-facets.spec.md` | 생산/소비/정의/관리/저장 역할 분리 |
| 원자 경계 (atomic scope) | `docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md` § PipeTransitionScope | DB tx / saga / compensate |
| 이벤트 카탈로그 | `docs/specs/meta-semantic/pipe-impl/pipe-connection-catalog.spec.md` § TransitionDef | 전이에 소속된 이벤트 |
| Guard (pre-condition) | meta-semantic PipeFlow 30종의 `branch` / `filter` / pre-condition step | 전이 성립 조건 |

System 문서는 이들을 `lifecycle_ref`로 참조만 한다.

### 규칙 3 — System 문서의 `lifecycle_ref` 필드

상태를 다루는 System은 frontmatter에 다음 필드를 선언:

```yaml
tier: system
id: deterministic-label-system

lifecycle_ref:
  # Entity가 가질 수 있는 상태 (Component tier 참조)
  state_component: deterministic-label-record-state

  # 전이 규칙 (meta-semantic 참조, optional — read-only projection이면 생략)
  pipe_refs:
    - meta-semantic/pipe-impl/<pipe-doc>#<transitionId>   # Form: <파일 경로> # <transitionId>
    # 여러 전이가 있으면 나열

  # 읽기 전용 여부 (write-mode 없음)
  read_only_projection: true

  # 설명
  notes: |
    현재는 read-only projection. write-mode controller 도입 전까지 pipe_refs 비어 있음.
```

### 규칙 4 — Read-only projection 단순화

System이 **read-only projection만** 수행하면:
- `state_component` **필수** (상태 enum 선언 필요)
- `pipe_refs` **빈 배열 허용** 또는 생략
- `read_only_projection: true` 명시
- 전이 규칙 없음 — 상태는 source에서 재계산

### 규칙 5 — Write-mode 도입 시 점진 확장

Write-mode transition controller가 구현되면:
- 각 전이를 meta-semantic의 `PipeTransitionScope`로 **별도 문서** 작성
- System 문서의 `pipe_refs`에 해당 `transitionId` 추가
- `read_only_projection: false`로 변경

단계적 도입 가능 — 전부 또는 일부만 write-mode로.

**Write-mode Pilot 참고**:
- [examples/approval-system.md](../examples/approval-system.md) — 가상 write-mode System. `pipe_refs`에 3개 transition 참조 (approve/reject/cancel). compensate 포함
- [examples/approval-request-state.md](../examples/approval-request-state.md) — pair State Component (4 states)
- 한계: 참조하는 `approval-pipe.spec.md`는 아직 meta-semantic에 실재하지 않음 — 패턴 시연이 목적

### 규칙 6 — Component의 State enum은 단순 선언만

State enum Component는 다음만 담는다 (확장 금지):
- `states: [...]` 리스트
- 각 state의 간단한 description (1~2줄)
- terminal / initial 여부 표시 (optional)

**금지**:
- 전이 규칙 (→ meta-semantic pipe)
- Guard 조건 (→ meta-semantic PipeFlow)
- Invariant (→ meta-semantic 또는 System 문서의 constraint 섹션)

## 실제 적용 예시

### deterministic-label-registry 재표현

**State enum (Component tier)**:

```yaml
---
tier: component
scope: data
aspect: domain_data
layer: mediation
id: deterministic-label-record-state
---

# DeterministicLabelRecordState

## 상태 목록

- `DRAFT` — initial. 좌표 후보만 있음.
- `LINTED` — syntax/frontmatter/schema 검증 통과
- `RESOLVED` — dependency/source/evidence 해소
- `ACTIVE` — drift-free + required evidence 활성
- `DEPRECATED` — terminal (신규 참조 금지)
- `ARCHIVED` — terminal (active inventory 제외)
- `BLOCKED` — reserved (read-only projection 할당 안 함, future write controller 소유)

전이 규칙은 lifecycle을 소유한 System 문서(`deterministic-label-system`) + 해당 meta-semantic pipe 참조.
```

**System tier의 lifecycle_ref**:

```yaml
tier: system
id: deterministic-label-system

lifecycle_ref:
  state_component: deterministic-label-record-state
  pipe_refs: []   # read-only projection — pipe 없음
  read_only_projection: true
  notes: |
    DRAFT→LINTED→RESOLVED→ACTIVE 전이는 `computeReadiness`가 매 호출마다 재계산.
    실제 전이 실행은 write-mode transition controller (미래 PRD)가 담당.
    그 시점에 meta-semantic PipeTransitionScope 문서 작성 + pipe_refs 채움.
```

## def validate에서 지원할 검증 (Phase 1.B)

- `lifecycle_ref.state_component`가 실존 Component tier 문서인가
- `lifecycle_ref.pipe_refs`의 각 항목이 meta-semantic 내 PipeTransitionScope와 일치하는가
- Component State 문서의 `states[]`와 System 구현 코드의 enum이 일치하는가 (D-9 SSOT 원칙 계승)
- `read_only_projection: true`이면 pipe_refs가 비어 있어야 (또는 unresolved 상태 pipe만)

## 장점

1. **역할 분리 명확** — STC = 분류, meta-semantic = 실행. 이중 소유 없음
2. **Read-only System 부담 없음** — pipe_refs 비우면 끝
3. **Write-mode 점진 도입** — 전이 별로 pipe 문서 추가
4. **기존 meta-semantic 594 tests 활용** — 실증된 체계
5. **Component State 재사용** — 같은 state enum을 여러 System이 참조 가능

## 제약

1. **State 리스트가 Component tier를 요구** — 단순 System도 state 있으면 별도 Component 문서 필요 (경량 문서라 부담 낮음)
2. **meta-semantic 이해 필요** — Write-mode 도입 시 PipeTransitionScope 이해 필수 (단 read-only만 다루면 불필요)
3. **`lifecycle_ref` schema는 Phase 1.B에서 frozen** — 현재는 제안 수준

## 연관 문서

- [D-17 (tier Pivot 결정)](../03-decisions.md) — 근거
- [tiers/system.md](../tiers/system.md) — lifecycle_ref 필드 설명
- [tiers/component.md](../tiers/component.md) — State enum Component 유형
- meta-semantic 원본:
  - `docs/specs/meta-semantic/pipe-impl/transition-scope.spec.md`
  - `docs/specs/meta-semantic/concepts/ms-concept-data-facets.spec.md` (데이터 패싯 5 역할)
  - `docs/specs/meta-semantic/meta-semantic-ir.spec.md` § lifecycle (Data IR의 생산/소비 관계)
