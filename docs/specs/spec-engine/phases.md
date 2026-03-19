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
  ├── 2-1: CLI 통합                             ✅ 7 명령어 + 5 codegen formats
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

@qa-sdk/cli에 spec 명령어 7개 구현. DI 없이 spec-core 직접 import.

공통 옵션: `--catalog` (DEMO_CATALOG 직접 로딩), `--specs <dir>` (파일 기반 로딩). 병행 가능.

```
qa-sdk spec list      [--catalog] [--specs <dir>]                           전체 목록
qa-sdk spec resolve   [--catalog] [--specs <dir>] --prefix <id> --values    Export title
qa-sdk spec validate  [--catalog] [--specs <dir>] --schema <id> --data      L0/L1/L2 검증
qa-sdk spec trace     [--catalog] [--specs <dir>] --id <specId>             추적성 경로
qa-sdk spec decode    [--catalog] --address <prefix:ver:addr> [--deep]      주소 → 제목
                      [--format json]                                       JSON 출력
qa-sdk spec codegen   [--catalog] [--specs <dir>]                           코드 생성
                      [--format ts|esm|cjs|proto|json-schema]
                      [--output <path>]
```

구현 상세:
- `spec list`: prefix별 export dims/pattern/internal/imports/specRef/rationale + schema 6종 + fragment 4종 + spec 문서.
- `spec resolve`: ExportSurfaceRegistry.resolve. 미등록 prefix / 누락 dim 에러 처리.
- `spec validate`: 6 base schemas 기본 제공 (registerPresets). 파일 없이 바로 검증 가능. schema not found 시 available schemas 안내.
- `spec trace`: outgoing/incoming relations + linked prefixes(specRef) + rationale.
- `spec decode`: `prefix:version:address` → decode → entries lookup → export resolve. `--deep`으로 prefix_ref 재귀 분해 (ko 포함). `--format json`으로 pipe 가능한 JSON 출력.
- `spec codegen`: IR(중간 표현) 기반 multi-format 코드 생성 (아래 상세).
- context 캐싱: 같은 옵션이면 registry 재생성 안 함.

### Codegen: IR 기반 multi-format 코드 생성

데이터 원천에서 언어 중립적 IR(Intermediate Representation)을 생성하고, 각 언어 generator가 IR을 소비.

```
데이터 원천 (DEMO_CATALOG + PrefixSpec)
    ↓
  buildIR() → IRModule { enums[], structs[] }
    ↓
  ├── generateFromIR()         → TypeScript (.ts)      ✅ const + type + interface
  ├── generateJSFromIR("esm")  → ESM JavaScript (.mjs) ✅ Object.freeze + _VALUES 배열
  ├── generateCJSFromIR()      → CommonJS (.cjs)       ✅ module.exports
  ├── generateProtoFromIR()    → Protobuf (.proto)     ✅ proto3 enum + message
  └── generateJsonSchemaFromIR() → JSON Schema (.json) ✅ draft-2020-12 + $ref
```

IR 타입 구조:
- `IREnum`: axis entries → { id, values[], capacity }
- `IRStruct`: export surface → { id, fields[], description }
- `IRField`: dim → { name, enumRef, dimKind }
- `IRModule`: { enums[], structs[] }

새 언어 추가: `IRModule`을 소비하는 generator 함수 하나만 구현. 데이터 원천 변경 불필요.

### 표준 Presets

6 base schemas + 4 fragments가 기본 내장 (`registerPresets()`):

| Schema | Category | Axes |
|--------|----------|------|
| event.base | event | event_kind, action + HasActor, HasTarget |
| entity.base | entity | entity_kind, state + Identified |
| relation.base | relation | source_ref, relation_kind, target_ref, qualifier |
| state.base | state | subject_ref, state_kind, state_value, scope |
| policy.base | policy | subject, action, resource, effect, scope |
| observation.base | observation | observed_ref, observation_kind, metric, trace_id |

검증 완료:
- [x] 7개 명령어 모두 동작
- [x] --catalog로 DEMO_CATALOG 10개 prefix 직접 로딩
- [x] decode: 3단계 해상도 (표면 title → 내부 분해 → deep resolve with ko)
- [x] decode --format json: pipe 가능한 구조화 JSON
- [x] codegen: 5 format 모두 동작 (ts, esm, cjs, proto, json-schema)
- [x] validate: 기본 schema 6종으로 파일 없이 즉시 검증
- [x] 에러 처리: 인자 누락, dim 누락, schema/spec not found, 미존재 디렉토리, 잘못된 주소 형식

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
