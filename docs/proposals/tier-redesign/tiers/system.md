---
def:
  id: tier-redesign-tiers-system
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

# STC Tier — System

## 핵심 원칙 (§1.2)

**System은 독립적이다.** System은 다른 System에 포함(`contains`)되지 않는다. System 간 관계는 다음만 허용:

- `depends_on` — 소비 관계
- `refines` — 구체화 관계
- `implements` — 특정 계약 구현 (일반 LinkType; D-17 Pivot 후 FSM tier는 없지만 향후 다른 계약-구현 관계에 사용 가능)

소유 관계(`contains`)는 Layout → System 배치에만 `refs`로 쓴다. 상세: [../rules/system-independence.md](../rules/system-independence.md).

## 정의

**Operations 집합**. CRUD / read-only / event-driven / 변환 모두 포함.

독립 운용 가능한 단위. 명시적 인터페이스(API, 이벤트)를 가지며, 상태가 있는 경우 `lifecycle_ref`로 State Component + meta-semantic pipe를 참조.

```
예: deterministic-label-system (read-only + compute)
  - buildDeterministicLabelInventory()    ← 조회
  - dryRunDeterministicLabelTransition()  ← 전이 검증 (dry-run)
  - depends_on: ontology-pack-system, doc-envelope
  - lifecycle_ref:
      state_component: deterministic-label-record-state
      pipe_refs: []   # read-only projection — pipe 없음
      read_only_projection: true
```

## 외연 기준 — R-7 3-check

"모든 것이 System이면 System은 설명력 상실"을 방지하기 위한 판단 기준. 아래 3개 중 **2개 이상 충족**할 때 System tier로 판단:

1. **명명 가능성** — Consumer가 이 operations 집합에 고유 이름을 붙여 부르는가 (e.g., `deterministic-label-system`, `ingest-system`)
2. **독립 운용** — 다른 System 없이 단독으로 의미 있는 결과를 내는가 (호출 체인의 endpoint 역할)
3. **Lifecycle 유무** — 관리하는 Entry의 상태가 의미 있게 변화하는가 (State Component 보유 + 필요 시 meta-semantic pipe 참조)

1개 이하 충족이면:
- Component + 함수 집합 → `component`
- 내부 헬퍼 → tier 분류 없음 (코드 수준)

상세: [../03-decisions.md#R-7](../03-decisions.md)

## Trivial System 예외

상태 없이 충분히 서술 가능한 System도 존재. 예:

- 순수 변환 System (encode/decode) — 상태 전이 아님
- 단순 read-only 쿼리 System — lifecycle 없음

이 경우 **`lifecycle_ref` 생략** + System 문서에 "상태 관리 없음" 명시.

## 상태 관리 (D-17 Pivot)

상태가 있는 System은 **meta-semantic에 위임**한다:

```yaml
lifecycle_ref:
  state_component: <Component tier id>         # State enum 위치
  pipe_refs: [<meta-semantic pipe path>]       # 전이 규칙 (read-only면 [])
  read_only_projection: true/false
```

- **State enum**: Component tier 문서로 분리 ("component" tier)
- **Lifecycle/전이**: meta-semantic의 `PipeTransitionScope`, `Data IR.lifecycle`, `TransitionDef` 참조
- **Read-only projection**: `pipe_refs: []`로 비움. 상태는 source에서 재계산
- **Write-mode**: 각 전이를 meta-semantic pipe 문서로 작성 + `pipe_refs` 추가

상세 규칙: [../rules/state-machine-delegation.md](../rules/state-machine-delegation.md)

## 좌표 권장값

| 축 | 권장 | 허용 |
|----|------|------|
| `tier` | `system` | — |
| `scope` | `feature` 또는 `flow` | 상황에 따라 |
| `aspect` | `func_def` / `process_flow` / `user_scenario` | 상황에 따라 |
| `layer` | 상황에 따라 | `domain` / `operation` / `mediation` / `experience` |

## 전환 힌트 (level → tier)

- `module` + Operations 집합 + R-7 3-check 2개 이상 → `system`
- `group` + 독립 기능 경계 (배치 아닌 operations) → `system`

우선순위 2 (knowledge 면제 다음). 상세 판단: [../rules/classification.md](../rules/classification.md)

## 예시

- **Pilot**: [../examples/deterministic-label-system.md](../examples/deterministic-label-system.md) — `lifecycle_ref` 패턴 + R-7 3-check 3/3 충족 검증
- 실제 qa-sdk: `ingest-system`, `decode-system`, `gate-system`, `registry-system`, `docs-control-plane` 등
