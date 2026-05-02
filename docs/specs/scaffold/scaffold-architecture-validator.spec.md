---
def:
  id: scaffold-architecture-validator
  type: spec
  tier: system
  level: leaf
  scope: constraint
  aspect: tech_constraint
  depth: validation
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, validation, architecture, testing]
  links:
    - target: scaffold-system
      type: refines
    - target: scaffold-template-catalog
      type: depends_on
  sources:
    - packages/architecture-schematics/src/validator.ts
    - packages/architecture-schematics/src/validator.test.ts
    - packages/architecture-schematics/src/cli.ts
---

# scaffold architecture validator

## 목적 ^purpose

architecture validator는 생성 코드와 기존 코드가 Domain Slice Architecture의 import 경계, BFF/read-model metadata, transaction/logging port, OpenAPI entity exposure 규칙을 지키는지 빠르게 검사하는 규칙 실행기다.

## 구성 ^overview

- `validateArchitecture(files)`는 TypeScript import declaration을 파싱해 layer별 금지 의존성을 검사한다.
- domain file은 `@nestjs/*`, `drizzle-orm`, infrastructure import를 금지한다.
- application file은 infrastructure와 Drizzle 직접 import를 금지한다.
- presentation file은 infrastructure repository 직접 import를 금지한다.
- use case는 transaction/logger port를 사용해야 한다.
- BFF surface는 domain entity를 import/expose하거나 persistence write를 수행하지 않아야 한다.
- read model 또는 BFF surface가 있으면 `metadata/openmetadata.seed.json`에 read-model/BFF cache key entry가 있어야 한다.
- OpenAPI fragment는 domain entity type을 노출하지 않아야 한다.
- `qa-scaffold validate <path>`는 path 아래 TypeScript, `openmetadata.seed.json`, `*.openapi.json`, `openapi/domains/<domain>/spec.json` 파일을 읽어 위반을 CLI error로 출력한다.

## 한계

- 현재 validator는 정적 문자열/AST 검사에 집중한다.
- aggregate boundary, glossary 품질, OpenMetadata lineage completeness의 의미론적 품질은 별도 rule 확장이 필요하다.
- alias 정책(`@common/*`, `@modules/*`)과 deep relative path 금지는 후속 validator rule로 추가한다.
