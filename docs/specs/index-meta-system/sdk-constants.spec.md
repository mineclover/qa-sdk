---
def:
  id: sdk-constants
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: canonical-format-spec
      type: depends_on
    - target: sdk-dim-views
      type: depends_on
---
# sdk-constants

## 목적 ^purpose

constants() 빌드 로직과 RESERVED_TOKENS. 모든 예약 토큰은 constants()를 통해 공급된다.

constants() 빌드 로직과 RESERVED_TOKENS. 모든 예약 토큰은 constants()를 통해 공급된다.

그룹: [sdk-system.md](sdk-system.md)
원본: `docs/specs/indexing/index-meta/sdk.spec.md`

## 상태

implemented

## 1. 예약 토큰 (RESERVED_TOKENS)

```ts
export const RESERVED_TOKENS: ReadonlySet<string> = new Set(["_", "~", "?"]);
```

### 기본 토큰

| 토큰 | 역할 | 의미 |
|------|------|------|
| `"_"` | **null** | 값 없음, 미결정, 해당 없음 |
| `"~"` | **other** | 정의된 카테고리에 해당하지 않음 |
| `"?"` | **unknown** | 존재하지만 식별 불가 |

### 오버라이드

테이블마다 사용하는 예약 토큰이 다를 수 있다:

```ts
// number_enum에서 NaN 추가
createIndexSDK(input, {
  reservedTokens: new Set(["_", "~", "?", "NaN"]),
});

// 예약 토큰 필터링 비활성화
createIndexSDK(input, {
  reservedTokens: new Set(),
});
```

## 2. entries() vs constants() vs dimFullView() 차이

| 메서드 | 예약 토큰 | inactive 항목 | 빈 슬롯 | capacity 정보 | 용도 |
|--------|----------|--------------|---------|-------------|------|
| `entries(dimId)` | **포함** | **포함** | **미포함** | **없음** | 전체 entries 참조, 마커 접근 |
| `constants(dimId)` | **제외** | **제외** | **미포함** | **없음** | 코드젠, IDE 자동완성, 도메인 상수 |
| `dimFullView(dimId)` | **포함** | **포함** | **포함** | **있음** | 백엔드 주소 추론, 관리 UI |

```ts
const tracking = sdk.client("tracking", "v1");

// entries — 전체 (마커 포함)
tracking.entries("action");
// -> ["_", "~", "click", "view", "scroll"]

// constants — 정규 도메인 값만
tracking.constants("action");
// -> { click: "click", view: "view", scroll: "scroll" }
```

## 3. constants() 빌드 로직

```
entries 배열 순회
  ├── 예약 토큰인가? -> 제외  (reservedTokens.has(entry))
  ├── inactive인가?  -> 제외  (activeIndices에 없음)
  └── 통과           -> result[String(entry)] = entry
```

### string_enum 결과

```ts
entries: ["_", "~", "admin", "editor", "viewer"]
constants -> { admin: "admin", editor: "editor", viewer: "viewer" }
```

### number_enum 결과

```ts
entries: [10, 20, 30]
constants -> { "10": 10, "20": 20, "30": 30 }
```

### inactive 필터링

entryFlags로 `deprecated` 등으로 표시된 항목은 constants에서 제외된다.
entries와 encode/decode에서는 여전히 유효하다 (기존 데이터 decode 보장).

```ts
// position 3 (editor)가 inactive
snapshots: {
  v1: {
    entries: ["_", "admin", "editor", "viewer"],
    entryFlags: { 3: { status: "inactive" } },
  },
}

// constants에서 editor 제외
tracking.constants("role");
// -> { admin: "admin", viewer: "viewer" }

// entries에는 여전히 포함
tracking.entries("role");
// -> ["_", "admin", "editor", "viewer"]

// encode/decode도 정상 동작 (기존 데이터)
tracking.decode(editorVV);
// -> { role: "editor", ... }
```

## 4. SDK-level constants

IndexClient와 별개로, SDK에서 직접 dim + snapshot을 지정해 상수를 추출할 수 있다.
특정 index에 바인딩되지 않은 dim-level 상수가 필요한 경우에 사용한다.

```ts
const sdk = createIndexSDK(input);

// index 바인딩 없이 dim의 상수 추출
const roles = sdk.constants("role", "v1");
// -> { admin: "admin", editor: "editor", viewer: "viewer" }

// index에 바인딩된 상수는 client.constants()
const perm = sdk.client("perm", "v1");
const actions = perm.constants("action");
```

SDK-level `constants()`도 동일한 필터링 규칙(예약 토큰 + inactive 제외)이 적용되며, 결과는 캐싱된다.
