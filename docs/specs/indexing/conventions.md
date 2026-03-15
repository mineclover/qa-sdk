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

> 상세 스펙: [`slot-marker.spec.md`](slot-marker.spec.md) — 설계 원리, 테스트 코드, 수집 전략, 용량 영향.

entries에 **슬롯 마커(slot marker)**를 포함하여 "값 없음", "분류 불가", "선택하지 않음" 같은 열린 상황을 닫힌 패턴의 주소 공간 안에서 표현한다. 시스템은 마커를 특별 취급하지 않으며, 의미 해석은 도메인 레이어의 책임이다.

### 표준 토큰

**`string_enum`** — 예약어이므로 정규 도메인 값으로 사용 금지:

| 토큰 | 역할 | 의미 |
|---|---|---|
| `"_"` | **null** | 값 없음, 미결정, 해당 없음, 선택하지 않음 |
| `"~"` | **other** | 정의된 카테고리에 해당하지 않음, 마이그레이션 과도기 버퍼 |
| `"?"` | **unknown** | 값이 존재하지만 식별 불가, 파싱 실패 |

**`number_enum`**: `"NaN"` (숫자가 아닌 값). position만 예외적으로 문자열 저장.

**커스텀 마커**: 표준 토큰 외 추가 가능. `description`에 의미를 명시해야 한다.

### 규칙

1. **명시적 선언**: dim의 `description`에 `reserved: [position]=token (설명)` 형식으로 선언. 선언 없으면 예약 항목 없음.
2. **선두 배치**: 마커는 entries 배열 앞쪽에 배치. 순서: `"_"` → `"~"` → `"?"` → 커스텀 → 정규 엔티티.
3. **프로젝트 전체 일관성**: 동일한 의미에 동일한 토큰. dim마다 다른 표기 금지.
4. **코덱 투명성**: 코덱에 마커 특별 처리 로직 삽입 금지.

### 선언 예시

```ts
// null + other 허용
category: {
  kind: { type: "string_enum" },
  description: 'reserved: [1]="_" (미분류), [2]="~" (기타)',
  snapshots: {
    v1: { entries: ["_", "~", "tech", "science", "art"] },
  },
}

// 예약 항목 없음 — 값은 반드시 정규 도메인 값
role: {
  kind: { type: "string_enum" },
  snapshots: {
    v1: { entries: ["admin", "editor", "viewer"] },
  },
}
```

### 소비자 판단 절차

1. `description`에 `reserved:` 선언이 있는지 확인.
2. **있으면**: 선언된 position과 토큰으로 예약 항목 식별.
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
