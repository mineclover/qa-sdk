---
name: semantic-change
description: "qa-sdk 좌표계/링크 구조 semantic 변경 시 따라야 할 체크리스트. Option B 사례처럼 validator-green + UX-broken 회귀를 방지한다."
---

# Semantic-Change Playbook

## 목적

좌표 세분화, 링크 타입 방향 변경, tier 승격 등 semantic 변경은 `def validate` 통과 ≠ 시스템 healthy 다. 4 계층 (L1 Data / L2 Validator / L3 Workflow / L4 Tooling) 각 층에서 검증이 필요하며, 본 skill 은 그 공통 체크리스트를 제공한다.

근거: Phase 3b Option B (2026-04-20) 에서 parent→child `depends_on` 제거 직후 `def validate` 는 계속 green 이었으나, `def topdown gate-system` 이 0 member 를 반환하면서 신규 contributor entry-point 가 침묵하며 붕괴했다. 80+ commits 후 workflow-smoke test 로 뒤늦게 발견됨. 본 playbook 은 동일 유형 회귀를 막기 위한 재사용 가능한 절차다.

## 트리거

다음 변경을 제안/실행할 때 본 skill 을 호출한다:

- aspect 값 추가/제거/분할 (Phase B 계열)
- scope / tier 정의 변경 (tier 승격, layout↔system 이동)
- link type 방향/의미 재정의 (`refines > depends_on` 우선순위 변경 등)
- validator rule 추가 / suppression 수단 도입
- `domain_root` / `aspect_parent` 파생 알고리즘 수정
- 대량 frontmatter 마이그레이션 (>5 문서 또는 구조적 링크)

## 관련 Rule (먼저 읽기)

- `docs/specs/system/layer-separation.rule.md` — 4 계층 책임 정의 + workflow smoke 원칙
- `docs/specs/system/change-simulation-precedence.rule.md` — Phase 0 시뮬레이션 선행 규율
- `docs/specs/system/link-type-usage.rule.md` — 9종 linkType 결정 매트릭스 + 안티패턴
- `docs/specs/system/validator-suppression-tags.rule.md` — 억제 수단 전수 목록

---

## 체크리스트

### Step 1 — 영향 분석 (pre-implementation)

- [ ] 변경이 **L1 Data 만** touching 인지, **L2 Validator** 까지 cascade 인지, **L3 Workflow / L4 Tooling** 까지 파급인지 판정
- [ ] 암묵 가정 탐색 — 기존 CLI / skill / 외부 도구 가 어떤 데이터 shape 를 가정하는가?
  - `collectDomainMembers` 는 contains ∪ depends_on← ∪ refines← 를 기대
  - `collectDocumentFamilyOnlyScope` 는 same-family role docs + `tier: system`/legacy group/module `contains` + layout `refs` 를 기대
  - `@def.boundary` 는 `tier: system | layout` 을 기대
  - `deriveDomainRoot` 는 outgoing `refines` / `depends_on` 만 walk
- [ ] 역방향 데이터 참조 (reverse index, incoming link walk) 가 의존하는가?
- [ ] 외부 tooling (`@def.boundary` 주석, `@def.doc` 주석, CLI 출력 파싱) 영향?

### Step 2 — 시뮬레이션 (simulate-first)

`docs/specs/system/change-simulation-precedence.rule.md` §1.1 대상이면 필수.

- [ ] `/tmp/<change>-simulation.ts` 스크립트로 실제 DB 재현 (하드코딩 금지)
- [ ] **Before/After 지표 표** — dup-coord, orphan, multi-parent, system-contains-system 카운트
- [ ] Go/No-Go 판정 + 사전 정의된 성공 기준 (예: "30 → ≤8")
- [ ] 리스크 / 가정 / rollback 경로 기록
- [ ] 다중 알고리즘 비교 — 설계 선택이 있다면 (예: Phase 0/0b/0c primary-parent 3회 iteration)
- [ ] 산출물 영속화: `docs/proposals/<topic>/reviews/<date>-<phase>-simulation.md`

한 번에 Go 가 안 나오면 **가설 수정 후 재시뮬**. 코드 커밋은 Go 이후에만.

### Step 3 — 계층별 검증 (post-implementation)

**L1 Data**:
- [ ] `qa-sdk def sync` 성공 (DB 적재)
- [ ] schema 불변식 통과 — `pnpm --filter definition-catalog test aspect-parents` 등

**L2 Validator**:
- [ ] `qa-sdk def validate` errors = 0 유지
- [ ] `pnpm --filter definition-catalog test validate` 회귀 없음
- [ ] 새 suppression 수단이 필요하다면 `validator-suppression-tags.rule.md` 를 **먼저** 업데이트

**L3 Workflow**:
- [ ] `pnpm --filter @qa-sdk/cli test -- workflow-smoke` 전부 통과
- [ ] `def topdown <core-root>` 가 silent empty 가 아님 (≥1 member)
- [ ] `def list --type=rule` 이 ≥8 건 유지
- [ ] `def doctor` 의 Core / Domains / Aspects / Annotations 4 섹션 모두 0 error

**L4 Tooling**:
- [ ] `@def.boundary` 주석 타깃이 실존 + `lifecycle != deprecated`
- [ ] `@def.doc` 주석 타깃 재검증 (`qa-sdk def code-link-gaps --json`)
- [ ] 외부 스크립트가 CLI 텍스트 포맷에 의존한다면 `--json` 모드로 이행되었는지 확인

### Step 4 — Union > single path (설계 원칙)

새 traversal / query 를 도입할 때 L3 workflow 에서는 단일 경로 의존을 피한다.

- [ ] 단일 edge-type 의존 금지 (contains only, depends_on only 등)
- [ ] 최소 2 개 edge-type 조합 허용 — migration 중 데이터 이질성 수용
- [ ] 예: `collectDomainMembers` = (contains 순방향) ∪ (depends_on 역방향) ∪ (refines 역방향)
- [ ] Layout/Pack 탐색은 `refs`도 family scope에 포함해야 한다
- [ ] silent empty 는 사용자에게 warning hint 출력 (예: `(멤버 없음 — contains/depends_on/refines 링크 부재)`)

### Step 5 — 커밋 원칙

- [ ] 각 commit 이 validator-green (중간 broken state 금지; RFC red 구간은 review 보고서에 timeline 명시)
- [ ] 도메인 배치 단위 commit (apm, df, gate, ingest 등 — 검토 가능한 크기)
- [ ] 롤백 경로 문서화 — 단일 커밋 revert 로 복구 가능한가?
- [ ] Smoke suite 결과를 PR description 에 첨부 (또는 CI 강제)

---

## 실패 모드 매트릭스

| 신호 | 의미 | 조치 |
|------|------|------|
| validator green but `def topdown X` = 0 | L3 workflow 가정 깨짐 (Option B 패턴) | `collectDomainMembers` union 확인, smoke 추가 |
| warning 증가 but 모두 **예측된** category | correctness signal — accept | 리뷰 보고서에 Before/After 기록 |
| warning 증가 + **unexpected** category | 실제 drift — rollback 후 가설 재검토 | 시뮬 재실행, 규칙 재설계 |
| `def doctor` Annotations `deprecated` > 0 | `@def.boundary` 가 폐기 스펙 가리킴 | 주석 수정 또는 타깃 lifecycle 복구 |
| `def audit --by-domain` 에서 핵심 루트 사라짐 | `deriveDomainRoot` 파생 경로 단절 | 시뮬로 path 재확인 |
| `def audit --by-domain` 에서 sub-docs 대부분 self-rooted | L3 rollup 구멍 — 알고리즘 extension 필요 | Phase 0 pattern 로 4 strategy 시뮬 → Hybrid 도입 |
| dup-coord 증가 but aspect 분할 intent | 재수렴 중간 상태 (의도적) | `knowledge_kind` / `cross-scope` / aspect 추가 분할로 해소 |

---

## Cascade 사례 매트릭스

변경 시작점이 L1/L2/L3/L4 중 어디이든, 다른 layer 까지 파급된다. 아래는 본 레포의 실 사례:

| 변경 시작점 | Layer cascade | 발견 방식 | 발견 지연 |
|-----------|-------------|---------|---------|
| Phase 3b Option B — parent→child `depends_on` 제거 (L1) | L3 workflow silent-fail | workflow-smoke test 추가 후 표면화 | 80+ commits |
| Phase 5e `@def.boundary` 재배선 (L4) | L1 data + L2 validator | validator 즉시 catch | 0 commits |
| Sub-doc rollup 확장 (L2 알고리즘) | L3 doctor 메트릭 변화 | `def doctor` + smoke 즉시 확인 | 0 commits |
| Phase 5b aspect split (L1 vocab) | L2 dup-coord 증가 | correctness signal (정예측) | N/A — RFC 에 사전 문서화 |

**교훈**:
- 시작점 = L1/L4 → 즉각 L2 catch (schema/validation)
- 시작점 = L1/L2 → L3 workflow 는 **지연 발견** (smoke 없으면 침묵)
- **workflow-smoke + CI def-gate** 가 유일한 L3 보호 장치

본 skill 의 Step 3 계층별 검증이 모든 layer 통과를 강제하는 이유.

근거:
- Option B: `docs/proposals/domain-hierarchy/reviews/2026-04-21-selector-review.md`, `-selector-fixes.md`
- Phase 5e boundary: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5e-boundary.md`
- Sub-doc rollup: `docs/proposals/domain-hierarchy/reviews/2026-04-21-subdoc-rollup-impl.md`, `-subdoc-rollup-simulation.md`
- Phase 5b aspect split: `docs/proposals/domain-hierarchy/reviews/2026-04-21-phase5b-exec.md`

---

## 사례 참조

- **Option B** (2026-04-20 Phase 3b): parent→child `depends_on` 제거. `def validate` 통과했으나 `def topdown gate-system` 이 silent 0 반환. Selector-review Gap #1 로 표면화 → Selector-fixes §1 에서 `collectDomainMembers` union 도입으로 복구.
  - 근거: `docs/proposals/domain-hierarchy/reviews/2026-04-21-selector-review.md`, `-selector-fixes.md`
- **Phase 5b** (2026-04-20 aspect 분할): dup-coord 가 17 → 20 으로 오히려 증가. RFC 02-impact §A.3 에서 사전 예고한 **재수렴 중간 상태** 였다 — correctness signal, not regression.
  - 근거: `docs/proposals/domain-hierarchy/reviews/2026-04-21-phase5b-exec.md`
- **Phase 0 3회 iteration** (2026-04-20): `deriveDomainRoot` primary-parent 알고리즘이 definition-catalog-spec 에 90건 오흡수 → 규칙 수정 후 재시뮬. 코드 커밋 전에 잡음.
  - 근거: `docs/specs/system/change-simulation-precedence.rule.md` §4.1

---

## 검증 (본 skill 자체)

- 본 playbook 을 실제 변경에서 사용했다면 PR description 에 "Step 1~5 체크리스트 수행" 기록.
- 새 실패 모드가 발견되면 §"실패 모드 매트릭스" 에 추가.
- 새 rule 문서가 추가되면 §"관련 Rule" 에 편입.
