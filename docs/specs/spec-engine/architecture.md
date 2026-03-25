---
def:
  id: spec-engine-architecture
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: deprecated
  links:
    - target: convergence-layer-spec
      type: refines
---
# Spec Engine — 아키텍처 + NestJS 모듈 매핑

## 목적 ^purpose

2-패키지 분리: **spec-core** (순수 TS 커널) + **spec-server** (NestJS 호스트).
CLI는 spec-core를 직접 import. 서버만 NestJS.
decorator는 binding metadata이고, source of truth는 spec/registry.

---

## 1. 계층 분리 원칙

### 패키지 구조

```
@qa-sdk/spec-core     순수 TS 커널 (NestJS 의존 없음)
  ├── CLI에서 직접 import     → new SchemaRegistry()
  ├── 테스트에서 직접 import   → new SchemaValidator(registry)
  └── spec-server에서 provider로 감쌈

@qa-sdk/spec-server   NestJS 호스트 (spec-core의 adapter)
  └── spec-core 클래스를 Module/Provider로 조립
```

### 런타임 계층

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

### 소비 경로

```
spec-core (순수 TS)
  ├── spec-server (NestJS)     → HTTP API, interceptor, DI
  ├── @qa-sdk/cli (commander)  → 직접 import, DI 없이 경량 사용
  ├── 테스트 (vitest)          → 직접 import
  └── 다른 @qa-sdk/* 패키지   → 직접 import
```

### 의존 방향

```
NestJS App → Spec Engine Core → Existing Coordinate Layer
                  ↑
          External Semantic (플러그인)
```

역방향 금지: 코어가 NestJS에 의존하면 안 된다. 코어가 기존 좌표 패키지에 의존하는 것은 허용.

---

## 2. NestJS 모듈 구성

### 2.1 CoreStructureModule

가장 중요한 코어. **singleton** 중심.

```typescript
@Module({
  providers: [
    ExportSurfaceRegistry,
    SchemaRegistry,
    SchemaValidator,
    SpecDocumentRegistry,
  ],
  exports: [
    ExportSurfaceRegistry,
    SchemaRegistry,
    SchemaValidator,
    SpecDocumentRegistry,
  ],
})
export class CoreStructureModule {}
```

포함:
- `ExportSurfaceRegistry` — prefix별 export surface 관리
- `SchemaRegistry` — Layer 2 스키마 + fragment 관리
- `SchemaValidator` — L0→L1→L2 검증 파이프라인
- `SpecDocumentRegistry` — spec 문서 관리

규칙:
- 모든 provider는 **singleton**
- request-scoped 금지 (scope 전파 방지)
- 코어 클래스는 순수 TS — `@Injectable()` 데코레이터만 추가

### 2.2 SpecRegistryModule

spec 파일 로딩 + 초기화.

```typescript
@Module({})
export class SpecRegistryModule {
  static forRoot(options: SpecRegistryOptions): DynamicModule {
    return {
      module: SpecRegistryModule,
      imports: [CoreStructureModule],
      providers: [
        { provide: SPEC_OPTIONS, useValue: options },
        SpecLoaderService,
      ],
      exports: [SpecLoaderService],
    };
  }
}
```

```typescript
interface SpecRegistryOptions {
  /** spec 파일 경로 */
  specPath: string;
  /** spec 파일 형식 */
  format: "yaml" | "json" | "ts";
}
```

역할:
- 파일 기반 spec 로딩 (YAML/JSON/TS)
- 앱 부팅 시 `OnModuleInit`에서 registry에 적재
- source of truth: 파일 시스템의 spec 정의

### 2.3 RuntimeObservationModule

trace/logging/observation.

```typescript
@Module({
  providers: [
    TraceContextService,
    ObservationWriterService,
    TraceInterceptor,
    LoggingInterceptor,
  ],
  exports: [
    TraceContextService,
    ObservationWriterService,
  ],
})
export class RuntimeObservationModule {}
```

포함:
- `TraceContextService` — ALS 기반 trace_id/boundary_id/contract_id 관리
- `ObservationWriterService` — 구조형 로그/이벤트 기록
- `TraceInterceptor` — trace_id 생성/전파
- `LoggingInterceptor` — 시작/종료/예외 기록

### 2.4 SemanticAdaptersModule

외부 의미 엔진 연결. custom provider로 교체 가능.

```typescript
@Module({
  providers: [
    { provide: POLICY_PORT, useClass: SimplePolicyAdapter },
    { provide: ONTOLOGY_PORT, useClass: NoopOntologyAdapter },
    { provide: TRANSITION_VALIDATOR_PORT, useClass: DefaultTransitionValidator },
  ],
  exports: [POLICY_PORT, ONTOLOGY_PORT, TRANSITION_VALIDATOR_PORT],
})
export class SemanticAdaptersModule {}
```

### 2.5 Feature Modules

실제 도메인 기능. 코어를 **사용만** 하고 **정의하지 않음**.

```typescript
@Module({
  imports: [
    CoreStructureModule,
    SpecRegistryModule,
    RuntimeObservationModule,
  ],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
```

---

## 3. 모듈 의존 그래프

```
AppModule
  ├── CoreStructureModule (singleton core)
  ├── SpecRegistryModule.forRoot({ specPath: "./specs" })
  │     └── CoreStructureModule (import)
  ├── RuntimeObservationModule
  ├── SemanticAdaptersModule
  └── Feature Modules
        ├── TeamModule
        │     └── CoreStructureModule, SpecRegistryModule, RuntimeObservationModule
        ├── AuthModule
        └── TrackingModule
```

---

## 4. Decorator 설계

decorator는 **source of truth가 아니라 binding metadata**.

### 정의

```typescript
// 경계 바인딩 — controller에 부착
export const Boundary = (id: string) => SetMetadata("boundary_id", id);

// 계약 바인딩 — handler에 부착
export const Contract = (id: string) => SetMetadata("contract_id", id);

// 스키마 바인딩 — handler에 부착
export const Schema = (id: string) => SetMetadata("schema_id", id);
```

### 사용

```typescript
@Controller("teams")
@Boundary("boundary.cms.team")
export class TeamController {
  @Post()
  @Contract("contract.api.team.create")
  @Schema("schema:event.team_create:v1")
  async create(@Body() body: CreateTeamDto) {
    // ...
  }
}
```

### 수집

`DiscoveryService`로 런타임에 metadata 수집 가능:

```typescript
@Injectable()
export class ContractDiscoveryService implements OnModuleInit {
  constructor(private discovery: DiscoveryService) {}

  async onModuleInit() {
    const controllers = this.discovery.getControllers();
    // metadata에서 boundary_id, contract_id 수집 → 인덱싱
  }
}
```

---

## 5. Interceptor 설계

### TraceInterceptor

```typescript
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(private trace: TraceContextService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const traceId = extractOrGenerate(ctx);
    return this.trace.run(traceId, () => next.handle());
  }
}
```

### ContractBindingInterceptor

```typescript
@Injectable()
export class ContractBindingInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private trace: TraceContextService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const boundaryId = this.reflector.get("boundary_id", ctx.getClass());
    const contractId = this.reflector.get("contract_id", ctx.getHandler());
    this.trace.setBoundary(boundaryId);
    this.trace.setContract(contractId);
    return next.handle();
  }
}
```

---

## 6. Request Context vs Core Registry

| 종류 | Scope | 관리 방식 |
|------|-------|----------|
| ExportSurfaceRegistry | **singleton** | app lifetime |
| SchemaRegistry | **singleton** | app lifetime |
| SpecDocumentRegistry | **singleton** | app lifetime |
| SchemaValidator | **singleton** | app lifetime |
| trace_id | **request** | ALS (TraceContextService) |
| boundary_id | **request** | ALS |
| contract_id | **request** | ALS |
| actor_ref | **request** | ALS |

코어 registry를 request-scoped로 만들면 안 되는 이유:
- NestJS에서 scope가 의존 체인으로 전파
- registry가 request-scoped → registry를 주입받는 모든 service가 request-scoped
- 성능 저하 + 불필요한 인스턴스 생성

---

## 7. 패키지 구조

### @qa-sdk/spec-core (순수 TS 커널)

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

### @qa-sdk/spec-server (NestJS 호스트)

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

## 8. 기존 패키지 통합

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

## 9. 함정 방지 체크리스트

| 함정 | 방지 |
|------|------|
| decorator metadata가 source of truth가 됨 | spec 파일/registry가 source of truth. decorator는 binding만. |
| request-scoped registry | 코어 registry는 반드시 singleton |
| 코어 타입이 NestJS에 의존 | core/ 디렉토리에 @nestjs/* import 금지 |
| prefix 구조를 Nest Module 개념으로 치환 | Module은 조립 단위. prefix는 모델 경계. 1:1 대응 금지. |
| CQRS 조기 도입 | 초기에는 service만. 복잡도 증가 후 선택적 도입. |
| DiscoveryService 과용 | 명시적 등록 우선. 자동 수집은 보조 수단. |
