---
def:
  id: scaffold-domain-schematic
  type: spec
  tier: system
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: scaffold
  tags: [scaffold, nestjs, domain-slice, ddd, cqrs, adapter-boundary]
  links:
    - target: scaffold-system
      type: refines
    - target: scaffold-template-catalog
      type: depends_on
    - target: scaffold-domain-development-convention
      type: depends_on
    - target: scaffold-architecture-validator
      type: depends_on
  sources:
    - packages/architecture-schematics/collection.json
    - packages/architecture-schematics/src/domain/index.ts
    - packages/architecture-schematics/src/domain/ast-wiring.ts
    - packages/architecture-schematics/src/domain/files
---

# scaffold domain schematic

## 목적 ^purpose

`domain` schematic은 도메인 이름과 parent Nest module을 받아 사내 Domain Slice Architecture 기본 구조를 생성하고 parent module imports에 자동 연결하는 생성 flow다.

## 구성 ^overview

- 입력 옵션은 `name`, `parentModule`, `includeReadModel`, `skipFormat`이다.
- `includeBff=true`이면 BFF surface를 생성하며 read model 파일도 함께 생성한다.
- 생성 위치는 `parentModule`이 있는 디렉터리 아래의 `<domain>/`이다.
- 생성 파일은 domain identity/type/entity/exception/entity spec, command DTO, use case, repository/outbox/transaction/logger port, Drizzle schema/repository adapter, outbox/transaction/unit-of-work/logger adapter, OpenAPI fragment, controller, metadata seed, Nest module이다.
- 생성된 OpenAPI fragment는 `qa-scaffold promote-openapi` 명령으로 중앙 contracts package의 `openapi/domains/<domain>/spec.json` 레이아웃으로 승격할 수 있어야 한다.
- `includeReadModel=true`이면 query-side read model port를 `application/queries`에 추가한다.
- parent module은 TypeScript AST로 분석해 import 구문과 `@Module({ imports: [...] })` 배열에 generated module을 추가한다.
- 생성/수정된 TypeScript 파일은 Prettier로 포맷한다.

## 표준화 규칙

- domain layer는 비즈니스 상태와 invariant를 소유하며 NestJS/Drizzle에 의존하지 않는다.
- application layer는 use case orchestration과 in/out port contract를 소유한다.
- infrastructure layer는 Drizzle persistence adapter, DB token, outbox adapter, transaction adapter, logger adapter, optional read-model adapter를 소유한다.
- presentation layer는 HTTP input adapter로 use case만 호출한다.
- BFF surface는 read model을 조합하며 domain entity를 노출하지 않는다.
- 복잡한 hierarchy domain은 무조건 폴더를 깊게 나누지 않고 bounded context 아래 aggregate별 하위 폴더/파일명 접두사로 응집한다.
- DDD 레이어의 각 파일은 `scaffold-domain-development-convention`의 책임 토폴로지 판정 규칙을 따른다.
