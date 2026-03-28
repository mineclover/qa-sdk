---
def:
  id: spec-core-types
  address: def_document:v2:342201
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
  links:
    - target: definition-catalog-spec
      type: depends_on
---

# Spec Engine — 코어 타입 정의

## 목적 ^purpose

framework-agnostic 순수 TypeScript 타입. NestJS 의존 없음. CLI, 테스트, 다른 런타임에서 직접 import하여 사용 중.

---

## 1. Export Surface — 모듈의 공개 식별자

prefix가 외부에 노출하는 제목(title) 패턴. 모듈의 `exports`에 해당.

```typescript
/**
 * prefix의 export surface 정의.
 * 어떤 차원이 외부에 보이고, 어떤 패턴으로 제목이 구성되는지.
 */
interface ExportSurface {
  /** 제목에 포함되는 차원 ID 목록 (순서 보장) */
  dims: string[];

  /** 제목 구성 패턴. 차원 ID를 {} 로 참조.
   *  예: "{action}.{role}" → "add.admin"
   */
  pattern: string;
}
```

### export에 포함/제외되는 차원

| 포함 (export dims) | 제외 (internal dims) |
|---|---|
| 좌표의 정체성을 결정하는 차원 | 컨텍스트 차원 (env, region 등) |
| prefix 간 구별에 필요한 차원 | 런타임 데이터 (table_ref) |

### 예시

```typescript
// permission prefix: 4차원 중 2차원만 export
{
  id: "permission",
  dims: {
    action: { kind: "axis", axisId: "action" },
    role:   { kind: "axis", axisId: "role" },
    env:    { kind: "axis", axisId: "env" },       // 내부
    svc:    { kind: "prefix_ref", prefixId: "service" }, // 내부
  },
  export: {
    dims: ["action", "role"],
    pattern: "{action}.{role}",
  },
}
// permission:v1:42 → title: "add.admin"
//   action, role만 제목에 드러남
//   env, svc는 분해해야 보임

// service prefix: 3차원 중 2차원 export
{
  id: "service",
  dims: {
    env:      { kind: "axis", axisId: "env" },
    region:   { kind: "axis", axisId: "region" },   // 내부
    svc_name: { kind: "axis", axisId: "svc_name" },
  },
  export: {
    dims: ["env", "svc_name"],
    pattern: "{env}/{svc_name}",
  },
}
// service:v1:40 → title: "prod/shopping-web"

// cart_event prefix: table_ref는 자동 제외
{
  id: "cart_event",
  dims: {
    actor:  { kind: "table_ref", table: "members" },  // 런타임, export 불가
    action: { kind: "axis", axisId: "cart_action" },
    target: { kind: "table_ref", table: "items" },     // 런타임, export 불가
  },
  export: {
    dims: ["action"],
    pattern: "{action}",
  },
}
// cart_event:v1:0 → title: "add"
```

### resolve 연산

```typescript
/**
 * export surface를 기반으로 좌표의 제목을 생성한다.
 *
 * @param surface - prefix의 export surface 정의
 * @param values - entries lookup 결과 (차원 ID → entry 문자열)
 * @returns 제목 문자열
 *
 * 예: resolve(permExport, { action: "add", role: "admin" }) → "add.admin"
 */
function resolveExportTitle(
  surface: ExportSurface,
  values: Record<string, string>,
): string;
```

---

## 2. Schema — Layer 2 구조 정의

[schema-layer.md](../indexing/schema-layer.md)에서 정의한 6 기본 카테고리 + SchemaAxis + Fragment.

### 2.1 Schema Category

도메인 개념이 아니라 **구조 역할(role of structure)** 6종.

```typescript
type SchemaCategory =
  | "entity"       // 정체성을 가진 것
  | "event"        // 발생한 것
  | "relation"     // 둘 이상의 객체 간 연결
  | "state"        // 상태 스냅샷
  | "policy"       // 권한/적용 범위/판정 구조
  | "observation"; // 관측/로깅/추적
```

### 2.2 SchemaAxis

스키마의 각 축(slot) 정의.

```typescript
interface SchemaAxis {
  /** 축 ID (vocabulary의 VersionedAxis.id 또는 테이블 참조명) */
  axisId: string;

  /** 필수 여부 */
  required: boolean;

  /** 복수 값 허용 여부 */
  multi: boolean;

  /** 값 유형 */
  valueType: "vocabulary" | "ref" | "literal" | "coordinate";

  /** vocabulary 축 참조 (valueType이 "vocabulary"일 때) */
  vocabularyRef?: string;

  /** 기본값 */
  defaultValue?: string | number;
}
```

### 2.3 SchemaDef

스키마 정의. category + axes + constraints.

```typescript
interface SchemaDef {
  /** 스키마 식별자. 형식: "{category}.{name}" */
  id: string;

  /** 버전 */
  version: string;

  /** 구조 카테고리 (6종) */
  category: SchemaCategory;

  /** 축 정의 */
  axes: Record<string, SchemaAxis>;

  /** Fragment 참조 (조합) */
  use?: string[];

  /** 구조적 제약 */
  constraints?: SchemaConstraint[];
}
```

### 2.4 SchemaFragment

공통 구조를 fragment로 추출. 상속이 아니라 조합.

```typescript
interface SchemaFragment {
  /** fragment 식별자 */
  id: string;

  /** 축 정의 (스키마에 합성됨) */
  axes: Record<string, SchemaAxis>;
}
```

### 2.5 SchemaConstraint

구조적 제약만. 의미적 규칙(Layer 3)은 여기에 넣지 않는다.

```typescript
interface SchemaConstraint {
  /** 제약 종류 */
  rule: "maxCount" | "minCount" | "requiredIf" | "exclusive";

  /** 대상 축 */
  axis: string;

  /** 값 (maxCount/minCount에 사용) */
  value?: number;

  /** 조건 (requiredIf에 사용) */
  condition?: { axis: string; value: string };
}
```

### 2.6 예시: event 스키마

```typescript
// Fragment 정의
const HasActor: SchemaFragment = {
  id: "HasActor",
  axes: {
    actor_ref: { axisId: "actor_ref", required: false, multi: false, valueType: "ref" },
  },
};

const HasTarget: SchemaFragment = {
  id: "HasTarget",
  axes: {
    target_ref: { axisId: "target_ref", required: false, multi: false, valueType: "ref" },
  },
};

// 이벤트 기본 스키마
const eventBase: SchemaDef = {
  id: "event.base",
  version: "v1",
  category: "event",
  use: ["HasActor", "HasTarget"],
  axes: {
    event_kind: { axisId: "event_kind", required: true, multi: false, valueType: "vocabulary", vocabularyRef: "event_name" },
    action:     { axisId: "action", required: true, multi: false, valueType: "vocabulary", vocabularyRef: "cart_action" },
  },
  constraints: [
    { rule: "maxCount", axis: "actor_ref", value: 1 },
    { rule: "maxCount", axis: "target_ref", value: 1 },
  ],
};
```

---

## 3. PrefixSpec — prefix의 완전한 명세

export surface + schema + 설계 근거를 하나로 묶는 최상위 타입.

```typescript
interface PrefixSpec {
  /** prefix 식별자 */
  id: string;

  /** 버전 */
  version: string;

  /** 전체 차원 (내부 + 외부) */
  dims: Record<string, DimRef>;

  /** export surface — 모듈의 공개 인터페이스 */
  export: ExportSurface;

  /** 다른 prefix 참조 (모듈 imports) */
  imports?: Record<string, string>;

  /** 스키마 바인딩 */
  schema?: {
    /** 구조 카테고리 */
    category: SchemaCategory;
    /** 스키마 정의 참조 */
    schemaRef?: string;
  };

  /** 설계 근거 */
  rationale?: string;

  /** 스펙 문서 참조 */
  specRef?: SpecId;
}
```

---

## 4. Spec Document — 설계 근거 문서

c4-doc의 문서 타입 체계에서 좌표계에 필요한 것만 추출.

### 4.1 SpecType

```typescript
/** 스펙 문서 유형 (c4-doc에서 추출) */
type SpecType =
  | "req"   // 요구사항 — 왜 이 prefix가 필요한가
  | "feat"  // 기능 — 이 prefix가 무엇을 하는가
  | "uc"    // 유즈케이스 — 이 prefix가 어떻게 쓰이는가
  | "evt"   // 이벤트 — 이 prefix가 어떤 이벤트를 나타내는가
  | "ls"    // 로직 스펙 — 이 prefix의 행위 규칙
  | "adr";  // 아키텍처 결정 — 이 prefix 설계에 대한 결정 기록
```

### 4.2 SpecId

```typescript
/**
 * 스펙 문서 식별자.
 * 계층적 구조: "FEAT-003", "FEAT-003-LS-01", "FEAT-003-LS-01-TC-01"
 */
type SpecId = string;
```

### 4.3 SpecRelation

```typescript
/** 스펙 문서 간 관계 */
interface SpecRelation {
  from: SpecId;
  to: SpecId;
  type:
    | "satisfies"    // 요구사항을 충족
    | "implements"   // 기능을 구현
    | "tests"        // 로직을 검증
    | "traces-to"    // 추적 연결
    | "depends-on";  // 의존
}
```

### 4.4 SpecDocument

```typescript
interface SpecDocument {
  id: SpecId;
  type: SpecType;
  title: string;
  lifecycle: "draft" | "active" | "deprecated";
  rationale?: string;
  relations?: SpecRelation[];
}
```

### 4.5 prefix ↔ spec 연결

```typescript
// prefix가 spec을 참조
const permissionSpec: PrefixSpec = {
  id: "permission",
  version: "v1",
  // ...
  specRef: "FEAT-003",          // ← 이 prefix는 FEAT-003에서 정의됨
  rationale: "서비스별 역할 권한 분리",
};

// spec이 prefix를 추적
const feat003: SpecDocument = {
  id: "FEAT-003",
  type: "feat",
  title: "서비스별 역할 권한 분리",
  lifecycle: "active",
  relations: [
    { from: "FEAT-003", to: "REQ-001", type: "satisfies" },
    { from: "FEAT-003-LS-01", to: "FEAT-003", type: "implements" },
  ],
};

// 추적 경로:
// REQ-001 ← satisfies ← FEAT-003 → PrefixSpec("permission")
//                           ↓
//                     FEAT-003-LS-01 (로직 규칙)
//                           ↓
//                     FEAT-003-LS-01-TC-01 (테스트)
```

---

## 5. Core Registry — 순수 TypeScript 서비스

NestJS 의존 없는 순수 클래스. NestJS에서는 Provider로 감싸서 DI에 올린다.

### 5.1 ExportSurfaceRegistry

```typescript
class ExportSurfaceRegistry {
  private surfaces: Map<string, ExportSurface>;

  /** prefix의 export surface 등록 */
  register(prefixId: string, surface: ExportSurface): void;

  /** prefix의 export surface 조회 */
  get(prefixId: string): ExportSurface | undefined;

  /** 좌표의 제목 생성 */
  resolve(prefixId: string, values: Record<string, string>): string;

  /** 등록된 모든 prefix ID */
  keys(): string[];
}
```

### 5.2 SchemaRegistry

```typescript
class SchemaRegistry {
  private schemas: Map<string, SchemaDef>;
  private fragments: Map<string, SchemaFragment>;

  registerSchema(schema: SchemaDef): void;
  registerFragment(fragment: SchemaFragment): void;
  getSchema(schemaId: string): SchemaDef | undefined;
  getFragment(fragmentId: string): SchemaFragment | undefined;

  /** fragment를 resolve하여 완전한 axes를 반환 */
  resolveSchema(schemaId: string): SchemaDef;

  /** category별 스키마 목록 */
  getByCategory(category: SchemaCategory): SchemaDef[];
}
```

### 5.3 SchemaValidator

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  layer: 0 | 1 | 2;
  axis?: string;
  rule: string;
  message: string;
}

class SchemaValidator {
  constructor(private registry: SchemaRegistry);

  /** Layer 0 → 1 → 2 순서로 검증 */
  validate(schemaId: string, data: Record<string, unknown>): ValidationResult;

  /** Layer 0: vocabulary 값 유효성 */
  validateVocabulary(axis: SchemaAxis, value: unknown): ValidationError[];

  /** Layer 1: 좌표 구조 정규성 */
  validateCoordinate(schema: SchemaDef, data: Record<string, unknown>): ValidationError[];

  /** Layer 2: 구조적 제약 (required, cardinality, exclusive) */
  validateConstraints(schema: SchemaDef, data: Record<string, unknown>): ValidationError[];
}
```

### 5.4 SpecDocumentRegistry

```typescript
class SpecDocumentRegistry {
  private docs: Map<SpecId, SpecDocument>;

  register(doc: SpecDocument): void;
  get(id: SpecId): SpecDocument | undefined;

  /** 특정 spec에서 출발하는 모든 관계 */
  relationsFrom(id: SpecId): SpecRelation[];

  /** 특정 spec을 참조하는 모든 관계 */
  relationsTo(id: SpecId): SpecRelation[];

  /** prefix가 참조하는 spec 조회 */
  getForPrefix(specRef: SpecId): SpecDocument | undefined;

  /** lifecycle 기준 필터 */
  getByLifecycle(lifecycle: "draft" | "active" | "deprecated"): SpecDocument[];
}
```

---

## 6. 식별자 체계 통합

### 기존 식별자 (변경 없음)

| 종류 | 형태 | 예시 |
|------|------|------|
| 좌표 주소 | `{prefixId}:{version}:{address}` | `permission:v1:42` |
| 스키마 식별자 | `schema:{category}.{name}:{version}` | `schema:event.base:v1` |
| vocabulary 식별자 | `vocab:{axisId}:{version}` | `vocab:action:v3` |
| axis 식별자 | `axis:{axisId}` | `axis:action` |

### 신규 식별자 (spec-engine 추가)

| 종류 | 형태 | 예시 |
|------|------|------|
| **export title** | `{export pattern 결과}` | `"add.admin"` |
| **prefix spec** | `spec:prefix:{prefixId}` | `spec:prefix:permission` |
| **spec document** | `{TYPE}-{NNN}` (c4-doc 호환) | `FEAT-003`, `FEAT-003-LS-01` |
| **spec relation** | `{from} → {type} → {to}` | `FEAT-003 → satisfies → REQ-001` |

### 좌표 → 제목 변환 전체 흐름

```
입력: permission:v1:42

1. decode(42) → { action: 10, role: 20, env: 0, svc: 40 }        [weighted-index]
2. entries lookup → { action: "add", role: "admin", env: "dev", ... } [LabelRegistry]
3. export resolve("permission", values) → "add.admin"               [ExportSurfaceRegistry]

결과: permission:v1:42 = "add.admin"
```

분해 시:
```
4. resolveAddress(42) → { env: "dev", svc → service:v1:40 → ... }  [demo-accessors]
5. specRef → FEAT-003 → "서비스별 역할 권한 분리"                      [SpecDocumentRegistry]
```

---

## 7. Codegen IR — 언어 중립적 중간 표현

데이터 원천에서 언어 중립적 IR(Intermediate Representation)을 생성하고, 각 언어 generator가 IR만 소비하여 코드를 출력한다. 새 언어를 추가할 때 데이터 원천을 건드리지 않아도 된다.

### 7.1 IR 타입

```typescript
/** enum: axis entries 등 유한 집합 */
interface IREnum {
  id: string;
  capacity?: number;
  values: IREnumValue[];
}

interface IREnumValue {
  name: string;       // 원본 entry 문자열
  index: number;      // 0-based position
  label?: string;     // ko 등 번역
}

/** struct: export surface 등 */
interface IRStruct {
  id: string;
  description?: string;
  fields: IRField[];
}

interface IRField {
  name: string;                           // dim label
  enumRef: string | null;                 // axis ID → enum 참조, null → string
  dimKind: "axis" | "prefix_ref" | "table_ref";
}

/** codegen 전체 입력 */
interface IRModule {
  name?: string;
  enums: IREnum[];
  structs: IRStruct[];
}
```

### 7.2 IR 생성

```typescript
import { buildIR } from "@qa-sdk/spec-core";

const ir = buildIR({
  axes: [...],           // AxisInput[]
  prefixSpecs: [...],    // PrefixSpec[]
  ko: { role: { admin: "어드민", ... } },
});
```

### 7.3 지원 Generator

| Generator | 출력 | 함수 |
|-----------|------|------|
| TypeScript | `.ts` (const + type + interface) | `generateFromIR(ir)` |
| ESM JavaScript | `.mjs` (Object.freeze + _VALUES) | `generateJSFromIR(ir, "esm")` |
| CommonJS | `.cjs` (module.exports) | `generateCJSFromIR(ir)` |
| Protobuf | `.proto` (proto3 enum + message) | `generateProtoFromIR(ir)` |
| JSON Schema | `.json` (draft-2020-12 + $ref) | `generateJsonSchemaFromIR(ir)` |

### 7.4 표준 Presets

`registerPresets(registry)` 호출로 6 base schemas + 4 fragments 기본 등록:

| Schema | Category |
|--------|----------|
| event.base | event |
| entity.base | entity |
| relation.base | relation |
| state.base | state |
| policy.base | policy |
| observation.base | observation |

| Fragment | Axes |
|----------|------|
| HasActor | actor_ref |
| HasTarget | target_ref |
| HasOutcome | outcome |
| Identified | identity |
