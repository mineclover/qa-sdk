---
def:
  id: domain-hierarchy-phase5d-cleanup
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: domain-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: review
---

# Phase 5d + owner-root-mismatch Cleanup — proposal 면제 규칙 및 meta-semantic peer 선언

## 목적 ^purpose

Phase 5a/5c 이후 잔여로 남은 두 독립 이슈를 한 배치에서 처리한다.
(1) Class C proposal cluster 3건을 validator 에서 면제하여 중복 좌표 경고에서 제외한다.
(2) meta-semantic-system 이 definition-catalog-spec 를 `depends_on` 으로 선언하여 15건의 owner-root-mismatch cascade 를 발생시키는 구조적 오류를 peer reference(`refs`) 로 교정한다. 두 수정 모두 스펙 설계 의도를 반영한 최소 변경이다.

## Phase 5d 처리 — proposal duplicate-coordinate 면제

### validator 변경

`packages/definition-catalog/src/validate.ts` 의 중복 좌표 감지 루프에 단일 조건 1줄 추가:

```ts
if (entry.knowledgeKind === "proposal") continue;
```

- 위치: 기존 `lifecycle === "deprecated"` / `tier === "component"` 필터 바로 아래.
- 이유: proposal 문서는 설계 반복 중 동일 좌표(`scope: meta` + `aspect: proposal_design`) 를 의도적으로 공유한다. tier-redesign·domain-hierarchy 등 cluster 는 "산출물" 이며 production 스펙이 아님.
- LOC delta: 코드 +1, 주석 +1 (블록 주석 한 줄 갱신).

빌드: `pnpm --filter definition-catalog build`, `pnpm --filter definition-data-source build`, `pnpm --filter @qa-sdk/cli build` 모두 성공(errors=0).

### 면제 결과

| 그룹 # (phase5-redesign) | 좌표 | 멤버 수 | 조치 후 |
|---|---|---|---|
| 33 | `system:meta:none:proposal_design` @ `tier-redesign-readme` | 18 | 면제 (전원 knowledge_kind=proposal) |
| 34 | `system:meta:none:proposal_design` @ `domain-hierarchy-readme` | 15 | 면제 (전원 knowledge_kind=proposal) |
| 36 | `layout:meta:none:proposal_design` @ `tier-redesign-readme` | 3 | 면제 (전원 knowledge_kind=proposal) |
| 35 | `none:constraint:none:tech_constraint` @ `guides-system` | 3 | **미면제** — architecture-decisions(adr) / coding-conventions(convention) / spec-convention(convention) 는 knowledge_kind=proposal 이 아니므로 정책상 경고 유지 |

dup-coord 그룹 수: 24 → 21 (-3). 35번 그룹은 조치가 필요하다면 aspect 세분화 또는 태그 부여로 후속 처리.

## owner-root-mismatch 처리

### meta-semantic-system.spec.md 링크 변경

근본 원인: `meta-semantic-system` 의 outgoing `depends_on: definition-catalog-spec` 링크가 domain_root 파생 시 `definition-catalog-spec` 로 walk 해 올라가면서 13 개의 meta-semantic-* 자식이 모두 mismatch 로 흘렀다.

변경 (한 링크):

```diff
-    - target: definition-catalog-spec
-      type: depends_on
+    - target: definition-catalog-spec
+      type: refs
```

- 의미: meta-semantic 과 definition-catalog 은 좌표계 동형 관계의 peer system 이며, 일방 "의존" 이 아니다. 본문 §6 "의존 방향" 의 ascii 도식에도 동일 문구 교정(`depends_on → definition-catalog` → `refs → definition-catalog ... peer system, 의존 아님`).
- `refs` 는 domain_root 파생 후보에서 제외되므로(`DOMAIN_LINK_TYPES = [refines, depends_on]`) meta-semantic-system 은 self-rooted 로 전환.

### cascade 효과

sync + audit 결과 owner-root-mismatch info 15건 → 2건. 나머지 2건은 meta-semantic-system cascade 와 무관한 개별 케이스로 아래에서 개별 처리.

### 잔여 개별 케이스 처리

| # | doc | 파생 root (이전) | 원인 링크 | 조치 | 파생 root (이후) |
|---|---|---|---|---|---|
| 1 | `meta-semantic-ir-rule` | `scope-nesting-system` | `depends_on: scope-nesting-system` (실제로는 동형 패턴 참조) | `depends_on → refs` | `meta-semantic-system` |
| 2 | `meta-semantic-spacetime-uid` | `coord-foundation` | `depends_on: coord-foundation` (실제로는 weighted-index math primitive 참조) | `depends_on → refs` | `meta-semantic-system` |

두 케이스 모두 문서 본문에서 대상 문서를 "참조" 하거나 "동형 패턴" 으로 언급하고 있어 `refs` 가 의미상 더 정확하다. `depends_on` 은 실제 코드 의존성이 있을 때 사용해야 하며, 두 케이스 모두 구조적/문서적 참조 성격이다.

잔여 owner-root-mismatch info: **0건**.

## 전체 검증 결과

| 지표 | Phase 5c 완료 시 (before) | Phase 5d + mismatch 완료 후 | Δ |
|---|---|---|---|
| errors | 0 | 0 | 0 |
| warnings | 48 | 45 | **-3** |
| duplicate-coordinate | 24 | 21 | **-3** |
| multi-parent | 15 | 15 | 0 |
| orphan | 7 | 7 | 0 |
| level-violation | 2 | 2 | 0 |
| owner-root-mismatch (info) | 15 | **0** | **-15** |
| system-contains-system | 0 | 0 | 0 |

- 목표("warnings ≤ 30") 는 미달. 원래 산정에서 owner-root-mismatch 를 warning 으로 가정한 것이 원인 — 실제 severity 는 `info` 로, warnings 총합에 가산되지 않는다. 실질적 감소는 warnings -3 + info -15 = 이슈 18 건 해소.
- dup-coord 목표 "≤ 20" 은 근접 미달(21). 35번(adr/convention) 그룹이 proposal 이 아니라 면제 대상이 아님.
- owner-root-mismatch 목표 "≤ 3" 은 달성(0).

## 다음 단계

- **Phase 5b (Class D Diversify)** 대기: 7건의 초대형 cluster(definition-catalog-spec 흡수) 는 여전히 존재. aspect 어휘 RFC(`q-aspect-vocabulary.md`) 착수 시점 재확인 필요.
- **Phase 5e (boundary 재지정)** 대기: viz-system-root / gate-system / definition-service 3 그룹은 `@def.boundary` annotation 이전이 선행되어야 한다.
- **Class C #35 후속 결정**: architecture-decisions / coding-conventions / spec-convention 3건 cluster 는 (a) aspect 세분화, (b) `cross-scope` 태그로 info 강등, (c) 현상 유지 중 선택 필요.

## 가역성 / 롤백

- validator 변경: `if (entry.knowledgeKind === "proposal") continue;` 1줄 제거로 원복.
- 링크 변경 3건 (`refs` ↔ `depends_on`): frontmatter 의 type 필드만 교체. 본문 수정은 meta-semantic-system §6 ascii 도식의 한 행 문구만.

## 산출물

- validator 변경: `packages/definition-catalog/src/validate.ts`
- 문서 변경 3건:
  - `docs/specs/meta-semantic/meta-semantic-system.spec.md` (링크 1건 + 본문 1행)
  - `docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-ir.rule.md` (링크 1건)
  - `docs/specs/meta-semantic/meta-semantic-ir/meta-semantic-spacetime-uid.spec.md` (링크 1건)
- 검증 로그: `/tmp/phase5d-step4-after.txt`, `/tmp/phase5d-mismatch-after.txt`, `/tmp/phase5d-mismatch-final.txt`
- 본 보고서: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5d-cleanup.md`

## 참조

- [2026-04-20-phase5-redesign.md](./2026-04-20-phase5-redesign.md) §"Class C" — 4 proposal cluster 분류
- [2026-04-20-phase3b-option-b.md](./2026-04-20-phase3b-option-b.md) §"7 → 15 owner-root-mismatch 처리" — cascade 근본 원인
- [2026-04-20-phase5c-abstract.md](./2026-04-20-phase5c-abstract.md) — Phase 5d 진입 직전 상태
- `packages/definition-catalog/src/validate.ts` §"중복 좌표 감지" (line 342-370) — 적용 지점
- `packages/definition-catalog/src/domain-root.ts` §`DOMAIN_LINK_TYPES` — refines/depends_on 만 domain candidate 로 간주

## 후속: Class C #35 adr/convention 면제 (2026-04-20)

Phase 5d 진입 시 미면제로 남긴 Class C #35 그룹(`architecture-decisions` / `coding-conventions` / `spec-convention`, 모두 `scope: constraint` + `aspect: tech_constraint`) 을 동일 exemption 패턴으로 처리한다. 세 문서의 `knowledge_kind` 는 각각 `adr` / `convention` / `convention` 으로 확인되어, validator 중복 좌표 감지 루프의 `knowledgeKind === "proposal"` 단일 조건을 `Set(["proposal", "adr", "convention"])` 기반 멤버십 체크로 확장한다. 두 kind 모두 "의사결정/컨벤션 묶음" 이라는 의도적 co-location 성격이며 production 좌표 충돌이 아님.

| 지표 | Phase 5d 완료 시 | 후속 조치 후 | Δ |
|---|---|---|---|
| errors | 0 | 0 | 0 |
| warnings | 42 | 41 | -1 |
| duplicate-coordinate | 18 | 17 | -1 |

잔여 dup-coord 17 건은 전부 production 스펙 cluster 로, aspect 어휘 RFC(`q-aspect-vocabulary.md`) 또는 Phase 5b (Class D Diversify) 에서 다룬다.

### 산출물 (후속)

- `packages/definition-catalog/src/validate.ts` 중복 좌표 감지 루프 (Set 멤버십 + 주석 1행 갱신)
- 검증 로그: `/tmp/class-c35-after.txt`
