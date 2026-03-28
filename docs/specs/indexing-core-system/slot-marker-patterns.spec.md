---
def:
  id: slot-marker-patterns
  address: def_document:v1:545
  scope: feature
  aspect: scenario
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: slot-marker-concept
      type: depends_on
---
# 슬롯 마커의 실제 사용 패턴

## 목적 ^purpose

슬롯 마커의 실제 사용 패턴. 카테고리 외 항목 수집 전략과 테스트 패턴.

## 구성 ^overview

- **3분류 체계**: 주소 공간의 모든 position을 normal(정규 도메인 값), reserved(슬롯 마커), empty(빈 headroom)로 분류하며, buildFullView로 전체 뷰를 구성한다.
- **index-label 매핑 제외**: 서비스 레이어는 정규 엔티티만 index-label 매핑에 포함하고, 마커는 매핑에서 제외하되 주소 공간에는 유지한다.
- **sparse 배치**: 1D 테이블(capacity 기반)에서 마커는 position을 자유롭게 배치할 수 있으며, composite index의 dim entries에서만 선두 배치가 중요하다.
- **분산 환경 적재**: 마커(`_`, `~`)는 정규 entry와 동일한 형식으로 D1에 적재되며, 분산 환경에서도 특별 처리 경로가 없다.
- **encode/decode 동일 동작**: 마커는 일반 entry와 완전히 동일하게 encode/decode round-trip이 동작하며, matchRanges로 마커 레코드만 범위 선택할 수 있다.
- **카테고리 외 항목 수집 전략**: `~`(즉시 수용 → 나중 재분류), `_`(새 차원 추가 시 기존 데이터 채움), `?`(파싱 실패 분리) 등 마커별 수집 전략을 정의한다.
- **게이트 시스템 조합**: 마커 position도 active/inactive/open/reserved 게이트 상태의 대상이며, inactive 전환 시 새 encode를 차단하되 기존 decode는 보존한다.
- **안티패턴**: `~` 마커 레코드의 영구 방치(임시 수용 목적 위반)와 composite dim entries에서의 후미 배치를 금지한다.

---

## 1. 서비스 레이어의 3분류: normal / reserved / empty

`table-flow.e2e.test.ts`에서 1D 주소 공간의 전체 뷰를 구성하고, 각 position을 3가지로 분류한다:

```ts
const RESERVED = {
  NULL:    "_",    // 값이 없거나 미결정
  OTHER:   "~",    // 정의된 카테고리에 해당하지 않음
  UNKNOWN: "?",    // 존재하지만 식별 불가
  NAN:     "NaN",  // 숫자가 아닌 값 (number_enum 전용)
} as const;

const RESERVED_TOKENS = new Set<string>(Object.values(RESERVED));

function buildFullView(
  capacity: number,
  entries: EntryRecord[]
): { position: number; value: string | null; kind: "normal" | "reserved" | "empty" }[] {
  const entryMap = new Map(entries.map((e) => [e.position, String(e.value)]));

  return Array.from({ length: capacity }, (_, i) => {
    const position = i + 1;
    const value = entryMap.get(position) ?? null;

    if (value === null) return { position, value: null, kind: "empty" as const };
    if (RESERVED_TOKENS.has(value)) return { position, value, kind: "reserved" as const };
    return { position, value, kind: "normal" as const };
  });
}
```

| kind | 의미 | encode | decode | 서비스에서의 취급 |
|------|------|--------|--------|----------------|
| `normal` | 정규 도메인 값 | O | O | index-label 매핑에 포함 |
| `reserved` | 슬롯 마커 | O | O | index-label 매핑에서 제외, 의미는 토큰으로 판별 |
| `empty` | 아직 값이 없는 빈 슬롯 | headroom | — | 나중에 채울 수 있는 여유 공간 |

테스트가 검증하는 것:

```ts
it("전체 뷰에서 normal / reserved / empty 를 분류할 수 있다", async () => {
  const entries = await store.getEntries(TABLE_ID, VERSION);
  const view = buildFullView(CAPACITY, entries);

  const normals   = view.filter((e) => e.kind === "normal");
  const reserveds = view.filter((e) => e.kind === "reserved");
  const empties   = view.filter((e) => e.kind === "empty");

  expect(normals).toHaveLength(REGULAR_ENTRIES.length);
  expect(reserveds).toHaveLength(RESERVED_ENTRIES.length);
  expect(empties).toHaveLength(CAPACITY - REGULAR_ENTRIES.length - RESERVED_ENTRIES.length);
});
```

---

## 2. index-label 매핑에서 마커 제외

서비스 레이어는 정규 엔티티만 index-label 매핑에 포함한다. 마커는 매핑에서 빠지지만 주소 공간에는 여전히 존재한다.

```ts
function indexLabelMap(view: FullView[]): { index: number; label: string }[] {
  return view
    .filter((e) => e.kind === "normal")
    .map((e) => ({ index: e.position, label: e.value! }));
}
```

```ts
it("정규 엔트리의 index-label 매핑이 정확하다", async () => {
  const map = indexLabelMap(view);

  expect(map).toContainEqual({ index: 1, label: "action" });
  expect(map).toContainEqual({ index: 2, label: "rpg" });

  // 예약 마커와 빈 주소는 포함되지 않음
  expect(map.map((e) => e.label)).not.toContain(RESERVED.NULL);
  expect(map.map((e) => e.label)).not.toContain(RESERVED.OTHER);
});
```

---

## 3. sparse 배치

마커가 반드시 position 1, 2에 있을 필요는 없다. 게임 카테고리 테스트에서 마커는 분산 배치된다:

```ts
const RESERVED_ENTRIES: [number, string][] = [
  [4,   "_"],     // null 마커 — position 4
  [140, "NaN"],   // NaN 마커 — position 140
  [999, "~"],     // other 마커 — position 999
];
```

```ts
it("예약 슬롯의 token과 position이 정확하다", async () => {
  const view = buildFullView(CAPACITY, entries);

  expect(view[3].value).toBe("_");      // position 4
  expect(view[139].value).toBe("NaN");  // position 140
  expect(view[998].value).toBe("~");    // position 999
});
```

> 선두 배치 규칙은 **multi-dim composite index의 dim entries**에서의 규칙이다. 1D 테이블(capacity 기반 단일 차원)에서는 position을 자유롭게 배치할 수 있다. composite index에서만 선두 배치가 중요한 이유: 새 엔티티 추가 시 shape이 바뀌면서 기존 인덱스가 밀리기 때문이다.

---

## 4. 분산 환경에서 마커가 포함된 entry 적재

`distributed.e2e.test.ts`에서 마커를 포함한 entry batch를 분산 D1에 적재한다:

```ts
const ROLE_PAYLOAD = {
  capacity: 8,
  entries: { "1": "guest", "2": "viewer", "3": "editor", "4": "admin", "5": "_" }
};
const CONTENT_PAYLOAD = {
  capacity: 100,
  entries: { "1": "article", "2": "video", "3": "~", "50": "podcast" }
};
```

마커(`"_"`, `"~"`)가 정규 entry와 동일한 형식으로 적재되고, 동일한 API로 조회된다. 분산 환경에서도 마커에 대한 특별 처리 경로가 없다.

---

## 5. encode/decode에서 마커는 일반 entry와 동일하게 동작한다

`meta-codec.test.ts`에서 encode/decode round-trip은 entry가 무엇이든 동일하다:

```ts
// entries에 마커가 포함된 DecodeMap
const mapWithMarkers: DecodeMap = {
  indexId: "perm", versionId: "v1",
  shape: [5, 4],  // 마커 2개 + 정규 3개, 마커 2개 + 정규 2개
  size: 20,
  dims: [
    { dimId: "role",   snapshotId: "v1", kind: { type: "string_enum" },
      entries: ["_", "~", "admin", "editor", "viewer"] },
    { dimId: "action", snapshotId: "v1", kind: { type: "string_enum" },
      entries: ["_", "~", "read", "write"] },
  ],
};

const codec = new MetaCodec(mapWithMarkers);

// 마커를 좌표로 사용 — 정상 동작
const vv = codec.encode({ role: "_", action: "read" });
expect(codec.decode(vv)).toEqual({ role: "_", action: "read" });

// 마커와 정규 값 혼합 — 정상 동작
const vv2 = codec.encode({ role: "admin", action: "_" });
expect(codec.decode(vv2)).toEqual({ role: "admin", action: "_" });
```

---

## 6. 범위 쿼리로 마커 레코드 선택

마커가 선두에 배치된 entries에서 `matchRanges`로 마커 레코드만 선택하거나 제외할 수 있다:

```ts
const codec = new MetaCodec(mapWithMarkers);
// shape: role[5] × action[4] = 20

// role이 "_"인 모든 레코드 (미결정 항목)
codec.matchRanges({ role: "_" });
// → [[0, 3]]  (role=position 1, action 와일드카드 4개)
```

---

## 7. 게이트 시스템과의 조합

`invalid-ranges.test.ts`에서 dim의 position별 상태(active/inactive/open/reserved)를 선언하고 composite 주소 구간으로 변환한다. 마커가 점유한 position도 이 게이트 시스템의 대상이다:

```ts
// role dim: position 1-4 active, 5 inactive(deprecated), 6-8 open(headroom)
const specs: DimStateSpec[] = [
  { dimIndex: 0, state: "inactive", coords: "5" },
  { dimIndex: 0, state: "open",     coords: "6-8" },
];

const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, specs);

// role=5 (inactive): 기존 데이터 decode는 가능, 새 encode는 불가
const g5 = checkGate((5-1)*256, rv, ia, op);
expect(g5).toEqual({ encode: false, decode: true, state: "inactive", shouldVerify: false });
```

마커 position을 inactive로 전환하면, 해당 마커로 새 레코드를 인코딩할 수 없게 된다. 기존 마커 주소의 데이터는 여전히 decode 가능하다.

---

## 8. 카테고리 외 항목의 수집 전략

"분류 체계에 맞지 않는 항목이 들어오면 어떻게 하나?" — 이것이 `"~"` (other) 마커의 핵심 용도다.

### 전략 1: 즉시 수용 → 나중에 재분류

```
이벤트 도착 → entries에 해당 값 없음 → "~"로 encode → 나중에 entries 추가 → 재인코딩
```

새 분류가 확정되기 전에도 데이터를 손실 없이 수집하고, 확정 후 재인코딩한다. `"~"` 주소의 원본 데이터(payload)는 별도 저장소에 보관하여 재분류 시 참조한다.

### 전략 2: 새 차원 추가 시 기존 데이터 마이그레이션

v1(2D)에서 v2(3D)로 차원이 추가될 때, 기존 데이터의 새 차원 값은 `"_"`로 채운다:

```ts
// v1: role × action (2D) → v2: role × action × env (3D)
const ids = v1Codec.decode(oldValue);
const migrated = v2Codec.encode({
  ...ids,
  env: "_",  // 새 차원 — 기존 데이터에는 해당 정보 없음
});
```

### 전략 3: `"?"` (unknown) — 파싱 실패 분리

외부 시스템에서 들어온 값이 파싱에 실패했을 때 `"~"` (분류 불가)와 구분한다:

```
"~" = 값 자체는 유효하지만 현재 분류 체계에 맞지 않음 → entries 추가로 해결
"?" = 값이 유효하지 않아 어떤 엔티티인지 판단 불가 → 원본 데이터 확인 필요
```

### 전략 4: 범위 쿼리로 미분류 항목 모니터링

```ts
// 모든 차원에서 마커가 position 1, 2에 배치되어 있을 때
const shape = [5, 5, 5]; // _(1), ~(2), 정규(3,4,5)

// "~" 마커 레코드 — 재분류가 필요한 항목
calcAddressRanges(shape, [null, "2", null]);

// "_" 마커 레코드 — 미결정/비적용 항목
calcAddressRanges(shape, ["1", null, null]);
```

주기적으로 `"~"` 주소의 레코드를 조회하여 새 엔티티로 재분류하거나, `"_"` 레코드 중 결정 가능한 것을 업데이트한다.

---

## 9. 안티패턴

**AP-1: `"~"` 마커 레코드를 영구 방치**

`"~"`의 목적은 **임시 수용**이지 영구 분류가 아니다. 주기적으로 재분류하지 않으면 `"~"` 주소에 이질적 데이터가 누적되어 의미를 잃는다.

**AP-2: composite dim의 entries에서 마커를 후미에 배치**

선두 배치 원칙 참조. 1D 테이블(capacity 기반)에서는 position을 자유롭게 배치할 수 있지만, composite index의 dim entries에서는 선두 배치가 중요하다.

## 참조

- [slot-marker-concept](slot-marker-concept.spec.md) — 마커 개념과 설계 원칙
- [slot-marker-capacity](slot-marker-capacity.spec.md) — 용량 영향
