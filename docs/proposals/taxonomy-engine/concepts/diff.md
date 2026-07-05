# Diff — 두 IR 비교

> `src/diff/` 모듈 spec. v0.4에서 추가. CLI `tax diff` / `tax git-diff`의 핵심.

## 정의

**두 TaxonomyIR을 비교해 변경 카탈로그(DiffEntry[])를 반환**하는 순수 함수. yaml 텍스트 diff가 아니라 IR 구조 diff — id/address/relation rule 수준의 변화를 1급으로 표현.

## 목적 ^purpose

taxonomy 변경을 구조적 DiffEntry와 breakingLevel로 분류해 리뷰, migration, CI 판단의 공통 입력으로 만든다.

## API

```typescript
function diff(a: TaxonomyIR, b: TaxonomyIR): {
  same: boolean
  changes: DiffEntry[]
  breakingLevel: "major" | "minor" | "patch" | "none"   // v0.9+
}
```

**입력**: 두 IR (`parse` 결과)
**출력**: `{ same, changes, breakingLevel }`. `breakingLevel`은 최고 등급(major > minor > patch > none). 분류 표는 [`semver-migration.md`](./semver-migration.md).

**결정론**: 같은 두 IR 입력 → 항상 같은 출력.

## 18 DiffEntry kinds (v0.9 기준)

| kind | 의미 | 주요 필드 | breakingLevel |
|------|------|----------|---------------|
| `axis-added` | b에 새 axis 추가 | `axis` | minor |
| `axis-removed` | a에 있던 axis 제거 | `axis` | major |
| `axis-lifecycle-changed` | axis lifecycle 변경 (v0.8+) | `axis, from, to` | patch |
| `entry-added` | axis에 entry 추가 | `axis, id` | minor |
| `entry-removed` | axis에서 entry 제거 | `axis, id` | major |
| `entry-address-changed` | entry의 address 변경 | `axis, id, from, to` | major |
| `entry-label-changed` | entry의 label 변경 | `axis, id, from, to` | patch |
| `entry-lifecycle-changed` | entry lifecycle 변경 (v0.8+) | `axis, id, from, to` | patch |
| `entry-placeholder-reason-changed` | placeholderReason 변경 (v0.8+) | `axis, id, from, to` | patch |
| `entry-decision-link-changed` | decisionLink 변경 (v0.8+) | `axis, id, from, to` | patch |
| `capacity-changed` | axis capacity 변경 | `axis, from, to` | minor (증가) / major (감소) |
| `relation-added` | b에 새 relation 추가 | `relation` | minor |
| `relation-removed` | a에 있던 relation 제거 | `relation` | major |
| `relation-rules-count-changed` | rule 수 변경 | `relation, from, to` | patch (rule-* 가 실제 영향 결정) |
| `relation-rule-added` | 특정 rule 추가 | `relation, rule` | minor |
| `relation-rule-removed` | 특정 rule 제거 | `relation, rule` | major |
| `constraint-added` | b에 새 constraint 추가 | `constraint` | minor |
| `constraint-removed` | a에 있던 constraint 제거 | `constraint` | major |

### DiffEntry 타입

```typescript
type DiffEntry = {
  kind: DiffEntryKind
  axis?: string
  relation?: string
  constraint?: string
  entry?: string         // entry id
  rule?: object          // rule 객체 (relation-rule-* 전용)
  from?: unknown
  to?: unknown
}
```

## Stable key 기반 rule 비교

relation rule 비교는 **stable key (sorted JSON)**으로 동일성 판단:

```typescript
// rule 객체를 stable key로 변환
function stableKey(rule: object): string {
  return JSON.stringify(rule, Object.keys(rule).sort())
}
// { upper: 'overview', lower: 'system' } → '{"lower":"system","upper":"overview"}'
```

같은 rule 객체는 key 순서와 무관하게 동일 취급. rule 순서 변경만 → diff 없음. rule 내용 변경 → `relation-rule-removed` + `relation-rule-added`.

## 사용 예시

### `tax diff` — 두 yaml 비교

```typescript
import { parse, diff } from 'taxonomy-engine'

const a = parse(readFileSync('v1.yaml', 'utf8')).ir
const b = parse(readFileSync('v2.yaml', 'utf8')).ir
const result = diff(a, b)

if (!result.same) {
  for (const change of result.changes) {
    console.log(change.kind, change.axis ?? change.relation)
  }
}
```

### `tax git-diff` — git working tree 변경 자동 감지

```bash
qa-sdk tax git-diff main
# git diff --name-only main...를 내부 실행
# 변경된 yaml 각각에 diff() 호출
# PR 리뷰에서 변경 내역을 구조적으로 확인 가능
```

동작 흐름:
1. `git diff --name-only <base>... -- 'docs/taxonomies/*.yaml'`
2. 각 변경 yaml에 대해 `git show <base>:<path>` → base IR
3. 현재 working tree → current IR
4. `diff(base, current)` → DiffEntry[]
5. 결과 출력

### JSON 출력 (`--json`)

```json
{
  "base": "main",
  "changes": [
    {
      "file": "docs/taxonomies/dkg-schema.yaml",
      "status": "modified",
      "changes": [
        { "kind": "entry-added", "axis": "node-type", "entry": "new-service" },
        { "kind": "relation-rule-added", "relation": "node-contains", "rule": { "parent": "service", "child": "new-service" } }
      ]
    }
  ]
}
```

## 다른 개념과의 관계

- [axis.md](./axis.md) — `axis-added/removed` 단위
- [entry.md](./entry.md) — `entry-*` 단위
- [relation.md](./relation.md) — `relation-*` 단위
- [constraint.md](./constraint.md) — `constraint-*` 단위

## 참조

- 코드 위치: `packages/taxonomy-engine/src/diff/index.ts`
- 테스트: `packages/taxonomy-engine/__tests__/unit/diff.test.ts`
- CLI `tax diff` / `tax git-diff`: [cli-commands.md](./cli-commands.md)
- v0.4 계획: [plans/v0.4.md](../plans/v0.4.md) §T-F4
- v0.5 계획: [plans/v0.5.md](../plans/v0.5.md) §T-H4 (rule-level 확장)
- v0.6 계획: [plans/v0.6.md](../plans/v0.6.md) §T-J3, T-J4
