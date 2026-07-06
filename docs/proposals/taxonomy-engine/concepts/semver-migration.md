---
def:
  id: taxonomy-engine-semver-migration-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: constraint
  aspect: migration
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: semver-migration
sources:
  - packages/taxonomy-engine/src/diff/index.ts
  - packages/taxonomy-engine/src/migration/index.ts
  - packages/taxonomy-engine/src/index.ts
  - packages/taxonomy-engine/__tests__/unit/diff-semver.test.ts
  - packages/taxonomy-engine/__tests__/unit/migration.test.ts
  - packages/cli/src/commands/taxonomy/diff.ts
  - packages/cli/src/commands/taxonomy/migration.ts
  - packages/cli/src/commands/taxonomy.test.ts
---

# Semver + Migration — 변경 영향도 분류와 이전 계획

> `diff()` 결과에 `breakingLevel`을 부여하고, 두 시점 IR 사이의 rename/decision 영향 후보를 보고한다. 자동 rewrite는 하지 않는다.

## 목적 ^purpose

- taxonomy 변경의 consumer 영향도를 `major | minor | patch | none`으로 요약한다.
- address 동일성으로 id rename 후보를 추정한다.
- decisionLink가 붙은 entry의 lifecycle/address/removal 영향을 별도 배열로 제공한다.
- CLI에서 `tax diff --semver`와 `tax migration --base`로 리뷰 게이트를 만들 수 있게 한다.

## breakingLevel

`diff(a, b)`는 `DiffResult`를 반환한다.

```typescript
type BreakingLevel = "major" | "minor" | "patch" | "none"

type DiffResult = {
  same: boolean
  changes: DiffEntry[]
  breakingLevel: BreakingLevel
}
```

여러 변경이 섞이면 최고 등급이 `breakingLevel`이 된다. 우선순위는 `major > minor > patch > none`이다.

## 분류 표

| DiffEntry kind | level | 조건 |
|----------------|-------|------|
| `axis-removed` | major | |
| `entry-removed` | major | |
| `entry-address-changed` | major | address는 영구 식별자 |
| `relation-removed` | major | |
| `relation-rule-removed` | major | |
| `constraint-removed` | major | |
| `capacity-changed` | major | `from > to` |
| `axis-added` | minor | |
| `entry-added` | minor | |
| `relation-added` | minor | |
| `relation-rule-added` | minor | |
| `constraint-added` | minor | |
| `capacity-changed` | minor | `from < to` 또는 동일 방향 외 증가 |
| `axis-lifecycle-changed` | patch | |
| `entry-label-changed` | patch | |
| `entry-lifecycle-changed` | patch | |
| `entry-placeholder-reason-changed` | patch | |
| `entry-decision-link-changed` | patch | |
| `relation-rules-count-changed` | patch | rule 추가/제거 kind와 함께 나올 수 있음 |

## migrationPlan

```typescript
function migrationPlan(from: TaxonomyIR, to: TaxonomyIR): MigrationPlan

type MigrationPlan = {
  idRenames: IdRename[]
  addressConflicts: AddressConflict[]
  manualReview: string[]
  decisionImpact: DecisionImpact[]
}
```

### idRenames

같은 axis에서 동일 address가 양쪽에 정확히 1개씩 있고 id가 다르면 rename 후보로 보고한다.

```typescript
{ axis: "layer", fromId: "cue", toId: "moment", address: 3 }
```

address도 id도 다르면 rename으로 추정하지 않는다. 유사도 기반 추정은 하지 않는다.

### addressConflicts

한 axis의 같은 address에 여러 id 후보가 생기면 `addressConflicts`에 보고한다. 자동 해결은 하지 않는다.

### manualReview

자동 처리하기 어려운 조건을 사람이 읽는 문자열로 남긴다. 현재 구현은 target axis capacity가 entries 수보다 작아지는 경우를 보고한다.

### decisionImpact

decisionLink가 있는 entry만 대상으로 한다.

| impact | 발생 조건 |
|--------|-----------|
| `lifecycle-changed` | 같은 id/address에서 lifecycle만 변경 |
| `address-changed` | 같은 id의 address 변경 |
| `removed` | entry 또는 axis 제거 |

address 변경과 lifecycle 변경이 동시에 있으면 `address-changed`만 보고한다. decisionLink가 없는 entry는 decisionImpact 대상이 아니다.

## CLI

### `tax diff <a> <b> --semver`

`--semver`가 있으면 `breakingLevel === "major"`일 때 exit 1이다.

```bash
qa-sdk tax diff docs/taxonomies/v1.yaml docs/taxonomies/v2.yaml --semver
```

### `tax migration --base <ref> <file>`

git base의 파일과 working tree 파일을 비교한다. 내부적으로 `git show "<base>:<file>"`, `parse()`, `diff()`, `migrationPlan()`을 순서대로 실행한다.

```bash
qa-sdk tax migration --base main docs/taxonomies/lesson-builder-content.yaml
qa-sdk tax migration --base main docs/taxonomies/lesson-builder-content.yaml --json
```

JSON 출력은 `base`, `file`, `diff`, `plan`을 포함한다.

## 다른 개념과의 관계

- [[diff]]: `DiffEntry[]`와 `breakingLevel`의 소유자
- [[registry]]: multi-version registry 대신 git base/current 비교를 사용한다
- [[lifecycle]]: lifecycle/decisionLink 변경은 patch 또는 decisionImpact로 분리된다
- [cli-commands.md](./cli-commands.md): `diff --semver`, `migration --base`

## 참조

- diff: `packages/taxonomy-engine/src/diff/index.ts`
- migration: `packages/taxonomy-engine/src/migration/index.ts`
- CLI diff: `packages/cli/src/commands/taxonomy/diff.ts`
- CLI migration: `packages/cli/src/commands/taxonomy/migration.ts`
- Stage 2 plan: `../plans/v0.9.md`

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/diff-semver.test.ts __tests__/unit/migration.test.ts
pnpm --filter @qa-sdk/cli test taxonomy.test
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
