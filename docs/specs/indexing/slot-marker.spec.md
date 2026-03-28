---
def:
  id: slot-marker-spec
  address: def_document:v1:537
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
  layer: domain
  links:
    - target: coord-foundation
      type: depends_on
---
# 슬롯 마커(Slot Marker)

## 목적 ^purpose

닫힌 패턴의 주소 공간에서 **"선택하지 않음"을 선택하는** 공식 메커니즘.
규범적 요약은 [`conventions.md` §2](conventions.md#2-예약-항목reserved-entry)를 참조한다.

관련 스펙:
- [`weighted-index`](weighted-index/README.md) — 수학 레이어 (마커를 일반 좌표로 처리)
- [`index-meta`](index-meta/README.md) — 스키마 레이어 (마커를 일반 entry로 처리)

## 상태

implemented

---

## 1. 문제: 닫힌 패턴에서 열린 상황

`WeightedIndex`는 닫힌 패턴이다. 모든 차원의 좌표는 `[1, shape[i]]` 범위 안에 있어야 하며, 좌표를 비울 수 없다.

하지만 현실 도메인에서는 좌표를 비워야 하는 상황이 반복적으로 발생한다:

| 상황 | 예시 | encode 시 문제 |
|------|------|---------------|
| **값 미결정** | 이벤트 발생 시 role이 아직 할당되지 않음 | 넣을 좌표가 없음 |
| **해당 없음** | 시스템 cron job에 "role" 개념 자체가 없음 | 차원이 적용되지 않음 |
| **분류 불가** | 신규 API가 기존 action 분류에 맞지 않음 | 일치하는 엔티티 없음 |
| **선택하지 않음** | 모든 role에 적용되는 정책을 등록 | 특정 값을 지정하고 싶지 않음 |
| **식별 불가** | 외부 시스템 응답 파싱 실패 | 값은 존재하지만 어떤 엔티티인지 모름 |
| **삭제된 엔티티** | 폐지된 role이지만 기존 주소는 유효해야 함 | append-only라 entries에서 제거 불가 |

이 모든 상황에서 `encode()`는 에러를 내뱉는다. 좌표가 비어있기 때문이다.

---

## 2. 해법: 슬롯 마커

좌표를 비울 수 없다면, **"비어있음"이라는 의미를 가진 좌표를 주소 공간에 미리 예약**한다. 이것이 슬롯 마커다.

마커도 entries 배열의 entry이므로 shape에 포함되고, encode/decode되고, bijection이 유지된다. 시스템 입장에서 마커는 그냥 좌표다. **"이 좌표가 마커다"라는 해석은 전적으로 도메인 레이어의 책임이다.**

### 표준 토큰

`string_enum` 차원에서 프로젝트 전체에 걸쳐 동일한 의미로 사용해야 하는 예약 토큰:

| 토큰 | 역할 | 커버하는 상황 |
|------|------|-------------|
| `"_"` | **null** — 값 없음 | 미결정, 해당 없음, 선택하지 않음 |
| `"~"` | **other** — 분류 불가 | 기존 분류 체계에 맞지 않는 새 값, 마이그레이션 과도기 |
| `"?"` | **unknown** — 식별 불가 | 값이 존재하지만 파싱 실패, 외부 시스템 응답 불명 |

`number_enum` 차원:

| 토큰 | 역할 |
|------|------|
| `"NaN"` | **not a number** — 숫자가 아닌 값 유입 |

### "선택하지 않음"이 공식 패턴인 이유

`"_"` 마커의 역할 중 가장 중요한 것은 **의도적 비선택(intentional non-selection)**이다. 이것은 "값이 없어서 넣을 수 없는" 상황과 다르다.

```
"이 정책은 모든 role에 적용된다" → role 차원에 특정 값을 지정하고 싶지 않다
"이 이벤트에 role 개념은 존재하지 않는다" → role 차원이 적용되지 않는다
```

두 경우 모두 `"_"`로 인코딩한다. 좌표가 비어있는 것이 아니라, **"비어있다는 의미의 좌표"가 채워진 것이다.** 비선택도 하나의 선택이며, 주소 공간에서 자기 자리를 차지한다.

이 패턴 덕분에:
- 닫힌 패턴의 bijection이 유지됨
- 범위 쿼리로 "미결정 레코드"를 정확히 선택 가능
- bitmask로 "선택하지 않음" 조합에 대한 권한을 명시적으로 부여/거부 가능
- 새 차원 추가 시 기존 데이터의 기본값으로 활용 가능

---

## 3. 설계 원칙

### 원칙 1: 시스템은 마커를 특별 취급하지 않는다

코덱(WeightedIndex, MetaCodec) 입장에서 `"_"`는 그냥 position 1의 entry다. 마커 관련 분기가 코덱에 존재하지 않는다.

```ts
// MetaCodec 내부 — 마커 판별 로직 없음
encode(entityIds: Record<string, EntityId>): VersionedValue {
  // "_"든 "admin"이든 동일한 경로로 encode
  const vi = this._prefix.encodeFromIds(this._map.indexId, entityIds, this._map.versionId);
  return { indexId: vi.prefix, versionId: vi.v, value: vi.id };
}
```

의미 해석은 서비스 레이어가 담당한다:

```ts
// 서비스 레이어 — 마커 판별은 여기서
const RESERVED_TOKENS = new Set(["_", "~", "?", "NaN"]);

function classifyEntry(value: string): "normal" | "reserved" {
  return RESERVED_TOKENS.has(value) ? "reserved" : "normal";
}
```

### 원칙 2: 선두 배치

마커는 entries 배열의 **앞쪽**에 배치한다. 순서: `"_"` → `"~"` → `"?"` → 커스텀 마커 → 정규 엔티티.

```ts
// ✅ 선두 배치 — 정규 엔티티가 끝에 추가되어도 마커 인덱스 안정
entries: ["_", "~", "admin", "editor"]
// "viewer" 추가 → ["_", "~", "admin", "editor", "viewer"]
// _ = position 1, ~ = position 2 고정

// ❌ 후미 배치 — 새 엔티티 추가 시 마커와 정규 엔티티의 경계가 모호
entries: ["admin", "editor", "_", "~"]
```

선두 배치의 실익:
- 범위 쿼리에서 마커 이후 position으로 정규 엔티티만 깔끔하게 선택 가능
- 모든 차원에서 `"_"`이 항상 position 1이라는 예측 가능성

### 원칙 3: 명시적 선언

마커 사용 여부는 dim의 `description` 필드에 `reserved:` 접두어로 선언한다. 선언이 없으면 모든 entry가 정규 도메인 값이다.

```
reserved: [1]="_" (미분류), [2]="~" (기타)
```

---

## 4. 테스트로 보는 실제 패턴

### 4.1 서비스 레이어의 3분류: normal / reserved / empty

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
| `normal` | 정규 도메인 값 | ✓ | ✓ | index-label 매핑에 포함 |
| `reserved` | 슬롯 마커 | ✓ | ✓ | index-label 매핑에서 제외, 의미는 토큰으로 판별 |
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

### 4.2 index-label 매핑에서 마커 제외

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

### 4.3 마커도 sparse 배치가 가능하다

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

### 4.4 분산 환경에서 마커가 포함된 entry 적재

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

### 4.5 encode/decode에서 마커는 일반 entry와 동일하게 동작한다

`meta-codec.test.ts`에서 encode/decode round-trip은 entry가 무엇이든 동일하다:

```ts
it("encode → decode round-trip: 원래 entity ID를 복원한다", () => {
  const codec = new MetaCodec(permMap());
  const vv = codec.encode({ role: "admin", action: "write", resource: 20 });
  const ids = codec.decode(vv);
  expect(ids).toEqual({ role: "admin", action: "write", resource: 20 });
});
```

마커를 entries에 넣어도 동일하다:

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

### 4.6 범위 쿼리로 마커 레코드 선택

마커가 선두에 배치된 entries에서 `matchRanges`로 마커 레코드만 선택하거나 제외할 수 있다:

```ts
const codec = new MetaCodec(mapWithMarkers);
// shape: role[5] × action[4] = 20

// role이 "_"인 모든 레코드 (미결정 항목)
codec.matchRanges({ role: "_" });
// → [[0, 3]]  (role=position 1, action 와일드카드 4개)

// role이 정규 엔티티인 레코드만 (마커 제외)
// admin=position 3, editor=4, viewer=5 → value 8~19
// 개별 조회를 합산하거나 range query 패턴 활용
```

### 4.7 게이트 시스템과의 조합

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

## 5. 카테고리 외 항목의 수집 전략

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

## 6. 용량 영향

마커는 shape을 증가시키므로 전체 주소 공간이 커진다.

| 구성 | shape | 주소 수 | 오버헤드 |
|------|-------|---------|----------|
| 마커 없음 | [10, 8, 5] | 400 | 기준 |
| `"_"`만 | [11, 9, 6] | 594 | +48.5% |
| `"_"` + `"~"` | [12, 10, 7] | 840 | +110% |

차원 수가 많을수록 오버헤드가 기하급수적으로 커진다. capacity planner에서 마커 수를 반드시 포함해야 한다:

```ts
planCapacity({
  dims: [
    { name: "role",     current: 5 + 2, growth: 3 },  // 마커 2개 포함
    { name: "action",   current: 8 + 2, growth: 2 },
    { name: "resource", current: 3 + 2, growth: 10 },
  ],
  left: [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: "uuid",
});
```

| 마커 수 | 구성 | 적합한 상황 |
|---------|------|-------------|
| 1 (`"_"`) | 최소 | null/해당없음만 표현하면 되는 경우 |
| 2 (`"_"` + `"~"`) | 표준 | 대부분의 운영 환경 |
| 3 (`"_"` + `"~"` + `"?"`) | 확장 | 외부 입력 파싱 실패를 구분해야 하는 도메인 |

---

## 7. 안티패턴

**AP-1: 코덱에 마커 특별 처리 로직 삽입**

```ts
// ❌ 코덱이 마커를 특별 처리 → 범용성 훼손
encode(coords) {
  if (coords.includes("_")) return SPECIAL_NULL_ADDRESS;
}

// ✅ 코덱은 마커를 일반 entry와 동일하게 처리
// 의미 해석은 서비스 레이어가 담당
```

**AP-2: `"~"` 마커 레코드를 영구 방치**

`"~"`의 목적은 **임시 수용**이지 영구 분류가 아니다. 주기적으로 재분류하지 않으면 `"~"` 주소에 이질적 데이터가 누적되어 의미를 잃는다.

**AP-3: dim마다 다른 마커 토큰 사용**

```ts
// ❌ 불일치 — "이 dim에서 null은 뭘로 표현하지?" 매번 확인 필요
role:     description: 'reserved: [1]="unassigned"'
action:   description: 'reserved: [1]="none"'
resource: description: 'reserved: [1]="N/A"'

// ✅ 표준 토큰 사용
role:     description: 'reserved: [1]="_"'
action:   description: 'reserved: [1]="_"'
resource: description: 'reserved: [1]="_"'
```

**AP-4: composite dim의 entries에서 마커를 후미에 배치**

선두 배치 원칙(§3 원칙 2) 참조. 1D 테이블(capacity 기반)에서는 position을 자유롭게 배치할 수 있지만, composite index의 dim entries에서는 선두 배치가 중요하다.
