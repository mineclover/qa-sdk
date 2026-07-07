---
def:
  tier: component
  id: axis-boundary-patterns
  type: spec
  address: def_document:v2:69760
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [entry-point]
  links:
    - target: spec-reference-system
      type: traces_to
sources:
  - packages/spec-core/src/loader/catalog-bridge.ts
  - packages/spec-core/src/loader/catalog-bridge.test.ts
  - packages/spec-core/src/visualization/layer-map.ts
  - packages/cli/src/commands/prefix-stamp.ts
---

# Axis 경계 적용 패턴

## 목적 ^purpose

api prefix 재설계, 서비스 계층 주소 표현, 미들웨어 자동 태깅처럼 axis 경계 기준이 실제 설계에 적용되는 패턴을 정리한다.

## 구성 ^overview

- `DimRef 3종 활용`: axis/prefix_ref/table_ref 선택으로 축 증가를 억제하는 패턴을 정의한다.
- `api prefix 재설계`: 계층 주소를 prefix_ref로 표현하여 axis 남용을 줄이는 사례를 기술한다.
- `서비스 계층 주소 표현`: 구조적 트리를 axis 증가 없이 표현하는 경로를 명시한다.
- `미들웨어 자동 태깅`: address_context를 런타임에서 자동 주입하는 보수적 원칙을 정리한다.

## DimRef 3종 활용

prefix의 각 차원은 3종 DimRef 중 하나로 정의된다 (core/src/catalog/catalog.types.ts):

```typescript
type DimRef =
  | { kind: "axis"; axisId: string }          // 공유 축 참조
  | { kind: "prefix_ref"; prefixId: string }  // 다른 prefix 참조
  | { kind: "table_ref"; table: string };     // 테이블 참조
```

**축 증가 억제 전략:**
- 새 candidate가 기존 prefix의 identity를 참조하면 → `prefix_ref` (축 증가 0)
- 새 candidate가 DB 테이블의 행을 가리키면 → `table_ref` (축 증가 0)
- 5Q Checklist를 모두 통과한 경우에만 → `axis` (축 증가 1)

## api prefix 재설계

API 엔드포인트를 축으로 표현할 때의 anti-pattern과 올바른 패턴:

**Anti-pattern: 엔드포인트마다 axis 추가**
```
endpoint prefix: method(axis) × path_segment_1(axis) × path_segment_2(axis) × ...
→ 축이 경로 깊이에 비례하여 증가
```

**올바른 패턴: prefix_ref + resource 모델**
```
endpoint prefix: svc_ref(prefix_ref) × method(axis) × resource(axis)
→ resource는 permission-engine의 canonical path (소문자, / 구분, depth ≤ 4)
→ 축 수 고정 (3개)
```

permission-engine/src/resource.ts의 `validateResource()`가 resource 형식을 검증한다: 소문자, `/` 구분, leading/trailing slash 금지, depth ≤ 4, `:param` 허용.

## 서비스 계층 주소 표현

서비스 계층(namespace/name)을 axis 없이 표현하는 패턴:

1. **ServiceContext**: `{ namespace: "shop", name: "payment", env: "prod" }` → `ref()` = `"shop/payment"`
2. **svc_ref**: observation 카테고리 prefix가 service prefix를 prefix_ref로 참조
3. **ownedPrefixes**: 서비스가 실제로 이벤트를 생산하는 prefix만 선언

이 패턴으로 서비스 계층의 깊이가 바뀌어도 축이 추가되지 않는다. ServiceBootConfig이 서비스 정체성의 단일 진입점이고, 모든 SDK 레이어가 여기서 파생된다.

## 미들웨어 자동 태깅

address_context를 런타임에서 자동 주입하는 패턴. 보수적 원칙:

1. **SDK 레벨 자동 태깅**: QaLoggerConfig.infraContext로 envelope 전체에 기본 좌표를 주입한다.
2. **서버 레벨 enrichment**: ingest-server의 enrichAddressContext()가 infra_context를 record에 머지한다.
3. **browser-sdk**: emitWithCoords/browserTrack에서 try-catch 필수 — 인코딩 실패 시 coordinate 없이 emit (이벤트 유실보다 좌표 누락이 낫다).

**보수적 원칙:**
- 자동 태깅은 **확실한 좌표만** 주입한다. 추측성 좌표는 주입하지 않는다.
- 자동 태깅 실패가 이벤트 전송을 차단하면 안 된다 (fail-open).
- 수동 지정(record.address_context)이 항상 자동 태깅(infra_context)을 override한다.
