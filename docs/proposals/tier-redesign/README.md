---
def:
  id: tier-redesign-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  links:
    - target: tier-redesign-mental-models
      type: refs
    - target: tier-redesign-00-design
      type: refs
    - target: tier-redesign-01-migration
      type: refs
    - target: tier-redesign-02-tracking-roadmap
      type: refs
    - target: tier-redesign-03-decisions
      type: refs
    - target: tier-redesign-tiers-readme
      type: refs
    - target: tier-redesign-examples-readme
      type: refs
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: index
supersedes: -
superseded_by: -
---

# STC — Semantic Topological Coordinate 제안

> **Status**: `under-review` · **Started**: 2026-04-18 · **Promoted**: 2026-04-19 · **Reviewer**: subagent review 1~6차 (독립 에이전트 피드백 루프)

## 제안 요약

기존 `level: group | module | leaf` 분해 체계를 **STC (Semantic Topological Coordinate)**로 전환한다. STC는 `tier × scope × layer` 세 축의 좌표계이며, `tier` 축이 Component / Entry / System / Layout의 **네 값**을 갖는다. **ECS 적응** 기반으로 데이터·ID aggregation·기능·배치를 분리 (ECS 정석 3축 + Layout 확장, 변형 범위는 [mental-models.md § ECS 정석 vs STC 적응](./mental-models.md) 참조).

> **D-17 Pivot (2026-04-18)**: 이전 설계는 5 tier(+ FSM)였으나 meta-semantic과의 역할 중복 해소를 위해 FSM tier 제거. 상태 전이/원자 경계/이벤트 카탈로그는 이미 실증된 meta-semantic(`docs/specs/meta-semantic/`) 체계가 단독 소유. System이 상태 관리 시 `lifecycle_ref`로 참조만. 상세: [03-decisions.md D-17](./03-decisions.md), [rules/state-machine-delegation.md](./rules/state-machine-delegation.md)

## 독자 / 읽는 순서

| 독자 | 순서 |
|------|------|
| 처음 읽는 사람 | `mental-models` → `00-design` → `tiers/` 각 문서 → `01-migration` → `03-decisions` |
| 이미 배경 아는 사람 | `mental-models` → `03-decisions` (결정 요약) → 필요 tier 문서 → `examples/` |
| 마이그레이션 실행자 | `01-migration` → `03-decisions` → `rules/` |
| 상태 관리 System 참고자 | `rules/state-machine-delegation.md` → `tiers/system.md` → `tiers/component.md` (State enum) |
| tier 하나만 이해하려는 사람 | `tiers/<해당>.md` 단독 |
| ECS / 분류학 배경 | `mental-models` (배경별 진입 경로 안내) |

## 구성

### 최상위 문서

| 파일 | 역할 | 핵심 |
|------|------|------|
| [mental-models.md](./mental-models.md) | **읽기 지도** | 3 taxonomy 모델 (ECS/doc-type/교차 단위) + 관점(질의 조합) 정의 |
| [00-design.md](./00-design.md) | 개요 허브 | 목적, 4가지 원칙, 좌표 공식, 재해석 예시, 미결 사항 |
| [01-migration.md](./01-migration.md) | 마이그레이션 가이드 | Phase 0~5 단계 + Phase 1.A/1.B 의존 순서 |
| [02-tracking-roadmap.md](./02-tracking-roadmap.md) | **추적 로드맵** | 이중 평면(Intent/Execution) 거버넌스 + 자동화 5단계 계획 |
| [03-decisions.md](./03-decisions.md) | Phase 0 결정 | D-1~D-19 + R-1~R-7 + Exit Criteria + Sanity Check |

### Tier별 정의 (시스템 단위 분할)

| 파일 | Tier | 핵심 |
|------|------|------|
| [tiers/README.md](./tiers/README.md) | — | **4 tier** 요약 + 관계도 |
| [tiers/component.md](./tiers/component.md) | Component | 데이터 shape, 공유 계약, State enum 역할 (D-17) |
| [tiers/entry.md](./tiers/entry.md) | Entry | 구체화 인스턴스 (R-2 재평가 대상) |
| [tiers/system.md](./tiers/system.md) | System | Operations + R-7 3-check + lifecycle_ref (meta-semantic 참조) |
| [tiers/layout.md](./tiers/layout.md) | Layout | 조직적 배치 + 재귀 + inline 금지 |

### 규칙

| 파일 | 역할 |
|------|------|
| [rules/classification.md](./rules/classification.md) | level → tier 전환 우선순위 5단계 |
| [rules/system-independence.md](./rules/system-independence.md) | System 독립성 + meta-semantic 위임 + Inline 정의 금지 |
| [rules/state-machine-delegation.md](./rules/state-machine-delegation.md) | 상태 관리 규칙 (D-17) — State Component + meta-semantic 참조 |

### 통합 및 거버넌스 (2026-04-19)

[integration/](./integration/) — 기존 시스템 연계 + Taxonomy 통합 명세

| 파일 | 주제 | 핵심 결론 |
|------|------|---------|
| [integration/system-linkage-map.md](./integration/system-linkage-map.md) | 4 시스템 연계 맵 | **7 연결 Gap** 식별 (P0 3건 Phase 1.B 선행 필수) + 설계 원칙 5건 |
| [integration/taxonomy-catalog.spec.md](./integration/taxonomy-catalog.spec.md) | **Taxonomy Catalog** | **L0~L3 지식 위계** + 14개 축 명세 + 오원적 분석 매트릭스 + 계획/현재/현실 거버넌스 |
| [integration/scope-and-legacy.md](./integration/scope-and-legacy.md) | 제안 범위·목적 | **D-19 통합**: design/knowledge 텍소노미 분리 + 11축 정합 |

### Pilot 예시

[examples/](./examples/) — STC 패턴을 실제 문서로 적용한 초안 (Phase 3 Pilot 전 schema 실효성 사전 점검)

| 파일 | Tier | 모드 / Sub-type | 핵심 |
|------|------|----------------|------|
| [examples/deterministic-label-record.md](./examples/deterministic-label-record.md) | Component | **data-shape** (D-18) | Record field shape + 다른 Component 참조 패턴 |
| [examples/deterministic-label-record-state.md](./examples/deterministic-label-record-state.md) | Component | state-enum (D-18) | **Read-only** 도메인 상태 (7 states) |
| [examples/deterministic-label-system.md](./examples/deterministic-label-system.md) | System | read-only-projection | `pipe_refs=[]` + R-7 3-check 3/3 |
| [examples/approval-request-state.md](./examples/approval-request-state.md) | Component | state-enum (D-18) | **Write-mode** 도메인 상태 (4 states) — 가상 Pilot |
| [examples/approval-system.md](./examples/approval-system.md) | System | **write-mode** | `pipe_refs=[3]` + meta-semantic 위임 + compensate — 가상 Pilot |
| [examples/docs-control-plane-layout.md](./examples/docs-control-plane-layout.md) | Layout | — | 5 Systems refs + heading mirror 패턴 |

---

## 현재 상태

- **Phase**: under-review (Phase 0 완료, Pilot 6종, **Phase 1.A 조사 4건 완료**)
- **완료**: STC 4-tier 설계(D-17 Pivot + D-18 Component sub-type), 마이그레이션 가이드, Phase 0 결정 메모(D-1~D-18 / R-1~R-7), subagent review 1~6차 피드백 반영, Pilot 6종(Component 3 + System 2 + Layout 1), Phase 1.A 선행 조사 4건(depth / layout-contains / meta-operational / classifier-ruleset)
- **다음 액션**: Phase 1.A 결론을 03-decisions.md에 승격 반영 → Phase 1.B 도구 구현 PRD 착수 또는 accepted 전환
- **차단 요소**: 없음
- **Phase 1.A 주요 결론**:
  - depth 필드 **유지 확정** (D-6: 4값 enum, 1,056 전수 사용)
  - Layout 전환 규모: **117건 위반 정정 + 9 group 정규화**
  - D-2 확장: 116 경계 문서 **exempt by design** 선언 권고
  - 자동 분류 커버리지 예상 **~85%** (CON-004 80% 초과)
- **Defer 항목** (Phase 1.B 결정 대상): `lifecycle_ref` hybrid write-mode 필드, `references:` Component↔Component 필드, def validate isolation 룰, evidence-shape/data-facet-role Pilot 추가 시점

## 승격 기준 (draft → under-review → accepted)

### draft → under-review

본 제안은 아래 조건을 모두 만족 — **under-review 승격 완료 (2026-04-18)**.

- [x] 설계 문서 완결 (목적 / 4 원칙 / 좌표 / 전환 기준 / 독립성 규칙)
- [x] 마이그레이션 가이드 완결 (Phase 0~5 + Phase 1.A/1.B 의존 순서)
- [x] Phase 0 결정 메모 (D-1~D-18 + R-1~R-7 + Exit Criteria)
- [x] Tier별 독립 문서 분할 (시스템 단위 가독성)
- [x] 규칙 독립 문서 (classification + system-independence + state-machine-delegation)
- [x] Pilot 예시 6종 (Component 3 + System 2 + Layout 1) + D-17/D-18 Pivot 반영 완료
- [x] **D-17 Pivot 완료** — FSM tier 제거 + meta-semantic 위임 (4 tier)
- [x] **D-18 Pivot 완료** — Component 데이터 진입점 재정의 + 6 sub-type taxonomy
- [x] 리뷰어 지정 + 피드백 수집 — subagent 1~6차 독립 review
- [x] 리뷰 질문 응답 완료 — blocker 전부 해소, polish 반영, defer 항목 명시

### 리뷰 체크리스트 (리뷰어용, D-17 반영)

리뷰어는 아래 항목을 순서대로 확인하고 각 항목에 **OK / 의견 / 차단** 표기:

#### 개념 일관성
- [ ] **4 tiers** (Component/Entry/System/Layout) 정의가 서로 간섭 없이 설명력을 가지는가 ([tiers/](./tiers/))
- [ ] 4가지 핵심 원칙 (§1.1~1.4)이 서로 호환되는가 ([00-design.md](./00-design.md))
- [ ] **D-17 Pivot**의 근거가 타당한가 — meta-semantic 위임이 이중 소유 해소에 실질 효과를 내는가 ([03-decisions.md § D-17](./03-decisions.md))
- [ ] `lifecycle_ref` schema가 실무에 적용 가능한가 ([rules/state-machine-delegation.md](./rules/state-machine-delegation.md))

#### Pilot 예시 검증
- [ ] [System 예시](./examples/deterministic-label-system.md)의 R-7 3-check 3/3 평가 + `lifecycle_ref` 구조가 타당한가
- [ ] [Layout 예시](./examples/docs-control-plane-layout.md)의 5 System refs 구조가 실제 구조 반영하는가
- [ ] Read-only 2 Pilot만으로 D-17 검증이 충분한가 — write-mode controller 부재 영향 판단

#### 마이그레이션 타당성
- [ ] [01-migration.md](./01-migration.md) Phase 1.A 조사 항목 3개(depth / Layout-like contains / operational)가 실현 가능한가
- [ ] Phase 1.B critical path (zod + refs + lifecycle_ref 검증 + classify + validate + sync)가 실제 도구 개발 흐름과 맞는가
- [ ] [03-decisions.md § Exit Criteria](./03-decisions.md)의 rollback 조건이 충분한가

#### 결정 가역성 / 부작용
- [ ] low reversibility 결정(D-1 / D-4 / **D-17**)이 실제로 되돌리기 힘든 것이 맞는가
- [ ] R-2 (Entry tier 약점), R-7 (System 외연)의 Pilot 검증 전 사용 신중 권고가 충분한가

#### Pivot으로 인한 새 긴장 (4차 리뷰 identified)
- [ ] **Component tier 과부하** — State enum 하위 역할이 Component tier 설명력을 해치지 않는가
- [ ] **meta-semantic learning cliff** — Pivot 후 학습 부담이 FSM tier 단독 이해보다 오히려 큰가
- [ ] **Write-mode Pilot 부재** — 가상 write-mode System Pilot 추가 필요성
- [ ] **D-16 4층 정합 소멸** — `transitionId` 공유 키 구조 손실에 대한 의식적 수용

### under-review → accepted

- [ ] 리뷰어 승인 획득
- [ ] 리뷰 중 식별된 **blocker** 전부 해소
- [ ] Phase 0 open 항목 중 **P1 조사** 시작 가능 여부 확인 (depth 사용처 / Layout-like contains / operational 정책)
- [ ] Phase 1 구현 범위 PRD 초안 작성 또는 **실행 GO 신호**

### accepted 이후

- 본 제안 자체는 유지 (역사 기록)
- 별도 PRD가 Phase 1 구현 담당
- 정규 spec 생성 시 본 제안의 각 파일에 `superseded_by:` 추가

### Frontmatter 필드 규칙 (참고)

본 proposal 문서들은 `def:` frontmatter를 사용하지 않되 **간단한 메타데이터**를 쓴다. 혼동 방지를 위해:

| 필드 | 위치 | 의미 |
|------|------|------|
| `tier` | 예시 문서 (`examples/**.md`), 기타 STC 적용 예시 | "이 문서가 속한 STC tier". 예: `tier: fsm` |
| `tier-name` | tier 정의 문서 (`tiers/**.md`) | "이 문서가 정의하는 tier의 이름". 예: `tier-name: fsm` |
| `role` | 모든 proposal 문서 | 본 proposal 내에서의 문서 역할. 예: `role: design`, `role: pilot-draft` |
| `part_of` | 모든 proposal 문서 | 소속 제안 이름. 모두 `tier-redesign` |

두 필드는 **의도적으로 다른 key**. Phase 1.B `def validate` 구현 시 별개 필드로 검증.

### 리뷰 요청 방법

현재 인프라 (격리 proposal 영역) 하에서의 리뷰 요청 절차:

1. 리뷰어가 본 제안을 독립적으로 읽음 (00-design → tiers/ → rules/ → examples/ → 03-decisions 순)
2. 위 "리뷰 체크리스트"를 fork하거나 주석 형태로 응답
3. 피드백을 GitHub issue 또는 내부 토의로 수렴
4. 응답 수집 후 본 README의 Status를 `under-review`로 변경, Reviewer 필드에 이름 기입

## 정규 docs와의 관계

본 제안은 `docs/specs/` 정규 트리 바깥에 있으며 `def sync` 그래프에 포함되지 않는다.

- 정규 docs에서 본 제안을 참조할 때는 **prose 상대 경로 링크**만 사용
- 본 제안이 정규 docs를 참조할 때도 마찬가지
- 수락(accepted) 시 별도 PRD가 정규 spec 이식 담당

### 외부 연결 (현재)

- [`deterministic-label-stability.plan`](../../specs/definition-catalog/deterministic-label-stability.plan.md) — 본 제안의 Phase 3 완료를 선행 조건으로 대기 중 (보류 상태)

## 수락 후 예상 산출물

제안이 accepted되면 다음이 정규 spec으로 생성된다. **위치 결정은 별도 논의 필요** — `docs/specs/meta/`는 현재 존재하지 않는 새 scope. 대안으로 `docs/specs/definition-catalog/` 또는 `docs/specs/system/` 하위 배치 고려.

**잠정 후보 위치**:

- `docs/specs/<scope>/doc-tier-convention.spec.md` — tier 필드 스키마와 판단 기준
- `docs/specs/<scope>/doc-tier-fsm.spec.md` — FSM tier의 schema + heading mirror 패턴
- `docs/specs/<scope>/doc-tier-migration.spec.md` — 마이그레이션 단계 고정
- `docs/specs/<scope>/doc-tier-system-independence.spec.md` — 독립성 규칙
- 기존 `definition-catalog-spec` 등의 점진 전환 PRD

**`<scope>` 결정**: accepted 직후 선택. 옵션:
1. `definition-catalog/` — 기존 정의 체계와 같은 위치
2. `system/` — 시스템 전반 규칙
3. `meta/` — 문서 체계 자체에 관한 메타 규칙 (신설 scope — 별도 ADR 필요)

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-04-18 | 초기 제안 작성 (00~03) |
| 2026-04-18 | `docs/superpowers/specs/`에서 `docs/proposals/tier-redesign/`로 이관, def frontmatter 제거, prose 링크로 전환 |
| 2026-04-18 | 시스템 단위 구조화: `tiers/` 5개 + `rules/` 2개 + `examples/` 3종 분할, 00-design.md를 개요 허브로 축소 |
| 2026-04-18 | Pilot self-review: 02-fsm-composition.md 미결 사항에 Pilot 작성 중 발견된 schema 긴장점 5+3개 추가 |
| 2026-04-18 | README에 승격 기준 (draft → under-review → accepted) 명시 |
| 2026-04-18 | 용어 정정: FSM의 `Gate` → `Guard` (UML statechart 표준). PRD의 "Quality Gate" (CI/test artifact)와 혼동 방지. tiers/fsm.md + 02/03/FSM example에 일괄 반영 |
| 2026-04-18 | Pilot 관찰 6개 **Phase 0 결정 완료 (Pilot 실증 남음)**: D-10 (any-state transition) / D-11 (dry-run as System operation) / D-12 (evidence promote) / D-13 (Consumer 참고 표준) / D-14 (code-doc 명명 정책) 추가, FSM 예시 + System 예시 적용. 실제 Pilot 실행 시 결정의 실효성 검증 필요. |
| 2026-04-18 | tiers/fsm.md에 Guards 상세 섹션 추가 (Guard vs Quality Gate checklist, Event-Guard 관계, 작성 가이드) |
| 2026-04-18 | README 승격 기준 + 리뷰 체크리스트 (개념 일관성 / Pilot 검증 / 마이그레이션 타당성 / 결정 가역성 / 미결 항목 5영역) + 리뷰 요청 방법 추가 |
| 2026-04-18 | Subagent review 1 완료 ([reviews/2026-04-18-review-01.md](./reviews/2026-04-18-review-01.md)) — verdict: `no-with-revisions` (blocker 2 + important 7 + minor 10) |
| 2026-04-18 | Review 반영 (blocker 2): R-2 Entry Option A 확정 + 정량 trigger 박제 (Phase 2 < 3건 / Phase 3 사용 0건 / Phase 4 < 5건 발동 시 Option B 자동 전환), "Pilot 관찰 해소 완료" → "Phase 0 결정 완료 (Pilot 실증 남음)" 표기 |
| 2026-04-18 | Review 반영 (important 7): Exit Criteria 정성 기준 정량화 + 50~79% 구간 처리 룰 + baseline 정의, DKG CON-004 근거 보강, Phase 4 4A/4B 분할, R-7 counter-test + self-reference 회피, Operational positive list + scope creep trigger, 직교성 정밀화 |
| 2026-04-18 | Review 반영 (minor 10): `^gate:` → `^guard:` 01-migration.md 잔존분, FSM `implementation_refs` + BLOCKED SSOT 예외 주석, Layout 가설 System 주석, D-15 `-system` 접미사 권장 convention 추가, D-10 validation rules 명시, tier-name vs tier 필드 구별 README에 명시, 정규 spec 위치 옵션 3개 제시, STC 명명 근거 보강, FSM M:N System implements 허용 명시, Phase 0 산출물 파일명 정합, CLI tsup 번들 제약 언급 |
| 2026-04-18 | `mental-models.md` 신규 (읽기 지도) — 4 taxonomy 모델 (ECS=tier / FSM 내부 sub / doc-type / 교차 단위) + 관점(taxonomy 질의 조합) 공식화. qa-sdk 컨벤션(모든 분류를 taxonomy로) 준수. 00-design + 03-decisions R-1에 cross-ref 추가 |
| 2026-04-18 | 2차 subagent review 완료 (data facet + pipe + simulation 체계와의 비교) — `reviews/2026-04-18-facet-flow-simulation-review.md`. STC ⊥ meta-semantic 대부분 직교, 가장 깊은 긴장은 FSM Transition ↔ PipeTransitionScope 용어 충돌 |
| 2026-04-18 | **D-16 추가**: FSM Transition ↔ PipeTransitionScope **Hybrid absorb**. Form 1 (inline) 또는 Form 2 (`scope_ref`) 선택. 4층 정합(좌표/흐름/이벤트/FSM) 공유 키 `transitionId`. meta-semantic 측 변경 없음. tiers/fsm.md + 02/03 + rules/system-independence.md + pilot FSM + mental-models.md 전원 반영 |
| 2026-04-18 | 3차 subagent review 완료 (`reviews/2026-04-18-review-03-final.md`) — verdict: `yes-with-minor-polish`. D-17 Pivot으로 초과 대응됨 |
| 2026-04-18 | **D-17 Pivot 대대적 재조립**: FSM tier **완전 제거** (STC = 4 tier로 축소). 이유: meta-semantic(594 tests)과의 역할 이중 소유 해소. State enum은 Component tier로, Lifecycle은 meta-semantic(`PipeTransitionScope`/`Data IR.lifecycle`) 참조. 영향 18 파일 (신규 `rules/state-machine-delegation.md` + 10 파일 갱신 + 3 파일 삭제 + 4 검증/README 갱신). D-5/D-7/D-9/D-10/D-12/D-13/D-14/D-16 superseded. R-3/R-5 superseded. 3차 리뷰도 `superseded-by-d17`로 마킹 |
| 2026-04-18 | 4차 subagent review (`reviews/2026-04-18-review-04-pivot.md`) — verdict: `no-blockers-remain`. 5 Blocker 반영 완료 (dead links / FSM implements 모순 / checklist 완료 마킹 / meta-semantic 경로 / README 체크리스트). 3 새 긴장점 식별 |
| 2026-04-18 | **D-18 추가**: Component tier를 **데이터 진입점**으로 재정의 + **6 sub-type taxonomy** (data-shape / state-enum / evidence-shape / data-facet-role / validation-rule / constant-literal). 긴장 1 (Component 과부하) 근본 해소 + 긴장 2 (learning cliff) 완화. meta-semantic Data 개념(Data IR, 5 facet 역할)이 Component sub-type으로 매핑됨. 신규 Pilot: `deterministic-label-record-state.md` (state-enum sub-type). 영향: tiers/component.md 전면 재구성 + rules/classification.md + rules/state-machine-delegation.md + mental-models.md + 00-design.md + examples 3종 |
| 2026-04-18 | **Write-mode Pilot 추가** — 긴장 3 (Write-mode Pilot 부재) 부분 해소. 가상 `approval-system` + `approval-request-state` Pilot 쌍 신설. `pipe_refs: [3개]`로 non-empty 패턴 시연 + compensate 포함. 한계: 참조하는 `approval-pipe.spec.md`는 미작성 (Phase 1.B 또는 실제 write-mode controller 구현 시점 보강). Pilot 총 5종(Component 2 + System 2 + Layout 1)으로 Read-only ↔ Write-mode 스펙트럼 demonstrate |
| 2026-04-18 | 5차 subagent review (`reviews/2026-04-18-review-05-post-d18.md`) — verdict: `conditional-accept`. Blocker 0, Polish 4 식별: (1) `pipe_refs` 경로 형식 `:` vs `#` 3곳 불일치 (2) `implements_type` 비공식 필드 도입 (3) Pilot sub-type 편향(state-enum만 실증) (4) 가상 depends_on 한계 배너 보강 필요 |
| 2026-04-18 | **Polish 4건 반영**: (1) `pipe_refs` `#` 통일 — 03-decisions/rules/system-independence/state-machine-delegation/examples 전수 (2) `implements_type` 필드 제거 (approval-system.md) — `read_only_projection: boolean`으로 단순화 (3) **data-shape Pilot 추가** ([`deterministic-label-record.md`](./examples/deterministic-label-record.md)) — state-enum 외 sub-type 1종 실증, Pilot 6종으로 확장 (4) 가상 depends_on 배너 보강 — approval-system/pipe/depends_on 3종류 virtual 모두 명시 + "def validate 실행 불가" 사유 기재 |
| 2026-04-18 | 6차 subagent verification review — verdict: `promote-ready`. Polish 3건 추가 식별(under-review 내 처리 가능): (P1) `approval-system.md:181` 문구 자기모순 (P2) `pipe_ref` 단수 vs `pipe_refs` 복수 혼용 (P3) examples/가 def sync 제외됨을 명시. Defer 4건 Phase 1.B로 분류 |
| 2026-04-18 | **Polish 3건 추가 반영** (under-review 승격 직전): (P1) approval-system.md:181 문구 재조정 — "D-17 원칙상 분리되어야 하나 가상 참조만 선언" 명확화 (P2) `pipe_ref` → `pipe_refs` 복수 통일 (4곳) (P3) examples/README.md에 def sync/validate 스캔 제외 규칙 명시 (상위 proposals README 상속) |
| 2026-04-18 | **Status: `draft` → `under-review` 승격**. 승격 기준 전 항목 만족, subagent review 1~6차 피드백 루프 완료, 블록커 0건. 다음 액션: 리뷰어 승인 + Phase 1.A 조사 GO 신호 → accepted 전환 |
| 2026-04-18 | **Phase 1.A 조사 4건 완료** ([phase-1a/](./phase-1a/)) — (1) `depth` 필드 유지 확정 (4값 enum, 1,056 전수 사용) (2) contains 995 중 117 System-contains-System 위반 + 9 group이 Layout 전환 후보 (3) 116 경계 문서 **D-2-Extended "exempt by design"** 선언 권고 (4) 자동 분류 6-step 의사결정 트리 + confidence 할당 + CON-004 80% 초과 커버리지 예상 (85%). Phase 1.B `def tier classify` 구현 사양 완결 |
| 2026-04-18 | **ECS 적응 정렬 (경량 Option 1)** — (1) `tiers/component.md`의 OOP "class/instance" 비유 제거 → Entity는 Component를 **aggregates**하는 ID로 재서술 (2) `tiers/entry.md` 재정의 — "projection/instance" 표현 제거, "고유 ID + Component 참조 집합" ECS 본의 기반 (3) `mental-models.md`에 **"ECS 정석 vs STC 적응" 비교 표** 추가 — 변형 4건 공식 박제 (Entity 문서화 축소 / Component sub-type / System state 외부 위임 / Layout 확장) (4) "ECS 원칙 기반" → "ECS 적응 기반" 표현 통일 (README + 00-design) (5) `tiers/layout.md` 시작부에 "ECS 외 확장 축" 배너 명시 |
| 2026-04-19 | **기존 시스템 연계 조사 4건 완료** ([integration/system-linkage-map.md](./integration/system-linkage-map.md)) — 독립 에이전트 병렬 조사: (1) Taxonomy (12축, 직교성 5건 확정) (2) Doc-Structure (3) Test (4) Rule. 문서 관리 체계 5 설계 원칙 수립 |
| 2026-04-19 | **Taxonomy Catalog 통합 명세 수립** ([taxonomy-catalog.spec.md](./integration/taxonomy-catalog.spec.md)) — L0~L3 지식 위계 공식화, D-19 이분법적 거버넌스(Design/Knowledge), 오원적 분석 매트릭스(Intent/Impl/Lineage/Verification/Impact), 계획/현재/현실(Plan/Current/Reality) 관리 평면 확립 |
| 2026-04-19 | **이중 평면 추적 로드맵 수립** ([02-tracking-roadmap.md](./02-tracking-roadmap.md)) — 설계 의도와 구현 사실의 괴리(Drift) 자동 감지 및 지능형 정제(Refining)를 위한 5단계 실행 계획 수립 |
| 2026-04-19 | **제안 범위·목적 재정의** ([integration/scope-and-legacy.md](./integration/scope-and-legacy.md)) — 주 목적: `level` → `tier` 교체(모호성 해소). 부차: Layout `refs` 신설 + LinkType↔DKG 정합 규칙(중복 5건 해소). 공존 11축(scope/aspect/layer/depth/doc-type-ext/knowledge_kind/lifecycle/axis/prefix/DKG 노드/meta-semantic) 불변 명시. 레거시 판정 매트릭스: `level` 필드 / System-contains-System 117건 / Layout-like group 9건 / FSM(완료) / 동명 LinkType-DKG edge 5쌍(LinkType을 SSOT로 projection). Non-Goals 11건 재확인 |
