---
def:
  id: conv-naming
  address: def_document:v2:273544
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, runtime, contract]
  links:
    - target: index-codec-spec
      type: constrains
    - target: table-accessor-api
      type: constrains
    - target: sdk-system
      type: constrains
---
# conv-naming

## 목적 ^purpose

축/entry/prefix ID의 네이밍 제약. snake_case, EntityId 정규화, 충돌 방지 규칙.

축/entry/prefix ID의 네이밍 제약. snake_case, EntityId 정규화, 충돌 방지 규칙.

## 구성 ^overview

- **콜론 금지**: 직렬화 형식 `{indexId}:{versionId}:{value}`의 구분자 충돌 방지를 위해 모든 ID에서 `:` 문자 사용 불가
- **MetaRegistry 강제**: 콜론 포함 ID는 생성자에서 ValidationError 발생으로 원천 차단
- **EntityId 정규화**: `-0`은 `0`으로 자동 정규화되며, 동일 snapshot 내 중복 EntityId는 ValidationError
- **커스텀 PackFormat 등록**: defineFormat → 용량 검증 → FormatRegistry 등록 → 프로토콜 생성 → AddressConverter 등록 → round-trip 검증 6단계 절차
- **defineFormat 검증**: name 비어있거나 chars ≤ 0이거나 groups 합계 ≠ chars이면 RangeError
- **이름 규칙**: PackFormat.name은 lowercase+하이픈, AddressProtocol.name은 `layout:{format.name}` 자동 생성
- **groups 설계**: 내부 저장용은 생략, API 노출용은 4~8자 단위, UUID 호환은 RFC 4122 고정 그룹

그룹: [conventions-system.md](conventions-system.md)
원본: `docs/specs/indexing/conventions.md` SS1, SS3, SS4

## 상태

implemented

## 1. ID 네이밍 제약

`VersionedValue`의 직렬화 형식이 `"{indexId}:{versionId}:{value}"`이므로, `:` 문자는 구분자로 예약되어 있다.

**규칙**: `dimId`, `snapshotId`, `indexId`, `versionId` 모두 `:` 문자를 포함할 수 없다.

```ts
// 유효
"perm", "iv1", "role", "v2"

// ValidationError
"ro:le", "v:1", "pe:rm", "iv:1"
```

MetaRegistry 생성자에서 강제한다. `:` 가 포함되면 `ValidationError`.

> **이유**: 직렬화 형식 `"{indexId}:{versionId}:{value}"`의 파싱은 마지막 두 콜론을 구분자로 사용한다. `indexId`는 콜론을 포함할 수 있지만, `versionId`에 콜론이 있으면 `parse()` 시 잘못된 분리가 발생한다. 생성자에서 모든 ID의 콜론을 금지해 이 문제를 원천 차단한다.

## 2. EntityId 정규화

- `-0`은 `0`으로 정규화된다. `entries` 배열에 저장될 때와 `idToIndex` Map에 등록될 때 모두 `0`으로 변환된다. `getDimSnapshot().entries`에서 `-0`이 반환되는 일은 없다.
- `-0`과 `0`은 같은 EntityId로 취급되므로 동일 snapshot에 함께 존재하면 `ValidationError`.
- 동일 snapshot 내 중복 EntityId는 `ValidationError`.

## 3. 커스텀 PackFormat 등록 절차

새 ID 컨테이너 포맷을 추가할 때 따라야 하는 표준 프로세스.

> 관련 스펙: `weighted-index/pack-format.spec.md`

### 3.1 포맷 정의

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
- `chars <= 0` 이면 `RangeError`
- `groups` 합계 != `chars` 이면 `RangeError`
- `groups` 내 0 이하 값이면 `RangeError`

### 3.2 체크리스트

| 단계 | 확인 사항 | 도구 |
|---|---|---|
| 1. 용량 산정 | 현재 shape의 곱이 포맷에 들어가는가? | `fitLayout({ shape, left, capacity: myFormat })` |
| 2. 필드 배치 | prefix + version + index가 chars 이내인가? | `planLayout()` 결과의 `totalChars` 확인 |
| 3. 포맷 등록 | `FormatRegistry`에 등록 | `reg.register(myFormat)` |
| 4. 프로토콜 생성 | 양방향 직렬화가 필요하면 layout protocol 생성 | `createLayoutProtocol({ format: myFormat, ... })` |
| 5. 변환기 등록 | `AddressConverter`에 프로토콜 등록 | `conv.register(layoutProtocol)` |
| 6. round-trip 검증 | 모든 등록 프로토콜과의 양방향 변환 확인 | `conv.convert(input, "layout:cuid")` round-trip |

### 3.3 전체 예시

```ts
import {
  defineFormat,
  createFormatRegistry,
  createLayoutProtocol,
  createAddressConverter,
  fitLayout,
  PACK_FORMATS,
} from "weighted-index";

// -- 1. 포맷 정의 --
const cuidFormat = defineFormat({
  name: "cuid", chars: 24, label: "CUID (96-bit)", groups: [8, 8, 8],
});

// -- 2. 용량 검증 --
const fit = fitLayout({
  shape: [100, 50, 20, 10],
  left:  [{ name: "prefix", chars: 4 }, { name: "version", chars: 2 }],
  capacity: cuidFormat,
});
// fit.indexBudget = 18, fit.product <= 16^18 -> 충분

// -- 3. 포맷 레지스트리 등록 --
const reg = createFormatRegistry();
reg.register(cuidFormat);
// reg.list()에서 chars 오름차순으로 cuid가 포함됨

// -- 4. 프로토콜 생성 --
const cuidProto = createLayoutProtocol({
  format: cuidFormat,
  schemaChars: 4,
  versionChars: 2,
  schemas:  { perm: 1, doc: 2 },
  versions: { v1: 1, v2: 2 },
});

// -- 5. 변환기 등록 --
const conv = createAddressConverter();
conv.register(cuidProto);

// -- 6. 양방향 검증 --
const addr = { schema: "perm", version: "v1", index: 42 };
const cuid  = conv.serialize(addr, "layout:cuid");
// -> "00010100-00000000-0000002a"
const colon = conv.convert(cuid, "colon");
// -> "perm:v1:42"
const back  = conv.convert(colon, "layout:cuid");
// -> "00010100-00000000-0000002a" (원본과 동일)
```

### 3.4 이름 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| `PackFormat.name` | lowercase, 하이픈 허용, 고유 | `"cuid"`, `"token-48"` |
| `AddressProtocol.name` | layout protocol은 `"layout:{format.name}"` 자동 생성 | `"layout:cuid"` |
| `FormatRegistry` 키 | `PackFormat.name`과 동일 | `reg.get("cuid")` |

### 3.5 groups 설계 가이드

| 상황 | groups 설정 | 이유 |
|---|---|---|
| 내부 DB 저장 전용 | 생략 (연속 hex) | 가독성 불필요, 파싱 단순 |
| API 응답, 외부 노출 | 4~8자 단위 그룹 | 사람이 구분 가능 |
| UUID 호환 필요 | `[8, 4, 4, 4, 12]` 고정 | RFC 4122 준수 |
| 고정 필드 시각화 | 필드 크기에 맞춤 | 예: prefix=4, ver=2, idx=6 -> `[4, 2, 6]` |
