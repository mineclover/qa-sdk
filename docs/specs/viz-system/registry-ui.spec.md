---
def:
  tier: component
  id: registry-ui-spec
  address: def_document:v2:1027
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: registry-service
  tags: [entry-point, frontend, registry]
  links:
    - target: registry-service-modules
      type: depends_on
sources:
  - packages/registry-ui/src/main.ts
  - packages/registry-ui/src/pages/dsl-builder.ts
  - packages/registry-ui/src/pages/prefix-builder.ts
  - packages/registry-ui/src/pages/glossary.ts
  - packages/registry-ui/src/store.ts
  - packages/registry-ui/scripts/static-smoke.test.mjs
---
# Registry UI

## 목적 ^purpose

registry-service의 데이터를 웹 UI로 시각화하는 프론트엔드 앱. DSL 빌더, prefix 빌더, 용어집 페이지를 제공하여 좌표계 구성을 브라우저에서 탐색·편집할 수 있게 한다.

## 구성 ^overview

- Pages: `dsl-builder` (DSL 편집), `prefix-builder` (prefix 구성), `glossary` (용어 탐색), `file-map` (파일/충돌 리포트)
- Store: 클라이언트 상태 관리
- 소스: `packages/registry-ui/src/`
