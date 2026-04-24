---
def:
  id: doc-envelope
  type: design
  tier: component
  component_subtype: data-shape
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: doc-envelope
  tags: [structural, contract]
  links:
    - target: deterministic-label-architecture
      type: traces_to
  source: packages/doc-envelope/src/index.ts
---

# doc-envelope — 문서 수집 중립 모델

## 목적 ^purpose

PRD/definition/ralph/evidence 등 이질적 문서 소스를 하나의 `DocumentEnvelope` read-only 타입으로 통합하는 수집 계층(Layer 1) 라이브러리. 도구 중립 — 특정 도구(ralph-tui 등) 지식은 담지 않는다. 파일 경로 하드코딩, schema 파싱, 해석 logic은 모두 경계 밖.

## 공개 API

- `DocumentEnvelope` + 보조 타입 (`DocumentLink`, `DocumentSource`, `DocumentTask`, `DocumentMetadata`)
- `normalizeDocumentEnvelope` / `matchesDocumentQuery`
- `collectDocumentFamilyOnlyScope` / `isArchivedPrdDocument` / `isTransientDocument`
- `detectCompletedRecords` (범용 `.todo.md` 감지)
- `parseTodoFollowUps` / `classifyTodoHeading` / `countMarkdownCheckboxes`

## Family Scope Contract

`collectDocumentFamilyOnlyScope`는 read-only family view를 만든다.

- 같은 `familyId`의 role documents(spec/rule/cases/test/plan/todo/memo/knowledge/prd)를 포함한다.
- `tier: system` 또는 legacy `level: group|module` target은 direct `contains` child를 포함한다.
- `tier: layout` target은 direct `refs` child를 포함한다.
- archived PRD와 transient session document는 기본 제외하고, transient는 explicit option이 있을 때만 포함한다.
- 이 함수는 source mutation authority가 없다. `docs collect`, PRD completion sync, BDD family view가 쓰는 scope 계산만 담당한다.

## 허용 의존

node built-ins만.
