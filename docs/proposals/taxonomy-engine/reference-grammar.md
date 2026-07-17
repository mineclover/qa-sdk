---
def:
  id: taxonomy-engine-reference-grammar
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: interface
  aspect: api_contract
  tier: component
  depth: specification
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: reference-grammar
sources:
  - packages/taxonomy-engine/src/ref/parser.ts
  - packages/taxonomy-engine/src/ref/resolver.ts
  - packages/taxonomy-engine/src/ref/types.ts
  - packages/taxonomy-engine/src/registry/index.ts
  - packages/taxonomy-engine/__tests__/unit/ref.test.ts
  - packages/taxonomy-engine/__tests__/unit/query.test.ts
  - packages/cli/src/commands/taxonomy/show.ts
---

# Reference Grammar

> taxonomy-engine의 `parseRef()` / `resolveRef()`가 구현한 3-tier 참조 문법.

## 목적 ^purpose

- 사람이 쓰는 짧은 ref와 도구가 쓰는 정확한 ref를 같은 resolver로 처리한다.
- entry id가 바뀌는 경우를 대비해 entry address 기반 조회를 제공한다.
- CLI `tax show`와 라이브러리 `show()`가 같은 ref grammar를 공유한다.

## 5.1 3-tier 참조

**Tier 1 — Path-based (JSON Pointer 스타일)**

정확하고 verbose한 형식. parser는 `#` 뒤의 path를 `TaxonomyRef` kind로 변환한다.

```text
qa-sdk-coordinate-system
qa-sdk-coordinate-system#/axes/scope
qa-sdk-coordinate-system#/axes/scope/entries/apm
qa-sdk-coordinate-system#/axes/scope/entries/apm/meta/owner
qa-sdk-coordinate-system#/relations/depth-contains
qa-sdk-coordinate-system#/relations/depth-contains/rules/0
qa-sdk-coordinate-system#/constraints/level-leaf-no-children
```

**Tier 2 — Dotted shorthand**

사람과 CLI에 가까운 단축형.

```text
qa-sdk-coordinate-system:scope
qa-sdk-coordinate-system:scope.apm
qa-sdk-coordinate-system:relations/depth-contains
qa-sdk-coordinate-system:relations/depth-contains/rules/0
qa-sdk-coordinate-system:constraints/level-leaf-no-children
qa-sdk-coordinate-system:coord{scope=apm,aspect=model,depth=layer}
```

**Tier 3 — Entry address-based**

axis 안의 address로 entry를 조회한다. 현재 구현은 `axis#decimal-address`만 지원한다.

```text
qa-sdk-coordinate-system::scope#1
qa-sdk-coordinate-system@v1::scope#1
```

Packed coordinate address 형식(`::coord:0x...`)은 parser가 의도적으로 거부한다. 좌표 packed integer를 풀려면 axis 정보가 필요하므로 별도 resolver 설계가 필요하다.

## 5.2 참조 가능한 단위

| 단위 | kind | 예시 |
|------|------|------|
| Taxonomy | `taxonomy` | `qa-sdk-coordinate-system` |
| Axis | `axis` | `qa-sdk-coordinate-system:scope` |
| Entry | `entry` | `qa-sdk-coordinate-system:scope.apm` |
| Entry by address | `entry-by-address` | `qa-sdk-coordinate-system::scope#0` |
| Entry field | `entry-field` | `qa-sdk-coordinate-system#/axes/scope/entries/apm/meta/owner` |
| Coordinate | `coordinate` | `qa-sdk-coordinate-system:coord{scope=apm,aspect=model}` |
| Relation | `relation` | `qa-sdk-coordinate-system:relations/depth-contains` |
| Relation rule | `relation-rule` | `qa-sdk-coordinate-system:relations/depth-contains/rules/0` |
| Constraint | `constraint` | `qa-sdk-coordinate-system:constraints/level-leaf-no-children` |

## 5.3 Cross-taxonomy import 검증

```yaml
imports:
  - taxonomy: qa-sdk-coordinate-system
    version: 1
    as: qac
```

`validateRefs()`는 registry가 제공될 때 import target 존재와 version을 확인한다.

| 상황 | 진단 |
|------|------|
| registry 없음 | import 검증 skip (backward compatibility) |
| target taxonomy 없음 | `ref-unresolved-import` |
| target version 불일치 | `ref-version-missing` |

## 5.4 Resolver 동작

1. `parseRef("qa-sdk-coordinate-system:scope.apm")`가 문자열을 `TaxonomyRef` union으로 변환한다.
2. `resolveRef(ref, registry)`가 `registry.get(ref.taxonomy)`로 IR을 찾는다.
3. ref에 `@v<n>`이 있으면 저장된 IR의 `version`과 정확히 일치해야 한다.
4. 대상 축/entry/relation/constraint가 없으면 `undefined`를 반환한다.

resolver는 fail-open이다. CLI와 validate 계층이 `undefined`를 사용자 오류나 진단으로 바꾼다.

## 5.5 버전 정책

- `@v<n>`이 있으면 저장된 IR의 `version`과 exact match해야 한다.
- `@v<n>`이 없으면 registry에 저장된 해당 taxonomy IR을 사용한다.
- 현재 `TaxonomyRegistry`는 slug당 IR 하나만 저장하므로 여러 version을 동시에 보관하지 않는다.
- axis-level `version`은 IR에 보존되지만 ref resolver의 taxonomy 선택 기준은 top-level `TaxonomyIR.version`이다.

## 참조

- ref parser: `packages/taxonomy-engine/src/ref/parser.ts`
- ref resolver: `packages/taxonomy-engine/src/ref/resolver.ts`
- ref types: `packages/taxonomy-engine/src/ref/types.ts`
- ref 관련 진단 코드: [concepts/diagnostics-catalog.md](./concepts/diagnostics-catalog.md) §ref-*
- 라이브러리 API: [api-surface.md](./api-surface.md)
- CLI show: [concepts/cli-commands.md](./concepts/cli-commands.md)

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/ref.test.ts __tests__/unit/query.test.ts __tests__/unit/validate.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
