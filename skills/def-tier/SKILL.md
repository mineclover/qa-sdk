---
name: def-tier
description: "STC 티어 결정. definition-catalog 문서에 system/layout/component/entry 중 올바른 tier를 부여한다."
---

# Definition Catalog — STC 티어 결정

tier는 문서가 **토폴로지상 어떤 역할을 하는가**를 나타낸다.
level(분해 위치)과 직교하며, 구조 검증의 핵심 축이다.

STC (Semantic Topological Coordinate) 체계: `tier × scope × layer` 좌표의 `tier` 축.

`tier` option 자체의 canonical 정의는 `definition-metadata-tier`가 소유한다. 이 skill은 그 option을 실제 문서에 적용하는 판단 절차다.

```bash
qa-sdk def get definition-metadata-tier
qa-sdk def get definition-frontmatter-metadata-system
```

## 4종 티어

| tier | 질문 | 본질 |
|------|------|------|
| `system` | "이것은 독립적으로 동작하는 연산 집합인가?" | 코드 패키지·서비스 경계를 대표하는 스펙 |
| `layout` | "이것은 여러 시스템/팩을 조망하는 뷰인가?" | 조직화된 읽기/배치 뷰. 코드 경계 없음 |
| `component` | "이것은 수동적으로 참조되는 데이터 형태인가?" | 링크 대상 전용. 독립 동작 없음. 6 sub-type |
| `entry` | "이것은 ID로 컴포넌트들을 묶는 정체성인가?" | ECS entity 유사. R-2 조건부 존재 |

---

## 결정 트리 (6-step)

### Step 0 — Exempt 선검사

아래 패턴은 `type: knowledge` + tier 불필요:

| 패턴 | 판정 |
|------|------|
| `CLAUDE.md`, `AGENTS.md`, `README.md` 등 루트 파일 | exempt |
| `docs/*.md` (docs/specs/ 바깥) | knowledge |
| `docs/skills/**`, `skills/**/*.md` | knowledge |
| `docs/proposals/**` | knowledge (proposal) |

### Step 1 — depth 힌트 (축소)

| depth | tier 후보 |
|-------|----------|
| `overview` | layout / system(그룹) |
| `specification` | component / system / entry |
| `implementation` | component / system |
| `validation` | component(validation-rule) / system test harness |

depth만으로 확정 불가 — 다음 step 계속.

### Step 2 — Layout / Pack 감지

**Layout / Pack 확정 (A ∧ B ∧ ¬C)**:
- A: `level === "group"` 또는 `depth === "overview"`
- B: `refs` 대상 ≥ 1 또는 여러 System/Interface를 조망/배치/배포 묶음으로 조직
- C: operations(함수/메서드 블록) 없음

→ `tier: layout`

### Step 3 — System 판정 (R-7 3-check)

Layout이 아니면 3개 신호 채점:

| check | 조건 | 점수 |
|-------|------|------|
| 명명 | id 접미사 `-system`, 또는 고유 이름 | +1 |
| 독립 운용 | 함수/메서드/operations 블록 존재 | +1 |
| Lifecycle | `states:` 목록 또는 `lifecycle_ref` frontmatter | +1 |

- 점수 ≥ 2 → `tier: system` (high confidence)
- 점수 1 → Step 4 (Component 우세)
- 점수 0 → Step 4

### Step 4 — Component 판정 + sub-type

schema 정의 / 상태 목록 / evidence shape 중 하나라도 있으면 Component.

**sub-type (첫 매칭 우선)**:

| 순서 | 조건 | sub-type |
|-----|------|---------|
| 1 | 상태 목록(`states:`)만 있고 operations 없음 | `state-enum` |
| 2 | evidence/readiness shape + 경로에 힌트 | `evidence-shape` |
| 3 | meta-semantic facet 매핑 (production/consumption) | `data-facet-role` |
| 4 | schema + validation 조건만 | `validation-rule` |
| 5 | 불변 상수 리스트만 | `constant-literal` |
| 6 | 기본 fallback | `data-shape` |

frontmatter: `component_subtype: data-shape` (6 값 중 하나)

### Step 5 — Entry (희소)

인스턴스를 canonical ID로 문서화할 때만. Phase 2 결과 후보 < 3건이면 tier 제거 검토.

### Step 6 — Fallback

위 모두 미매칭 → `needs_review: true`. 직접 판단.

---

## 티어별 구조 규칙

### tier: system

- **contains 허용** — 하위 component/entry 포함 가능
- **System→System contains 금지** — 다른 `tier: system` 문서를 contains 불가
  - 대신: `depends_on` (의존), `refs` (참조), `traces_to` (추적)
- **코드 경계 가능** — `@def.boundary <id>` 소유 가능
- **상태 관리 시 meta-semantic 위임** — State enum은 Component로 분리, 전이 규칙은 `lifecycle_ref`로 참조
- **문서 분할 기준점** — E/C/I/S + L/P 분할은 먼저 어떤 system이 책임지는지 정한 뒤 그 내부에서 수행

### Interface / DSL 평면 (I)

`interface`는 현재 별도 tier 값이 아니라 소비 계약 평면이다. 보통 `scope: interface` + `aspect: api_contract|cli_contract|event_contract` 또는 rule/spec 문서로 표현한다.

- System을 어떻게 소비할지 정의한다.
- Component의 data/state/evidence vocabulary를 참조한다.
- Runtime behavior, validator, projector, writer를 소유하지 않는다. 그런 behavior는 System 문서로 분리한다.
- 여러 Interface 문법 조각을 조망하거나 배포/문서 묶음으로 조직하는 문서는 Layout/Pack으로 둔다.

```yaml
def:
  tier: system
  lifecycle_ref:          # 상태 관리 System만 (D-17)
    state_component: my-doc-state  # 상태 enum Component
    pipe_refs:
      - pipe/approve
      - pipe/reject
```

```yaml
def:
  tier: system
  links:
    - target: child-component-a   # OK
      type: contains
    - target: other-system        # OK
      type: depends_on
    - target: sibling-system      # ERROR: system→system contains 금지
      type: contains
```

### tier: layout

- **contains 금지** — 직접 소유 불가
- **refs 필수** — 최소 1개 이상의 `refs` 링크
- **코드 경계 없음**
- **생성적 소비 컨텍스트** — 안에서 새 System/Component 발견 가능 (단, inline 정의 아닌 독립 문서로 promote)
- **Pack 표현 가능** — 배포/문서 묶음이 behavior/data ownership 없이 여러 System/Interface를 조직하면 layout-like pack으로 본다.

```yaml
def:
  tier: layout
  links:
    - target: system-a
      type: refs
    - target: system-b
      type: refs
```

### tier: component

- **contains 비권장** — 자식이 있으면 level-violation warning → `tier: system`으로 재검토
- **링크 대상 전용** — 여러 System이 공유 계약
- **6 sub-type** 지정 권장

```yaml
def:
  tier: component
  component_subtype: data-shape   # data-shape | state-enum | evidence-shape
                                  # data-facet-role | validation-rule | constant-literal
```

**state-enum 예시** (D-17 Pivot — 상태는 System 내부가 아닌 별도 Component):

```yaml
# my-doc-state.spec.md
def:
  tier: component
  component_subtype: state-enum
  states:
    - draft
    - review
    - approved
    - deprecated
```

### tier: entry (R-2)

- ECS entity 유사. canonical singleton ID 문서화 대상
- 신중히 사용 — 대부분 Component나 System으로 충분

---

## 흔한 오분류 패턴

| 증상 | 원인 | 수정 |
|------|------|------|
| `system`인데 다른 `system`을 `contains` | System 독립성 위반 | `contains → depends_on` |
| `layout`인데 `refs`가 없음 | 뷰가 비어있음 | refs 추가 또는 `tier: system` 변경 |
| `layout`인데 `contains`로 세부 문서를 소유 | Layout/Pack이 ownership을 가짐 | `contains → refs` 또는 owner System으로 이동 |
| `component`인데 `contains` 자식 다수 | 실제로는 system | `tier: system`으로 변경 |
| 상태 전이 로직이 System 내부에 직접 있음 | D-17 위반 | State enum → Component, 전이 → `lifecycle_ref` |
| 코드 경계(`@def.boundary`)가 있는데 `layout` | 경계 소유는 system만 | `tier: system`으로 변경 |
| `component` tier인데 좌표 중복 경고 | component는 좌표 유일성 불필요 | 검증기에서 component 제외됨 (정상) |

---

## 마이그레이션 참조 (legacy level → tier)

| 이전 | 권장 tier | 판단 기준 |
|------|----------|----------|
| `level: group` + 코드 패키지 소유 | `system` | 코드 경계 소유 여부 |
| `level: group` + 조망 뷰 | `layout` | refs 링크만 가지는지 |
| `level: group` + 여러 System/Interface 묶음 | `layout` | Pack/Layout 역할인지 |
| `level: module` + 독립 동작 | `system` | 독립 실행 가능 여부 |
| `level: leaf` + 데이터 형태 | `component` | 수동 참조 여부 |
| `level: leaf` + 코드 경계 소유 | `system` | `@def.boundary` 존재 여부 |

---

## 도메인 루트 (domain_root)

`tier: system` 문서는 링크 그래프를 따라 가장 가까운 상위 도메인으로 귀속되며, 이를 `domain_root`로 파생한다.

**파생 규칙(요약)**:
- `contains` 링크의 역방향 부모 → `depends_on`의 상위 시스템 → `refines` 대상 → 없으면 self
- 다중 후보는 `selectPrimaryParent`의 우선순위(contains > depends_on > refines)로 결정
- 최대 깊이 10, 순환은 방어됨

**사용**:

```bash
qa-sdk def audit --by-domain     # 루트별 문서 수 + top 좌표
qa-sdk def list --domain-root <rootId>
qa-sdk def context <docId>       # 하단에 "도메인 루트: <rootId>" 표시
```

`owner_system`과 파생 루트가 불일치하면 `def context`에 경고가 나오고, `def validate`에서 `owner-root-mismatch` info 진단이 붙는다. tier를 다시 검토할 때 이 신호가 "소속 도메인 재검토 필요"의 단서가 된다.

전체 설계 및 Phase 계획: `docs/proposals/domain-hierarchy/` 참조.

### 관련 규칙

tier / link type / suppression 이 교차하는 지점은 별도 rule 문서가 있다. tier 변경 전 필수 확인:

- `docs/specs/system/link-type-usage.rule.md` — 9종 linkType 방향/사이클 매트릭스 + tier 별 제약 (system→system contains 금지, layout→refs 전용)
- `docs/specs/system/validator-suppression-tags.rule.md` — dup-coord 가 component/knowledge_kind/cross-scope 로 억제되는 조건
- `docs/specs/system/layer-separation.rule.md` — tier 재정의는 L1 semantic change → L3 workflow smoke 재실행 필수
- `skills/semantic-change/SKILL.md` — tier 재분류 / aspect 분할 시 공통 체크리스트

## 검증

```bash
qa-sdk def sync
qa-sdk def validate    # system-contains-system, level-violation 확인
```

tier 변경 후 체크리스트:
1. `system → component`: 코드 경계(`@def.boundary`) 제거 확인
2. `component → system`: System→System contains 위반 여부 확인
3. `layout → system`: refs 링크를 contains/depends_on으로 전환 여부 검토
4. `system` + 상태: state enum Component 분리, `lifecycle_ref` 추가 검토
5. 변경 후 `def sync + def validate` 실행
