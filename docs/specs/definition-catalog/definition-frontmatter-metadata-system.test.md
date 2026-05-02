---
def:
  id: definition-frontmatter-metadata-system-test
  type: spec
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [testing, metadata]
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
---

# Definition Frontmatter Metadata System — Validation Mapping

## 목적 ^purpose

frontmatter metadata option catalog가 parser/validator와 맞는지 확인하는 현재 테스트 표면을 연결한다.

## 검증 매핑 ^defines

| 검증 | 현재 테스트 |
|------|-------------|
| `type` / `knowledge_kind` 상호 배제 | `packages/definition-catalog/src/frontmatter.test.ts` |
| `owner_system`, `projection_plane`, `intent_hierarchy` 파싱 | `packages/definition-catalog/src/frontmatter.test.ts` |
| real docs frontmatter scan | `packages/definition-catalog/src/scan-real.test.ts` |
| option graph validation | `node packages/cli/dist/index.js def validate` |
