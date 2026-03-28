---
def:
  id: table-accessor-api
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: table-dimref-types
      type: depends_on
    - target: table-schema-def
      type: depends_on
---
# accessor API에서의 table_ref 처리

## 목적 ^purpose

accessor API에서 table_ref를 처리하는 방법. MetaRegistry/PrefixCodec으로의 외부 전파 경로.

## 구성 ^overview

- **getFixedLabels**: 모든 accessor에서 table_ref 차원을 제외하는 공통 헬퍼
- **구조 vs 산술 분리**: getPrefixStructure에서는 table_ref가 보이지만, shape/encode/decode에서는 투명하게 제외
- **외부 전파 차단**: catalogToRegistryInput, catalogToPrefixCodecInput 변환 시 table_ref 건너뜀
- **이벤트 타입 선언**: prefix로 actor(누가) x action(무엇을) x target(어디에) 관계를 타입으로 정의
- **좌표-엔티티 연결**: table_ref/axis_ref를 통해 차원과 테이블 행 간 정적 타입 안전 참조
- **그래프 탐색**: ColumnRef + DimRef를 결합하여 좌표-테이블-좌표 간 영향 분석 및 데이터 흐름 추적
- **인코딩 분리**: table_ref를 좌표 공간에서 제외하여 유한 좌표 + 무한 엔티티 참조 구조 보장

---

## 1. getFixedLabels — table_ref 제외 헬퍼

모든 accessor 함수는 `getFixedLabels()` 헬퍼로 `table_ref`를 제외한다.

소스: `packages/demo-snapshot/src/demo-accessors.ts`

```typescript
function getFixedLabels(prefix): string[] {
  return prefix.labels.filter(l => prefix.dims[l].kind !== "table_ref");
}
```

---

## 2. API별 table_ref 처리

| API | table_ref 처리 |
|---|---|
| `getPrefixStructure()` | labels/dims에 **포함** (구조 정보) |
| `getPrefixShape()` | **제외** — shape/capacity에 반영 안 됨 |
| `getPrefixEntries()` | **제외** — entries에 반환 안 됨 |
| `encodePrefix()` | **제외** — positions에 넣지 않음 |
| `decodePrefix()` | **제외** — 결과에 나타나지 않음 |
| `resolveAddress()` | **제외** — dims에 포함 안 됨 |
| `decomposeAddress()` | **제외** — 분해 대상 아님 |
| `verifyRoundTrip()` | **제외** — 고정 차원만 라운드트립 검증 |

**구조(structure)에서는 보이지만, 산술(encoding)에서는 투명:**

```typescript
// 구조: table_ref 차원이 보인다
const s = getPrefixStructure(DEMO_CATALOG, "cart_event");
s.labels;        // ["actor", "action", "target"] ← 3개 전부
s.dims.actor;    // { kind: "table_ref", table: "members" }

// 산술: table_ref 차원이 사라진다
const shape = getPrefixShape(DEMO_CATALOG, "cart_event", "v1");
shape.shape;     // [32] ← action만

const decoded = decodePrefix(DEMO_CATALOG, "cart_event", "v1", 1);
decoded.actor;   // undefined ← table_ref는 decode 안 됨
decoded.action;  // { position: 1, value: "remove" }
```

---

## 3. 외부 레이어 전파 — MetaRegistry / PrefixCodec

테이블 시스템은 DEMO_CATALOG 내부의 메타데이터로만 존재하며, 하위 인코딩 레이어에 전파되지 않는다.

소스: `packages/demo-snapshot/src/demo-bridge.ts`

```
DEMO_CATALOG
├── axes          ──→ catalogToRegistryInput() ──→ MetaRegistry
├── prefixes      ──→ catalogToPrefixCodecInput() ──→ PrefixCodec
│   └── table_ref 차원 → **제외** (두 함수 모두)
└── tables        ──→ 전파 없음 (application layer의 메타데이터)
```

| 변환 함수 | table_ref 처리 | 이유 |
|---|---|---|
| `catalogToRegistryInput()` | 건너뜀 | MetaRegistry는 좌표 산술만 담당 |
| `catalogToPrefixCodecInput()` | 건너뜀 | PrefixCodec은 axis만 label로 등록 |

---

## 4. 테이블 시스템으로 할 수 있는 것

### 4.1 이벤트 타입 선언

prefix로 "누가(actor) 무엇을(action) 어디에(target) 했다"를 타입으로 선언한다.

```
단항: auth_event  = actor × action           (회원이 로그인했다)
이항: cart_event  = actor × action × target  (회원이 상품을 추가했다)
다항: order_event = ctx × actor × action × order  (환경에서 회원이 주문을 취소했다)
```

### 4.2 좌표-엔티티 타입 안전 연결

`table_ref`는 "이 차원은 members 테이블의 행이다"를 타입으로 선언한다.
`axis_ref`는 "이 컬럼의 값은 role 축의 entry다"를 타입으로 선언한다.

이를 통해:
- 이벤트의 actor가 어떤 테이블 타입인지 정적으로 알 수 있다
- 테이블 행의 특정 컬럼이 어떤 축 값인지 정적으로 알 수 있다
- 테이블 행이 어떤 좌표 주소를 저장하는지 정적으로 알 수 있다

### 4.3 그래프 탐색 (추적성)

ColumnRef와 DimRef를 합치면 좌표↔테이블↔좌표를 오가는 그래프가 된다.

용도:
- **영향 분석:** "role 축에 entry를 추가하면 어떤 테이블이 영향받는가?" → `axis_ref`로 role을 참조하는 컬럼 탐색
- **데이터 흐름 추적:** "이 이벤트의 actor는 어떤 조직 소속이고, 그 조직은 어떤 리전에 있는가?" → `table_ref` FK → `prefix_ref` 좌표 decode
- **스키마 검증:** "cart_event의 target이 items 테이블을 참조하는데, items에 category axis_ref가 있으므로 장바구니 이벤트에서 상품 카테고리까지 추적 가능"

### 4.4 인코딩 분리 (좌표 공간 유한성 보장)

`table_ref`가 좌표에서 제외되므로:
- 좌표 공간은 유한하게 유지된다 (action 3가지 × service 100개 = 300 좌표)
- 엔티티는 무한히 참조 가능하다 (member 수백만, item 수백만)
- 같은 좌표 주소 + 다른 refs = "같은 종류의 이벤트, 다른 대상"

---

## 5. 소스 위치

| 파일 | 역할 |
|---|---|
| `packages/demo-snapshot/src/demo-accessors.ts` | `getFixedLabels()` + 모든 accessor에서 table_ref 제외 처리 |
| `packages/demo-snapshot/src/demo-bridge.ts` | MetaRegistry/PrefixCodec 변환 시 table_ref 건너뛰기 |
| `packages/demo-snapshot/src/catalog-builder.ts` | refEntries 파생 시 `table_ref` 제외 |

## 참조

- [table-dimref-types](table-dimref-types.spec.md) — DimRef 종류와 사용 규칙
- [table-schema-def](table-schema-def.spec.md) — 테이블 스키마 정의와 그래프 탐색
- [dimension-operations.md](../indexing/dimension-operations.md) — 축 교차 선택, 환경 주입, 배포 시점 해석
