---
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: independence-rules
---

# System 독립성 + meta-semantic 상태 위임 + Inline 정의 금지

세 가지 규칙이 STC의 구조적 무결성을 보장한다.

## 규칙 1 — System 독립성

**System은 다른 System에 포함(`contains`)되지 않는다.**

System 간 관계는 다음만 허용:
- `depends_on` — 소비 관계 (A가 B를 사용)
- `refines` — 구체화 관계 (A가 B를 더 구체화)
- `implements` — 계약 구현 (D-17 이전엔 System→FSM 용도였으나 FSM tier 제거로 현재 활성 사용처 없음. 향후 Component 계약 등으로 재사용 가능)

### 실제 qa-sdk 예시

```
# 틀린 구조 (System이 System을 contains)
docs-control-plane
  └─ contains → deterministic-label-registry   ← X

# 올바른 구조 (System 간 소비 — depends_on)
docs-control-plane (System)
  └─ depends_on: deterministic-label-registry
                 doc-envelope
                 ontology-pack-validate

# Layout이 System을 나열 — refs
system-infra-layout (Layout)
  └─ refs: ingest-system, decode-system, gate-system,
           registry-system, query-system
```

## 규칙 2 — System ↔ meta-semantic 상태 위임 (D-17 Pivot)

**상태를 가지는 System은 meta-semantic 체계에 위임한다.** STC 자체에는 FSM tier가 없으며, 상태 전이/원자 경계/이벤트 카탈로그는 meta-semantic이 소유한다.

### 참조 방향

```
System (STC)
  └─ lifecycle_ref:
       state_component: <Component tier id>          (State enum 위치)
       pipe_refs: [<meta-semantic path>#<transitionId>, ...]   (전이 규칙 — 형식: 파일 경로 # transitionId)
       read_only_projection: true/false
```

### 세부 규칙

- **State enum 분리** — Entity가 가질 수 있는 상태 리스트는 **Component tier 문서**로 분리. System 문서에 인라인 금지
- **Lifecycle 참조** — 전이/원자 경계/compensate/이벤트 카탈로그는 meta-semantic 문서(`docs/specs/meta-semantic/`) 참조
- **Read-only System 단순화** — 상태 변화가 있더라도 write-mode controller 없으면 `pipe_refs: []` + `read_only_projection: true`
- **Code SSOT 방향** — code enum / 타입은 **Component State** 문서의 `states[]`를 따름. 역방향 금지
- **Trivial System 예외** — 상태가 없는 System은 `lifecycle_ref` 생략

### 예시

```yaml
# Read-only System (상태 있지만 projection만)
tier: system
id: deterministic-label-system
lifecycle_ref:
  state_component: deterministic-label-record-state
  pipe_refs: []
  read_only_projection: true

# Write-mode System (전이 실행)
tier: system
id: approval-system
lifecycle_ref:
  state_component: approval-request-state
  pipe_refs:
    - meta-semantic/pipe-impl/approval-transitions#approve-dispatch
    - meta-semantic/pipe-impl/approval-transitions#reject-dispatch
  read_only_projection: false

# 상태 없는 System
tier: system
id: codec-system
# lifecycle_ref 없음 (stateless transformation)
```

상세: [state-machine-delegation.md](./state-machine-delegation.md)

### Trivial System 판단 힌트

- Read-only 단일 함수 (예: `getX(id): X`)
- 상태 전이가 데이터 shape만으로 자명 (Component가 모든 contract 표현)
- 외부 consumer 없음 (도구 내부 헬퍼)

## 규칙 3 — Inline 정의 금지 (R-4)

**Layout의 "생성"은 "발견"이지 "inline 정의"가 아니다.**

Layout이 새 Entry / Component / System을 발견할 수 있지만, 발견된 정의는 **독립 tier 문서로 promote**한다.

### 실제 예시

```
# 틀린 구조 (Layout이 inline으로 System 정의)
some-layout (Layout)
  refs: existing-system
  defines:
    new-system:                      ← X
      operations: [op1, op2]         ← 여기에 써넣으면 안 됨
      (inline-defined lifecycle)       ← X 금지

# 올바른 구조 (필요성 드러남 → 독립 문서로 promote)
some-layout (Layout)
  refs: existing-system, new-system  ← 독립 파일로 만든 뒤 참조
```

### 세부 규칙

- Layout 문서는 **참조(refs)와 조직**만 담는다
- 새 System / Component / State enum의 operations / lifecycle / schema 정의는 **독립 tier 문서로** (상태 전이는 meta-semantic 참조)
- Layout은 "이 자리에 X가 필요함"을 선언할 수 있되, X의 정의는 별도 문서
- Promote 후 Layout 섹션은 요약 + `[[<promoted-doc>]]` 링크 유지

### 자기 증명

Layout 재귀는 "이전에 없던 구조적 요구를 발견하는 메커니즘"이지 "문서 안에 다른 문서를 품는 메커니즘"이 아니다.

## LinkType 사용 요약

| 관계 | 방향 | LinkType | 용도 |
|------|------|----------|------|
| System → System | 소비 | `depends_on` | A가 B를 사용 |
| System → System | 구체화 | `refines` | A가 B를 더 구체화 |
| **System → Component (State enum)** | **상태 소유** | `lifecycle_ref.state_component` (frontmatter 필드) | **State enum을 담는 Component 참조 (D-17)** |
| **System → meta-semantic pipe** | **실행 위임** | `lifecycle_ref.pipe_refs` (frontmatter 필드) | **상태 전이 규칙을 meta-semantic에 위임** |
| Layout → System | 배치 | `refs` (신규) | Layout이 Systems를 조직 |
| Layout → Layout | 재귀 | `refs` | Layout이 다른 Layout 참조 |
| Component → ? | — | — | Component는 수동적, 링크 대상일 뿐 |
| Entry → Component | aggregation | `refines` 또는 metadata | Entry가 참조하는 Component 집합 (ECS Entity 적응) |

> **D-17 Pivot**: 기존 "System → FSM: implements" 및 "FSM Transition → PipeTransitionScope: implements" 관계가 모두 제거됨 (FSM tier 삭제). 대신 System 문서의 `lifecycle_ref` frontmatter 필드로 State Component와 meta-semantic pipe를 참조.

`contains`는 Layout → System 등의 소속 표현에 **사용하지 않는다** (`refs` 사용). `contains`는 여전히 문서-문서 포함 관계(group → leaf)에서 쓰일 수 있지만, STC 도입 후에는 대체로 제거 대상.

## 검증 승격

`def validate`의 경고 → 에러 승격 시점:

| 위반 | Phase 1 | Phase 2~3 | Phase 4 | Phase 5 |
|------|---------|-----------|---------|---------|
| System이 System을 `contains` | warning | warning | **error** | error |
| Layout inline 정의 감지 | — | warning | **error** | error |
| `lifecycle_ref.state_component` 미존재 Component 참조 | — | warning | **error** | error |
| `lifecycle_ref.pipe_refs` 미존재 meta-semantic pipe 참조 | — | warning | **error** | error |

상세: [../03-decisions.md#D-17](../03-decisions.md)

## 근거

- 핵심 원칙: [../00-design.md §1.2, §1.3](../00-design.md)
- Phase 0 결정: [../03-decisions.md D-4, D-8](../03-decisions.md)
- System 외연: [../03-decisions.md#R-7](../03-decisions.md)
