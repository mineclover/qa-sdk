# Spec Engine — 구현 단계 계획

> **Status: IN PROGRESS**
>
> 목표: 작은 세계를 구체화하는 도구 인프라
>
> indexing 레이어(수학/어휘/버전/프로토콜)는 변경 없이 유지.
> spec-engine은 그 위에서 "왜 이 구성인가, 밖에서 뭘 보는가"를 정의한다.

---

## 패키지 분리 원칙

```
packages/
  spec-core/          ← 순수 TS 커널 (NestJS 의존 없음)
  spec-server/        ← NestJS 호스트 (spec-core를 provider로 감쌈) — 미착수
```

### 소비 경로

```
spec-core (순수 TS)
  ├── spec-server (NestJS)     → HTTP API, interceptor, DI       ○ 미착수
  ├── @qa-sdk/cli (commander)  → 직접 import, DI 없이 경량 사용  ✅ 구현
  ├── vitest                   → 직접 import                     ✅ 61 tests
  └── 다른 @qa-sdk/* 패키지   → 직접 import
```

---

## 의존 그래프

```
Phase 1: spec-core 기반 (순수 TS 커널)        ✅ 완료
  │
  ├── 1-1: 타입 + 레지스트리 + 검증기          ✅ 28 tests
  ├── 1-2: DEMO_CATALOG 브릿지                 ✅ 10 tests
  └── 1-3: spec 파일 로더                       ✅ 9 tests
  │
  ▼
Phase 2: 소비 경로
  │
  ├── 2-1: CLI 통합                             ✅ 4 명령어 동작
  └── 2-2: spec-server (NestJS 호스트 + API)   ○ 미착수
  │
  ▼
Phase 3: 좌표계 시나리오 검증                   ✅ 14 tests
  │
  ▼
Phase 4: 관측 계층 (선택적)                     ○ 미착수
  │
  ▼
Phase 5: 확장 (선택적)                          ○ 미착수
```

---

## Phase 1: spec-core 기반 (순수 TS 커널) ✅ 완료

61 tests pass. NestJS 의존 없음. tsc 빌드 성공.

### 1-1: 타입 + 레지스트리 + 검증기 ✅

| 파일 | 역할 | 상태 |
|------|------|------|
| `export-surface/export-surface.types.ts` | ExportSurface 타입 | ✅ |
| `export-surface/export-surface.registry.ts` | 등록/조회/resolve | ✅ 9 tests |
| `schema/schema.types.ts` | SchemaCategory, SchemaAxis, SchemaDef, Fragment, Constraint | ✅ |
| `schema/schema.registry.ts` | 스키마 + fragment 등록/조회/resolve | ✅ |
| `schema/schema.validator.ts` | L0→L1→L2 검증 파이프라인 | ✅ 12 tests |
| `spec/spec.types.ts` | SpecId, SpecType, SpecRelation, SpecDocument | ✅ |
| `spec/spec-document.registry.ts` | spec 문서 등록/조회/관계 탐색 | ✅ 7 tests |
| `spec/prefix-spec.types.ts` | PrefixSpec (export + schema + specRef + DimRef) | ✅ |
| `shared/result.ts` | Result<T, E> 유틸 | ✅ |
| `shared/errors.ts` | SpecError, DuplicateRegistrationError, NotFoundError, ValidationError | ✅ |
| `index.ts` | 전체 re-export | ✅ |

### 1-2: DEMO_CATALOG 브릿지 ✅

| 파일 | 역할 | 상태 |
|------|------|------|
| `loader/catalog-bridge.ts` | DEMO_CATALOG → PrefixSpec[] 변환 | ✅ 10 tests |

- axis dims → export surface에 포함
- table_ref dims → export에서 자동 제외
- prefix_ref dims → export에 포함 + imports에 매핑
- export pattern 자동 추론: axis/prefix_ref dims를 `.`으로 연결
- CatalogInput 인터페이스로 demo-snapshot 강결합 방지

### 1-3: spec 파일 로더 ✅

| 파일 | 역할 | 상태 |
|------|------|------|
| `loader/spec-loader.ts` | JSON/YAML 파일 기반 로딩 | ✅ 9 tests |

파일 유형 자동 판별:
- `category` + `axes` → SchemaDef
- `axes` (without `category`, `dims`) → SchemaFragment
- `export` + `dims` → PrefixSpec
- `type` + `id` → SpecDocument

검증:
- 필수 필드 누락 시 명확한 에러 (파일 경로 + 필드명)
- 디렉토리 미존재 시 에러 반환 (throw 안 함)
- 비지원 확장자 (`.xml` 등) throw

---

## Phase 2: 소비 경로

### 2-1: CLI 통합 ✅

@qa-sdk/cli에 spec 명령어 4개 구현. DI 없이 spec-core 직접 import.

```
qa-sdk spec list     [--specs <dir>]    Prefix + Schema + Fragment + Spec 문서 전체 목록
qa-sdk spec resolve  [--specs <dir>] --prefix <id> --values <json>   Export title 생성
qa-sdk spec validate [--specs <dir>] --schema <id> --data <json>     L0/L1/L2 검증
qa-sdk spec trace    [--specs <dir>] --id <specId>                   추적성 경로 조회
```

구현 상세:
- `spec list`: prefix별 export dims/pattern/internal/imports/specRef/rationale 표시. schema + fragment + spec 문서도 함께 표시.
- `spec resolve`: ExportSurfaceRegistry.resolve 호출. 미등록 prefix / 누락 dim 에러 처리.
- `spec validate`: SchemaRegistry에서 schema 로딩 → SchemaValidator.validate. schema not found 시 available schemas 안내.
- `spec trace`: SpecDocumentRegistry에서 outgoing/incoming relations + linked prefixes(specRef) 추적.
- context 캐싱: 같은 옵션이면 registry 재생성 안 함.

검증 완료:
- [x] @qa-sdk/cli에서 spec-core import 성공 (빌드 에러 없음)
- [x] DI 없이 직접 인스턴스화 동작
- [x] 4개 명령어 모두 동작 (list, resolve, validate, trace)
- [x] 에러 처리: 인자 누락, dim 값 누락, schema not found, spec not found, 디렉토리 미존재

### 2-2: spec-server (NestJS 호스트) ○ 미착수

spec-core를 NestJS provider로 감싸 HTTP API 제공.

```
packages/spec-server/
  src/
    main.ts
    app.module.ts
    modules/
      core-structure.module.ts      ← spec-core → provider
      spec-registry.module.ts       ← dynamic module (forRoot)
    controllers/
      registry.controller.ts        ← schema/export-surface 조회
      spec.controller.ts            ← spec document 조회
    tokens.ts
```

```typescript
@Module({
  providers: [
    ExportSurfaceRegistry,
    SchemaRegistry,
    {
      provide: SchemaValidator,
      useFactory: (r: SchemaRegistry) => new SchemaValidator(r),
      inject: [SchemaRegistry],
    },
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

검증 기준:
- [ ] NestJS 앱 부팅 성공
- [ ] `GET /schemas/:id` → schema 정의 반환
- [ ] `GET /exports/:prefixId/resolve?dim=value` → export title
- [ ] `GET /specs/:id` → spec document 반환

---

## Phase 3: 좌표계 시나리오 검증 ✅ 완료

14 tests pass (scenarios.test.ts). DEMO_CATALOG 실제 prefix로 end-to-end 증명.

| 시나리오 | 검증 내용 | 상태 |
|----------|----------|------|
| service (all axis, 4D) | DEMO_CATALOG 전체 prefix 변환 + decode→export | ✅ |
| cart_event (table_ref 제외) | table_ref 자동 제외 + action만 export | ✅ |
| permission (prefix_ref) | prefix_ref+axis export + imports 매핑 + resolveAddress 깊은 분해 | ✅ |
| order_event (혼합) | prefix_ref+axis export, table_ref 제외 | ✅ |
| 3단계 해상도 | key→title→decompose→deep resolve 전체 파이프라인 | ✅ |
| 전체 prefix 라운드트립 | 모든 DEMO_CATALOG prefix의 address 0에서 export resolve 동작 | ✅ |

---

## Phase 4: 관측 계층 (선택적) ○ 미착수

좌표계 시나리오 검증 이후, 필요 시 도입.

### spec-core (순수 TS)

| 파일 | 역할 |
|------|------|
| `observation/observation.types.ts` | Observation 타입 |
| `observation/trace-context.ts` | ALS 기반 trace context (Node.js 전용이지만 NestJS 의존 없음) |
| `observation/observation-writer.ts` | 기록 서비스 |

### spec-server (NestJS 전용)

| 파일 | 역할 |
|------|------|
| `modules/runtime-observation.module.ts` | NestJS 모듈 |
| `interceptors/trace.interceptor.ts` | trace_id 주입 |
| `interceptors/contract-binding.interceptor.ts` | metadata → context |
| `interceptors/logging.interceptor.ts` | 시작/종료/예외 기록 |
| `decorators/boundary.decorator.ts` | @Boundary() |
| `decorators/contract.decorator.ts` | @Contract() |

도입 조건:
- 서비스에서 요청 단위 추적이 필요할 때
- 좌표 기반 로깅을 실제로 수집할 때

---

## Phase 5: 확장 (선택적) ○ 미착수

| 항목 | 조건 |
|------|------|
| SemanticAdaptersModule | Layer 3 규칙이 필요할 때 |
| DiscoveryService 자동 수집 | contract 수가 많아질 때 |
| CQRS | command/query 분리가 필요할 때 |
| dynamic module forFeature | 다중 도메인 모듈 패턴이 필요할 때 |

---

## 기술 스택

| 항목 | spec-core | spec-server |
|------|-----------|-------------|
| 런타임 | Node.js | NestJS v10+ |
| HTTP | — | @nestjs/platform-express |
| 타입 | 순수 TypeScript | TypeScript + decorators |
| 빌드 | tsc ESM only | tsc ESM only |
| decorator | 불필요 | experimentalDecorators: true |
| 테스트 | vitest | vitest + @nestjs/testing |
| 좌표 연산 | weighted-index (import) | spec-core 경유 |
| 카탈로그 | demo-snapshot (import) | spec-core 경유 |

### spec-core tsconfig

```jsonc
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

### spec-server tsconfig

```jsonc
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src"]
}
```

### package.json 의존성

**spec-core:**
```jsonc
{
  "name": "@qa-sdk/spec-core",
  "type": "module",
  "dependencies": {
    "weighted-index": "workspace:*",
    "demo-snapshot": "workspace:*"
  }
}
```

**spec-server:**
```jsonc
{
  "name": "@qa-sdk/spec-server",
  "type": "module",
  "dependencies": {
    "@qa-sdk/spec-core": "workspace:*",
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  }
}
```
