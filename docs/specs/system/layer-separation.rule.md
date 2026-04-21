---
def:
  id: layer-separation
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, architecture, convention, workflow]
  links:
    - target: system-specs-rules-index
      type: traces_to
    - target: cases-md-convention
      type: refines
    - target: link-type-usage
      type: refines
---

# Layer Separation — 4-Layer 책임 모델과 Workflow Smoke 원칙

## 목적 ^purpose

definition-catalog 주변 문서·검증·CLI·주석 계층이 **서로 다른 품질 게이트** 로 검증되는데도, 실무에서는 "validator green == 시스템 green" 으로 오해되어 UX 회귀가 말없이 통과된다. 본 규칙은 계층별 책임/경계/검증 방법/안티패턴을 고정하고, **silent empty / semantic change without workflow re-verify** 같은 재발 패턴을 차단하기 위한 Workflow Smoke 원칙을 성문화한다.

근거: Phase 3b Option B 에서 parent→child `depends_on` 을 제거한 순간 `def validate` 는 계속 green 이었으나, `def topdown gate-system` 이 0 건을 반환하면서 신규 contributor entry-point 가 침묵하며 붕괴했다 (selector-review Gap #1 → selector-fixes §1).

---

## 1. 규칙 — 4 계층 정의

### 1.1 L1 — Data Layer

SSoT: `docs/specs/**/*.{spec,plan,todo,rule,memo,test,cases}.md` 의 frontmatter + 본문 + 링크 그래프.

| 항목 | 내용 |
|---|---|
| **책임** | frontmatter schema (scope/aspect/depth/tier/lifecycle/layer), link relationships (9 종 linkType), level/level-violation, domain_root 파생에 필요한 의미 관계 유지 |
| **경계** | workflow 가정을 인코딩하지 않는다. 예: "부모는 자식을 `contains` 로 선언해야 한다" 같은 관례는 규칙이 아니라 convention — 규칙으로 승격할 때는 validator 와 workflow 양쪽에서 검증되어야 한다 |
| **의존 방향** | 없음. L1 은 가장 하단 — 다른 계층이 L1 에 의존한다 |
| **검증** | `qa-sdk def sync` 성공 + link target 존재 + frontmatter schema 통과 (L2 가 수행) |
| **위반 예시** | `links: [{ target: x, type: contains }]` 를 tier:system 이 선언 (= `system-contains-system` 에러), `.cases.md` 가 `^overview` 대신 ad-hoc 헤더 사용 |

### 1.2 L2 — Validator Layer

SSoT: `packages/definition-catalog/src/validate.ts` 와 `*.rule.md` 에 기술된 taxonomy 규칙.

| 항목 | 내용 |
|---|---|
| **책임** | 구조적 불변식 — cycles (`depends_on`/`implements`/`refines`), schema 준수, 좌표 유일성, tier × linkType 제약 (layout:refs, system:no-contains, component:no-children 등), `@def.boundary` 타깃 제약 |
| **경계** | UX / workflow 결과를 판정하지 않는다. "도메인 루트가 멤버를 드러내는가?", "rule 문서가 발견 가능한가?" 같은 workflow 질문은 L3 책임이다. integration test 를 대체하지 않는다 |
| **의존 방향** | L1 frontmatter 를 입력으로 받는다. L3/L4 가 이 결과를 소비할 수 있으나, L2 는 그들의 존재를 알지 않는다 |
| **검증** | `packages/definition-catalog/src/validate.test.ts` + 대표 실패 fixture. `pnpm exec qa-sdk def validate` 가 errors=0 을 유지 |
| **위반 예시** | validator-green 만 근거로 "시스템 정상" 선언; workflow 관점의 empty 결과를 error 로 감지하라고 validator 에게 요구 (계층 혼동) |

### 1.3 L3 — Workflow Layer

SSoT: CLI 명령 (`packages/cli/src/commands/*.ts`), skill 문서 (`skills/*/SKILL.md`, `docs/skills/*.md`), 실제 사용자 워크플로우.

| 항목 | 내용 |
|---|---|
| **책임** | 사용자 경험 — `def topdown`, `def list`, `def audit --by-domain`, `def find-by-file`, skill-guided discovery. entry-point 가 의미 있는 결과를 반환하도록 보장 |
| **경계** | frontmatter 스키마를 직접 변경하지 않는다. L1/L2 를 registry / audit API (`collectDomainMembers`, `deriveAllDomainRoots`, `DefDataSource`) 를 통해 소비한다 |
| **의존 방향** | L1 ← L2 ← **L3**. 상위 계층은 하위 계층 규약을 가정한다 |
| **검증** | workflow smoke suite — `packages/cli/src/workflow-smoke.test.ts`. 대표 시나리오에 대해 "도메인 루트 토폴로지는 비어있지 않다" / "rule 필터는 ≥8 건" / "boundary 주석 타깃은 DB 에 존재한다" 식의 **non-empty assertion** 유지 |
| **위반 예시** | `def topdown <core root>` → 0 건을 "정상 출력" 으로 취급하여 PR merge. skill 예시가 현재 데이터와 불일치하는데 업데이트 없음 (selector-review Gap #8). silent empty 를 "데이터 미존재" 로 해석 |

### 1.4 L4 — Tooling / Integration Layer

SSoT: 소스 코드 주석 (`@def.boundary`, `@def.doc`), 에디터 통합, 외부 스크립트, git-hook, CI pipeline 가드.

| 항목 | 내용 |
|---|---|
| **책임** | code ↔ spec round-trip, annotation 유효성, 에디터/IDE 통합, 외부 도구의 CLI 출력 파싱 |
| **경계** | L3 의 진화를 허용한다. CLI 출력 포맷 변경에 대비하여 `--json` 출력을 소비하거나 버전 협상으로 해결. frontmatter 를 직접 수정하지 않는다 |
| **의존 방향** | L1 ← L2 ← L3 ← **L4**. 가장 상단이며 L3 의 계약을 가정한다 |
| **검증** | `@def.boundary` 주석이 **존재하고** + **deprecated 가 아닌** spec 을 가리키는지 감사. Workflow smoke Scenario E 로 샘플 검증. `def find-by-file` round-trip 성공률 (`def code-link-gaps` coverage) |
| **위반 예시** | `@def.boundary decode-service-spec` (실제는 `decode-service-system` 로 이전됨 — selector-review Gap #2). CLI 텍스트 출력에 정규식으로 의존하여 `def list` 포맷 변경 시 외부 파이프라인 침묵 붕괴 |

### 1.5 의존 방향 요약

```
L1 (Data)  ←  L2 (Validator)  ←  L3 (Workflow)  ←  L4 (Tooling)
```

- 상위 계층은 하위 계층의 계약을 가정한다. 역참조 금지.
- 각 계층은 **독립적으로 테스트 가능** 해야 한다. 하위 계층 단독 green ≠ 전체 green.

---

## 2. 재발 방지 원칙 (Workflow Smoke 원칙)

Phase 3b Option B 사건의 근본 교훈 3가지를 구속력 있는 원칙으로 고정한다.

### 2.1 원칙 — "Semantic data change ⇒ workflow smoke re-verify"

**규칙**: L1 의 semantic change (예: parent→child `depends_on` 제거, link 의미 반전, tier 재정의) 는 L3 workflow smoke suite 재실행 + 결과 검토 전에 merge 하지 않는다.

- validator pass 는 **필요 조건** 일 뿐 충분 조건이 아니다.
- 변경 PR 은 smoke suite 결과를 diff 에 첨부하거나 CI 로 강제한다.

### 2.2 원칙 — "Union > single path"

**규칙**: 한 질문에 여러 semantic 경로가 타당할 때 (예: "A 가 B 의 멤버인가?" — contains 순방향 / depends_on 역방향 / refines 역방향 모두 후보), L3 탐색은 **세 경로의 OR union** 을 반환한다.

- 단일 경로 선택은 migration 중에는 false-negative 를 낳고, migration 후에도 데이터 레이아웃 이질성을 견디지 못한다.
- 구현 근거: `collectDomainMembers()` (`packages/cli/src/commands/def.ts:829`) — contains 순방향 + depends_on/refines 역방향 union.

### 2.3 원칙 — "Silent empty should warn, not be absence"

**규칙**: L3 명령이 **well-known entry-point** (예: 등록된 도메인 루트) 에 대해 빈 결과를 내면, 사용자에게 **warning 문구** 를 함께 출력하고 smoke suite 에서 **non-empty assertion 으로 차단** 한다.

- empty 는 "데이터가 없다" 와 "경로가 끊겼다" 를 구분하지 못한다 — silent 는 후자를 전자로 오독하게 만든다.
- `def topdown` 이 0 member 를 반환할 때 이제 `(멤버 없음 — contains/depends_on/refines 링크 부재)` hint 를 출력한다 (`def.ts:874-877`).
- smoke suite 는 핵심 루트 (`gate-system`, `apm-system`, `df-system`, `ingest-system`, `decode-system`) 에서 `≥ N members` 를 요구한다.

---

## 3. 검증

> 자동화: `.github/workflows/def-gate.yml` 이 PR 에서 §3.1 (`def sync` + `def validate`), §3.2 의 `aspect-parents` + `workflow-smoke` 를 강제한다. 실패 시 merge 차단.

### 3.1 L2 validator (structural)

```bash
pnpm exec qa-sdk def sync
pnpm exec qa-sdk def validate
# errors == 0 유지
```

### 3.2 L3 workflow smoke

```bash
pnpm --filter @qa-sdk/cli test -- workflow-smoke
```

아래 5 Scenario 모두 통과 필수:

- **A** `def audit --by-domain` 에 핵심 루트 (`gate-system`, `apm-system`, `df-system`, `ingest-system`, `decode-system`) 가 모두 등장하고 문서 수 > 0.
- **B** 핵심 루트 4 건에 대해 `collectDomainMembers` ≥ 2 건.
- **C** `def list --domain-root gate-system|apm-system` ≥ 3 건.
- **D** `def list --type=rule` ≥ 8 건 (현재 19 건).
- **E** 샘플 소스 파일 3건의 `@def.boundary` 타깃이 DB 에 존재하며 `deprecated` 가 아님.

### 3.3 L4 tooling round-trip

```bash
pnpm exec qa-sdk def find-by-file <path>
pnpm exec qa-sdk def code-link-gaps --json
# unlinkedFiles 감소 추세, deprecated 타깃 발견 시 stderr 경고
```

### 3.4 리뷰 체크리스트

새 PR 리뷰 시:

- [ ] L1 데이터 변경 → L2 validator green 재확인
- [ ] L1 semantic 변경 → L3 workflow smoke 재실행 + 결과 diff
- [ ] L3 신규 CLI 플래그/서브커맨드 → smoke suite 에 non-empty assertion 추가
- [ ] L4 `@def.boundary` 추가/변경 → 타깃이 approved lifecycle 인지 확인 + smoke suite Scenario E 에서 sampling 되는지 검토

---

## 4. 예외

| 예외 | 정당화 |
|---|---|
| RFC 중간 phase 에서 smoke suite 일시 red | RFC 문서에 red 상태와 해소 timeline 을 명시. 예: Phase 3a (14 error 일시 허용 후 revert) |
| 신규 도메인 루트 등장 직후 smoke 미반영 | 후속 PR 에서 "핵심 루트" 집합 업데이트. 다만 suite 는 "5 개 이상" 의 floor 를 유지 |
| L4 외부 도구가 레거시 text 포맷 의존 | `--json` 출력으로 이행 후 유예 기간 기록. 유예 만료 시점은 PR 에 명시 |

---

## 5. 근거

- [selector-review §2.3 / §5 Gap #1 / Gap #8](../../proposals/domain-hierarchy/reviews/2026-04-21-selector-review.md) — `def topdown gate-system` 0 member silent regression 증거
- [selector-fixes §1.2 / §1.3](../../proposals/domain-hierarchy/reviews/2026-04-21-selector-fixes.md) — `collectDomainMembers` union 도입과 실측 복구
- `packages/cli/src/commands/def.ts:829-861` — `collectDomainMembers` 구현 (Union 원칙)
- `packages/cli/src/commands/def.ts:874-877` — `(멤버 없음 — contains/depends_on/refines 링크 부재)` hint (Silent-empty-warn)
- [link-type-usage.rule.md §1.4](./link-type-usage.rule.md) — domain_root 파생 우선순위 (`refines > depends_on`)
- [cases-md-convention.rule.md](./cases-md-convention.rule.md) — consumer/provider 계층 분리 (L3 workflow 의 L1 모델링)
- `packages/cli/src/workflow-smoke.test.ts` — 5 Scenario smoke suite (본 규칙의 자동 검증)
