---
def:
  id: taxonomy-engine-registry-concept
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: data
  aspect: concept
  tier: component
  depth: specification
  sources:
    - packages/taxonomy-engine/src/registry/index.ts
    - packages/taxonomy-engine/src/ref/resolver.ts
    - packages/taxonomy-engine/src/validate/ref.ts
    - packages/taxonomy-engine/__tests__/unit/registry.test.ts
    - packages/taxonomy-engine/__tests__/unit/ref.test.ts
    - packages/taxonomy-engine/__tests__/unit/validate.test.ts
    - packages/cli/src/commands/taxonomy/shared.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: concept-registry
---

# Registry — Taxonomy의 우주

> 여러 [[taxonomy]] IR을 함께 보관하고 cross-taxonomy 조회/검증을 가능하게 하는 in-memory map.

## 목적 ^purpose

- import target 존재와 version을 검증할 때 기준 집합을 제공한다.
- `show()`/`resolveRef()`가 taxonomy slug로 IR을 찾게 한다.
- CLI `--registry <dir>`이 라이브러리의 순수 API 위에서 파일 로딩을 수행할 수 있게 한다.

## 정의

`TaxonomyRegistry`는 메모리상 `Map<taxonomy-slug, TaxonomyIR>`이다.

```typescript
class TaxonomyRegistry {
  add(ir: TaxonomyIR): void
  get(taxonomy: string): TaxonomyIR | undefined
  list(): string[]
}
```

## 핵심 원리

### 단일 slug 저장

같은 taxonomy slug로 `add()`를 두 번 호출하면 뒤 호출이 덮어쓴다. 현재 registry는 multi-version store가 아니다. version 일치는 `validateRefs()`와 `resolveRef()`가 저장된 IR의 `version`과 요청 version을 비교해 판단한다.

### Fail-open 조회

`get(unknown)`은 `undefined`를 반환한다. registry 자체는 진단을 만들지 않고, 호출자인 validate/show/ref resolver가 진단 또는 실패 상태를 결정한다.

### CLI 통합

라이브러리의 `TaxonomyRegistry`는 파일 I/O를 모른다. `--registry <dir>` 처리는 `packages/cli/src/commands/taxonomy/shared.ts`의 `loadRegistryDir()`가 담당하고, 로드한 IR을 registry에 `add()`한다.

지원 CLI:
- `tax validate <file> --registry <dir>`
- `tax show <ref> --registry <dir>`
- `tax codegen <file> --registry <dir>`
- `tax diff <a> <b> --registry <dir>`

## 다른 개념과의 관계

- [[taxonomy]]: registry가 보관하는 단위
- [reference-grammar.md](../reference-grammar.md): `resolveRef()`가 registry를 사용한다
- [[diagnostic]]: missing import는 `ref-unresolved-import`, version mismatch는 `ref-version-missing`

## 참조

- 코드: `packages/taxonomy-engine/src/registry/index.ts`
- resolver: `packages/taxonomy-engine/src/ref/resolver.ts`
- import validate: `packages/taxonomy-engine/src/validate/ref.ts`
- CLI registry loader: `packages/cli/src/commands/taxonomy/shared.ts`
- CLI: [cli-commands.md](./cli-commands.md)

## 검증 명령 ^validation

```bash
pnpm --filter taxonomy-engine exec vitest run __tests__/unit/registry.test.ts __tests__/unit/ref.test.ts __tests__/unit/validate.test.ts
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
