---
name: def-validate
description: "definition-catalog 검증 이슈 해소. def validate 에러/경고를 유형별로 분류하고 우선순위에 따라 수정한다."
---

# Definition Catalog — 검증 이슈 해소

## 실행 순서

```bash
qa-sdk def sync           # 파일 → DB 동기화 (항상 먼저)
qa-sdk def validate       # 이슈 목록 출력
```

출력은 최대 10건 + "외 N건" 형태로 잘린다.
전체 목록이 필요하면 `validateGraph`를 직접 호출하거나 `def audit`으로 타입별 집계를 확인한다.

### `def doctor` 와의 관계

`def validate` 는 **L2 (validator)** 레이어만 본다. workflow 가정 (도메인 루트가 멤버를 드러내는가, rule 문서가 발견 가능한가) 은 검증하지 않는다.

`def doctor` 는 L2 + L3 (workflow smoke) + L4 (annotation round-trip) 을 한 번에 돌리는 통합 헬스체크다. 신규 기여자/에이전트는 `def validate` 대신 `def doctor` 를 먼저 실행하고, Core 섹션의 `validate` 경고/에러가 잡히면 본 skill 로 내려와 유형별로 해소한다.

계층 분리 원칙 상세: `docs/specs/system/layer-separation.rule.md` (L1 data / L2 validator / L3 workflow / L4 tooling).

## 계층 맥락

본 skill 은 **L2 validator layer** 를 다룬다. 핵심 원칙: **errors=0 은 필요 조건일 뿐 충분 조건이 아니다 — L3 workflow-smoke 는 별도 게이트**.

| 계층 | 본 skill 관계 |
|------|-------------|
| L1 (data) | 검증 대상 — frontmatter schema + 링크 그래프를 입력으로 받는다 |
| **L2 (validator)** | **본 skill 담당** — validateGraph 규칙, taxonomy 불변식, code-boundary 검증 |
| L3 (workflow) | 본 skill 이 보증하지 않음 — `def topdown` silent empty, `def list --type=rule` 누락 등은 잡지 못한다 |
| L4 (tooling) | 본 skill 이 일부 다룸 — `invalid-code-boundary` / `ambiguous-code-boundary` 는 L4 round-trip 규율 |

Semantic 변경 (링크 방향, aspect 분할 등) 을 수반한다면 `def validate` 통과 후에도 반드시 `skills/semantic-change/SKILL.md` Step 3 체크리스트를 돌린다. Option B 사건 재발 방지.

관련 rule: `docs/specs/system/layer-separation.rule.md` §1.2 (L2 정의), `docs/specs/system/validator-suppression-tags.rule.md` (억제 수단).

## 에러 우선순위 (순서대로 해소)

### 1. `circular-ref` — 순환 참조

**패턴**: A→B→A (depends_on / implements / refines 체인)

**원인**: 자식 문서가 부모를 다시 `refines` 또는 `depends_on` 하는 역방향 링크.

**수정**:
1. 방향을 찾는다: 어느 쪽이 "자식"인지 판단
2. 자식 문서의 역방향 링크 제거 (부모를 `refines`하는 링크)
3. 부모→자식 방향의 링크 타입 확인 (`depends_on → contains`가 맞으면 교체)

```yaml
# Before (순환): parent depends_on child, child refines parent
# After: parent contains child, child에서 parent 참조 제거
```

**주의**: `contains`, `constrains`, `traces_to`는 순환 검사 대상이 아님.

---

### 2. `broken-link`

**원인**: target ID가 존재하지 않음.

**수정**:
- 오타면 ID 교정
- 삭제된 문서면 링크 제거
- 아직 없는 문서면 `lifecycle: draft`로 먼저 생성 후 연결

---

### 3. `system-contains-system`

**원인**: `tier: system` 문서가 다른 `tier: system` 문서를 `contains`.

**수정**: `contains → depends_on` 전환.

```yaml
# Before
- target: other-system
  type: contains
# After
- target: other-system
  type: depends_on
```

**역방향 링크 확인**: 자식 문서에 `refines`/`implements` 역참조가 있으면 함께 제거 (circular-ref 예방).

**주의**: tier 변경으로 새 system-contains-system이 cascade될 수 있음. 변경마다 sync+validate 반복.

---

### 4. `level-violation` (layout)

**원인**: `tier: layout`인데 `refs` 링크가 없거나, `contains` 링크가 있음.

**수정 A** — refs 추가 (조망 뷰가 맞는 경우):
```yaml
links:
  - target: relevant-system
    type: refs
```

**수정 B** — tier 변경 (실제로는 system인 경우):
```yaml
tier: system   # layout → system
# refs 링크를 contains/depends_on으로 검토
```

---

### 5. `missing-owner-system`

**원인**: `type: design` 문서에 `owner_system` 누락.

**수정**:
```yaml
def:
  type: design
  owner_system: <소유 시스템 ID>   # 추가
```

`svc` 필드가 있으면 해당 서비스가 소유 시스템인 경우가 많음.

---

### 6. `invalid-code-boundary`

**원인**: `@def.boundary <id>`로 참조된 문서가 코드 boundary를 소유할 수 있는 `tier: system|layout` 또는 legacy contains parent가 아님.

**수정**:
- 코드 경계를 소유해야 하는 문서: `tier: system`으로 변경
- 여러 System/Interface를 조망하는 boundary면 `tier: layout` + `refs`로 변경
- 잘못 annotation된 경우: 소스 파일에서 `@def.boundary` 주석 제거

---

### 7. `ambiguous-code-boundary`

**원인**: 하나의 코드 파일이 서로 다른 시스템에 속한 여러 `@def.doc` 참조를 가져서 boundary가 모호함.

**수정**: 명시적 boundary 선언 추가:
```ts
// @def.doc my-feature-spec
// @def.boundary my-package-system   // 추가 — primary boundary 선언
```

---

## 경고 우선순위

### `level-violation` (component)

**원인**: `tier: component`인데 `contains` 자식이 있음.

**의미**: component가 실제로는 독립 동작 단위일 수 있음.

**수정**:
- 자식을 가져야 한다면: `tier: system`으로 변경
- 자식이 불필요하다면: contains 링크 제거

**cascade 주의**: component → system으로 변경하면 해당 문서를 `contains`하는 부모가 system-contains-system 위반이 됨.

---

### `multi-parent`

**원인**: 한 문서가 여러 부모로부터 `contains` 참조.

**수정 A** — 의도적 공유 (cross-domain 공용 컴포넌트):
```yaml
tags: [cross-scope]   # 추가하면 warning 억제
```

**수정 B** — 비의도적 중복:
1. 주 소속 1곳만 `contains` 유지
2. 나머지는 `depends_on`으로 전환

---

### `duplicate-coordinate`

**원인**: `tier:scope:layer:aspect` 조합이 다른 문서와 동일.

**판단**:
- `tier: component`면 좌표 중복이 허용됨 (validator에서 자동 제외)
- `tier: system/layout`이면 `aspect` 세분화하거나 `layer` 조정

**component 예외 원칙**: component는 "같은 역할을 하는 여러 데이터 형태"가 존재할 수 있어 좌표 유일성 요구 불필요.

---

### `orphan`

**원인**: 어디에도 참조되지 않는 approved 문서.

**수정 방향**:
- root system 문서(`*-system-root`, `*-system`)는 상위 layout에서 `refs`로 연결
- 기능 문서는 해당 system의 `contains`에 추가
- 진짜 standalone이면 lifecycle을 `deprecated`로 전환

---

### `invalid-type-classification`

**원인 A**: `type: knowledge`인데 `.spec.md`/`.plan.md`/`.rule.md` 확장자 → `type: spec`으로 변경
**원인 B**: `type: spec/design`인데 `.todo.md`/`.memo.md` 확장자 → 확장자가 레거시 혼용인 경우 warning 억제됨 (정상)

---

### `owner-root-mismatch` (info)

**심각도**: info — 자동 수정 대상 아님. 링크 그래프와 frontmatter 선언이 어긋남을 표면화한다.

**원인**: `frontmatter.owner_system`과 링크 그래프 기반 파생 `domain_root`가 일치하지 않음. Phase 2 validator가 추가한 진단.

**예**:
```
cloud-event-bridge: owner_system=meta-semantic-system, derived_root=definition-catalog-spec
```

**판단**:
- `owner_system`이 맞다면 링크 부족 → `depends_on` 또는 `contains`로 실제 소유 시스템과 연결
- 파생 루트가 맞다면 `owner_system`을 재선언
- 둘 다 부분적으로 맞으면 도메인 경계 재검토 (Phase 3 타겟)

상세: `docs/proposals/domain-hierarchy/00-design.md`.

**수정**:
- `.spec.md` + `type: knowledge` → `type: spec` 변경 + `knowledge_kind` 필드 제거
- `.plan.md`/`.rule.md` + `type: knowledge` → `type: spec` 변경 + `knowledge_kind` 필드 제거
- `.spec.md` 파일에서 `type: spec`으로 변경 시 `knowledge_kind` 함께 제거 필수

---

## 수정 후 검증 루프

```bash
# 1. 파일 수정
# 2. 동기화
qa-sdk def sync
# 3. 검증
qa-sdk def validate
# 4. 에러 0건이 될 때까지 반복
```

**주의**: sync 없이 validate 하면 이전 상태 기준으로 검증됨.

### Suppression 태그 (경고 억제)

특정 경고는 의도적 억제 수단으로 해소할 수 있다. 단 **억제 ≠ 해결** — 구조적 수정이 더 적절한 경우가 많다.

- `lifecycle: deprecated` — 거의 모든 검사 skip (폐기 예정 문서)
- `tier: component` — `duplicate-coordinate` skip (수동 참조 대상 data-shape)
- `knowledge_kind: proposal|adr|convention` — `duplicate-coordinate` skip (문서 묶음)
- `tags: [cross-scope]` — `multi-parent` / `duplicate-coordinate` skip (의도적 공유, 그룹 전원 요구)
- `tags: [orphan-expected]` — `orphan` skip (독립 유효 문서)
- `.cases.md` / `.test.md` 확장자 — `orphan` 자동 skip

전수 목록 + 오용 금지선: `docs/specs/system/validator-suppression-tags.rule.md`.
신규 suppression 도입 시 반드시 해당 rule 문서를 **먼저 갱신** 후 `validate.ts` 수정.

### 계층 구분 — validate 통과 ≠ 시스템 healthy

`def validate` 는 L2 구조 검증만 본다. L3 (workflow) 이상은 통과시키지 못한다:
- "도메인 루트에서 `def topdown` 이 ≥1 member 반환" — L3 smoke 책임
- "rule 문서 ≥8 건 발견" — L3 smoke 책임
- "`@def.boundary` 타깃이 deprecated 아님" — L4 책임

Semantic 변경 (링크 방향 재정의, aspect 분할 등) 을 했다면 `def validate` 통과 후에도 `skills/semantic-change/SKILL.md` 체크리스트를 돌려야 한다. Phase 3b Option B 사건 (validator green + def topdown silent 0) 을 재발하지 않는 것이 목적.

---

패키지 코드(`packages/definition-catalog/src/validate.ts` 등) 수정 시:
```bash
pnpm --filter definition-catalog build
pnpm --filter definition-data-source build
pnpm --filter @qa-sdk/cli build
# 그 후 def sync + def validate
```

## 에러 타입 요약표

| 타입 | 심각도 | 즉시 수정 | 일괄 패치 가능 |
|------|--------|----------|--------------|
| `circular-ref` | error | 필수 | 패턴 분석 후 |
| `broken-link` | error | 필수 | ID 오타면 가능 |
| `system-contains-system` | error | 필수 | contains→depends_on |
| `level-violation` (layout) | error | 필수 | tier 규칙 확인 후 |
| `missing-owner-system` | error | 필수 | svc 기반 일괄 가능 |
| `invalid-code-boundary` | error | 필수 | tier 변경 |
| `ambiguous-code-boundary` | error | 필수 | @def.boundary 추가 |
| `multi-parent` | warning | 케이스별 | cross-scope 태그 |
| `duplicate-coordinate` | warning | tier 확인 | component 제외 |
| `orphan` | warning | 케이스별 | 루트 연결 |
| `invalid-type-classification` | warning | type 필드 수정 | 일괄 패치 가능 |
| `level-violation` (component) | warning | tier 검토 | system 변경 |
| `owner-root-mismatch` | info | 링크/owner 재검토 | 도메인 단위 판단 |
