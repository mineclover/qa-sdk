---
def:
  id: definition-metadata-source-map
  type: design
  tier: system
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [metadata, structural, coordinate-cluster]
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
    - target: definition-code-link-coverage
      type: depends_on
sources:
  - packages/definition-catalog/src/code-references.ts
  - packages/definition-catalog/src/code-references.test.ts
  - packages/definition-catalog/src/frontmatter.ts
---

# Definition Metadata — `source` / `sources`

## 목적 ^purpose

`source`와 `sources`는 문서 책임과 코드 파일/심볼을 연결한다. closure, find-by-file, review feedback의 code responsibility evidence다.

## 정의 ^defines

| field | 위치 | 의미 |
|-------|------|------|
| `source` | top-level frontmatter | 단일 코드 target |
| `sources` | top-level frontmatter | 복수 코드 target |
| `@def.doc` | code comment | 코드에서 문서를 가리키는 보조 선언 |
| `@def.boundary` | code comment | 코드 파일의 primary definition boundary |

## 제약 ^constraint

- `source`/`sources`는 `def:` 블록 안에 넣지 않는다.
- symbol target은 `packages/pkg/src/file.ts:Symbol` 형식을 쓴다.
- source mapping은 context dependency의 source가 아니라 해당 책임의 source여야 한다.
