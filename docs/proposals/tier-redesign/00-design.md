---
def:
  id: tier-redesign-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: tier-redesign-readme
      type: depends_on
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: overview
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/tier-redesign/`의 일부로, 아직 정규 스펙이 아닙니다.
> 본 제안이 **accepted** 상태로 승격되면 규칙은 `docs/specs/` 정규 트리로 이식되고 본 문서는 역사 기록으로 보존됩니다.
>
> 본 문서는 **개요 + 핵심 원칙 + 좌표 공식 + 재해석 예시**만 담는다. 각 tier 정의와 세부 규칙은 [tiers/](./tiers/), [rules/](./rules/)에 분산. 읽는 순서는 [README.md](./README.md) 참조.
>
> **읽기 지도**: 배경별 진입 경로와 4 taxonomy 모델 + 관점(질의 조합) 정의는 [mental-models.md](./mental-models.md) 참조. 먼저 읽으면 전체 구조 파악에 도움.

# STC (Semantic Topological Coordinate) — 설계 개요

## 목적 ^purpose

문서와 시스템을 중복 없이 좌표로 표현하기 위한 **STC (Semantic Topological Coordinate)** 체계를 정의한다. STC의 `tier` 축은 Component / Entry / System / Layout의 **네 값**을 가지며, 기존 `level(group/module/leaf)` 체계를 **ECS 적응** 기반의 `tier` 축으로 전환하고, Layout을 System 소비 + 생성의 컨텍스트로 분리한다. ECS 정석(Entity/Component/System 3축)과의 변형 범위는 [mental-models.md § ECS 정석 vs STC 적응](./mental-models.md) 표로 박제.

> **용어**: 본 문서에서 **STC**는 전체 좌표계를, **tier**는 STC의 구조 축(Component/Entry/System/Layout)을, **tiers**는 그 4개 값을 지칭한다. "4-tier" 같은 숫자 접두 표현은 사용하지 않는다 — count는 구현 세부일 뿐 핵심 개념이 아님.

> **Pivot 결정 (D-17)**: 이전에 5 tier(Component/Entry/FSM/System/Layout)로 설계했으나 **FSM tier 제거**. 상태 전이/원자 경계는 meta-semantic(`docs/specs/meta-semantic/`)이 소유. STC는 **문서 분류**만 담당하고 **실행/상태는 meta-semantic 위임**. 상세: [03-decisions.md D-17](./03-decisions.md), [rules/state-machine-delegation.md](./rules/state-machine-delegation.md)

> **명명 근거 (STC)**:
> - **Semantic**: tier / scope / layer 각 축이 의미(semantic) 기반 분류 — 데이터 구조가 아닌 "무엇을 서술하는가" 의미로 분류
> - **Topological**: 엄밀한 수학적 topology 의미보다는 **"위치"와 "인접성"** 의미로 사용. Layout 재귀(§1.3)로 형성되는 참조 그래프에서 각 문서의 **topological position**(어떤 tier × scope × layer에 있고, 무엇과 인접한지)을 정의
> - **Coordinate**: 세 축의 교차점이 문서의 "주소". 이를 frontmatter로 선언 + 도구가 검증
>
> 엄밀한 수학 topology는 아니되, "위치 + 관계"의 직관을 공유. 더 정확한 명명 후보는 "Semantic Structural Coordinate" 또는 "Categorical Multi-axis Coordinate"이나 **"STC"** 약어의 발음성/기억성을 고려해 현 이름 유지.

---

## 1. 핵심 원칙 ^defines

네 가지 원칙이 STC의 기반이 된다.

### 1.1 데이터는 여러 System에 공유된다

Entry / Component는 여러 System이 의존한다. 이 공유 의존성 때문에 Axis를 고정하고 버전 관리한다 — Axis가 흔들리면 모든 의존 System이 무효화된다.

→ 적용: [Component tier](./tiers/component.md) § 변경 경로

### 1.2 System은 독립적이다

System은 다른 System에 포함(`contains`)되지 않는다. System 간 관계는 `depends_on` / `refines`만 허용 (`implements`는 D-17 이전 System→FSM 용도였으나 FSM tier 제거로 현재 활성 사용처 없음).

→ 상세: [rules/system-independence.md](./rules/system-independence.md) § 규칙 1

### 1.3 Layout은 생성적 소비 컨텍스트다

Layout은 수동적 뷰가 아니다. 안에서 System을 소비하고 새 Entry / Component / System을 **발견**할 수 있다. 단 **생성 ≠ inline 정의** — 발견된 정의는 독립 tier 문서로 promote.

→ 상세: [rules/system-independence.md](./rules/system-independence.md) § 규칙 3

### 1.4 상태 관리는 meta-semantic에 위임

상태 전이(FSM 개념)는 STC가 소유하지 않는다. 이미 존재하는 meta-semantic(`docs/specs/meta-semantic/`) 체계가 **594 tests**로 실증된 pipe / transition-scope / data-facets 체계를 보유하고 있고, 같은 개념을 STC에도 두면 이중 소유 문제 발생.

**해결**: System이 상태 관리 시 meta-semantic을 참조만 한다.

```
System (STC)  ──(lifecycle_ref)──→  meta-semantic (외부)
                                    - Data IR.lifecycle
                                    - PipeTransitionScope
                                    - TransitionDef

State enum   →  Component tier (STC 내부 분리)
Lifecycle    →  meta-semantic pipe (외부 참조)
```

→ 상세: [rules/state-machine-delegation.md](./rules/state-machine-delegation.md) / [03-decisions.md D-17](./03-decisions.md)

---

## 2. STC tier 체계

STC의 `tier` 축은 4개 값을 갖는다. 각 tier는 독립 문서로 정의.

```
Component  →  Entry  →  System  →  Layout
  (데이터)    (투영)    (기능)     (배치+생성)

상태 관리 필요 시 System에서 meta-semantic에 위임 (외부 참조)
```

| Tier | 정의 문서 | 역할 |
|------|----------|------|
| Component | [tiers/component.md](./tiers/component.md) | **데이터 진입점** (D-18) — 6 sub-type: data-shape / state-enum / evidence-shape / data-facet-role / validation-rule / constant-literal |
| Entry | [tiers/entry.md](./tiers/entry.md) | 구체화 인스턴스 (R-2 신중) |
| System | [tiers/system.md](./tiers/system.md) | Operations 집합 + 상태 관리 시 meta-semantic 참조 |
| Layout | [tiers/layout.md](./tiers/layout.md) | 조직적 배치 |

판단 우선순위: [rules/classification.md](./rules/classification.md)

---

## 3. 좌표 공식

```
doc_coordinate = tier × scope × layer
```

| 차원 | 값 | 역할 |
|------|----|------|
| `tier` | component / entry / system / layout | 이 문서가 무엇인가 |
| `scope` | data / feature / flow / constraint / interface / state / ui | 어떤 종류의 관심사인가 |
| `layer` | domain / operation / mediation / experience | 왜 존재하는가 |

**중복 감지 규칙**: 같은 `(tier, scope, layer, aspect)` 좌표를 가진 문서가 둘 이상이면 중복 신호.

**깊이 표현**: `contains` 링크 체인이 System 내부 구조를 표현한다 (단, System 독립성 원칙 내에서).

### `depth` 필드 — D-6 보류

기존 frontmatter의 `depth`(overview/specification/implementation/validation)는 stage 축이다. STC가 이를 흡수하지 않으며, stage는 여전히 `lifecycle`(draft/approved)과 파일 확장자(.spec/.plan/.todo/...)로 표현된다. 운명(제거/재정의/유지)은 Phase 1 영향 조사 후 별도 결정. 상세: [03-decisions.md#D-6](./03-decisions.md)

### qa-sdk 기존 좌표계와의 관계 — Independent classification axes (부분 상관)

세 좌표계는 **완전 직교**가 아닌 **독립 분류축 + 권장 상관관계**로 공존. 각 축의 값은 독립적으로 설정 가능하되, 특정 tier는 특정 scope와 **권장 상관** (예: Component → data, System → feature).

- URN / prefix / axis — 런타임 데이터 인스턴스 좌표 (예: `urn:def:spec:docs-control-plane:v1`)
- scope × aspect — 문서 관심사 분류
- **STC tier — 문서 구조 분류 (신규)**

**엄밀한 관계**:
- URN은 identifier (instance), scope/aspect/tier는 classifier (metadata) — 존재 층위가 달라 **직교**
- scope × aspect와 tier는 모두 문서 metadata 필드이며 **서로 다른 질문에 답함** (관심사 vs 구조) — **독립 분류축**이되 권장 상관관계 있음
- `depth` 필드는 D-6 보류 — 제거 방향이지만, 제거해도 STC가 `depth`를 흡수하지 않음 (`lifecycle` + 확장자 조합이 stage 축 대체)

상세 관계: [03-decisions.md § qa-sdk 기존 좌표계와의 관계](./03-decisions.md)

---

## 4. 현재 문서의 재해석 예시

실제 qa-sdk 문서들을 STC tier로 분류해본다. 명확한 경우와 애매한 경우를 병치해 기준의 실효성을 점검한다.

### 명확 사례

| 문서 | tier | 근거 |
|------|------|------|
| `ingest-system` | System | R-7 3-check 3/3 |
| `system-infra-layout` | Layout | 여러 System을 refs로 조직 |
| `system-root` | Layout | 여러 Layout을 refs로 조직 |
| `deterministic-label-record-state` (미작성) | Component | State enum 분리 — meta-semantic 체계 참조 대상 |

### 애매 사례

| 문서 | 잠정 tier | 분할 제안 |
|------|----------|----------|
| `docs-control-plane` | System | Sub-package를 `depends_on`으로 분리. 상태 관리는 lifecycle_ref로 meta-semantic 참조 |
| `definition-catalog-spec` | 분할 필요 | Component (스키마) + System (operations). 상태 전이는 meta-semantic |
| `CLAUDE.md` | tier 면제 | Operational instruction 예외 (D-2 확장) |

### 본 제안 자체

수락 후 예상 분할:
- `doc-tier-convention.spec.md` — tier 스키마 정의 (Component)
- `doc-tier-migration.spec.md` — 전환 operations (System)
- `doc-tier-delegation.spec.md` — meta-semantic 위임 규칙 (System 확장)

Sanity Check 상세 + 분류 근거: [03-decisions.md § Sanity Check](./03-decisions.md)

---

## 5. 미결 사항 (우선순위별)

### P1 — Phase 1 전 또는 Phase 1 구현 범위 (선결)

**조사**:
- [ ] D-6 `depth` 필드 사용처 전수 조사
- [ ] Layout-like `contains` 실사용 사례 조사
- [ ] Operational 문서 tier 예외 정책 (D-2 확장)

**스키마/도구**:
- [ ] `tier` 필드 스키마 변경
- [ ] `refs` LinkType 반영
- [ ] `def validate` 마커 동기 검증 구현 방법

**State 관리 세부 (D-17)**:
- [ ] `lifecycle_ref` frontmatter 필드 schema 확정 (zod)
- [ ] State Component minimum shape
- [ ] System → meta-semantic pipe 참조 형식 (pipe 경로 + transitionId) 고정

### P2 — 자동 분류 단계

- [ ] 1,046개 문서 tier 자동 분류
- [ ] 자동 분류 성공률 측정 (목표 ≥80%)
- [ ] System/Layout 경계 애매 문서 비율 측정

### P3 — Pilot 검증

- [ ] R-7 System 외연 3-check 실효성 검증
- [ ] R-2 Entry tier 후보 수 관찰
- [ ] State Component promote threshold 확정 (복잡도 초과 시 별도 Component 문서로)
- [ ] Layout heading mirror 권장/필수 결정
- [ ] System → meta-semantic lifecycle_ref 참조가 Consumer 관점에서 자연스러운가 (학습 곡선 측정)

### P4+ — 전체 전환 이후

- [ ] R-2 Entry tier 존속/제거 최종 결정
- [ ] `level` 필드 deprecated 처리 시점
- [ ] Build-time codegen 자동화 도입 여부

### Exit Criteria
Rollback 조건: [03-decisions.md § Exit Criteria](./03-decisions.md). 주요 트리거:
- Phase 2: 자동 분류 성공률 < 50% / Entry 후보 0건 / System-Layout 경계 애매 > 30%
- Phase 3: Pilot schema 부적합 / framing 어색 / R-7 기준 실효 없음
- Phase 1: 도구 변경 비용이 허용 범위 5배 초과 → 전면 rollback

---

## 다음 읽기

- **Tier 정의**: [tiers/README.md](./tiers/README.md)
- **분류 + 독립성 규칙**: [rules/classification.md](./rules/classification.md), [rules/system-independence.md](./rules/system-independence.md)
- **마이그레이션**: [01-migration.md](./01-migration.md)
- **State Machine Delegation**: [rules/state-machine-delegation.md](./rules/state-machine-delegation.md) — 상태 관리 위임 규칙 (D-17)
- **Phase 0 결정**: [03-decisions.md](./03-decisions.md)
- **Pilot 예시**: [examples/](./examples/)
