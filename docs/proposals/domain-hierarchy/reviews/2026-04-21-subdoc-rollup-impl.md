---
def:
  id: domain-hierarchy-subdoc-rollup-impl
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
    - target: domain-hierarchy-subdoc-rollup-simulation
      type: depends_on
status: implemented
date: 2026-04-21
part_of: domain-hierarchy
role: implementation-report
---

# Sub-document Rollup 구현 보고 — Hybrid D > A > C 적용

## 목적 ^purpose

이 문서는 Sub-document Rollup 구현 보고 — Hybrid D > A > C 적용에 대한 제안·검토 기록을 보존하고, 관련 설계 판단과 후속 작업의 근거를 제공한다.

선행 시뮬레이션: [`2026-04-21-subdoc-rollup-simulation.md`](./2026-04-21-subdoc-rollup-simulation.md).
판정 GO 후 `deriveDomainRoot` 를 확장 구현한 결과를 정리한다.

## §1 Source_path 접근성 결론

`DefinitionEntry.ref` 필드(`packages/definition-catalog/src/types.ts:430`) 가 이미 file path 를 보존한다. `registry-helpers.ts#docRowToRegistryInput` 가 DB row 의 `sourcePath` 컬럼을 `ref` 로 매핑한다. **별도 타입 변경 없이 3 전략 모두 catalog 레이어 안에서 구현 가능**.

## §2 구현 요약

### 2.1 알고리즘 변경점

`deriveDomainRoot` 의 기본 walk(`refines > depends_on` outgoing) 가 **self** 로 귀결한 경우에 한해 sub-doc rollup 을 시도한다. 다음 두 조건을 모두 만족해야 한다:

1. `tier === "component"` (system / layout / entry / exempt 는 기존 그대로)
2. `ref` 가 sub-doc 확장자 (`.todo.md / .plan.md / .memo.md / .test.md / .cases.md / .rule.md`) 로 끝남

위 조건이 만족되지 않거나 모든 전략이 실패하면 self 반환 — backward compat 유지.

### 2.2 Strategy 구현

| 전략 | 헬퍼 | 설명 |
|------|------|------|
| **D — id-prefix** | `stripSubDocIdSuffix` | `foo-todo` → `foo` 탐색. 못 찾으면 `foo-system`, `foo-spec` fallback 시도 |
| **A — contains-inverse** | `collectContainsParents` + `selectSubDocParent` | 이 문서를 `contains` 하는 부모 중 system tier 우선, 동률이면 id 오름차순 |
| **C — file co-location** | `findCoLocatedSpec` | `foo.todo.md` ↔ 같은 디렉토리의 `foo.spec.md` 또는 `foo.md` (sub-doc 형제는 제외) |

각 전략은 부모를 찾으면 `deriveDomainRoot` 로 재귀 위임 — 동일한 visited / depth cap 적용. Strategy B (traces_to walk) 는 시뮬레이션 §5.2 결과(`definition-catalog-spec` 24.3% 흡수)에 근거해 의도적으로 미구현.

### 2.3 결정론

- D: `SUB_DOC_FALLBACK_SUFFIXES` 순서 고정 (`""`, `"-system"`, `"-spec"`)
- A: tier rank → id localeCompare
- C: candidate path 순서 고정 (`{stem}.spec.md`, `{stem}.md`), sibling 다중 시 id localeCompare

## §3 변경 파일

| 파일 | LOC | 비고 |
|------|-----|------|
| `packages/definition-catalog/src/domain-root.ts` | +130 | `SUB_DOC_EXTENSIONS`, `deriveSubDocRoot`, helpers |
| `packages/definition-catalog/src/index.ts` | +2 | `deriveSubDocRoot`, `SUB_DOC_EXTENSIONS` export |
| `packages/definition-catalog/src/domain-root.test.ts` | +260 | 19 신규 테스트 |

## §4 테스트 결과 (L1-L4)

### L1 — Data
변경 없음. frontmatter 미수정.

### L2 — Validator
```
$ pnpm exec qa-sdk def validate
[local] ✓ 검증 통과 (경고 1건)
[warning]
  bdd-contract-cli-rule: 어디에서도 참조되지 않는 고아 문서
```
0 errors. 기존 1 warning 변동 없음.

### L3 — Workflow
- `domain-root.test.ts`: **51/51 pass** (기존 32 + 신규 19)
- `aspect-parents.test.ts`: 5/5 pass (invariant 무변경)
- `workflow-smoke.test.ts`: **13/13 pass** (CLI smoke 무변경)
- definition-catalog 전체: 27 failures 모두 pre-existing (frontmatter drift, registry stats — 본 변경과 무관). 사전 stash 확인.

### L4 — Tooling
- `def doctor`: 0 errors / 1 warning (변경 전과 동일)
- `def sync`: 1253 docs / 3239 links — 정상

## §5 커버리지 측정

본 패키지에 임시 스크립트(`measure-rollup.mjs`, 보고 후 삭제) 로 동일 DB 에서 baseline walk vs extended algorithm 직접 비교.

| 지표 | Baseline | Extended (이 PR) | 시뮬 예측 | 시뮬 대비 |
|------|----------|------------------|----------|-----------|
| Sub-docs 총 | 136 | 136 | 136 | — |
| Rollup 성공 | 60 | **114** | 103 | +11 |
| **Coverage** | **44.1%** | **83.8%** | 75.7% | **+8.1pt** |
| Self-root | 76 | 22 | 33 | -11 |
| Max absorb | 10.3% | 14.0% | 11.0% | +3.0pt |

Top-10 roots (Extended):

```
storage-system: 19
definition-catalog-spec: 17
rlsc: 11
gate-system: 10
registry-system: 6
scope-nesting-system: 6
operational-ontology-system: 6
meta-semantic-system: 5
df-system: 5
system-support: 4
```

### 5.1 시뮬레이션 대비 +8.1pt 초과 분석

시뮬레이션은 self-root sub-docs 만 대상으로 한 가설 알고리즘이었고, 실제 구현은 **기본 walk 가 self 로 귀결한 모든 component sub-doc** 에 fallback 을 적용한다. 두 정의가 정확히 일치하지 않아 추가 흡수가 발생.

추가 흡수의 의미적 정당성 spot check:
- `storage-system` 19건 (vs 시뮬 11건): D 전략이 `storage-*-todo / -plan / -cases` 류를 추가 흡수 — 의미 정합.
- 과흡수 14.0% 는 Phase 0 ceiling(20%) 대비 안전. 단일 root 가 30% 이상을 흡수하지 않으므로 grouping 정체성 파괴 없음.

## §6 시뮬레이션 대비 차이 정리

| 항목 | 시뮬 가정 | 실제 구현 | 비고 |
|------|----------|----------|------|
| 적용 대상 | self-root sub-docs 만 | 기본 walk 가 self → 모든 component sub-docs | 더 광범위 — 자연스러운 결과 |
| 우선순위 | D > A > C | 동일 | — |
| Strategy B | 거부 | 미구현 | 의도된 결정 |
| `source_path` 접근 | 별도 인덱스 가능성 언급 | `DefinitionEntry.ref` 직접 사용 | 기존 필드 활용으로 마찰 0 |
| `selectSubDocParent` tiebreak | system > layout > localeCompare | 동일 | — |

## §7 후속 권고

- **운영 문서 정합**: 시뮬 §5.4 의 self-root 잔존 33건 중 `event-taxonomy-roadmap-plan` 류처럼 대응 spec 이 없는 8건은 spec 작성 또는 frontmatter `owner_system` 보완으로 해결.
- **`docs/specs/system/*.rule.md` (10건)**: `system-specs-rules-index` 같은 group doc 도입 시 A 전략으로 자동 흡수.
- **회귀 보호**: `deriveAllDomainRoots` 결과를 snapshot 으로 저장해 향후 변경 시 비교하면 regression 조기 발견 가능 (별도 PR).

## §8 산출물 인덱스

- 본 보고: `docs/proposals/domain-hierarchy/reviews/2026-04-21-subdoc-rollup-impl.md`
- 시뮬레이션: `docs/proposals/domain-hierarchy/reviews/2026-04-21-subdoc-rollup-simulation.md`
- 시뮬레이션 스크립트: `/tmp/subdoc-rollup-sim.ts` (영속 안 함)
- 구현: `packages/definition-catalog/src/domain-root.ts`
- 테스트: `packages/definition-catalog/src/domain-root.test.ts`
