---
def:
  id: tier-redesign-reviews-2026-04-18-review-04-pivot
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
status: review
date: 2026-04-19
part_of: tier-redesign
role: proposal
supersedes: -
superseded_by: -
sources:
  - docs/proposals/tier-redesign/README.md
  - docs/proposals/tier-redesign/00-design.md
  - docs/proposals/tier-redesign/03-decisions.md
  - docs/proposals/tier-redesign/mental-models.md
  - docs/proposals/tier-redesign/rules/classification.md
  - docs/proposals/tier-redesign/rules/state-machine-delegation.md
  - docs/proposals/tier-redesign/rules/system-independence.md
  - docs/proposals/tier-redesign/tiers/component.md
  - docs/proposals/tier-redesign/tiers/entry.md
  - docs/proposals/tier-redesign/tiers/system.md
  - docs/proposals/tier-redesign/tiers/layout.md
  - docs/proposals/tier-redesign/examples/deterministic-label-system.md
  - docs/proposals/tier-redesign/examples/approval-system.md
  - docs/specs/definition-catalog/deterministic-label-stability-boundary.memo.md
  - packages/deterministic-label-registry/src/index.ts
---

# STC Proposal — 4차 리뷰 (D-17 Pivot 검증)

## 목적 ^purpose

이 문서는 STC Proposal — 4차 리뷰 (D-17 Pivot 검증)에 대한 제안·검토 기록을 보존하고, 관련 설계 판단과 후속 작업의 근거를 제공한다.

> **현재 상태 메모**: 이 문서는 D-17 Pivot 적용 중 발견된 blocker를 남긴 historical review다.
> 이후 `tiers/`, `rules/`, `examples/`, `mental-models` 문서가 FSM tier 제거와 current
> deterministic-label stateless projection 경계에 맞춰 정리되었다. 본문 아래의 파일/라인 지적은 당시
> 상태의 감사 기록이며, 현재 상태 판단은 위 `sources`의 현행 문서와 source-backed 예제를 기준으로 한다.

## 요약 (Executive Summary)

D-17 Pivot은 **개념적으로는 성공**했다. FSM tier 제거 + meta-semantic 위임이라는 근본 방향은 이중 소유 해소와 ECS 원본 충실이라는 관점에서 더 깔끔하다. 새 규칙 문서(`state-machine-delegation.md`)는 read-only / write-mode 분기와 `lifecycle_ref` 필드 schema를 명료히 제시해 Pivot의 골격이 잘 서 있음을 보여준다. 그러나 **실행 완결성은 부족하다** — 삭제된 `tiers/fsm.md`, `02-fsm-composition.md`, `examples/deterministic-label-record-fsm.md`로의 깨진 링크가 최소 7건(component.md, entry.md, README.md, examples/deterministic-label-system.md), "FSM tier 제거" 주장과 모순되는 잔존 서술이 최소 8건(`system.md`의 `implements — FSM 계약 구현`, `system-independence.md` 제목 "System 독립성 + FSM implements", `classification.md` level→tier 매핑에 `fsm`, `mental-models.md`의 Perspective 섹션 전체가 FSM 예시로 구성됨, `00-design.md §1.2`, `README.md` 구조 절반). Pivot의 근거 문서(`03-decisions.md` §영향받는 문서 리스트)조차 18개 항목 중 **8개를 `[ ]` 미완료로 명시**하는데, 이는 저자가 인지한 상태에서 리뷰에 올렸다는 의미. D-17 자체의 가치는 인정하되, 리뷰어 제정 + under-review 승격 전에 **blocker 4~5건의 실질 해소가 필요**하다. 또한 Pivot이 **새 긴장 3건**을 만들었다: ①write-mode controller 없이 read-only pilot만으로 D-17 검증 불가, ②meta-semantic 학습 부담이 FSM tier 단독 이해보다 오히려 큼, ③D-16이 주장하던 `transitionId` 공유 키 4층 정합 구조가 소멸하면서 "정합 검증 메커니즘"이 약해졌다. **Verdict: `no-blockers-remain`** — D-17은 유지 권장하나 Pivot 실행이 끝나지 않음. Blocker 해소 후 `under-review` 승격 가능.

## Verdict

- **Ready for under-review**: `no-blockers-remain`
- **D-17 평가**: `partial` (개념 성공 / 실행 미완)
- 핵심 근거:
  1. `03-decisions.md:456~463`이 D-17 반영 작업 중 **8/18 항목 `[ ]` 미완료**로 자인. 특히 `tiers/fsm.md 삭제` / `02-fsm-composition.md 삭제` / `examples/deterministic-label-record-fsm.md 삭제`는 실제 파일은 삭제됐으나(Bash 확인: no such file), checklist 자체가 업데이트 누락 — 자체 일관성 검사 실패.
  2. **삭제된 파일로의 깨진 링크** 최소 7건: `component.md:57, :97`, `entry.md:52`, `README.md:92, :96, :110, :166`, `examples/deterministic-label-system.md:102, :169`. 이들은 `def validate`가 도입되기 전이지만 prose로 읽히는 직선적 불일치.
  3. **"FSM tier 제거"와 모순되는 잔존 진술**: `system.md:17`(`implements — FSM 계약 구현`), `system.md:25`(`명시적 인터페이스(API, 이벤트, FSM)`), `system.md:93`(`우선순위 3 (FSM 다음)`), `system.md:97`(`FSM implements + R-7 3-check 충족 검증`), `system-independence.md:8`(제목에 `FSM implements`), `system-independence.md:19`(`implements — FSM 계약 구현`), `system-independence.md:112`(`implements: some-fsm` 예시), `00-design.md:48`(§1.2 `implements`만 허용), `classification.md:52`(level→tier 매핑에 `fsm`), `mental-models.md:166~188`(Perspective 섹션 전체가 FSM 예시).
  4. Pivot이 만든 새 긴장(Target 3에서 상술)이 **의미 있는 재설계 비용**을 내포 — `lifecycle_ref` schema가 Phase 1.B에 frozen 예정이지만 Pilot이 모두 read-only라 write-mode 검증 공백.

## Target 1: D-17 완결성

### 1.1 FSM 참조 제거

#### 적절한 역사적 언급 (OK)

- `README.md:9`, `03-decisions.md:24` 등 D-17 Pivot 설명 자체의 "FSM tier 제거" 언급은 타당 — 역사적 맥락 제공
- `tiers/layout.md:46` "Pivot 전 (5 tier)" 주석 — 명시적 역사 표기
- `tiers/README.md:12` Pivot 후 구조 언급 — 타당
- `03-decisions.md:401~438` Superseded Decisions/Reviews 섹션 — 적절한 역사 기록
- `mental-models.md:18` Pivot 후 구조 언급 — 타당

#### 부적절한 잔존 (regress) — 파일별

**`tiers/system.md` 중대 regress 4건**:
- `:17` "`implements` — FSM 계약 구현": LinkType 설명이 여전히 FSM을 목적어로 지목. D-17로 System↔FSM implements 관계는 소멸했으므로 `implements`의 의미 재정의 또는 제거 필요.
- `:25` "명시적 인터페이스(API, 이벤트, FSM)": 정의 문장에 `FSM`이 계약 대상으로 등장. Pivot 후에는 `API, 이벤트, 또는 상태 있다면 lifecycle_ref 참조`가 맞음.
- `:93` "우선순위 3 (FSM 다음)": `classification.md`에서 우선순위 2가 FSM이었으나 Pivot으로 FSM 우선순위 제거됨. 따라서 System은 우선순위 2로 당겨졌음. "FSM 다음" 표현이 비일관.
- `:97` "— FSM implements + R-7 3-check 충족 검증": Pilot 예시 설명에 FSM implements가 남아 있음. 실제 pilot 내용은 lifecycle_ref로 바뀐 상태.

**`rules/system-independence.md` 중대 regress 5건**:
- `:8` 문서 제목 "# System 독립성 + FSM implements + Inline 정의 금지": D-17 Pivot이라면 "FSM implements"가 제목에 남으면 안 됨.
- `:19` "`implements` — FSM 계약 구현": LinkType 목록 서술 (system.md:17과 같은 문제)
- `:112` 예시 `implements: some-fsm`: inline 정의 금지 예시의 "틀린 구조" 쪽이지만, FSM이 주어 아닌 목적어로 남아 있어 FSM tier 존재를 암묵적 가정.
- `:122` "새 System / Component / FSM의 operations / lifecycle / schema": 서술에 `FSM` 여전히 포함. D-17로는 "System / Component / State enum"이 맞음.
- `:143` "> **D-17 Pivot**: 기존 ... 관계가 모두 제거됨"은 타당하지만, 같은 문서 위쪽 규칙 1 (line 19, 규칙 3 line 122)에서 FSM을 여전히 언급 — 자체 모순.

**`tiers/component.md` 중대 regress 3건**:
- `:57` "상태 전이 규칙 → [FSM tier](./fsm.md)": 삭제된 파일로 링크 + FSM tier 언급. 이 줄은 **가장 규모 큰 regress** — 상태 전이 규칙 포함 금지 대상이 "FSM tier"로 명시되어 있고 링크가 404.
- `:97` "현재는 [FSM 예시](../examples/deterministic-label-record-fsm.md)": 삭제된 파일로 링크. Component tier 예시로 FSM 예시 evidence_shapes를 참고하라는 말이지만 파일 자체가 없음.

**`tiers/entry.md` regress 1건**:
- `:52` "인스턴스 생명주기 전이 → [FSM](./fsm.md)": 삭제된 파일로 링크 + FSM tier 언급.

**`rules/classification.md` regress 1건**:
- `:52` "| `leaf` | `component` / `entry` / `fsm` 중 하나 |": level→tier 매핑 표에 `fsm`이 여전히 tier 후보로 등장. D-17로 4 tier이므로 `fsm`이 있으면 안 됨.

**`00-design.md` regress 1건**:
- `:48` §1.2 System 독립성 핵심 원칙 "System 간 관계는 `depends_on` / `refines` / `implements`만 허용": D-17에서 `implements`는 FSM 계약 구현용이었으나 FSM tier가 없어졌으므로 **`implements`의 의미 재정의**가 필요. 재정의 전에는 이 줄이 모호 상태.

**`mental-models.md` Perspective 섹션 전면 regress**:
- `:166~188` 전체 Perspective 예시가 `tier = fsm` 기반: "FSM Contracts", "Unfinished FSM work", "Pilot 검증 대상" 예시 모두 FSM 전제. D-17로는 이 예시들이 전면 재작성되어야 함. 저자가 §18에서 "Model 2 (FSM 내부) 제거"라고 표기했으나 본문의 Perspective 예시는 갱신 누락.
- `:196` bash 예시도 `--tier fsm` 사용
- `:207` "Producer 질의: '내가 구현할 FSM 계약' → `tier=fsm AND doc-type=.spec`"

**`examples/deterministic-label-system.md` regress 3건 (실제 Pilot 문서)**:
- `:102` "Invariants: 결정론적 ... `deterministic-label-record-fsm` § `inv-read-only-projection` 준수": 삭제된 파일 참조.
- `:169` "FSM `inv-read-only-projection`": 같은 삭제된 참조.
- `:181` "'Trivial System 예외'가 아님 — FSM implements 정상 연결": FSM implements 관계 자체가 D-17로 소멸했으므로 "정상 연결"이라는 표현이 무효.

**`README.md` regress 7건**:
- `:80` "Pilot 예시 3종 (FSM / System / Layout)": 현재 2종 (FSM 삭제).
- `:81` "FSM의 Guard 개념 독립 섹션 + Quality Gate 구별 checklist": Guard 섹션 자체가 삭제된 `tiers/fsm.md`에 있었음.
- `:90~98` 리뷰 체크리스트가 5 tier 전제 + 삭제된 파일로 링크 + FSM 예시 대응 확인 항목: 전면 재작성 필요.
- `:110` `02-fsm-composition.md` 링크 (삭제된 파일).
- `:131~132` frontmatter 필드 규칙 예시에 `tier: fsm`, `tier-name: fsm` (이미 무효한 값).
- `:166` "doc-tier-fsm.spec.md — FSM tier의 schema": 삭제된 tier의 후속 산출물이 여전히 예상.

**`01-migration.md` regress 1건**:
- `:98` "우선순위 6단계 룰을 실행 가능한 분류기로 정의": `classification.md`는 현재 **5단계** (D-17 Pivot이 우선순위 2 "FSM" 제거). "6단계"는 구 표기.
- (기타 `01-migration.md`는 대부분 D-17 반영됨 — `:66`, `:72` 등)

**종합**: 저자의 `03-decisions.md:456~463` 영향받는 문서 리스트 중 `[x]`로 표시된 항목조차도 실제로는 부분 반영 상태. 예: `tiers/system.md` 는 `[x]`이지만 위 4건 regress 있음; `rules/system-independence.md`는 `[x]`이지만 5건 regress 있음. **자체 완료 선언과 실제 상태의 gap**이 D-17 실행의 **가장 큰 약점**.

### 1.2 lifecycle_ref 일관성

**대조 대상 4곳**:
1. `tiers/system.md:61~77` § 상태 관리 (D-17 Pivot)
2. `rules/state-machine-delegation.md:46~69` § 규칙 3
3. `rules/system-independence.md:46~89` § 규칙 2
4. `examples/deterministic-label-system.md:16~19` frontmatter

**공통 필드 합의**:

| 필드 | system.md | state-machine-delegation.md | system-independence.md | pilot |
|------|-----------|----------------------------|------------------------|-------|
| `state_component` | ✓ | ✓ | ✓ | ✓ |
| `pipe_refs` | ✓ | ✓ | ✓ | ✓ (`[]`) |
| `read_only_projection` | ✓ | ✓ | ✓ | ✓ (`true`) |
| `notes` | — | ✓ (optional) | — | — |

**평가**: 공통 필드 4개는 **정합**. `notes`는 optional이라 미반영 OK.

**불일치 1건 발견** — `pipe_refs` 값 형식:
- `state-machine-delegation.md:60` 예시: `meta-semantic/pipe-impl/<pipe-doc>:<transitionId>` (형식: `<pipe 문서 경로>:<transitionId>`)
- `system.md:67` 예시: `[<meta-semantic pipe path>]` (transitionId 언급 없음)
- `system-independence.md:79` 예시: `meta-semantic/pipe-impl/approval-transitions:approve-dispatch` (형식 일치)

**세부 긴장**: `system.md:67`의 표현은 "pipe path"라고만 표기해 `transitionId`가 필수인지 모호. Frozen schema가 어떻게 될지 Pilot 전에 결정 필요.

**더 심각한 불일치** — meta-semantic 참조 경로의 실제 존재 검증:
- `state-machine-delegation.md:39` "`docs/specs/meta-semantic/concepts/ms-concept-data-facets.spec.md` § Data IR.lifecycle": **실제 파일에 `Data IR.lifecycle` 섹션 없음**. Grep 결과 해당 spec에서 `lifecycle` 단어는 frontmatter 뿐(`lifecycle: approved`). DataLifecycle은 실제로 `meta-semantic-ir/meta-semantic-ir-data.spec.md:79`에 존재. 참조가 잘못된 파일을 가리킴.

### 1.3 State enum Component 분리

**규칙 선언 위치**:
- `state-machine-delegation.md` 규칙 1 (:18~29): 명료
- `state-machine-delegation.md` 규칙 6 (:88~99): 금지 목록 (전이 / Guard / Invariant 제외) 명료
- `tiers/component.md:27`: "State enum — System의 `lifecycle_ref.state_component`가 참조 (D-17 Pivot)"
- `tiers/component.md:30~51` § "State enum Component 특수 역할": 예시 + 포함 금지 명료

**정합**: 규칙이 3곳에서 반복되며 의미가 일치. 특히 "포함 금지 (State enum Component 기준)" 리스트가 state-machine-delegation.md 규칙 6과 component.md §State enum 특수 역할에서 동일.

**OK**: State enum Component 분리는 D-17 실행의 **가장 성공적인 부분**.

**Minor 의문**: Component tier의 schema가 "state enum + description"만 허용하는지, 아니면 "불변 상수 리스트" 일반으로도 확장 가능한지 — `state-machine-delegation.md:31` "State enum Component는 불변 상수 리스트의 일종"이라는 표현이 있지만 Component tier 일반과 State Component의 경계가 명확하지 않음. 예: "DRAFT status + description + terminal/initial 표시"가 있는 State Component는 단순 상수 리스트가 아님.

### 1.4 Superseded 마킹

**03-decisions.md의 superseded 마킹 품질**:

- `:42~53` TL;DR 표: D-5/D-7/D-8/D-9/D-10/D-12/D-13/D-14/D-16 9개 모두 ~~취소선~~ + "superseded by D-17" 표기 — **명료**.
- `:60` 개념 리뷰 5개 목록: R-3/R-5가 superseded로 명시됨 — **OK**.
- `:401~438` Superseded Decisions 섹션: 9개 결정 각각 "superseded by D-17" + 대체 위치 기술 — **명료**.
- `:432~438` Superseded Reviews 섹션: R-3/R-5가 superseded로 기술 — **OK**.

**평가**: Superseded 마킹은 완결적. 역사 기록으로서 잘 보존됨.

**의문 1건 — 각 superseded decision이 **본문에서도 삭제되었는가**?
- D-5/D-7/D-8/D-10/D-12/D-13/D-14/D-16 본문은 **Superseded 섹션에만 남음** (현행 결정 섹션에서 제거됨). OK.
- D-9는 TL;DR에 ~~D-9~~ 표기되지만 본문에 별도 섹션 없음. "Component State SSOT로 계승"이라는 표기가 `state-machine-delegation.md:150`에 "(D-9 SSOT 원칙 계승)"으로 반영 — 계승 의도가 살아있음. 계승 방식은 정합적이나, superseded 상태를 분명히 표기하는 건 **부분 완료**.

## Target 2: Cross-file 정합성

### 2.1 tiers/system.md `lifecycle_ref` ↔ rules/state-machine-delegation.md

**`tiers/system.md:61~77`** 과 **`state-machine-delegation.md:46~69`** 비교:

| 항목 | system.md | state-machine-delegation.md | 일치 여부 |
|------|-----------|----------------------------|----------|
| 필드 3개(`state_component`, `pipe_refs`, `read_only_projection`) | ✓ | ✓ | 일치 |
| `state_component` 설명 | "State enum 위치" | "Component tier 참조" | 일치 |
| `pipe_refs` 형식 | `<meta-semantic pipe path>` | `meta-semantic/pipe-impl/<pipe-doc>:<transitionId>` | **불일치** (전자는 transitionId 생략) |
| Read-only 처리 | "pipe_refs: []로 비움" | "빈 배열 허용 또는 생략" | 부분 일치 |
| Write-mode 도입 | "pipe_refs 추가" | 규칙 5에 상세 | 일치 |

**결론**: transitionId 포함 여부 차이가 Pilot 전 frozen 안 됨 — schema 실제 정의 시점에 정합 필요.

### 2.2 rules/classification.md ↔ 00-design.md §4

**classification.md 5단계 우선순위**:
1. knowledge 면제
2. Operations + R-7 → system
3. 여러 system 배치 → layout
4. 데이터 shape → component
5. singleton → entry

**00-design.md §4 재해석 예시**:
- `ingest-system` → System (우선순위 2)
- `system-infra-layout` → Layout (우선순위 3)
- `system-root` → Layout (우선순위 3)
- `deterministic-label-record-state` → Component (우선순위 4)
- `docs-control-plane` → System (우선순위 2)
- `definition-catalog-spec` → 분할
- `CLAUDE.md` → tier 면제 (우선순위 1)

**정합**: 명확 사례 모두 classification.md의 우선순위에 올바르게 매핑. Entry tier 우선순위 5 예시가 §4에 없는 것이 눈에 띄지만 이는 R-2로 설명된 희소성과 일관.

### 2.3 mental-models.md 3 모델 ↔ tiers/ 실제 tier 수

**mental-models.md 선언 (line 30~44)**:
- Model 1 ECS taxonomy: `tier ∈ { component, entry, system, layout }` — **4값**
- Model 2 doc-type taxonomy
- Model 3 교차 단위 관점

**tiers/ 디렉토리 실제 파일 (4개, Bash 확인)**:
- component.md, entry.md, system.md, layout.md — **4개**

**정합**: Model 1 선언과 tiers/ 실제 파일 수가 4로 일치.

**단 Perspective 섹션 (line 166~188) 4개 예시 중 3개가 `tier=fsm`**. 이는 **자체 모순** — Model 1에서는 `tier ∈ { component, entry, system, layout }`인데 Perspective 예시에서 `tier=fsm` 사용 가능성을 전제. 존재하지 않는 값을 query하는 예시가 되어 버림.

### 2.4 examples/deterministic-label-system.md ↔ rules/state-machine-delegation.md

**Pilot frontmatter (`deterministic-label-system.md:16~19`)**:
```yaml
lifecycle_ref:
  state_component: deterministic-label-record-state
  pipe_refs: []
  read_only_projection: true
```

**state-machine-delegation.md 규칙 3 (`:50~69`)**:
```yaml
lifecycle_ref:
  state_component: <Component tier id>
  pipe_refs:
    - meta-semantic/pipe-impl/<pipe-doc>:<transitionId>
  read_only_projection: true/false
  notes: |
    설명
```

**정합**: Pilot은 read-only projection이므로 `pipe_refs: []`이고 `notes` 생략은 규칙 4(`:71~78`)의 "read-only projection만 수행하면 빈 배열 허용 또는 생략"에 부합. **정합 OK**.

### 2.5 03-decisions.md D-17 영향 리스트 ↔ 실제 반영 범위

**03-decisions.md:444~463 영향받는 문서**:

| # | 파일 | 선언 | 실제 상태 |
|---|------|------|----------|
| 1 | 00-design.md | [x] | **부분 반영** (§1.2 `implements` 미처리) |
| 2 | tiers/README.md | [x] | **반영** |
| 3 | tiers/component.md | [x] | **부분 반영** (line 57, 97 깨진 링크 + FSM 언급) |
| 4 | tiers/system.md | [x] | **부분 반영** (line 17, 25, 93, 97 regress) |
| 5 | tiers/layout.md | [x] | **반영** |
| 6 | rules/classification.md | [x] | **부분 반영** (line 52 매핑 표 regress) |
| 7 | rules/system-independence.md | [x] | **부분 반영** (line 8, 19, 112, 122 regress) |
| 8 | rules/state-machine-delegation.md | [x] | **반영** |
| 9 | mental-models.md | [x] | **부분 반영** (Perspective 섹션 전면 미갱신) |
| 10 | 03-decisions.md | [x] | **반영** |
| 11 | 01-migration.md | **[ ]** | **부분 반영** (line 98 "6단계"만 남음, 나머지 OK) |
| 12 | examples/deterministic-label-system.md | **[ ]** | **부분 반영** (line 102, 169, 181 regress) |
| 13 | examples/docs-control-plane-layout.md | **[ ]** | **반영** (line 30에 D-17 주석) |
| 14 | examples/README.md | **[ ]** | **반영** |
| 15 | tiers/fsm.md | **[ ]** | **삭제 완료** (Bash 확인) |
| 16 | 02-fsm-composition.md | **[ ]** | **삭제 완료** |
| 17 | examples/deterministic-label-record-fsm.md | **[ ]** | **삭제 완료** |
| 18 | README.md | **[ ]** | **부분 반영** (line 80, 81, 90~98, 110, 131~132, 166 regress) |

**종합**: **저자 선언 `[x]` 7개 중 4개가 부분 반영**; **`[ ]` 8개 중 3개만 미반영(그 중 2개는 삭제 완료했으나 checklist 업데이트 누락)**. `03-decisions.md`의 영향 리스트가 스스로의 진행 상태와 불일치 — Pivot 실행의 **메타 관리 실패**.

## Target 3: D-17이 만든 새 긴장점

이전 긴장(FSM / PipeTransitionScope 이중 소유, Guard vs Quality Gate 혼동)은 해소됨. 그러나 Pivot이 **새 긴장 6건** 만들었다.

### 3.1 Component tier 복잡화 (중간 우려)

**현상**: Component tier가 이제 다음 역할 혼합:
1. **데이터 shape** (타입/스키마 정의) — 원래 역할
2. **공유 계약** (여러 System 간 breaking change 관리) — 원래 역할
3. **불변 상수** (enum literals) — 원래 역할
4. **State enum** (D-17 신규 추가)
5. **Validation 규칙** (데이터 shape의 일부)

**긴장**: (1)+(2)+(3)은 "데이터"라는 일관된 개념이지만 (4) State enum은 "**상태 나열**"이라는 **다른 관심사**. 기존 DimRef / 좌표 카탈로그 / axis entries 같은 "불변 리스트"와 State enum은 **semantic 축이 다름**:
- 불변 상수 리스트: 도메인 값 공간 선언 (예: 축의 허용 값)
- State enum: 상태 머신의 **상태 공간** (생명주기 체계의 일부)

**`state-machine-delegation.md:31`**가 "State enum Component는 불변 상수 리스트의 일종"이라고 흡수했지만, 이는 **classification 은폐**에 가까움. State enum은 meta-semantic lifecycle과 쌍이 되는 객체이므로 "Component 특수 역할"을 명시적으로 **sub-type**으로 다루는 편이 명료할 수 있음.

**의견**: `state_component` 전용 frontmatter field type을 정의하거나, Component tier 내 sub-classification(`component_kind: data | state_enum | constant_list | ...`)을 도입하지 않으면 Phase 3에서 **Component tier 문서의 내부 다양성**에 대한 지침 혼선.

### 3.2 meta-semantic 학습 부담 (높은 우려)

**현상**: Pivot 전에는 FSM tier만 이해하면 "상태 있는 System 문서"를 쓸 수 있었음. Pivot 후에는:
1. STC 4 tier (Component / Entry / System / Layout) 이해
2. `lifecycle_ref` frontmatter schema 이해
3. Component tier의 State enum 역할 이해
4. **meta-semantic 체계 전체** 이해:
   - 9 원자 개념 (pipe, branch-path, transition-scope, boundary, folding, data-facets, event, contract-descent, verification-unit, spacetime-uid)
   - PipeFlow 30종
   - PipeTransitionScope ↔ TransitionDef 관계
   - Data IR / Pipe IR / Module IR

**긴장**: `README.md:18` "상태 관리 System 참고자 | `rules/state-machine-delegation.md` → `tiers/system.md` → `tiers/component.md` (State enum)"라는 읽기 순서는 **세 문서**로 제한하지만, 실제로 `lifecycle_ref.pipe_refs`에 값을 넣으려면 저자가 meta-semantic의 개별 spec을 읽어야 함. `state-machine-delegation.md:33~42`의 meta-semantic 참조 표에서 4 개념을 소개 — 저자는 각 개념의 위치 + 용도를 파악 후 작성해야 함. Read-only면 Pilot 작성은 가능하나 write-mode로 가면 **학습 곡선이 급증**.

**구체 시나리오**: Phase 3 Pilot에서 write-mode System 1건 작성 시도 시 저자는:
- PipeTransitionScope 문서 신규 작성 (`docs/specs/meta-semantic/pipe-impl/` 아래)
- 해당 `transitionId` 정의
- System의 `pipe_refs`에 참조 등록
- `def validate`에서 양측 정합 검증

이 과정이 기존 "단일 FSM tier 문서 1개 작성"보다 **훨씬 복잡**. 저자의 `03-decisions.md:219~221` Pilot 검증 가설 3번째("meta-semantic 학습 부담이 Consumer에 과도한가")이 이 우려를 인식한 것이지만, **write-mode Pilot 없이 검증 불가**.

**심각도**: High. Pivot의 핵심 검증 가설이 Pilot에서 검증 불가 상태.

### 3.3 Stateless System "생략했다" 검증의 모호

**현상**: `rules/system-independence.md:60` "**Trivial System 예외** — 상태가 없는 System은 `lifecycle_ref` 생략"
**긴장**: "생략했다는 걸 어떻게 확인하나?"

상태 없는 System은 `lifecycle_ref` 필드가 frontmatter에 아예 없음. `def validate`는:
- `lifecycle_ref` 있는 System → 필드 검증 (state_component 실존, pipe_refs 유효)
- `lifecycle_ref` 없는 System → **의도적 생략 vs 작성 누락** 구별 불가

예: 저자가 "상태 없는 System"이라 주장하며 `lifecycle_ref` 생략했지만, 실제로는 "상태 있는데 작성 안 함"인 경우. 검증 메커니즘이 없음.

**해결 후보**:
- Option A: `lifecycle_ref: null` 또는 `stateless: true` 명시 요구 (긍정적 선언)
- Option B: `def tier classify` 명령이 code ↔ doc 대조로 "enum이 있는데 lifecycle_ref가 없음" 경고 감지
- Option C: 현상 유지 + 저자 책임

`state-machine-delegation.md`와 `system-independence.md` 모두 Option A/B/C 중 무엇인지 미결정. Phase 1.B schema frozen 시 결정 필요.

**심각도**: Medium. Pilot 단계에서는 저자 책임으로 OK, 전체 전환 시 문제.

### 3.4 Write-mode controller 부재 → Pivot 검증 공백 (가장 심각)

**현상**: `examples/`의 2개 Pilot이 모두 read-only:
- `deterministic-label-system.md`: `pipe_refs: []`, `read_only_projection: true`
- `docs-control-plane-layout.md`: Layout tier (상태 관리 없음)

**긴장**: D-17의 핵심 전제 "System + meta-semantic 조합이 자연스럽다"는 write-mode 없이 검증 불가:
- Read-only projection은 `pipe_refs` 비어있어 **meta-semantic 실제 참조 경험 없음**
- `lifecycle_ref.pipe_refs` schema의 실용성은 최소 1개의 write-mode Pilot에서만 증명 가능
- `transitionId` 참조 형식, meta-semantic pipe 문서 작성 부담, 정합 검증 메커니즘 전부 **가설 상태**

**비교 — Pivot 전 상태**:
- `examples/deterministic-label-record-fsm.md`는 Pilot FSM으로 전체 상태/전이/Guard를 직접 기술
- 검증 가능한 surface가 있었음

**Pivot 후 상태**:
- FSM pilot 삭제
- 남은 것은 lifecycle_ref가 빈 배열인 read-only Pilot 1건
- **Pivot 이전보다 검증 공백이 더 큼**

**심각도**: Critical. D-17의 롤백 비용이 low reversibility이므로 Pilot 검증 전 승격은 위험. 저자의 `03-decisions.md:219~221`이 이를 Phase 3 검증 가설로 명시하지만, Phase 3 Pilot으로 **write-mode 1건을 추가**하지 않으면 검증 불가.

**권장**: Under-review 승격 전 또는 Phase 3 초기에 write-mode System Pilot 1건 추가. 후보:
- `ingest-session-state` (Verdict FSM 활용)
- `approval-system` 가설 (system-independence.md:76~81 예시)
- 새로 작성하지 않고 기존 meta-semantic pipe 중 1개를 참조하는 lightweight Pilot

### 3.5 State Component minimum schema 미확정

**현상**: `state-machine-delegation.md:88~99` 규칙 6이 state enum Component의 "담는 것/금지"를 선언하지만 구체 schema 미확정.

**명시된 것**:
- `states: [...]` 리스트
- 각 state의 description (1~2줄)
- terminal / initial 여부 (optional)

**불명확한 것**:
- `states`가 string[] 인가 `{ id, description, terminal? }[]`인가?
- terminal/initial을 frontmatter에 두나 본문에 두나?
- 상태 간 순서 정보는 포함 가능한가? (ordered linear state machine 표현)

**Component tier 예시** (`state-machine-delegation.md:104~128`) 는 자유 markdown으로 작성 — 정형화 전 상태.

**긴장**: Phase 1.B에서 schema frozen되는데, `03-decisions.md:383` "State Component minimum shape 확정"이 미결 항목. Pilot 작성 전 확정하지 않으면 Pilot 간 schema drift 발생.

**심각도**: Medium. Pilot 시작 전 결정 필요.

### 3.6 4층 정합 구조 소멸

**D-16 주장 (superseded)**: FSM Transition ↔ PipeTransitionScope 4층 정합 — 좌표(PathSegment) / 제어 흐름(PipeTransitionScope) / 이벤트(TransitionDef) / FSM — 공유 키 `transitionId`로 4층 연결.

**D-17 Pivot 후**: 
- FSM tier 제거 → 4층이 3층으로 축소 (meta-semantic 내부에 3층은 여전히 있음)
- STC 측은 `lifecycle_ref`로 **외부 참조만**
- STC 문서의 State Component ↔ meta-semantic 측 정합은 `def validate`의 런타임 검증에 의존

**긴장**: 명시적 4층 공유 키 대신, "State Component의 `states[]` + meta-semantic pipe의 `events[]` 간 암묵적 정합"으로 **정합 검증 메커니즘이 약해짐**:
- 이전: `transitionId`가 4층 공유 키 → 한 레이어 변경 시 다른 레이어가 자동 차단
- 현재: State Component와 meta-semantic pipe가 독립 편집 가능 → drift 위험

**저자 인식**: `state-machine-delegation.md:146~150` "def validate에서 지원할 검증"이 이 정합을 커버하지만, 검증 로직이 Phase 1.B에 구현 예정. Pilot에서는 수동 검증.

**심각도**: Medium-High. 4층 정합은 D-16에서 "meta-semantic과 STC를 함께 쓸 때 한쪽 변경이 다른 쪽에 반영됨을 보장"하는 구조였는데, Pivot으로 이 보장이 **도구 의존**으로 퇴행.

**긍정 해석**: Pivot은 "meta-semantic은 meta-semantic이고, STC는 STC"라는 역할 분리를 선택. 4층 정합이 meta-semantic 내부에만 살아있어도 STC가 meta-semantic을 **일반 도구로 참조**하는 구조로 더 깔끔. 다만 이 해석이 저자 의도인지 `03-decisions.md`에 명시되지 않음.

## Target 4: 이전 이슈 regression check

### 4.1 1차 review B-1/R-2 Entry 정량 trigger

**1차 review B-1** (:166~178): R-2 Entry tier의 정량 trigger 박제 요청.

**현 상태**:
- `03-decisions.md:247~254` R-2 결정 섹션: Option A + 3 phase 정량 trigger 유지 ✓
- `tiers/entry.md:20~40` § R-2 조건부 존속: 동일 trigger 반복 ✓

**평가**: **유지됨**. D-17과 독립된 결정이라 regress 없음.

### 4.2 1차 review Important-1 Exit Criteria 정량화

**1차 review** (Category C-3, :137~150): 정성 기준 정량화 + 자동 분류 50~79% 구간 처리 룰 + baseline 정의 요청.

**현 상태**:
- `03-decisions.md:353~376` Exit Criteria 섹션: 
  - Phase 2 트리거들 (자동 분류 < 50% / 50~79% / Entry < 3건 / contains > 100건 / 애매 > 30%) 정량 유지 ✓
  - Phase 3 트리거에 "D-17 framing 어색"이 추가 — `:362` "Pilot에서 D-17 framing 어색 | 저자 + 리뷰어 2명 | meta-semantic 위임 구조 재평가"
  - `:364` "`lifecycle_ref` schema 부적합 발견 | Pilot 저자 | schema 재설계"
  - D-17 Pivot 역방향 조건 (:372~375) 추가 ✓
- Phase 4B false positive > 10% 트리거 ✓

**평가**: **유지 + D-17 관련 trigger 추가**. 개선됨.

### 4.3 1차 review Important-4 Phase 4 4A/4B 분할

**1차 review F-9** (:272~276): Phase 4 warning→error 전환과 대량 마이그레이션 충돌 방지.

**현 상태**:
- `01-migration.md:195~230` § Phase 4 — 전체 전환 (4A + 4B 분할): 
  - 4A (warning 유지) ✓
  - 4B (warning → error 승격, observation 기간 2~4주) ✓

**평가**: **유지됨**.

### 4.4 1차 review Important-6 Operational positive list

**1차 review F-5** (:229~240): Operational 예외 scope creep 방지 — positive list + 수량 trigger.

**현 상태**:
- `rules/classification.md:28~44` § Operational instruction 면제: positive list + 명시적 불허 + Scope creep Exit Criteria (150건 초과) ✓

**평가**: **유지됨**.

### 4.5 2차 review Facet-flow §5 권장 4가지

**2차 review §5.3~5.4** (:390~439): 충돌 4건 + 통찰 6개.

**충돌 4건의 현 상태**:

| 충돌 | 2차 review | D-17 후 상태 |
|------|------------|--------------|
| FSM vs PipeTransitionScope 어휘 | 해소 필요 | **해소됨** — FSM tier 자체가 소멸 |
| Folding 용어 중복 | Pilot 시 혼동 가능 | **잠재 유지** — meta-semantic folding vs STC "contains" 계층 구별은 여전 |
| `level` 제거 시 meta-semantic 드리프트 | 비용 평가 필요 | **Phase 1.A 조사 항목에 포함 필요** (현재 명시 없음) |
| `depth` 필드 제거 (D-6 보류) | 영향 범위 결정 필요 | **D-6 보류 유지**, Phase 1.A 1번 항목 |

**통찰 6개의 반영 상태**:

| 통찰 | 2차 review | 반영 여부 |
|------|------------|----------|
| 1. 수집 vs 해석 레이어 분리 | tier/scope/layer 독립 보장 | 명시 없음 (R-1 직교성 주장 있으나 한 문서만으로 결정 가능성은 미검증) |
| 2. 경로 합산 원리가 Layout 독립성 근거 | meta-semantic 원칙 2 인용 | 반영 없음 |
| 3. 변형 후 저장 = Component v2 패턴 근거 | meta-semantic 인용 | 반영 없음 |
| 4. Fold 경계 = 체크포인트 framing | FSM Guard에 적용 | **D-17로 FSM 삭제** — 통찰 소실 |
| 5. 정적 분석 파이프라인 확장 | Phase 2 후 meta-semantic interpret 적용 | 반영 없음 |
| 6. System = 이벤트 트리거 + 패싯 흐름 | R-6 보충 | 반영 없음 |

**평가**: 2차 review 충돌 중 가장 중요한 1번은 Pivot으로 자연 해소. 나머지는 **여전히 유효** — 특히 level 제거 시 meta-semantic 드리프트는 Phase 1.A 조사 항목으로 추가되어야 함. 통찰 4번("Fold 경계 framing")은 D-17로 적용 대상(FSM)이 소멸해 소실.

### 4.6 3차 review의 잔존 polish 4건

**3차 review review-03-final.md의 4 drift** (문서 자체가 superseded-by-d17로 마킹):

| 항목 | 3차 review | D-17 후 상태 |
|------|-----------|--------------|
| 1. `01-migration.md` Phase 0 FSM schema 목록이 `states/events/gates/...` 옛 어휘 | 수정 필요 | **해소됨** — Phase 0 서술이 D-17로 재작성 |
| 2. `tiers/fsm.md` Frontmatter/Marker가 D-16 Form 2 미반영 | 수정 필요 | **해소됨** — tiers/fsm.md 삭제 |
| 3. `tiers/README.md` 관계도가 4층 정합 미반영 | 수정 필요 | **부분 해소** — 4 tier 관계도로 재작성, 4층 정합 자체는 소멸 |
| 4. `^transition:<id>` 마커가 Form 2(`scope_ref`)에도 걸릴 때 동기 검증 규칙 미명시 | 수정 필요 | **해소됨** — 마커 개념 자체가 D-17로 소멸 |

**평가**: 4건 모두 D-17 Pivot으로 자연 해소 (삭제된 파일에 있던 issue였으므로). 3차 review의 verdict `yes-with-minor-polish`는 D-16 기준이었고, 이제는 D-17로 완전히 다른 검토 기준이 적용됨.

## Target 5: STC 실질 가치 재점검

"4 tier + meta-semantic 위임"이 **실제로** 기존 `level: group/module/leaf` 체계보다 나은가?

### 5.1 기존 level 체계 대비 4 tier 구체 가치

**level 체계 (현행)**:
- `group`: 묶임의 이유 (조직적 경계) — 재귀 가능
- `module`: 단일 개념 + 구성 요소 참조 (개념적 경계)
- `leaf`: 최종 명세 (구현 경계)

**4 tier 체계 (제안)**:
- `component`: 데이터 shape
- `entry`: 구체화 인스턴스 (R-2 신중)
- `system`: Operations 집합
- `layout`: 조직적 배치

**비교**:

| 관점 | level | 4 tier |
|------|-------|--------|
| 문서 "무엇을 서술하는가" 분류 | 불가 (묶임의 이유만) | 가능 (데이터/기능/배치 구별) |
| 재귀성 | group 재귀 | layout 재귀 |
| 확장성 | 3값 고정 | 확장 가능 (D-17로 FSM 빠짐이 증명) |
| 기존 도구 호환 | 완전 호환 | Phase 4~5에 level 제거 |
| 도입 비용 | 0 (현행) | 1,046 문서 재분류 + 도구 전환 |

**실질 가치 질문**: 4 tier의 "무엇을 서술하는가" 구별이 실무에 1,046 문서 재분류 비용을 정당화할 만한 가치를 내는가?

**긍정 측면**:
- System 독립성 원칙 (D-4 `refs` LinkType)은 level 체계에는 없는 진짜 새 구조
- `tier: system` 문서의 R-7 3-check 기준은 "어떤 문서가 operations 단위인가"를 명확화 — 기존 module과 다름
- Component의 breaking change 관리 경로 (v2 신규 + superseded_by)는 공유 계약 문서의 고유 요구사항을 처리

**부정 측면**:
- Entry tier는 R-2로 희소성 박제 상태 — 4 tier 중 1개가 Pilot 전부터 "조건부 제거 대상"
- Component ↔ State enum Component 내부 다양성이 새로 도입됨 (§3.1)
- D-17 이후 "상태 전이는 tier로 표현 안 함, meta-semantic 위임"이라는 방침은 "분류 체계가 문서가 커버하는 개념을 전부 분류하지 못함"을 인정하는 것. **분류 체계의 완결성이 약해짐**.

### 5.2 meta-semantic을 이미 쓰는 상황에서 STC가 추가하는 것

**meta-semantic 기존 기여**:
- 9 원자 개념 + PipeFlow 30종
- 594 tests로 실증된 실행 파이프라인
- Data IR / Pipe IR / Module IR
- PipeTransitionScope, TransitionDef, DataLifecycle

**STC 추가 기여**:
- 문서 분류 축 (tier) — **meta-semantic에는 없음**
- 문서 구조 원칙 (System 독립성, Layout 재귀, Inline 금지)
- frontmatter schema (lifecycle_ref 등)

**중첩 영역**:
- State enum: Component tier (STC) ↔ DataLifecycle (meta-semantic IR)
- 전이: 없음 (STC는 `lifecycle_ref`로 위임)

**평가**: 중첩이 적음 — STC = 문서 분류, meta-semantic = 실행 체계. **직교성 주장 유효**. 

**단 학습 부담**: 이미 meta-semantic을 쓰는 저자가 **추가로** STC 4 tier + `lifecycle_ref` schema를 이해해야 함. 기여 가치가 학습 비용을 정당화하는지는 Pilot 검증 필요 (§3.2 우려와 연결).

### 5.3 `tier` 필드가 `scope × aspect`로 표현 가능한 정보 중복?

**주장 (STC)**: tier는 "무엇을 서술하는가", scope는 "어떤 종류의 관심사인가" — 직교.

**실제 검증**:

| 문서 후보 | scope | aspect | tier | 중복? |
|----------|-------|--------|------|------|
| `deterministic-label-system` | feature | func_def | system | 아님 (scope는 "feature" + aspect "func_def"가 Operations이지만 system tier는 "독립 단위")
| `deterministic-label-record-state` | data | domain_data | component | 아님 (data + domain_data는 "도메인 데이터"지만 component tier는 "공유 shape")
| `ingest-system` | feature | process_flow | system | 부분 중복? (feature × process_flow는 이미 "기능의 흐름"을 나타내는데, system tier가 더 정보 추가 있나?)

**관찰**: system tier는 `scope × aspect` 조합 중 일부와 겹칠 수 있음. 특히 "feature + process_flow" 조합은 system의 "operations 집합" 성격과 상관. 하지만:
- `scope × aspect`만으로는 "이 문서가 독립 운용 단위인가 / 조직적 배치인가"를 구별 불가
- R-7 3-check 기준이 `scope × aspect`에 인코딩 불가 (명명 가능성 / 독립 운용 / Lifecycle 유무는 tier 결정의 판단 기준이지, scope/aspect의 질문이 아님)

**결론**: 중복 없음. tier는 **구조적 역할** 축으로 scope/aspect와 독립 정보.

**단 Component의 "data" scope 상관**은 권장값 수준이지 강제 아님 (00-design.md:122, tiers/component.md:82). 실제로는 interface scope + api_contract aspect도 Component 후보. tier/scope/aspect 3축 조합이 **과하게 많아질** 가능성은 있음 (Phase 2 자동 분류가 이 문제를 드러낼 것).

### 5.4 Pilot이 Read-only 2종만 남은 실효성

**현 Pilot**:
1. `deterministic-label-system.md` (System tier, read-only projection)
2. `docs-control-plane-layout.md` (Layout tier, 상태 없음)

**검증 가능한 것**:
- Layout tier의 refs 사용 ✓
- System tier의 R-7 3-check 평가 ✓
- lifecycle_ref의 `read_only_projection: true` 케이스 ✓
- System 독립성 (depends_on 관계) ✓

**검증 불가한 것**:
- Component tier 문서 (deterministic-label-record-state 미작성)
- Entry tier 문서 (의도적 부재)
- Write-mode System의 lifecycle_ref ≠ read-only (§3.4)
- Component State ↔ code enum SSOT 정합
- `pipe_refs` 실제 meta-semantic 참조 경로

**평가**: **Pilot 검증 공백이 심각**. D-17 Pivot의 핵심 가설 검증을 위한 Pilot이 부족. 
- 최소 4~5개 Pilot 권장: Component(State enum) + Component(일반 data) + System(read-only) + System(write-mode) + Layout
- 현재 2개 Pilot으로는 D-17 실효성 검증 부족

**실무 질문**: Pilot이 2개로 accepted될 위험은? Phase 3 완료 후 Phase 4 전체 전환 시 예상치 못한 긴장이 1,046 문서 전환 중 드러날 가능성.

## 추가 발견

### E-1: `03-decisions.md` 체크리스트와 실제 파일 상태의 gap

**발견**: `03-decisions.md:456~463`의 18항목 중 8항목이 `[ ]` 미완료로 표기되지만 실제로 3항목(15/16/17)은 **이미 삭제 완료** (Bash `ls` 확인). 즉 **체크리스트 자체가 stale**.

**영향**: 리뷰어 혼동. "완료 수준"을 파악하려면 체크리스트가 아닌 실제 파일 상태 조회가 필요.

**권장**: 체크리스트를 현재 상태로 sync. `[x]` 항목 중 part 반영은 `[~]` 같은 중간 상태 도입 검토.

### E-2: `system-independence.md` 파일 제목과 내용의 불일치

**발견**: `:1~8` frontmatter + 제목 "# System 독립성 + FSM implements + Inline 정의 금지"라고 3개 규칙을 선언하지만, 실제 본문은:
- 규칙 1 (System 독립성) — 유지
- 규칙 2 (System ↔ meta-semantic 상태 위임) — **변경됨**, "FSM implements"가 아님
- 규칙 3 (Inline 정의 금지) — 유지

문서 제목이 구 규칙 2(FSM implements)를 유지. D-17 Pivot 후 제목 업데이트 누락.

**권장**: 제목을 "System 독립성 + meta-semantic 위임 + Inline 정의 금지"로 변경.

### E-3: `examples/deterministic-label-system.md` 내부 모순

**발견**:
- `:33` "D-17 Pivot 반영: FSM implements 관계 제거, lifecycle_ref로 State Component + meta-semantic 참조"
- `:181` "'Trivial System 예외'가 아님 — FSM implements 정상 연결"

같은 Pilot 문서 내부에 "FSM implements 관계 제거"와 "FSM implements 정상 연결" 모순.

**권장**: `:181` 재작성. "State Component 연결로 Lifecycle 기준 만족"이 타당.

### E-4: `rules/state-machine-delegation.md`의 meta-semantic 참조 오류

**발견**: `:39` "`docs/specs/meta-semantic/concepts/ms-concept-data-facets.spec.md` § Data IR.lifecycle"

**실제**: 해당 파일(ms-concept-data-facets.spec.md)에 `Data IR.lifecycle` 섹션 없음 (grep 결과 frontmatter `lifecycle: approved`만). DataLifecycle은 `docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-ir-data.spec.md:79`에 정의.

**영향**: 저자가 "상태 lifecycle은 여기 참조"라 가이드한 위치가 실제와 다름. Pilot 작성자가 meta-semantic spec을 뒤져야 함.

**권장**: `:39` 참조 경로 수정 — `meta-semantic-ir/meta-semantic-ir-data.spec.md § DataLifecycle` 또는 유사. 테이블 전체 meta-semantic 참조 경로 검증 필요.

### E-5: README 승격 체크리스트가 5 tier 전제

**발견**: `README.md:89~110` 리뷰 체크리스트 전체가 5 tier 전제. 특히:
- `:90` "5 tiers (Component/Entry/FSM/System/Layout) 정의가 서로 간섭 없이"
- `:92` "Guard vs Quality Gate 구별" ← FSM 관련
- `:96` FSM 예시 실제 코드 대응 확인 ← 예시 자체 삭제
- `:110` `02-fsm-composition.md` 미결 확인 ← 파일 삭제

D-17 Pivot으로 체크리스트 전면 재작성 필요.

**권장**: README 리뷰 체크리스트 D-17 기준으로 재작성.

### E-6: Entry tier의 D-17 미처리

**발견**: `tiers/entry.md`는 D-17 Pivot 영향 리스트(`03-decisions.md:444~463`)에 포함되지 않음 — 저자는 Entry tier가 D-17과 무관하다고 판단한 듯.

**실제**: `:52` "인스턴스 생명주기 전이 → [FSM](./fsm.md)" — FSM tier 참조. D-17 이후 이 대안 제시가 **존재하지 않는 tier를 가리킴**.

**권장**: `tiers/entry.md`를 D-17 영향 리스트에 추가하고 line 52를 "인스턴스 생명주기 전이 → System + lifecycle_ref로 meta-semantic 참조"로 수정.

### E-7: D-11 (Dry-run은 System operation) 유지의 근거 보강 필요

**발견**: `03-decisions.md:134~143` D-11 유지. D-17으로 FSM tier가 없어졌지만 D-11은 "System의 operation"이라는 성격이 FSM tier 없이도 독립 유효하다고 주장.

**미처리**: Dry-run 결과 shape의 `guardEvidence` (pilot `:137`)가 D-14 (Gate/Guard 명명)과 연결됐었는데 D-14는 superseded. `guardEvidence` 필드명을 유지할 것인가? 

**권장**: D-11의 Dry-run 결과 shape 필드명이 D-17 이후에도 유효한지 검토. 특히 `guardEvidence`는 FSM Guard에 매핑된 용어였음.

## 최종 권장

### 즉시 수정 (blocker)

1. **깨진 링크 제거 (7건)**: D-17 영향 리스트의 "삭제" 항목(15~17)은 이미 수행됐으나, **참조 제거가 누락**. 다음 링크들 일괄 수정:
   - `tiers/component.md:57` FSM tier 링크 → "상태 전이 규칙 → System + lifecycle_ref (meta-semantic 위임)"
   - `tiers/component.md:97` FSM 예시 링크 → 별도 Component 예시 작성 or 링크 제거
   - `tiers/entry.md:52` FSM 링크 → System + lifecycle_ref 참조
   - `examples/deterministic-label-system.md:102, :169` FSM 예시 참조 → 내부 Invariants 섹션 or 삭제
   - `README.md:92, :96, :110, :166` FSM 관련 링크 → 재작성 or 삭제

2. **"FSM implements" 잔존 서술 제거 (8건)**: D-17이 FSM tier + FSM implements 관계를 소멸시켰으므로 아래 잔존 진술 수정:
   - `tiers/system.md:17, :25, :93, :97`
   - `rules/system-independence.md:8 (제목), :19, :112, :122, :143과 본문 내 모순 해소`
   - `00-design.md:48` §1.2 "implements만 허용" — implements의 의미 재정의 또는 제거
   - `rules/classification.md:52` level→tier 매핑에서 `fsm` 제거
   - `mental-models.md:166~188, :196, :207` Perspective 예시 FSM → Component/System 예시로 전면 재작성
   - `examples/deterministic-label-system.md:181` 내부 모순

3. **03-decisions.md:456~463 체크리스트 sync**: 실제 상태로 업데이트. `[ ]` 중 삭제 완료된 3건을 `[x]`로, 부분 반영된 7건을 명시.

4. **meta-semantic 참조 경로 수정**: `state-machine-delegation.md:39` "Data IR.lifecycle" 참조 경로 오류 — 실제 파일 위치로 수정.

5. **README 리뷰 체크리스트 재작성**: D-17 기준으로 전면 재작성. 4 tier + lifecycle_ref + State Component + meta-semantic 위임 검증 항목으로.

### 승격 전 권장 (important)

1. **Write-mode Pilot 1건 추가** (§3.4): D-17의 핵심 가설 "System + meta-semantic 조합이 자연스럽다" 검증을 위해 Phase 3 Pilot에 write-mode System 1건 포함. 후보:
   - approval-system 가설의 실체화
   - ingest-session-state (Verdict FSM 활용)
   - 기존 meta-semantic pipe 중 1개 참조하는 lightweight Pilot
2. **State Component minimum schema 확정** (§3.5): Phase 1.B schema frozen 전 결정. `states` 필드 구조(string[] vs objects), terminal/initial 표현 방식.
3. **Stateless System 검증 메커니즘** (§3.3): `lifecycle_ref` 생략과 누락 구별 방법 결정 (Option A 긍정 선언 권장).
4. **Component tier 내부 다양성 명시** (§3.1): State enum Component를 sub-type으로 다룰지, `component_kind` 필드 도입할지 결정.
5. **4층 정합 약화 인정/보완** (§3.6): D-16의 4층 공유 키 구조가 D-17로 소멸함을 명시적으로 `03-decisions.md`에 기술. `def validate`의 역할 강화로 보완 가능.
6. **2차 review 통찰 6개 중 유효한 5개 반영 검토** (§4.5): 통찰 1/2/3/5/6은 D-17 후에도 유효.
7. **`system-independence.md` 제목 변경**: "System 독립성 + meta-semantic 위임 + Inline 정의 금지" (E-2).
8. **level 제거 시 meta-semantic 드리프트 조사** (2차 review §5.3 #3): Phase 1.A 조사 항목에 추가.

### 참고 (minor)

1. `01-migration.md:98` "6단계" → "5단계"로 수정.
2. `D-11` Dry-run 결과 shape의 `guardEvidence` 필드명 재검토 (E-7).
3. Entry tier의 D-17 영향 처리 (`tiers/entry.md:52`, E-6).
4. `state-machine-delegation.md:74~78` "Trivial System 예외"가 `system-independence.md:60` 규칙과 겹치는데 표현이 약간 다름 — 용어 통일.
5. `examples/README.md:47` "미작성된 Pilot — Component State Pilot: deterministic-label-record-state.md ... Phase 3 Pilot에서 작성 예정"이 명시적. Phase 3 진입 전 이 Pilot 작성 완료 여부 확인 필요.
6. Component tier가 새로 도입되는 State enum sub-type이 **기존 Component의 breaking change 관리(§변경 경로)**와 다른 규칙을 따르는지 명시 (State enum 변경은 상태 머신 자체 변경이라 일반 Component breaking change와 다른 영향 경로).
7. `03-decisions.md:60` "개념 리뷰 5개 (R-1/R-2/R-4/R-6/R-7)"는 실제로 **5개 맞음** (R-3/R-5 superseded) — 표기 OK. 단 superseded 2건을 괄호 안에 표기해 "5개 (+ 2 superseded)"로 하면 더 명료.

## Phase 진행 권장

- **draft 유지**. 현재 D-17 실행이 부분 완료 상태 — blocker 5건 해소 후 under-review 승격 가능.
- Blocker 1~5는 **단순 polish 작업**이므로 1일 내 해소 가능. 그 후 under-review 전환 권장.
- Write-mode Pilot 추가(중요도 1)는 Phase 3 초입에서 시작 — under-review 승격 차단 아님.
- State Component minimum schema 확정(중요도 2)은 Phase 1.B frozen 전까지 결정하면 됨.
- **D-17 자체는 유지 권장**: 이중 소유 해소 + ECS 원본 충실이라는 방향은 올바름. 단 실행이 부분 완료이므로 **리뷰어 지정 전 blocker 해소 필수**.
- **롤백 조건 유지**: `03-decisions.md:372~375` "Pilot에서 System + meta-semantic 조합이 직관에 반하면 FSM tier 복원 검토" — low reversibility 주의. Pilot 검증에서 학습 부담(§3.2) 또는 정합 약화(§3.6)가 실체화되면 D-17 재고 고려.

**종합**: D-17 Pivot은 **개념적으로 성공, 실행적으로 부분 완료**. 4차 리뷰는 Pivot의 큰 방향에는 동의하되, **실행 완결과 검증 공백 보완** 없이 under-review 승격 비권장. 
