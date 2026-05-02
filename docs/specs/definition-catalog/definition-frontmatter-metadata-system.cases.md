---
def:
  id: definition-frontmatter-metadata-system-cases
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
  tags: [scenario, testing, metadata]
  links:
    - target: definition-frontmatter-metadata-system
      type: refines
    - target: definition-frontmatter-metadata-system-test
      type: traces_to
---

# Definition Frontmatter Metadata System — Use Cases

## 목적 ^purpose

frontmatter metadata option catalog가 실제 authoring/review에서 어떤 판단을 도와야 하는지 정의한다.

## 시나리오 1: 새 문서의 metadata option을 선택한다 ^overview

**전제**: 작업자가 새 definition 문서를 만든다.

**동작**: `definition-frontmatter-metadata-system`에서 `type`, `tier`, `scope/aspect`, `depth`, `layer`, `owner_system` 순서로 option 의미를 확인한다.

**기대**:
- 각 field의 의미와 값 목록을 한 system에서 탐색할 수 있다.
- authoring guide는 작성 순서만 설명하고 option 의미를 복제하지 않는다.
- parser/validator가 허용하는 값과 문서 catalog가 drift되지 않는다.

**실패 시 수정 대상**: metadata option 문서, `types.ts`, `frontmatter.ts`, `frontmatter.test.ts`.

## 시나리오 2: metadata enum 값을 추가한다

**전제**: 새 scope/aspect/tier/link type이 필요하다.

**동작**: 작업자가 option 문서, 타입 정의, frontmatter parser, validation test를 함께 갱신한다.

**기대**:
- 새 값은 의미, 사용 조건, 금지 조건을 가진다.
- `def validate`가 통과한다.
- option 추가가 다른 metadata field 의미를 침범하지 않는다.

**실패 시 수정 대상**: 해당 `definition-metadata-*` 문서와 parser/test.
