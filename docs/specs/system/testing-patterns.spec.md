---
def:
  id: testing-patterns
  type: spec
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [testing, ssot]
  links:
    - target: facet-test-isolation
      type: traces_to
---

# 테스트 패턴 — SSOT 파생 표준

## 목적 ^purpose

"카탈로그가 바뀌어도 테스트는 깨지지 않아야 한다" 원칙에 따라 반복 적용되는 8가지 테스트 패턴을 정의한다.

---

## 1. 카운트는 SSOT에서 파생

```typescript
// ❌ 하드코딩 (카탈로그 변경 시 깨짐)
expect(axes.length).toBe(74);
expect(prefixes.length).toBe(46);

// ✅ SSOT 파생
expect(axes.length).toBe(Object.keys(DEMO_CATALOG.axes).length);
expect(prefixes.length).toBe(Object.keys(DEMO_CATALOG.prefixes).length);
```

## 2. DKG bootstrap 결과는 범위 검증

```typescript
// ❌ 정확한 노드 수 하드코딩 (DKG 설정 변경 시 깨짐)
expect(nodes.length).toBe(267);

// ✅ 범위 또는 불변조건
expect(nodes.length).toBeGreaterThan(100);
expect(graph.getNodesByKind("prefix").length).toBe(
  Object.keys(DEMO_CATALOG.prefixes).length
);
```

## 3. export surface / dim 목록은 구조 기반 검증

```typescript
// ❌ dim 이름 하드코딩 (svc_ref 추가 시 깨짐)
expect(spec.export.dims).toEqual(["action"]);

// ✅ 제외 조건으로 검증
for (const dim of spec.export.dims) {
  expect(dim).not.toBe("actor");  // table_ref 제외 확인
}
expect(spec.export.dims).toContain("action");  // 핵심 dim 포함 확인
```

## 4. prefix_ref 포함 테스트는 DKG에서 파생

```typescript
// ❌ address_context를 수동 나열 (prefix 추가 시 누락)
const ac = { page_view: "pv:v2:0", endpoint: "ep:v1:0" /* ... 30개 */ };

// ✅ DKG에서 전체 prefix 자동 생성
const ac: Record<string, string> = {};
for (const p of graph.getNodesByKind("prefix")) {
  ac[p.id] = `${p.id}:v1:0`;
}
```

## 5. 하드코딩이 허용되는 경우

| 패턴 | 이유 |
|------|------|
| HTTP status (`toBe(200)`) | 프로토콜 상수 |
| 테스트 fixture의 주입 데이터 (`3 records inserted → toBe(3)`) | 테스트가 데이터를 제어 |
| 특정 prefix/axis ID (`"tracking"`, `"cart_event"`) | 테스트 시나리오 컨텍스트 |
| 에러 메시지/코드 (`"INVALID_INPUT"`) | API 계약 |

## 6. 서비스 단위 테스트 (NestJS 패턴)

```typescript
// 의존성 주입으로 격리 테스트
function buildApp(deps: Partial<AppDeps> = {}) {
  return createApp({
    configStore: new InMemoryConfigStore(),  // 실제 인메모리 구현
    ...deps,
  });
}

// mock: 외부 서비스 호출만
const bindings = { "ingest-server": { fetch: vi.fn().mockResolvedValue(new Response("ok")) } };
```

## 7. D1 Store 테스트

```typescript
// NodeSqliteDriver(:memory:)로 D1 시뮬레이션
const driver = new NodeSqliteDriver(":memory:");
for (const stmt of DDL.split(";").filter(s => s.trim())) {
  await driver.execute(stmt);
}
const store = new D1RecordStore(driver);
```

## 8. convergence 복사본 동기화

- `spec-core/shared/graph-port.ts` 변경 시 `convergence/graph-port.ts` 동기화 필수
- `copy-drift.test.ts`가 자동 감지
