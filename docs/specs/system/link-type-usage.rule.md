---
def:
  id: link-type-usage
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, convention, link-graph]
  links:
    - target: domain-hierarchy-readme
      type: traces_to
    - target: definition-taxonomy
      type: constrains
    - target: cases-md-convention
      type: refines
    - target: test-md-convention
      type: refines
---

# Link Type Usage — 9 종 링크 타입 결정 매트릭스 및 안티패턴

## 목적 ^purpose

`DefinitionLink.linkType` 어휘(9 종)의 **방향 의미**, **사이클 검사 대상 여부**, **상황별 권장/금지 조합**, 그리고 domain-hierarchy 세션(2026-04-20 Q2 / Phase 3a / Phase 3b / Phase 4 / Phase 5e)에서 실증된 **안티패턴**을 고정한다. 신규 frontmatter 작성 및 리뷰 시 이 규칙을 참조하면 `system-contains-system`, `circular-ref`, `invalid-code-boundary` 같은 validator 에러를 사전에 회피할 수 있다.

---

## 1. 규칙

### 1.1 9종 링크 타입 의미 표

`packages/definition-catalog/src/types.ts` §`LinkType`와 `src/frontmatter.ts` §`VALID_LINK_TYPES`가 SSOT. 현재 총 **9종** (`verifies` 는 frontmatter-only 관용 라벨이며 별도 §1.3 참조).

| type | 방향 의미 (A → B) | cyclic 검사? | 주요 사용 컨텍스트 |
|------|------------------|:---:|-------------------|
| `contains` | A가 B를 소유 (ownership) | No | 부모 group/module → 자식. **tier: system → system 금지**. tier: layout 은 `refs` 사용 |
| `depends_on` | A가 B를 소비 (runtime/compile-time consumption) | **Yes** | 소비자-공급자. Phase 3b Option B 이후 "자식 → 부모 domain_root" 선언에도 사용 |
| `refines` | A가 B의 추상 개념을 구체화 (ISA / specialization) | **Yes** | abstraction → concrete. Q2: domain_root 파생 시 `depends_on` 보다 **우선** |
| `implements` | A가 B의 추상 계약을 구현 | **Yes** | 인터페이스 구현. spec → contract |
| `constrains` | A가 B에 제약을 부여 | No | rule → 규율 대상 문서, policy → behavior |
| `traces_to` | A가 B에 근거/추적 기록을 건다 | No | decision → RFC, impl → spec, context → architecture |
| `refs` | A가 B를 단순 참조 (의미적 결합 없음) | No | **tier: layout 전용** — 여러 system 을 카탈로그로 묶을 때 (STC D-4) |
| `evolves_from` | A가 B의 개정판 (버전 진화) | No | v2 → v1. registry 가 revision 순으로 정렬 |
| `supersedes` | A가 B를 대체 (이전 개정 폐기) | No | 신규 계약이 구 계약을 대체 |

**`cyclicTypes` 집합** = `{depends_on, implements, refines}` — `validate.ts:116` 기준. 이 3종만 `circular-ref` 검사에 참여한다. 나머지 6종은 사이클 허용 대상이 아니지만 (`contains`, `constrains`, `traces_to`, `refs`, `evolves_from`, `supersedes`) validator 가 **감지하지 않는다** — 의미상 방향성이 약하거나 버전 진화(DAG) 를 따르기 때문.

### 1.2 상황별 결정 매트릭스

| 상황 | 권장 링크 | 금지 링크 | 근거 |
|------|-----------|-----------|------|
| parent system → child system | (frontmatter 에서 선언하지 않음 — 부모는 본문 `^overview` 로만 기술) | `contains`, `depends_on` | Phase 3a / Phase 3b Option B |
| parent layout → child system/root | `refs` | `contains`, `depends_on` | Phase 4 / validate.ts:213-230 (tier: layout 은 `refs` 강제) |
| child system → parent domain_root | `depends_on` | `contains` (방향 불가), `refines` (ISA 의미 아닐 때) | Phase 3b Option B |
| abstract spec → concrete detail (ISA) | `refines` | `depends_on` | Q2 review, Option B 우선순위 |
| parent group/module → child leaf/component | `contains` | `refs` (의미적 결합 있음) | validate.ts:264-287 |
| `.test.md` → 검증 대상 spec | `verifies` (권장) 또는 `refines`/`depends_on` (레거시 유예) | `contains` | test-md-convention §1.5 |
| `.cases.md` → parent spec + provider system | `refines` (상위 spec) + `depends_on` (provider) | `contains` | cases-md-convention §1.2 |
| rule → 규율 대상 spec/system | `constrains` | `depends_on` | 의미 왜곡 회피 |
| decision/impl → 근거 RFC/proposal | `traces_to` | `depends_on` | 의미 왜곡 회피 |
| v2 spec → v1 spec (개정 관계) | `evolves_from` (+선택적 `supersedes`) | `refines`, `depends_on` | registry.test.ts:189-195 |
| `@def.boundary` 주석의 타깃 문서 | tier: `system` 또는 `layout` | tier: `component`, `entry`, `interface/api_contract` spec | Phase 5e |

### 1.3 `verifies` — 예외적 frontmatter 레이블

`verifies` 는 `VALID_LINK_TYPES` 집합에 **없다**. 그럼에도 `test-md-convention.rule.md` §1.5 가 이를 **권장**하는 이유: `.test.md` 의 frontmatter 파서 경로가 별도로 `verifies` 를 허용하도록 확장 예정이며, 현시점에서는 신규 `.test.md` 작성 시 `verifies` 를 선언하고, validator 는 아직 거부하지 않는다 (silent pass). 기존 27개 `.test.md` 파일 중 18건이 `refines`, 6건이 `depends_on`, 2건이 `verifies`, 1건이 `traces_to` 혼재. 마이그레이션은 기회주의적으로 수행한다.

**가이드**:
- 신규 `.test.md` → `type: verifies` 우선. 기존 파일은 유예.
- `.cases.md` 는 `verifies` 쓰지 않는다 (§1.2 참조).

### 1.4 domain_root 파생 관점

`deriveDomainRoot()` 는 outgoing `refines` / `depends_on` 만 walk 한다 (`packages/definition-catalog/src/domain-root.ts`). 다른 링크 타입(`contains`, `traces_to`, `constrains`, `refs`, `evolves_from`, `supersedes`)은 파생에 영향을 주지 않는다.

- **우선순위**: `refines` (ISA, coherence) > `depends_on` (USES, cross-domain 가능) — Q2 Option B.
- 두 종류가 모두 parent (tier: system|layout) 를 가리킬 때 `refines` 를 primary 로 선택.
- "멤버십"을 프론트매터로 선언하고 싶다면 `depends_on` (cross-domain consumer) 또는 `refines` (domain-local ISA) 중 선택.

---

## 2. 안티패턴 — 명시적 금지 목록

| 안티패턴 | 어디서 발견 | 왜 금지 |
|---------|-----------|--------|
| `tier: system` A — `contains` → `tier: system` B | Phase 3a (39건 revert) | validator `system-contains-system` error (`validate.ts:231-245`). System 독립성 원칙 위반 |
| 부모 system A — `depends_on` → 자식 system B + 자식 B — `depends_on` → 부모 A | Phase 3a | 직접 2-노드 cycle → `circular-ref` error |
| 3-edge 혼합 cycle via `depends_on` + `refines` | Phase 3b (`viz-language-system` case) | 사전 존재하는 `refines` 체인과 신규 `depends_on` 이 cross-domain 경로에서 사이클 형성 |
| `tier: layout` 이 `contains` 로 자식 소유 | Phase 5e, validate.ts:213-230 | validator error — layout 은 `refs` 만 허용 |
| `tier: component` 이 `contains` 자식 보유 | validate.ts:246-255 | warning — component 는 수동 참조 대상, data-shape 분리 권장 |
| `.test.md` 가 `contains` 링크 선언 | test-md-convention §1.5 | test 는 검증자, 소유자가 아님 |
| `@def.boundary` 가 `tier: component`/`entry` 또는 interface/api_contract spec 지목 | Phase 5e | boundary 는 system/layout 수준에서만 의미 있음 |
| peer system 간 `contains` (도메인 경계를 넘는 소유) | Phase 3a | cross-domain ownership 금지, `depends_on` 또는 `refs` 로 표현 |

### 2.1 안티패턴 제거 패턴

Option B 패턴 (Phase 3b): "부모가 자식을 선언"하는 frontmatter 링크는 제거하고, "자식이 부모를 가리키는" 링크만 유지한다. 부모는 본문 `^overview` 에 자식 목록을 나열해 가독성 확보.

---

## 3. 검증

### 3.1 validator 규칙 (자동)

```bash
pnpm exec qa-sdk def sync
pnpm exec qa-sdk def validate
```

아래 에러가 0 이어야 한다:

- `system-contains-system` — §2 table 행 1
- `circular-ref` — §2 table 행 2·3
- `level-violation` (tier: layout contains, tier: component contains) — §2 table 행 4·5
- `invalid-code-boundary` — §2 table 행 7 (`@def.boundary` 오지정)
- `broken-link` — target 존재 확인 (일반)

### 3.2 수동 감사 스니펫

```bash
# parent→child depends_on 역방향 안티패턴 탐지 (Phase 3a 재발 방지)
# — system frontmatter 에서 자식 방향 depends_on 이 남아있는지
pnpm exec qa-sdk def audit --rule parent-child-depends-on

# .test.md verifies 커버리지 — 신규 파일
for f in $(find docs/specs -name "*.test.md"); do
  grep -q "type: verifies" "$f" || echo "LEGACY-LINK-TYPE: $f"
done

# layout → refs 사용 확인
pnpm exec qa-sdk def incoming <layout-id>   # refs 관계만 나와야 함
```

### 3.3 리뷰 체크리스트

신규 frontmatter PR 리뷰 시:

- [ ] 모든 `links[].type` 값이 §1.1 9 종 중 하나 (또는 `.test.md` 의 `verifies`)
- [ ] `tier: system` 문서는 `contains` 를 다른 `tier: system` 문서에 사용하지 않음
- [ ] `tier: layout` 문서는 `contains` 대신 `refs` 만 사용
- [ ] 자식 → 부모 방향에서 `depends_on` 또는 `refines` 선택: 의존(USES) vs 구체화(ISA)
- [ ] `.test.md` 는 `verifies` 우선, `.cases.md` 는 `refines` + `depends_on` 쌍
- [ ] `@def.boundary` 주석의 타깃 문서가 `tier: system|layout`
- [ ] 버전 진화는 `evolves_from`/`supersedes` 사용

---

## 4. 예외

| 예외 | 정당화 |
|------|-------|
| 기존 문서의 레거시 링크 타입 혼용 (`.test.md` 의 `refines`/`depends_on` 27개) | tolerance mode — 본 규칙 승격 후 기회주의적 마이그레이션 |
| RFC 진행 중 임시 위반 | review 문서에 명시하면 허용. 예: Phase 3a 는 error 14건을 일시 생성 후 revert 로 baseline 복구 |
| `cross-scope` 태그 그룹 전원 부여된 `multi-parent contains` | validate.ts §contains 다중 부모 — 의도적 공유 소속 선언 |
| `knowledge_kind: proposal/adr/convention` 의 중복 좌표 | validate.ts:357-362 — 의도적 co-location |
| `viz-language-system → viz-system` 승격 보류 | Phase 3b 당시 `motion-content-contract`의 viz 소속 링크로 cycle risk가 있었음. 현재 motion-content 계약은 motion-content 도메인으로 이동했으며, 승격 여부는 별도 parent-child 재검토 후 적용 |

---

## 5. 근거

- `packages/definition-catalog/src/types.ts` §`LinkType` — 9 종 어휘 SSOT
- `packages/definition-catalog/src/frontmatter.ts:186` — `VALID_LINK_TYPES` 집합
- `packages/definition-catalog/src/validate.ts:116` — `cyclicTypes = {depends_on, implements, refines}`
- `packages/definition-catalog/src/validate.ts:213-255` — tier 별 contains/refs 강제 규칙
- `packages/definition-catalog/src/validate.ts:408-427` — `system-contains-system` warning
- `packages/definition-catalog/src/domain-root.ts` — `deriveDomainRoot()` 파생 로직
- [2026-04-20-q2-parent-priority.md](../../proposals/domain-hierarchy/reviews/2026-04-20-q2-parent-priority.md) — refines > depends_on (Option B)
- [2026-04-20-phase3a-antipattern-fix.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase3a-antipattern-fix.md) — system-contains-system 충돌 분석 (옵션 A/B/C/D)
- [2026-04-20-phase3b-option-b.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase3b-option-b.md) — parent→child depends_on 제거 + child→parent 추가
- [2026-04-20-phase4-impl.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase4-impl.md) — layout refs 로 orphan 수용
- [2026-04-20-phase5e-boundary.md](../../proposals/domain-hierarchy/reviews/2026-04-20-phase5e-boundary.md) — `@def.boundary` 가 layout 허용 + 타깃 제약
- [cases-md-convention.rule.md](./cases-md-convention.rule.md) — `refines` + `depends_on` 쌍
- [test-md-convention.rule.md](./test-md-convention.rule.md) — `verifies` 권장
