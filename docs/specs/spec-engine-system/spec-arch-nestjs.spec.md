---
def:
  id: spec-arch-nestjs
  address: def_document:v2:137361
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: spec-core
  tags: [runtime, observability, structural]
  links:
    - target: spec-arch-interceptors
      type: refines
---
# NestJS 모듈 구성과 의존 그래프

## 목적 ^purpose

NestJS 모듈 구성과 의존 그래프. Request Context와 Core Registry의 분리.

## 구성 ^overview

- **CoreStructureModule**: ExportSurfaceRegistry, SchemaRegistry, SchemaValidator, SpecDocumentRegistry를 singleton으로 관리하는 코어 모듈
- **SpecRegistryModule**: forRoot 패턴으로 spec 파일(YAML/JSON/TS)을 로딩하고 OnModuleInit에서 registry에 적재
- **RuntimeObservationModule**: ALS 기반 TraceContextService와 ObservationWriterService로 trace/logging/observation 처리
- **SemanticAdaptersModule**: 정책/온톨로지/전이 검증기를 custom provider로 교체 가능한 외부 의미 엔진 어댑터
- **Feature Modules**: 코어를 사용만 하고 정의하지 않는 도메인 기능 모듈(TeamModule, AuthModule 등)
- **singleton 원칙**: 코어 registry를 request-scoped로 만들면 NestJS scope 전파로 성능 저하 발생, 반드시 singleton 유지
- **Request Context 분리**: trace_id/boundary_id/contract_id/actor_ref는 ALS 기반 request scope로, 코어 registry와 명확히 분리

---

## 1. CoreStructureModule

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

---

## 2. SpecRegistryModule

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

---

## 3. RuntimeObservationModule

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

---

## 4. SemanticAdaptersModule

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

---

## 5. Feature Modules

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

## 6. 모듈 의존 그래프

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

## 7. Request Context vs Core Registry

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
