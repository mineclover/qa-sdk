---
def:
  id: definition-metadata-id
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
sources:
  - packages/definition-catalog/src/types.ts
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/registry.ts
  - packages/definition-catalog/src/frontmatter.test.ts
---

# Definition Metadata — `id`

## 목적 ^purpose

`def.id`는 문서의 stable machine identity다. 파일 경로나 제목이 바뀌어도 링크, source map, graph traversal은 이 값을 기준으로 문서를 찾는다.

## 정의 ^defines

| field | 값 | 규칙 |
|-------|----|------|
| `id` | kebab-case string | 필수, repo 전체 유일 |

## 제약 ^constraint

- 제목이나 파일명과 다를 수 있지만, 가능하면 파일 stem과 맞춘다.
- 링크 대상은 path가 아니라 `def.id`를 사용한다.
- id rename은 semantic change다. 기존 id를 쓰는 `links[].target`, source map, tests를 함께 갱신한다.
