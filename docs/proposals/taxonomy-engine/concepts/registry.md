# Registry — Taxonomy의 우주

> 여러 [[taxonomy]]를 함께 보관하고 cross-taxonomy 참조 허용.

## 정의

`TaxonomyRegistry` 클래스. 메모리상 Map<taxonomy-slug, TaxonomyIR>.

## 목적

- import 해소 (cross-tax 참조 검증)
- registry-wide ref 조회 (한 ref가 여러 taxonomy를 가로지를 수 있음)
- CLI `--registry <dir>` 옵션의 기반

## API

```typescript
class TaxonomyRegistry {
  add(ir: TaxonomyIR): void
  get(taxonomy: string): TaxonomyIR | undefined
  list(): string[]
}
```

## 핵심 원리

### 덮어쓰기 정책

같은 taxonomy slug로 add()를 두 번 호출하면 두 번째가 덮어씀. multi-version 동시 보관 불가 (현재). 후속에서 version-aware add 가능.

### Fail-open

`get(unknown)` → undefined. validate/show가 이걸 받아 진단 emit.

### CLI 통합

`--registry <dir>` 옵션은 디렉토리의 모든 .yaml 일괄 로드. validate/show/codegen/diff에서 지원 (v0.6).

## 다른 개념과의 관계

- [[taxonomy]]: Registry가 보관하는 단위
- import: Registry에 등록된 target만 해소 가능

## 참조

- spec: `../00-design.md` §5.3
- 코드: `packages/taxonomy-engine/src/registry/index.ts`
- CLI: `cli-commands.md`
