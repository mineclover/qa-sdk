# 인덱싱 시스템 관례

> `weighted-index`와 `index-meta`를 사용하는 프로젝트에서 따라야 하는 규칙.
> 기반 원리는 [`foundation.md`](foundation.md), 사용 패턴은 [`patterns.md`](patterns.md)를 참조한다.

---

## 1. ID 네이밍 제약

`VersionedValue`의 직렬화 형식이 `"{indexId}:{versionId}:{value}"`이므로, `:` 문자는 구분자로 예약되어 있다.

**규칙**: `dimId`, `snapshotId`, `indexId`, `versionId` 모두 `:` 문자를 포함할 수 없다.

```ts
// ✅ 유효
"perm", "iv1", "role", "v2"

// ❌ ValidationError
"ro:le", "v:1", "pe:rm", "iv:1"
```

MetaRegistry 생성자에서 강제한다. `:` 가 포함되면 `ValidationError`.

> **이유**: 직렬화 형식 `"{indexId}:{versionId}:{value}"`의 파싱은 마지막 두 콜론을 구분자로 사용한다. `indexId`는 콜론을 포함할 수 있지만, `versionId`에 콜론이 있으면 `parse()` 시 잘못된 분리가 발생한다. 생성자에서 모든 ID의 콜론을 금지해 이 문제를 원천 차단한다.

---

## 2. 예약 항목(Reserved Entry)

### 문제

`encode()`는 모든 차원에 반드시 값이 있어야 한다. 값이 없으면 에러다. 그러나 실제 도메인에서는 정규 분류 밖의 상태가 존재한다:

| 상태 | 예시 |
|---|---|
| **미지정 (null)** | 우선순위 미배정, 마이그레이션 시 새 차원에 값 없음 |
| **기타 (other)** | 정의된 카테고리에 해당하지 않는 이벤트 |
| **알 수 없음 (unknown)** | 값이 존재하지만 식별 불가, 파싱 실패 |

이런 상태가 encode에서 에러가 되면 안 되므로, entries에 해당 상태를 나타내는 **예약 항목**을 포함해야 한다.

### 원칙

1. **dim이 허용하는 예약 항목을 명시적으로 선언한다.** 선언하지 않으면 모든 entry가 정규 도메인 값이며, 값 없이 encode하면 에러다.
2. **허용한다면 프로젝트 전체에서 동일한 토큰을 사용한다.** 각 dim이 `"unassigned"`, `"none"`, `"N/A"` 등 제각기 다른 표기를 쓰면 소비자가 일관되게 판단할 수 없다.
3. **시스템은 예약 항목을 특별 취급하지 않는다.** 좌표가 부여되고, encode/decode되고, bijection이 유지된다. "이 값이 예약 항목이다"라는 해석은 도메인 레이어의 책임이다.

### 슬롯 마커

예약 항목의 핵심은 **슬롯 마커(slot marker)** 개념이다. 어떤 position에든 특정 의미를 가진 토큰을 마커로 선언할 수 있다. 시스템은 마커를 특별 취급하지 않으며, 의미 해석은 전적으로 도메인 레이어의 책임이다.

마커는 두 종류로 분류된다:

**표준 마커** — 프로젝트 전체에서 동일한 의미로 사용해야 하는 예약 토큰.

**커스텀 마커** — 특정 dim에서만 사용하는 마커. `description`에 의미를 명시해야 한다.

### 표준 토큰

**`string_enum` 표준 마커** — 예약어이므로 정규 도메인 값으로 사용 금지:

| 토큰 | 의미 |
|---|---|
| `"_"` | **null** — 값이 없거나 아직 결정되지 않음 |
| `"~"` | **other** — 정의된 카테고리에 해당하지 않음 |
| `"?"` | **unknown** — 값이 존재하지만 식별 불가 |

**`number_enum` 표준 마커**:

| 토큰 | 의미 |
|---|---|
| `"NaN"` | **not a number** — 숫자가 아닌 값이 들어온 경우 |

> `number_enum`의 entries는 number[]이지만, `NaN` 마커 position만 예외적으로 `"NaN"` 문자열을 value로 저장한다. 시스템(encode/decode)은 이를 일반 entry와 동일하게 처리하며, NaN 여부 판단은 도메인 레이어 책임이다.

**커스텀 마커**: 위 표준 토큰 외에 프로젝트 필요에 따라 추가 가능. 단, `description`에 의미를 명시해야 한다.

### 배치 규칙

1. **예약 항목은 entries 배열의 앞쪽에 배치.** 정규 항목보다 앞에 위치시켜 경계를 명확히 한다.
2. 표준 마커가 여럿이면 순서: `"_"` (null) → `"~"` (other) → `"?"` (unknown) → `"NaN"`.
3. 커스텀 마커는 표준 마커 뒤에 배치.
4. dim 정의의 `description`에 `reserved:` 접두어로 선언.

### 선언 형식

`description` 필드에 다음 형식으로 기술:

```
reserved: [position]=token (설명), [position]=token (설명)
```

선언이 없으면 예약 항목이 없는 것이다.

### 예시

```ts
// ── null만 허용 ───────────────────────────────────────────────────
priority: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미지정)',
  snapshots: {
    v1: { entries: ["_", "low", "medium", "high"] },
  },
}

// ── null + other 허용 ─────────────────────────────────────────────
category: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미분류), [2]="~" (기타)',
  snapshots: {
    v1: { entries: ["_", "~", "tech", "science", "art"] },
  },
}

// ── 예약 항목 없음 — 값은 반드시 정규 도메인 값 ───────────────────
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

### 소비자 판단 절차

1. `description`에 `reserved:` 선언이 있는지 확인.
2. **있으면**: 선언된 position과 토큰으로 예약 항목 식별. `string_enum` 표준 토큰은 토큰 자체로 의미 확정.
3. **없으면**: 모든 entry가 정규 도메인 값. 값 없이 encode할 수 없으므로 호출자가 에러 처리.

---

## 3. EntityId 정규화

- `-0`은 `0`으로 정규화된다. `entries` 배열에 저장될 때와 `idToIndex` Map에 등록될 때 모두 `0`으로 변환된다. `getDimSnapshot().entries`에서 `-0`이 반환되는 일은 없다.
- `-0`과 `0`은 같은 EntityId로 취급되므로 동일 snapshot에 함께 존재하면 `ValidationError`.
- 동일 snapshot 내 중복 EntityId는 `ValidationError`.

---

## 4. 커스텀 PackFormat 등록 절차

새 ID 컨테이너 포맷을 추가할 때 따라야 하는 표준 프로세스.

> 관련 스펙: [`pack-format.spec.md`](pack-format.spec.md)

### 4.1 포맷 정의

`defineFormat`으로 검증된 `PackFormat` 객체를 생성한다.

```ts
import { defineFormat } from "weighted-index";

const myFormat = defineFormat({
  name:   "cuid",           // 고유 식별 이름 (FormatRegistry 키)
  chars:  24,               // hex 자릿수 (dash 제외)
  label:  "CUID (96-bit)",  // 사람이 읽을 수 있는 설명
  groups: [8, 8, 8],        // dash 그룹 (선택, 합계 = chars)
});
```

**검증 규칙 (defineFormat이 강제)**:
- `name` 비어있으면 `RangeError`
- `chars ≤ 0` 이면 `RangeError`
- `groups` 합계 ≠ `chars` 이면 `RangeError`
- `groups` 내 0 이하 값이면 `RangeError`

### 4.2 체크리스트

| 단계 | 확인 사항 | 도구 |
|---|---|---|
| ① 용량 산정 | 현재 shape의 곱이 포맷에 들어가는가? | `fitLayout({ shape, left, capacity: myFormat })` |
| ② 필드 배치 | prefix + version + index가 chars 이내인가? | `planLayout()` 결과의 `totalChars` 확인 |
| ③ 포맷 등록 | `FormatRegistry`에 등록 | `reg.register(myFormat)` |
| ④ 프로토콜 생성 | 양방향 직렬화가 필요하면 layout protocol 생성 | `createLayoutProtocol({ format: myFormat, ... })` |
| ⑤ 변환기 등록 | `AddressConverter`에 프로토콜 등록 | `conv.register(layoutProtocol)` |
| ⑥ round-trip 검증 | 모든 등록 프로토콜과의 양방향 변환 확인 | `conv.convert(input, "layout:cuid")` round-trip |

### 4.3 전체 예시

```ts
import {
  defineFormat,
  createFormatRegistry,
  createLayoutProtocol,
  createAddressConverter,
  fitLayout,
  PACK_FORMATS,
} from "weighted-index";

// ── ① 포맷 정의 ──
const cuidFormat = defineFormat({
  name: "cuid", chars: 24, label: "CUID (96-bit)", groups: [8, 8, 8],
});

// ── ② 용량 검증 ──
const fit = fitLayout({
  shape: [100, 50, 20, 10],
  left:  [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: cuidFormat,
});
// fit.indexBudget = 18, fit.product ≤ 16^18 → 충분

// ── ③ 포맷 레지스트리 등록 ──
const reg = createFormatRegistry();
reg.register(cuidFormat);
// reg.list()에서 chars 오름차순으로 cuid가 포함됨

// ── ④ 프로토콜 생성 ──
const cuidProto = createLayoutProtocol({
  format: cuidFormat,
  schemaChars: 4,
  versionChars: 2,
  schemas:  { perm: 1, doc: 2 },
  versions: { v1: 1, v2: 2 },
});

// ── ⑤ 변환기 등록 ──
const conv = createAddressConverter();
conv.register(cuidProto);

// ── ⑥ 양방향 검증 ──
const addr = { schema: "perm", version: "v1", index: 42 };
const cuid  = conv.serialize(addr, "layout:cuid");
// → "00010100-00000000-0000002a"
const colon = conv.convert(cuid, "colon");
// → "perm:v1:42"
const back  = conv.convert(colon, "layout:cuid");
// → "00010100-00000000-0000002a" (원본과 동일)
```

### 4.4 이름 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| `PackFormat.name` | lowercase, 하이픈 허용, 고유 | `"cuid"`, `"token-48"` |
| `AddressProtocol.name` | layout protocol은 `"layout:{format.name}"` 자동 생성 | `"layout:cuid"` |
| `FormatRegistry` 키 | `PackFormat.name`과 동일 | `reg.get("cuid")` |

### 4.5 groups 설계 가이드

| 상황 | groups 설정 | 이유 |
|---|---|---|
| 내부 DB 저장 전용 | 생략 (연속 hex) | 가독성 불필요, 파싱 단순 |
| API 응답, 외부 노출 | 4~8자 단위 그룹 | 사람이 구분 가능 |
| UUID 호환 필요 | `[8, 4, 4, 4, 12]` 고정 | RFC 4122 준수 |
| 고정 필드 시각화 | 필드 크기에 맞춤 | 예: prefix=4, ver=2, idx=6 → `[4, 2, 6]` |
