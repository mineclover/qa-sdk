---
def:
  id: data-object-binding
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-data-contract
      type: depends_on
    - target: prefix-path-summation
      type: depends_on
    - target: meta-semantic-philosophy
      type: depends_on
---

# DataObject Binding — 데이터 스키마 ↔ prefix 좌표 바인딩

## 목적 ^purpose

DataSchema를 prefix 주소 공간에 바인딩하여 데이터 인스턴스를
좌표로 식별 가능한 객체로 만들고, 필드 단위 계보 추적의 기반을 제공한다.
설계 시점 제약이지 런타임 제약이 아니다.

## 니즈

현재 상태:
```
DataSchema "orders" → columns, facetRole, primaryKey
StepDataContract → consumes/produces (필드 이름 + 타입)
FieldLineage → 필드 변환 추적

빠진 것:
  "orders" 스키마가 어떤 prefix에 좌표화되는가? → 선언 없음
  인스턴스 ORD-123의 주소는? → 매핑 규칙 없음
  계보 추적에서 주소 맥락 복원 → 불가
```

## 패키지 설계

**`data-object` 패키지** — `@qa-sdk/core`에만 의존, 분리 가능.

```
packages/data-object/
├── src/
│   ├── types.ts          DataObjectBinding, BindingValidation
│   ├── registry.ts       BindingRegistry (인메모리)
│   ├── validate.ts       validateBindings, validateLineageChain
│   └── index.ts
├── package.json          deps: @qa-sdk/core (타입만)
└── tsconfig.json
```

### 핵심 타입

```typescript
/** DataSchema → prefix 바인딩 선언 */
interface DataObjectBinding {
  /** DataSchema ID */
  schemaId: string;
  schemaVersion: string;

  /** 바인딩 대상 prefix */
  prefixId: string;
  prefixVersion: string;

  /** identity 컬럼 → prefix dim/segment 매핑 */
  columnToAxis: Record<string, ColumnAxisMapping>;
}

/** 컬럼 → 축 매핑 */
interface ColumnAxisMapping {
  /** prefix dim label */
  dimLabel: string;
  /** sum 모델일 때: 어떤 세그먼트에 속하는지 */
  segmentId?: string;
}
```

### 검증 함수

```typescript
/** 바인딩 정합성 검증 — CI에서 1회 실행 */
function validateBindings(
  bindings: DataObjectBinding[],
  catalog: Catalog,
): BindingValidation[]

interface BindingValidation {
  schemaId: string;
  prefixId: string;
  errors: string[];
  warnings: string[];
}
```

검증 항목:
- [ ] schemaId의 identity 컬럼이 columnToAxis에 매핑되어 있는지
- [ ] dimLabel이 prefix.dims에 존재하는지
- [ ] sum 모델: segmentId가 해당 version의 segments에 존재하는지
- [ ] columnToAxis의 dim이 해당 축의 entries와 호환되는지
- [ ] 같은 prefix에 중복 바인딩이 없는지

### 레지스트리

```typescript
interface BindingRegistry {
  /** 바인딩 등록 */
  register(binding: DataObjectBinding): void;
  /** schemaId로 바인딩 조회 */
  getBySchema(schemaId: string): DataObjectBinding | null;
  /** prefixId로 바인딩 조회 */
  getByPrefix(prefixId: string): DataObjectBinding[];
  /** 전체 목록 */
  listAll(): DataObjectBinding[];
}
```

### 계보 체인 검증

```typescript
/**
 * FieldLineage 체인이 바인딩을 통해 유효한지 검증.
 * source schema → target schema 변환에서 양쪽 모두 prefix에 바인딩되어 있는지.
 */
function validateLineageChain(
  lineages: FieldLineage[],
  registry: BindingRegistry,
): LineageChainValidation

interface LineageChainValidation {
  /** 바인딩 있는 계보 */
  bound: number;
  /** 바인딩 없는 계보 (경고) */
  unbound: number;
  /** 바인딩은 있지만 dim 매핑 불일치 */
  mismatched: string[];
}
```

## 전곱/합산과의 관계

| 주소 모델 | 바인딩 방식 | 계보 맥락 |
|----------|-----------|----------|
| product | columnToAxis: { orderType → orderType dim } | 축 조합으로 맥락 복원 |
| sum | columnToAxis: { orderType → orderType dim, segmentId: "order_payment" } | 세그먼트 + 축으로 분기 맥락 복원 |

## 사용 흐름

```
1. 설계 시: DataSchema 정의 → DataObjectBinding 선언
2. CI: validateBindings(bindings, catalog) → 에러 시 빌드 실패
3. 시뮬레이션: FieldLineage 수집 → validateLineageChain(lineages, registry)
4. 런타임: 변화 없음 — SDK는 기존대로 encodePrefix/encodeBySegment 사용
```

## 성능

| 시점 | 비용 | 빈도 |
|------|------|------|
| 바인딩 등록 | O(1) Map.set | 설계 시 1회 |
| 검증 | O(bindings × columns) | CI 1회 |
| 계보 체인 검증 | O(lineages) Map.get | 시뮬 후 1회 |
| **런타임** | **0** | **개입 안 함** |

## 의존 방향

```
data-object (신규)
  ├── depends: @qa-sdk/core (타입: DataSchema, PrefixDef, Catalog, PathSegment, FieldLineage)
  ├── 사용처: CLI (validateBindings in CI)
  ├── 사용처: pipe-simulate (validateLineageChain 후처리)
  └── 사용처: pipe-definition-bridge (바인딩 조회)

@qa-sdk/core → data-object 의존 없음 (역방향 금지)
```

## 제네릭 타입 + codegen

### 접근 A: 제네릭 타입 (수동 선언, 타입 안전)

```typescript
/** prefix 기반 제네릭 — PrefixId 리터럴로 타입 레벨 바인딩 */
interface BoundDataObject<
  S extends string,   // schemaId
  P extends string,   // prefixId
> {
  readonly schemaId: S;
  readonly prefixId: P;
  /** 인스턴스 데이터 — DataSchema 컬럼에서 파생 */
  readonly data: Record<string, unknown>;
  /** 인코딩된 좌표 */
  readonly address: number;
  /** 직렬화된 주소 */
  readonly serialized: string;  // "prefix:version:address"
}

// 사용 예: 타입 레벨에서 스키마-prefix 바인딩 강제
type OrderData = BoundDataObject<"orders", "order_process">;
type PaymentData = BoundDataObject<"payments", "payment">;

// 계보 추적 시 타입 안전
function trackLineage<S1 extends string, P1 extends string, S2 extends string, P2 extends string>(
  source: BoundDataObject<S1, P1>,
  target: BoundDataObject<S2, P2>,
  transform: TransformKind,
): FieldLineage;
```

### 접근 B: codegen (자동 생성, 카탈로그 기반)

기존 `generateCatalogTypes` (prefix-ids.ts, axes.ts, dims.ts 생성) 패턴 확장.
카탈로그의 prefix + DataSchema 정의에서 typed binding 코드를 자동 생성.

```typescript
// codegen-core에 추가
function generateDataObjectBindings(
  catalog: Catalog,
  schemas: DataSchema[],
  bindings: DataObjectBinding[],
): DataObjectCodegenResult

// 생성 파일:
//   data-objects.ts    — BoundDataObject 타입 인스턴스 (prefix별)
//   binding-registry.ts — 바인딩 레지스트리 초기화 코드
//   lineage-types.ts   — 스키마 간 계보 타입 (어떤 필드가 어디로 흐를 수 있는지)
```

생성 예시:
```typescript
// Generated: data-objects.ts
export interface OrderProcessData {
  orderType: "normal" | "express" | "subscription";
  paymentMethod: "card" | "bank" | "crypto" | "point";
  shippingOption: "standard" | "sameDay";
}

export const ORDER_PROCESS_BINDING: DataObjectBinding = {
  schemaId: "orders",
  prefixId: "order_process",
  prefixVersion: "v1",
  columnToAxis: {
    orderType: { dimLabel: "orderType" },
    paymentMethod: { dimLabel: "paymentMethod", segmentId: "order_payment" },
    shippingOption: { dimLabel: "shippingOption", segmentId: "order_shipping" },
  },
};

// Generated: lineage-types.ts
/** orders.amount → payments.amount 계보가 유효함을 타입으로 선언 */
export type ValidLineage =
  | { source: "orders"; target: "payments"; field: "amount"; transform: "direct" }
  | { source: "orders"; target: "payments"; field: "orderId"; transform: "direct" };
```

### 두 접근의 관계

```
제네릭 (접근 A): 수동 선언 — 소규모, 유연, 즉시 사용
codegen (접근 B): 자동 생성 — 대규모, 카탈로그 SSOT, CI 통합

B가 A를 생성한다:
  catalog + schemas → codegen → BoundDataObject<S,P> 인스턴스 + 바인딩 + 계보 타입
```

## 할 일

### Phase 1 — 타입 + 레지스트리

- [ ] `data-object` 패키지 생성 (package.json, tsconfig)
- [ ] `DataObjectBinding` + `ColumnAxisMapping` 타입 정의
- [ ] `BoundDataObject<S, P>` 제네릭 타입 정의
- [ ] `BindingRegistry` 인메모리 구현
- [ ] 테스트: 바인딩 CRUD

### Phase 2 — 검증

- [ ] `validateBindings(bindings, catalog)` — 정합성 검증
- [ ] `validateLineageChain(lineages, registry)` — 계보 체인 검증
- [ ] 테스트: 검증 (정상/에러), 계보 체인 (bound/unbound)

### Phase 3 — codegen

- [ ] `codegen-core`에 `generateDataObjectBindings` 추가
- [ ] 생성 파일: data-objects.ts, binding-registry.ts, lineage-types.ts
- [ ] CLI `qa-sdk codegen --data-objects` 명령 연동
- [ ] 테스트: 생성 코드 결정론성, 타입 정합성

### Phase 4 — 통합

- [ ] pipe-definition-bridge에서 BindingRegistry 활용
- [ ] pipe-simulate에서 validateLineageChain 후처리
- [ ] prefix-stamp에서 바인딩 스탬프 지원
