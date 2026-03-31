---
def:
  id: spec-arch-layers
  address: def_document:v2:273561
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, runtime, contract]
  links:
    - target: spec-arch-interceptors
      type: constrains
---
# spec-engine 계층 분리 원칙

## 목적 ^purpose

spec-engine의 계층 분리 원칙. core → adapter → service 방향으로만 의존 허용.

## 구성 ^overview

- **2패키지 분리**: spec-core(순수 TS 커널, NestJS 의존 없음) + spec-server(NestJS 호스트, spec-core의 adapter)
- **4계층 런타임 스택**: spec-server(서버 전용) → spec-core(공용 커널) → Indexing Layer(수학/어휘/프로토콜) → External Semantic(플러그인)
- **의존 방향 원칙**: NestJS App → spec-core → 좌표 레이어 단방향만 허용. 코어가 NestJS에 역방향 의존 금지
- **3가지 소비 경로**: spec-server(HTTP API + DI), CLI(직접 import, DI 없이 경량), 테스트/다른 패키지(직접 import)
- **spec-core 내부 구조**: export-surface, schema(registry/validator/fragments), spec(document/prefix), loader(catalog-bridge), codegen(IR→TS/JS/Proto/JSON Schema)
- **기존 패키지 통합**: weighted-index(encode/decode), demo-snapshot(DEMO_CATALOG로 registry 초기화), index-meta(버전 lifecycle 동기화)
- **함정 방지**: decorator가 source of truth 되는 것 금지, 코어 registry는 반드시 singleton, core에 @nestjs/* import 금지, CQRS 조기 도입 금지

---

## 1. 패키지 구조

```
@qa-sdk/spec-core     순수 TS 커널 (NestJS 의존 없음)
  ├── CLI에서 직접 import     → new SchemaRegistry()
  ├── 테스트에서 직접 import   → new SchemaValidator(registry)
  └── spec-server에서 provider로 감쌈

@qa-sdk/spec-server   NestJS 호스트 (spec-core의 adapter)
  └── spec-core 클래스를 Module/Provider로 조립
```

---

## 2. 런타임 계층

```
┌─────────────────────────────────────────────┐
│  @qa-sdk/spec-server (NestJS 호스트)         │  서버 전용
│  Module · Controller · Interceptor · Guard   │
│  └─ binding, wiring, transport, lifecycle    │
├─────────────────────────────────────────────┤
│  @qa-sdk/spec-core (순수 TS 커널)            │  CLI + 서버 + 테스트 공용
│  ExportSurface · Schema · Spec · Identifier  │
│  └─ 타입, 레지스트리, 검증, 로더            │
├─────────────────────────────────────────────┤
│  Indexing Layer (변경 없음)                   │
│  weighted-index · demo-snapshot · index-meta  │
│  └─ 수학, 어휘, 버전 관리, 프로토콜          │
├─────────────────────────────────────────────┤
│  External Semantic Layer (플러그인)           │
│  Policy · Ontology · Transition              │
│  └─ custom provider로 교체 가능              │
└─────────────────────────────────────────────┘
```

---

## 3. 소비 경로

```
spec-core (순수 TS)
  ├── spec-server (NestJS)     → HTTP API, interceptor, DI
  ├── @qa-sdk/cli (commander)  → 직접 import, DI 없이 경량 사용
  ├── 테스트 (vitest)          → 직접 import
  └── 다른 @qa-sdk/* 패키지   → 직접 import
```

---

## 4. 의존 방향

```
NestJS App → Spec Engine Core → Existing Coordinate Layer
                  ↑
          External Semantic (플러그인)
```

역방향 금지: 코어가 NestJS에 의존하면 안 된다. 코어가 기존 좌표 패키지에 의존하는 것은 허용.

---

## 5. 기존 패키지 통합

### weighted-index

코어에서 직접 import하여 encode/decode 수행.

```typescript
// core/export-surface/export-surface.registry.ts
import { WeightedIndex } from "weighted-index";

// decode → entries lookup → export resolve 체인
```

### demo-snapshot

DEMO_CATALOG에서 axis/prefix 정보를 읽어 registry 초기화.

```typescript
// SpecLoaderService.onModuleInit()
import { DEMO_CATALOG } from "demo-snapshot";

// DEMO_CATALOG의 각 prefix → PrefixSpec으로 변환 → 등록
```

### index-meta

버전 관리 연동. version lifecycle 상태를 spec lifecycle과 동기화 가능.

---

## 6. 패키지 구조 — @qa-sdk/spec-core

```
packages/spec-core/
  package.json                           ← NestJS 의존 없음
  tsconfig.json                          ← decorator 불필요
  src/
    index.ts                             ← 전체 re-export

    export-surface/
      export-surface.types.ts
      export-surface.registry.ts

    schema/
      schema.types.ts
      schema.registry.ts
      schema.validator.ts
      schema.fragments.ts

    spec/
      spec.types.ts
      spec-document.registry.ts
      prefix-spec.types.ts

    loader/
      catalog-bridge.ts              ← DEMO_CATALOG → PrefixSpec[] 변환
      spec-loader.ts                 ← JSON/YAML → SpecDocument/PrefixSpec/SchemaDef/SchemaFragment

    codegen/
      ir.ts                          ← 중간 표현 (IRModule, IREnum, IRStruct)
      ir-builder.ts                  ← 데이터 원천 → IRModule 변환
      ts-generator.ts                ← IR → TypeScript (.ts)
      js-generator.ts                ← IR → ESM (.mjs) / CommonJS (.cjs)
      proto-generator.ts             ← IR → Protobuf proto3 (.proto)
      json-schema-generator.ts       ← IR → JSON Schema draft-2020-12 (.json)

    observation/                     ← Phase 4 (미착수)
      observation.types.ts
      trace-context.ts
      observation-writer.ts

    shared/
      result.ts
      errors.ts
```

---

## 7. 패키지 구조 — @qa-sdk/spec-server

```
packages/spec-server/
  package.json                           ← @nestjs/*, @qa-sdk/spec-core
  tsconfig.json                          ← experimentalDecorators: true
  src/
    main.ts                              ← NestJS bootstrap
    app.module.ts                        ← root module

    modules/
      core-structure.module.ts           ← spec-core → provider 감쌈
      spec-registry.module.ts            ← dynamic module (forRoot)
      runtime-observation.module.ts
      semantic-adapters.module.ts

    controllers/
      registry.controller.ts
      spec.controller.ts

    interceptors/
      trace.interceptor.ts
      contract-binding.interceptor.ts
      logging.interceptor.ts

    decorators/
      boundary.decorator.ts
      contract.decorator.ts
      schema.decorator.ts

    tokens.ts                            ← injection tokens

    features/                            ← 도메인 기능 (Phase 4)
      team/
        team.module.ts
        team.controller.ts
        team.service.ts

  specs/                                 ← spec 파일 (source of truth)
    boundary/
    contract/
    state/
    flow/
```

---

## 8. 함정 방지 체크리스트

| 함정 | 방지 |
|------|------|
| decorator metadata가 source of truth가 됨 | spec 파일/registry가 source of truth. decorator는 binding만. |
| request-scoped registry | 코어 registry는 반드시 singleton |
| 코어 타입이 NestJS에 의존 | core/ 디렉토리에 @nestjs/* import 금지 |
| prefix 구조를 Nest Module 개념으로 치환 | Module은 조립 단위. prefix는 모델 경계. 1:1 대응 금지. |
| CQRS 조기 도입 | 초기에는 service만. 복잡도 증가 후 선택적 도입. |
| DiscoveryService 과용 | 명시적 등록 우선. 자동 수집은 보조 수단. |
