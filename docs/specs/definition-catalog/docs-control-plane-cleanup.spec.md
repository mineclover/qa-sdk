---
def:
  id: docs-control-plane-cleanup
  type: design
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  level: leaf
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: cli
  tags: [contract, cleanup, review]
  links:
    - target: docs-control-plane
      type: refines
    - target: docs-control-plane-rule
      type: depends_on
sources:
  - packages/cli/src/commands/docs.ts
  - packages/cli/src/lib/docs-control-plane/completed-record-review.ts
---

# Docs Control Plane Cleanup

## 목적 ^purpose

`qa-sdk docs cleanup ...` command family가 completed record candidate를 read-only로 검토하고, keep-as-evidence / archive-review / memo-conversion-review / promote-spec-review recommendation과 explicit cleanup planning/apply surface를 어떻게 제공하는지 정의한다. 이 문서는 cleanup review/plan/apply surface를 소유하며 unbounded cross-family lifecycle rewrite authority는 소유하지 않는다.

## 명령 표면 ^defines

| command | write authority | 역할 |
|---------|-----------------|------|
| `docs cleanup review` | read-only | repo/family/PRD scope의 completed record candidate를 모아 recommendation과 evidence bundle을 계산 |
| `docs cleanup plan` | dry-run only | target validation, proposed output path, preserved evidence paths, validation command를 가진 explicit cleanup plan 계산. `--all --recommended` 또는 `--all --action-map`으로 family/PRD/repo multi-record plan 가능 |
| `docs cleanup apply` | explicit write | validated cleanup move를 수행한다. 현재 `--action archive`, completed TODO 대상의 `--action memo-conversion`, completed PRD pair의 `--action memo-conversion`, completed TODO 대상의 `--action promote-spec`, `--action rewrite`를 지원하며, `--all --recommended` 또는 `--all --action-map`으로 family/PRD/repo batch apply 가능 |

## 구현 경계

- `commands/docs.ts` owns command parsing, scope resolution, output formatting, and error handling.
- `completed-record-review.ts` owns candidate grouping, recommendation heuristics, paired/family document correlation, and cleanup evidence summary.
- `completed-record-cleanup-plan.ts` owns dry-run cleanup target validation, proposed output path planning, validation commands, and warning generation.
- `completed-record-cleanup-apply.ts` owns cleanup write execution, no-overwrite validation, paired PRD archive moves, PRD memo-conversion paired handling, and moved-path reporting.

## 규칙

- cleanup review는 read-only다.
- cleanup plan은 dry-run only다. `--apply`는 unsupported-operation으로 거절한다.
- cleanup apply는 explicit write surface다. 현재는 `--action archive`, completed TODO 대상의 `--action memo-conversion`, completed PRD pair의 `--action memo-conversion`, completed TODO 대상의 `--action promote-spec`, `--action rewrite`를 허용한다.
- bounded batch cleanup은 `--all --recommended` 또는 `--all --action-map` strategy만 허용한다.
- batch cleanup apply는 family/PRD/repo scope를 허용하되, recommendation 기반 action 또는 explicit action-map만 실행하고 duplicate output이나 기존 output path가 있으면 preflight에서 거절한다.
- single-target cleanup은 `--override <json-file|inline-json>`로 같은 override object를 직접 받을 수 있다.
- action-map value는 단순 action string이거나 `{ action, outputPath?, secondaryOutputPath?, assimilationTargetPath?, appendMarkdown?, bodyTemplate?, frontmatterPatch? }` object일 수 있다.
- `assimilationTargetPath` override는 cross-family spec promotion 같은 bounded semantic rewrite를 허용한다.
- `appendMarkdown` override는 memo conversion이나 spec assimilation 본문에 operator-supplied markdown fragment를 덧붙일 수 있게 한다.
- `bodyTemplate` override는 memo conversion/spec assimilation 본문 block 자체를 템플릿으로 재정의한다.
- `frontmatterPatch` override는 whitelisted metadata(`level`, `scope`, `aspect`, `depth`, `layer`, `lifecycle`, `svc`, `tags`, `links`)를 moved/updated markdown target에 다시 적용한다.
- override string fields는 `{{record.path}}`, `{{record.documentId}}`, `{{record.kind}}`, `{{record.title}}`, `{{record.basename}}`, `{{record.pairedPath}}`, `{{record.lifecycle}}`, `{{candidate.familyId}}`, `{{primary.path}}`, `{{primary.stableId}}`, `{{paired.path}}`, `{{paired.stableId}}` placeholder를 지원한다.
- `bodyTemplate`는 위 placeholder 외에 `{{source.path}}`, `{{source.body}}`, `{{completedItemsMarkdown}}`, `{{cleanupRecommendation}}`, `{{appendMarkdown}}`, `{{plan.action}}`, `{{plan.outputPath}}`, `{{plan.secondaryOutputPath}}`, `{{plan.assimilationTargetPath}}`를 지원한다.
- `completedRecords[]`는 review signal이며 cleanup recommendation 역시 mutation authority가 아니다.
- recommendation은 operator convenience다. archive/memo/spec promotion을 직접 실행하지 않는다.
- `keep-as-evidence`, `archive-review`, `memo-conversion-review`는 explicit write workflow 전에 사용하는 review vocabulary다.
- cleanup plan은 explicit target validation, no hidden overwrite, preserved source/evidence links 원칙을 만족하는 write-workflow precursor다.
- `docs cleanup apply --action archive`는 primary record와 paired PRD JSON이 있으면 함께 archive path로 이동한다.
- `docs cleanup apply --action memo-conversion`은 completed TODO record를 `.memo.md` path로 이동하고, `bodyTemplate`/`appendMarkdown` override가 있으면 moved target body에도 적용한다.
- `docs cleanup apply --action memo-conversion`은 completed PRD markdown을 `.memo.md` path로 이동하고, paired PRD JSON은 `tasks/archive/`로 이동한다.
- `docs cleanup apply --action promote-spec`은 completed TODO fact를 같은 family의 단일 spec에 흡수하고, TODO record는 archive로 이동한다.
- `docs cleanup apply --action rewrite`은 moved/in-place record target과 optional assimilation target에 body/frontmatter override를 적용하는 generic action이다. `assimilationTargetPath`가 있으면 apply는 그 target body를 실제로 append/update한다.
- arbitrary semantic rewrites beyond the supported action matrix and override fields는 여전히 out of scope다.
