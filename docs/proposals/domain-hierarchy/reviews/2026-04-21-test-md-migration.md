---
def:
  id: test-md-convention-migration
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
    - target: test-md-convention
      type: traces_to
    - target: domain-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: domain-hierarchy
role: review
---

# `.test.md` Convention Migration — 27 파일 정렬

## 목적 ^purpose

`test-md-convention.rule.md` (commit `f297fba1`) 성문화 직후, 27 개 `.test.md`
파일의 frontmatter drift를 규칙에 맞게 일괄 정렬한다. 동시에 규칙이 권장하는
`type: verifies` 링크 타입을 `VALID_LINK_TYPES` 어휘에 합류시켜 silent-drop
현상을 제거한다.

## 처리 대상

총 **27 파일** (find docs/specs -name "*.test.md" 기준).

| 분류 | 개수 | 비고 |
|------|------|------|
| 완전 준수 (수정 불필요) | 2 | `doc-envelope.test.md`, `ralph-tui-integration.test.md` — 이미 feature/scenario + verifies |
| 부분 준수 (링크 타입만) | 1 | `pipe-static-lineage.test.md` — 이미 feature/scenario, refines → verifies |
| 전체 마이그레이션 | 24 | scope + aspect + linkType (일부는 depth도) |

실제 마이그레이션 대상 **25 파일** (24 full + 1 link-only).

## 변경 summary

### scope: flow → feature (23 건)

모든 scope=flow 파일 대상. `decode-bigint`, `event-taxonomy-contracts`,
`gate-cache-invalidation`, `gate-consistency`, `gate-event-bus`,
`pipeline-aggregator`, `pipeline-cache`, `query-rule-migration`,
`service-control-plane-cleanup`, `rlsc-{canvas,context,encoder,grid,intent,metrics,monitor,pattern,query,relations}`,
`scope-nesting-{contract-timing,pattern-lifecycle,procedure,simulation-layers}`.

### aspect: user_scenario → scenario (23 건)

scope 변경과 짝. 동일 23 파일.

### depth: specification → validation (1 건)

`axis-projection.test.md` — 유일한 outlier였음.

### Link 타입 → verifies

| 기존 타입 | 개수 | 처리 |
|-----------|------|------|
| `refines` | 17 | 주 타겟 → `verifies` (전 변환) |
| `depends_on` | 6 | 주 타겟 → `verifies`. 단 `event-taxonomy-contracts` 의 2건 (`event-mapping-pack-spec`, `service-event-adoption-spec`) 과 `pipe-static-lineage` 의 `test-name-tokens` 는 실제 의존이므로 유지 |
| `traces_to` | 1 | `axis-projection` → `verifies` |
| 다중 target 전부 변환 | 2 | `service-control-plane-cleanup` 의 `realization-service-control-plane` + `service-manifest-cleanup-lane` 모두 `verifies` (공동 검증 대상) |
| 기존 `verifies` 유지 | 2 | `doc-envelope`, `ralph-tui-integration` |

총 `verifies` 링크: **25** (이중 타겟 파일 2 건 포함).

## Code 변경: `verifies` 어휘 합류

규칙 §1.5 가 `type: verifies` 를 권장하지만, `VALID_LINK_TYPES`
(frontmatter.ts), `LinkType` (types.ts), `LINK_TYPE.entries`
(vocabulary.ts) 에 미등록이어서 파서가 silent-drop 하고 있었다. 결과적으로
`.test.md` → spec 링크가 끊기며, 25 개 대상 spec 이 incoming 0 → orphan
warning 발생.

따라서 본 마이그레이션과 함께 세 SSOT 파일에 `"verifies"` 를 추가:

- `packages/definition-catalog/src/types.ts` §`LinkType` — 9→10 종
- `packages/definition-catalog/src/frontmatter.ts` §`VALID_LINK_TYPES` — Set 에 추가
- `packages/definition-catalog/src/vocabulary.ts` §`LINK_TYPE`
  - `entries` 배열에 `"verifies"` 추가
  - `capacity: 32` 유지 (nextPowerOf2(10 × 2 = 20) = 32, 여유)
  - `ko.verifies = "검증"`
  - JSDoc "8 entries, capacity 16" 오기 정정 → "10 entries, capacity 32"

cyclicTypes 집합 (`depends_on`, `implements`, `refines`) 에는 추가하지 않음
— `verifies` 는 방향성이 단방향(test → spec)이며 cycle 위험이 없다.

domain-root 파생 (refines/depends_on walk) 도 `verifies` 제외. test.md 의
incoming link 가 spec 을 parent 로 오인하는 것은 `cases-md-convention` 과
동일한 경계.

## Intentional skips

없음. 모든 27 파일이 provider-side 시나리오로 올바르게 분류되었다.

각 파일의 시나리오 블록을 샘플링한 결과, 모두 provider "나는 이렇게
동작한다" 관점이며 consumer "공급자에게 이걸 기대한다" (`.cases.md`) 관점
혼입은 발견되지 않았다. Fix-target 지시문이 암묵적이거나 생략된 것은 rule
§1.4 에 의거 정상.

## 검증 결과

### Validator

```
baseline (pre-migration):
  errors: 0, warnings: 2
  - bdd-contract-cli: component contains advice (pre-existing)
  - link-type-usage: 어디에서도 참조되지 않는 고아 문서 (pre-existing)

post-migration:
  errors: 0, warnings: 2  (동일)
```

`query-rule-migration`, `decode-bigint`, `rlsc-*` 등 25 개 spec 은 이전에는
`refines`/`depends_on` incoming 링크로 참조되다가 silent-drop 후 orphan
위험이 있었다. 어휘 합류로 `verifies` 링크가 정상 등록되어 orphan 0 건 유지.

### Rule compliance grep

```bash
grep -L "type: verifies" docs/specs/**/*.test.md → 0 건
grep -L "scope: feature" docs/specs/**/*.test.md → 0 건
grep -L "aspect: scenario" docs/specs/**/*.test.md → 0 건
grep -L "depth: validation" docs/specs/**/*.test.md → 0 건
```

**27/27 파일이 규칙 준수** — intentional skip 0 건.

### definition-catalog 테스트 회귀

```
pre-vocab-change:  26 failed | 584 passed (baseline)
post-vocab-change: 26 failed | 584 passed (동일)
```

어휘 확장이 regression을 도입하지 않음 (기존 26 failure는 assemble/scan-real/tag-coverage 등 무관 assertion drift — 2026-04-21 final-cleanup 보고서와 동일).

## 커밋 목록

| # | 주제 | 파일 |
|---|------|------|
| 1 | `feat(def): add verifies link type to vocabulary` | types.ts, frontmatter.ts, vocabulary.ts |
| 2 | `refactor(def): test-md convention migration — 25 .test.md` | 25 .test.md (scope/aspect/depth/linkType) |
| 3 | `docs(proposals): test-md migration report` | 본 보고서 |

## 파생 산출물

- 계획: `/tmp/test-md-migrate-plan.json` (27 항목 per-file patch spec)
- 어휘 확장: `link-type-usage.rule.md` §1.3 "silent pass" 언급은 이제 의미 없음 — 후속 문서 갱신 대상 (본 PR 후)

## 참조

- [test-md-convention.rule.md](../../specs/system/test-md-convention.rule.md) — 원본 규칙
- [link-type-usage.rule.md](../../specs/system/link-type-usage.rule.md) — §1.3 `verifies` 특례 (이제 정식 타입으로 승격)
- [2026-04-21-final-cleanup.md](./2026-04-21-final-cleanup.md) — 본 작업 직전 validator baseline 확정
- `packages/definition-catalog/src/vocabulary.ts` §`LINK_TYPE` — 10 entries
- `packages/definition-catalog/src/frontmatter.ts:186` — `VALID_LINK_TYPES` Set
