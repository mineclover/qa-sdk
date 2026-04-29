---
def:
  id: tier-redesign-03-decisions
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
role: phase-0-decision
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/tier-redesign/`의 일부. 아직 정규 스펙이 아닙니다.
>
> 이전 문서: [01-migration](./01-migration.md) · 첫 문서: [00-design](./00-design.md)

# Semantic Topological Coordinate — Phase 0 결정 메모

## 날짜: 2026-04-18

## 맥락

[01-migration.md](./01-migration.md)의 Phase 0은 STC 체계의 핵심 설계 결정을 고정해, 이후 Phase 1~5의 구현·전환·정착이 근거를 참조할 수 있게 하는 단계다. 본 메모는 Phase 0의 산출물이자, 후속 PRD/spec이 근거로 인용하는 결정 레지스트리다.

각 결정은 `D-<번호>`, 각 개념 리뷰는 `R-<번호>`로 번호를 붙인다. 후속 문서는 이 번호로 인용한다.

> **D-17 Pivot (2026-04-18)**: FSM tier를 STC에서 제거하고 상태 전이를 meta-semantic에 위임하는 근본 결정. D-5/D-7/D-9/D-10/D-12/D-13/D-14/D-16 등 FSM 관련 결정 다수가 superseded. 상세: [D-17](#d-17-fsm-tier-pivot-meta-semantic에-상태-위임), [rules/state-machine-delegation.md](./rules/state-machine-delegation.md)

## TL;DR

### 현행 결정

| 결정 | 요약 | 가역성 |
|------|------|--------|
| D-1 | STC 채택 (Component/Entry/System/Layout — **4 tier**) | low |
| D-2 | tier는 `type: spec`에만 적용, knowledge 예외 | medium |
| D-3 | level → tier 전환 룰 (우선순위 **5단계**) | medium |
| D-4 | Layout→System 참조는 `refs` 신규 LinkType | low |
| **D-6** | `depth` 필드 — **보류 (조사 후 별도 결정)** | — |
| D-11 | Dry-run은 System operation | medium |
| D-15 | System 명명 컨벤션 `-system` 접미사 권장 (강제 아님) | medium |
| **D-17** | **FSM tier Pivot — meta-semantic에 상태 전이 위임** | **low** |
| **D-18** | **Component tier = 데이터 진입점 + sub-type taxonomy** | medium |
| **D-19** | **최상위 문서 분류 체계 (Design vs Knowledge) 도입** | high |

### Superseded 결정

| 결정 | 요약 | 상태 |
|------|------|------|
| ~~D-5~~ | ~~FSM 기본 scope/aspect~~ | superseded by D-17 |
| ~~D-7~~ | ~~FSM schema~~ | superseded by D-17 |
| ~~D-8~~ | ~~System↔FSM implements~~ | superseded by D-17 |
| ~~D-9~~ | ~~FSM SSOT~~ | superseded by D-17 (Component State SSOT로 계승) |
| ~~D-10~~ | ~~Any-state transitions~~ | superseded by D-17 |
| ~~D-12~~ | ~~Evidence shape promote~~ | superseded by D-17 |
| ~~D-13~~ | ~~Consumer 빠른 참고~~ | superseded by D-17 |
| ~~D-14~~ | ~~Gate/Guard 명명~~ | superseded by D-17 (FSM 제거) |
| ~~D-16~~ | ~~FSM Transition Hybrid absorb~~ | superseded by D-17 |

**가역성 정의**:
- `low` — rollback 시 1,046 문서 재작업 또는 도구 전반 교체 필요
- `medium` — 규칙/정책 변경으로 rollback 가능
- `high` — 스키마 필드 복원 또는 단일 함수 수정으로 rollback 가능

**개념 리뷰 5개 (R-1/R-2/R-4/R-6/R-7)**: tier/doc-type 직교성, Entry tier 약점, Layout 생성적 성격, System "CRUD" 오해, System 외연 경계. ~~R-3(FSM framing)~~, ~~R-5(Guard 도메인)~~은 D-17로 superseded.

---

## 결정 (현행)

### D-1: STC 채택 (4 tier)

**결정**: Component / Entry / System / Layout을 도입한다 (**D-17 Pivot 반영, 기존 5 tier에서 FSM 제거**).

**근거**:
- ECS 기반으로 데이터/인스턴스/기능/배치의 분리가 문서-코드 정합성을 만든다
- 기존 `level`(group/module/leaf)은 "묶임의 이유"만 담음 — "무엇을 담는가"는 표현 못함
- 상태 전이 개념은 STC가 아닌 meta-semantic이 소유 (D-17)

**영향**: 1,046 기존 문서의 tier 재분류. 도구(`def sync/validate`) 업데이트.

---

### D-2: tier는 `type: spec` 문서에만 적용

**결정**: `tier` 필드는 `type: spec` 문서에만 필수. `type: knowledge` 문서는 tier 없이도 유효.

**근거**:
- 5-tier는 **아키텍처·구현**을 서술하는 문서를 분류
- Knowledge 문서는 **개념·철학·ADR·패턴** 등 "왜 그렇게 결정했는가"를 서술

**예외 (Operational)**: `CLAUDE.md`, `.claude/skills/`, `docs/skills/` 등은 **positive list**로 tier 면제 (자세한 규칙은 [rules/classification.md](./rules/classification.md)).

---

### D-3: level → tier 전환 룰 (5단계)

**결정**: [rules/classification.md](./rules/classification.md)의 **5단계** 우선순위 채택. D-17로 "상태 전이" 항목 제거.

**판단 판단 순서** (위에서부터 먼저 적용):

1. `type: knowledge` → tier 면제
2. Operations 집합 + R-7 3-check 2개 이상 → `system`
3. 여러 system을 조직적으로 배치 → `layout`
4. 데이터/스키마 shape (State enum 포함) → `component`
5. 잘 알려진 singleton 인스턴스 패턴 → `entry` (R-2 신중)

**영향**: Phase 2 자동 분류가 이 우선순위로 판단.

---

### D-4: Layout → System 참조의 LinkType

**결정**: **`refs`** 신규 LinkType 도입.

**의미**:
- `refs`: composition reference. 소유/의존/구현 어느 것도 아님
- Layout이 빠져도 System은 독립적으로 존재

**영향**:
- `def validate`에 `refs` 검증 추가 — Layout → System 방향만 허용
- 기존 문서에서 `contains`가 Layout-like 용도로 쓰인 곳을 Phase 2에서 `refs`로 재분류

---

### D-6: `depth` 필드 — 보류

**상태**: **보류**. 본 Phase 0에서 결정하지 않는다.

**이유**: Phase 1 구현 전 1,046 문서의 `depth` 실사용 전수 조사가 선행되어야 정보 손실 여부 판단 가능.

**근거 (예상 방향)**:
- `depth`(overview/specification/implementation/validation)는 stage 축
- `lifecycle` + 확장자 조합으로 stage 표현 충분
- 중복 축으로 추정

---

### D-11: Dry-run은 System operation

**결정**: Dry-run 평가 기능(예: `dryRunDeterministicLabelTransition`)은 **System의 operation**이다. FSM tier가 제거된 후에도 이 결정은 유효.

**근거**:
- Dry-run은 실제 상태 변경이 없는 "평가 함수"
- System 문서의 operations 섹션에 기술
- 결과 shape에 `mutationTargets` 모두 `false` 명시

**가역성**: medium

---

### D-15: System 명명 컨벤션 `-system` 접미사

**결정**: System tier 문서의 id는 `<domain>-system` 접미사 **권장** (필수 아님).

**근거**:
- 기존 qa-sdk 관행: `ingest-system`, `gate-system` 등
- 명명으로 tier 식별 가능

**규칙**:
- 새 System 생성 시 `-system` 접미사 권장
- 기존 문서 변경 강제 안 함 (`docs-control-plane`처럼 접미사 없어도 OK)

**가역성**: medium

---

### D-17: FSM tier Pivot — meta-semantic에 상태 위임

**결정**: FSM을 STC의 tier로 두지 않는다. STC는 Component / Entry / System / Layout 4 tier로 축소. 상태 전이 / 원자 경계 / 이벤트 카탈로그는 기존 meta-semantic(`docs/specs/meta-semantic/`)이 단독 소유한다.

**근거**:

1. **이중 소유 해소** — 이전 설계(D-16 Hybrid)에서 "transition" 어휘가 STC FSM tier와 meta-semantic PipeTransitionScope 양쪽에 존재. 이중 소유는 설계 오류의 강한 신호
2. **meta-semantic 실증** — 594 tests로 뒷받침되는 기존 체계가 상태/원자성/compensate/events를 이미 완결적으로 소유
3. **ECS 원본 충실** — 차용한 ECS에는 FSM tier가 없음. 원본에 가깝게 유지
4. **Learning cliff 해소** — Form 1/Form 2 선택 복잡성 제거
5. **STC 일반화** — 상태 없는 도메인에도 동일 체계 적용

**구조**:

```
System (STC)
  └─ lifecycle_ref:
       state_component: <Component tier id>                 # State enum
       pipe_refs: [<meta-semantic path>#<transitionId>]     # 전이 규칙 (형식: 파일 경로 # transitionId)
       read_only_projection: true/false

State enum         → Component tier 문서로 분리 (D-17 규칙)
Lifecycle / 전이   → meta-semantic 체계 참조 (외부)
```

**Superseded 결정 대응**:

| 기존 결정 | 새 위치 |
|---------|---------|
| D-5 (FSM scope/aspect) | 삭제 — FSM tier 없음 |
| D-7 (FSM schema) | 삭제 |
| D-8 (System↔FSM implements) | System의 `lifecycle_ref`로 대체 |
| D-9 (FSM SSOT) | Component State → code enum SSOT로 계승 |
| D-10 (Any-state transitions) | meta-semantic PipeTransitionScope에 위임 |
| D-12 (Evidence shape promote) | Component tier에 적용 가능 |
| D-13 (Consumer quick-ref) | System 문서에 적용 가능 (기존 그대로) |
| D-14 (Gate/Guard 명명) | 삭제 |
| D-16 (FSM Transition Hybrid absorb) | 삭제 — hybrid 자체가 의미 없음 |

**영향**:

- `tiers/fsm.md` — **삭제**
- `02-fsm-composition.md` — **삭제**
- `examples/deterministic-label-record-fsm.md` — **삭제**
- [rules/state-machine-delegation.md](./rules/state-machine-delegation.md) — **신규**: 상태 관리 위임 규칙
- [tiers/system.md](./tiers/system.md) — `lifecycle_ref` 설명 추가
- [tiers/component.md](./tiers/component.md) — State enum Component 역할 추가
- [examples/deterministic-label-system.md](./examples/deterministic-label-system.md) — `implements` 제거, `lifecycle_ref` 추가
- [rules/classification.md](./rules/classification.md) — 5단계로 축소
- [rules/system-independence.md](./rules/system-independence.md) — System↔meta-semantic 규칙
- [mental-models.md](./mental-models.md) — Model 2 (FSM 내부) 제거, 3 모델로 축소

**가역성**: **low** — 문서 ~1,300줄 재조립 완료 상태. 롤백 시 FSM tier 재도입 + Pilot FSM 재작성 필요.

**Pilot 검증 가설** (Phase 3):
- System + meta-semantic 조합이 실무에 자연스러운가
- State enum Component 분리가 가독성을 해치지 않나
- meta-semantic 학습 부담이 Consumer에 과도한가

**Write-mode Pilot 추가 (2026-04-18)**: 긴장 3 (Write-mode Pilot 부재) 부분 해소 목적으로 가상 Pilot 쌍 신설.
- [examples/approval-request-state.md](./examples/approval-request-state.md) — write-mode Component (4 states)
- [examples/approval-system.md](./examples/approval-system.md) — write-mode System (non-empty `pipe_refs`, compensate 포함)
- 한계: `pipe_refs`가 가리키는 meta-semantic pipe 문서(`approval-pipe.spec.md`)가 미작성. Phase 1.B 또는 실제 write-mode controller 구현 시 보강

---

### D-18: Component tier = 데이터 진입점 + sub-type taxonomy

**결정**: Component tier를 **모든 데이터 개념의 STC-level 진입점**으로 선언. 내부 **sub-taxonomy**로 세분화된 데이터 유형을 관리. meta-semantic이 다루는 Data 개념은 Component의 sub-type 중 하나로 매핑됨.

**근거**:

1. **이중 소유 완전 해소** — meta-semantic Data 개념(Data IR, facet roles)과 STC Component가 **동일 개념**. 두 곳에서 서술하면 이중 소유. 하나로 통합.
2. **긴장 1 근본 해소** — D-17로 State enum이 Component에 추가되면서 "과부하"처럼 보였으나 실제는 **본래 의도의 명시화**. Component = 모든 데이터의 진입점.
3. **Learning cliff 완화** — Consumer는 Component tier 진입만 이해하면 됨. meta-semantic 세부는 **필요 시에만** 깊이 학습.
4. **meta-semantic과 STC의 역할 경계 재확인** — STC Component = 문서 레벨 진입점(taxonomy), meta-semantic = 실행/runtime 구현 체계.

**Sub-type taxonomy (6 카테고리)**:

```yaml
tier: component
component_subtype: <sub-type>         # 신규 필드
# sub-type별 추가 필드:
states: [...]                          # state-enum일 때
schema: {...}                          # data-shape일 때
facet_role: production|consumption|... # data-facet-role일 때
```

| Sub-type | 의미 | 예시 |
|---------|------|------|
| `data-shape` | 타입/인터페이스/스키마 (primary) | `LabelRecord { id, state, ontologyPackId, ... }` |
| `state-enum` | 전이 규칙 없는 상태 리스트 | `DeterministicLabelRecordState` (D-17로 분리) |
| `evidence-shape` | 계산 결과 데이터 형상 | `GuardEvidence { passed, reason }` |
| `data-facet-role` | meta-semantic 5역할 중 하나 | 생산/소비/정의/관리/저장 중 하나의 역할 문서 |
| `validation-rule` | shape의 validation 조건 (후보) | zod schema 조건 |
| `constant-literal` | 불변 상수 리스트 (후보) | 허용 값 열거 |

`validation-rule`과 `constant-literal`은 **data-shape의 하위 요소**로 볼 수 있으므로 초기엔 **후보 상태**. Pilot 관찰로 승격/제거 결정.

**meta-semantic과의 매핑**:

| meta-semantic 개념 | STC Component sub-type |
|------------------|----------------------|
| Data IR | `data-shape` (+ lifecycle 참조) |
| Data facet 5역할 | `data-facet-role` |
| PipeFlow의 입출력 data | `data-shape` (pipe 소유) |
| Evidence / Gate output | `evidence-shape` |

**문서 소유**:
- meta-semantic 문서(Data IR 등)는 **meta-semantic 영역에 유지** (실행 구현 체계)
- STC Component는 **동일 개념을 tier taxonomy 관점에서 기술** — 문서는 서로 prose 참조
- 이중 소유 아님 — **같은 개념의 다른 관점 서술**

**SSOT 방향 (D-9/D-17 계승)**:
- STC Component = 문서 레벨 진입점 (tier taxonomy)
- meta-semantic = 실행/runtime 구현 체계
- code enum = Component `states[]` / `facet_role` 등을 구현

**영향**:

- `tiers/component.md` — 전면 재구성: "데이터 진입점" 선언 + sub-type taxonomy + meta-semantic 매핑
- `rules/state-machine-delegation.md` — State enum이 Component sub-type임 명시
- `rules/classification.md` — Component 판단 시 sub-type 결정 가이드
- `mental-models.md` Model 1 — Component 설명 확장 (진입점 관점)
- `examples/deterministic-label-record-state.md` — **신규 State Component Pilot** (`component_subtype: state-enum`)
- `examples/deterministic-label-system.md` — `lifecycle_ref.state_component`가 `state-enum` sub-type 참조임 명시

**긴장 관계**:
- **긴장 1 해소 ✓** — "과부하"를 "본래 구조"로 재해석
- **긴장 2 완화** — Component가 진입점이므로 meta-semantic 전체 학습 필수 아님
- **긴장 4 부분 복원** — State Component ↔ Data IR 매핑으로 4층 정합의 약한 복원

**가역성**: **medium** — sub-type 필드는 frontmatter level 추가/제거로 rollback 가능. 단 기존 Component 문서들의 sub-type 지정은 재작업 필요.

**Pilot 검증 가설** (Phase 3):
- 6개 sub-type 카테고리가 실제 Component 문서들을 충분히 커버하는가
- `validation-rule`, `constant-literal`이 독립 sub-type으로 필요한가 vs `data-shape` 하위로 충분한가
- meta-semantic 실 문서와의 매핑이 자연스러운가

---

### D-19: 최상위 이분법적 분류 체계 (Design vs Knowledge) 도입

**결정**: 모든 `definition-catalog` 문서는 `type` 필드를 통해 `design` 또는 `knowledge` 중 하나로 최상위 분류를 강제한다.

**근거**:
- 문서화 시스템의 장기 관리 시 설계 자산(Actionable)과 지식 맥락(Contextual)의 혼용을 방지하기 위함.
- `knowledge_kind` 축과 `doc-type-ext`(파일 확장자) 체계의 역할을 물리적으로 분리하여 책임 분리(SoR) 원칙 강화.

**구조**:
- **`type: design`**: `.spec`, `.rule`, `.test`, `.plan`, `.cases` 등 기능적 확장자 필수. `tier`와 정밀 좌표 필수. `knowledge_kind` 금지.
- **`type: knowledge`**: `.md`, `.memo`, `.todo` 확장자 사용. `knowledge_kind` 필드 필수. `tier` 면제.

**영향**:
- `def audit` 및 `def validate` 룰셋 강화: `type`과 확장자, 내부 마커 간의 불일치(Drift) 감지 추가.
- `rules/classification.md` 최상단에 마스터 스위치로 반영.

**가역성**: **high** — 필드 스키마 추가와 검증 룰이 전부이며, 기존 시스템의 `type: knowledge` 관행을 공식화한 수준.

---

## 개념 리뷰 (현행)

### R-1: tier vs doc-type 직교성

**논점**: tier(component/entry/system/layout)와 doc-type(spec/rule/todo/test/memo/plan) 관계가 명시되지 않으면 혼동 위험.

**근거 framing**: tier는 **Mental Model 1 (ECS taxonomy)**의 축, doc-type은 **Mental Model 2 (doc-type taxonomy)**의 별개 축. 두 축은 직교 taxonomy로 공존. 상세: [mental-models.md § Model 1](./mental-models.md) / [§ Model 2](./mental-models.md).

**정리**:
- **doc-type = 문서의 성격**: 완료된 정의 / 소비 규칙 / 실행 항목 / 검증 기준 / 결정 맥락 / 방향
- **tier = 문서가 서술하는 대상**: 데이터 / 인스턴스 / 기능 / 배치
- 두 축은 **직교** — 조합 가능

---

### R-2: Entry tier의 문서화 가치 재평가

**논점**: Entry는 **ECS Entity 적응**으로 "여러 Component를 aggregates하는 canonical ID 문서". 런타임 Entity는 대부분 동적이라 문서 대상이 아니고, 문서화 가치 있는 경우가 얼마나 있는가?

**약점**:
- 런타임 인스턴스는 문서화 대상이 아님 (동적 생성/소멸)
- Entry 문서 후보는 "canonical/singleton 인스턴스 패턴" 정도 — 희소

**결정 (Option A 확정 + 정량 trigger 박제)**:

- **선택**: Option A (Phase 1~3 Entry tier 유지, 사용 신중)
- **정량 trigger (박제, 결정 회피 불가)**:
  - **Phase 2 조건**: 자동 분류 결과 Entry 후보 **≥ 3건** 없으면 Phase 3 Pilot 진입 전 **Option B 전환 개시**
  - **Phase 3 조건**: Pilot 작성 중 Entry tier 실제 사용 건수 = 0이면 Phase 4에 **Option B 적용 강제**
  - **Phase 4 조건**: Entry tier 문서가 전체 분류 1,046 중 **< 5건**이면 Option B 제거

---

### R-4: Layout의 "생성적" 성격

**논점**: "Layout이 System을 생성한다"의 의미가 모호.

**정리**:
- Layout 문서는 **System/Entry/Component 참조를 조직** (primary)
- Layout 내부에서 **새로 정의 필요한 것 발견** 시, 그 정의는 **독립 문서로 분리** 작성 (inline 정의 금지)
- Layout 문서가 "생성한다"는 것은 **필요성을 드러낸다**는 의미

**결정**: Layout 재귀 섹션에 "Inline 정의 금지, 새 필요성은 독립 문서로 promote" 명시.

---

### R-6: System "기능 집합"의 CRUD 강제성

**논점**: "CRUD가 필수"인지 오해될 여지.

**정리**:
- System은 **operations 집합** — 읽기 전용 System도 완전한 System
- "CRUD"라는 표현은 "일반적 예시"일 뿐 **요구사항 아님**
- System 요건: (a) 명시적 interface, (b) 독립 운용 가능

**결정**: "operations (CRUD 또는 read-only 포함)"로 순화.

---

### R-7: System 개념의 외연

**논점**: "무엇이 System이 아닌가?"의 경계가 불분명하면 "모든 것이 System이면 System 설명력 상실".

**판단 기준 (3-check)**:

1. **명명 가능성** — Consumer가 고유 이름을 붙여 부르는가
2. **독립 운용** — 다른 System 없이 단독으로 의미 있는 결과를 내는가
3. **Lifecycle 유무** — 관리하는 Entry의 상태가 의미 있게 변화하는가 (Component State 보유 + 필요 시 meta-semantic pipe 참조)

**규칙**: 3개 기준 중 **2개 이상 충족**할 때 System tier.

**D-17 Pivot 후 재해석**: Lifecycle 기준의 "FSM implements" 근거는 삭제. 대신 "State Component 보유 + meta-semantic 연동"으로 대체.

---

## qa-sdk 기존 좌표계와의 관계

STC는 **세 번째** 좌표계가 아니다. qa-sdk에 이미 존재하는 두 좌표계와 **독립 분류축으로 공존**.

### 좌표계

1. **URN / prefix / axis** — 런타임 데이터 인스턴스 좌표
2. **scope × aspect** — 문서 관심사 분류
3. **STC tier** (신규) — 문서 구조 분류

**직교 관계**: 완전 직교가 아닌 **독립 분류축 + 권장 상관관계**로 공존.

### D-6의 `depth` 제거 재조명

`depth`는 stage 축. STC가 이를 흡수하지 않음 — stage는 `lifecycle` + 확장자로 표현. D-6 제거 방향은 **중복 축 제거**.

---

## Sanity Check — 실제 문서 분류

STC tier 분류를 현재 repo 문서에 대입.

### 명확 케이스

| 문서 | 제안 tier | 근거 |
|------|-----------|------|
| `ingest-system` (기존) | `system` | R-7 3-check 3/3 |
| `system-infra-layout` | `layout` | 여러 System을 refs로 조직 |
| `system-root` | `layout` | 여러 Layout을 refs로 조직 |
| `deterministic-label-record-state` (미작성) | `component` | State enum 분리 (D-17 규칙) |

### 애매 케이스

#### `docs-control-plane.spec.md`

- **잠정**: `tier: system` (R-7 3/3 만족)
- **lifecycle_ref**: `state_component: deterministic-label-record-state`, `pipe_refs: []` (read-only projection)
- Sub-package(`doc-envelope`, `deterministic-label-registry`, `ontology-pack-validate`)는 **별도 System** + `depends_on` 관계

#### `definition-catalog-spec`

- **잠정 tier**: 분할 대상
- Component (스키마) + System (operations)로 분리. 상태 전이가 있다면 meta-semantic 참조

#### `CLAUDE.md`

- **결정**: tier 면제 (operational instruction) — D-2 확장

---

## Exit Criteria — Rollback 조건

각 결정의 검증 실패 시 대응.

### 부분 rollback (결정별)

| 시점 | 트리거 | 판단 주체 / 방법 | 대응 |
|------|--------|----------------|------|
| Phase 2 | 자동 분류 성공률 < 50% | 자동 측정 | 전환 룰(D-3) 재설계 |
| Phase 2 | 자동 분류 50~79% | 자동 측정 | 룰 보강 + 재실행. 60% 미만이면 부분 재설계 |
| Phase 2 | Entry 후보 < 3건 | 자동 측정 | R-2 trigger 발동 — Option B 전환 |
| Phase 2 | Layout-like `contains` > 100건 | 자동 측정 | `refs` 도입 비용 재평가(D-4) |
| Phase 2 | System/Layout 경계 애매 > 30% | 자동 측정 | R-7 3-check 기준 재검토 |
| Phase 3 | Pilot에서 D-17 framing 어색 | 저자 + 리뷰어 2명 | meta-semantic 위임 구조 재평가 |
| Phase 3 | `lifecycle_ref` schema 부적합 발견 | Pilot 저자 | schema 재설계 |
| Phase 4B | Warning → error 승격 시 false positive > 10% | 자동 측정 | 4A로 롤백 |
| 임의 | 정규 docs에서 STC 어휘 오용 > 5건/월 | 수동 review | Proposal을 `under-review`로 되돌림 |

### 전면 rollback (전체 취소)

- **조건**: Phase 1 구현 비용이 **baseline × 5 초과** (2 person-week × 5 = 10 person-week)
- **대응**: 제안을 `rejected`로 전환, 기존 level 체계 유지

### D-17 Pivot 역방향 조건

- **조건**: Phase 3 Pilot에서 System + meta-semantic 조합이 직관에 반하거나 Consumer 학습 부담이 허용 범위 초과
- **대응**: D-17을 재고하고 FSM tier 복원 검토 (**가역성 low** — 문서 ~1,300줄 복원 필요)

---

## 미결 / 후속

### Phase 1 전에 해야 할 일
- [ ] `depth` 필드 사용처 전수 조사 (D-6 근거)
- [ ] 기존 문서에서 Layout-like `contains` 사용 사례 조사 (D-4 영향)
- [ ] Entry tier 후보 수 관찰 지표 설정 (R-2)
- [ ] `lifecycle_ref` frontmatter schema 확정 (zod)
- [ ] State Component minimum shape 확정
- [ ] System → meta-semantic pipe 참조 형식 고정

### Phase 3 Pilot 검증 가설
- System + meta-semantic 조합이 자연스러운가 (D-17 Pilot 검증 핵심)
- Entry tier를 실제 몇 건 작성하게 되는가 (R-2)
- R-7 3-check 기준이 실효적인가

### Phase 4+
- Entry tier 존속 여부 (R-2)
- `depth` 필드 제거 (D-6)
- System 명명 `-system` 접미사 규칙 적용률 (D-15)

---

## Superseded Decisions (역사 기록, D-17로 무효화)

### ~~D-5: FSM 기본 scope/aspect~~
**superseded by D-17**. FSM tier 제거로 무효.

### ~~D-7: FSM schema 카테고리/marker~~
**superseded by D-17**. FSM tier 제거로 무효.

### ~~D-8: System↔FSM `implements` + orphan 금지~~
**superseded by D-17**. System↔meta-semantic 위임 관계로 대체 ([rules/system-independence.md § 규칙 2](./rules/system-independence.md)).

### ~~D-9: FSM SSOT 원칙~~
**superseded by D-17**. Component State SSOT로 계승 (code enum은 State Component의 `states[]`를 따름).

### ~~D-10: Any-state transitions object form~~
**superseded by D-17**. meta-semantic PipeTransitionScope가 담당.

### ~~D-12: Evidence shape promote 기준~~
**superseded by D-17**. Component tier의 일반 promote 규칙 적용.

### ~~D-13: Consumer 빠른 참고 섹션 표준화~~
**superseded by D-17**. FSM 문서가 없어졌으나, 일반 System 문서에 선택적 적용 가능.

### ~~D-14: 코드-문서 명명 차이 정책 (Gate/Guard)~~
**superseded by D-17**. FSM 제거로 Gate/Guard 용어 충돌 맥락 자체 소멸.

### ~~D-16: FSM Transition은 inline 매핑 또는 PipeTransitionScope 참조 (hybrid)~~
**superseded by D-17**. Hybrid 대신 **완전 위임**. Form 1/2 선택 자체 소멸.

---

## Superseded Reviews (역사 기록)

### ~~R-3: FSM = System의 소비 인터페이스 framing의 견고성~~
**superseded by D-17**. FSM이 STC 외부에 있으므로 "System 인터페이스 framing" 논점 자체가 meta-semantic 내부 문제로 이관됨.

### ~~R-5: Guard 개념의 도메인 특수성~~
**superseded by D-17**. Guard는 meta-semantic PipeFlow의 `branch`/`filter`로 대체됨.

---

## 영향받는 문서 / 다음 갱신 작업

D-17 Pivot은 이미 반영 완료:

1. [x] [00-design.md](./00-design.md) — §1.4 원칙 / §2 tier / §3 좌표 / §4 재해석 / §5 미결 전부 4 tier로
2. [x] [tiers/README.md](./tiers/README.md) — 5 → 4 tier
3. [x] [tiers/component.md](./tiers/component.md) — State enum 역할 추가
4. [x] [tiers/system.md](./tiers/system.md) — lifecycle_ref, R-7 3-check 재해석
5. [x] [tiers/layout.md](./tiers/layout.md) — FSM 비교 제거
6. [x] [rules/classification.md](./rules/classification.md) — 5단계
7. [x] [rules/system-independence.md](./rules/system-independence.md) — System↔meta-semantic 규칙
8. [x] [rules/state-machine-delegation.md](./rules/state-machine-delegation.md) — 신규
9. [x] [mental-models.md](./mental-models.md) — Model 2 제거, 3 모델로
10. [x] 03-decisions.md (본 문서) — 재구성 완료
11. [x] [01-migration.md](./01-migration.md) — Phase 3 Pilot 요건에서 FSM 제외, lifecycle_ref schema 추가
12. [x] [examples/deterministic-label-system.md](./examples/deterministic-label-system.md) — `implements` 제거, `lifecycle_ref` 추가
13. [x] [examples/docs-control-plane-layout.md](./examples/docs-control-plane-layout.md) — FSM 참조 제거
14. [x] [examples/README.md](./examples/README.md) — Pilot 목록에서 FSM 제거
15. [x] `tiers/fsm.md` — **삭제됨** (199줄)
16. [x] `02-fsm-composition.md` — **삭제됨** (288줄)
17. [x] `examples/deterministic-label-record-fsm.md` — **삭제됨** (370줄)
18. [x] [README.md](./README.md) — 구성 표 (4 tier), 변경 이력에 D-17 항목 추가

---

## 최종 승인 상태

- 본 memo는 **draft** — D-17 반영 완료
- 승격 조건: Phase E (examples), Phase F (삭제), Phase G (README) 완료 후
- 본 memo의 결정은 Phase 3 Pilot 검증 결과에 따라 **재평가 대상**
- D-17의 롤백 비용은 low reversibility — Phase 3 Pilot에서 위험 조기 감지 필수
