---
def:
  id: codegen-core
  type: spec
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: codegen-core
  tags: [codegen, library]
  links:
    - target: apm-codegen-system
      type: refines
  source: packages/codegen-core/src/index.ts
---

# codegen-core — 순수 코드 생성 함수 라이브러리

## 목적 ^purpose

`SchemaSnapshot`/`Catalog` 입력을 TypeScript/Proto 소스 문자열로 변환하는 순수 함수 라이브러리. CLI나 빌드 도구의 I/O 계층과 분리돼 결정론적 결과(`generateCatalogTypes()`는 동일 입력 → 동일 contentHash)를 보장. 파일 시스템 접근, fetch, env 의존 없음.
