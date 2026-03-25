---
def:
  id: perm-codec-spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
  tags: [security]
  links:
    - target: permission-model
      type: depends_on
    - target: perm-resource-spec
      type: depends_on
---

# permission-engine codec 스펙

## 목적 ^purpose

`PermissionCodec`은 `permission-engine`의 address codec layer다.
Tier 1 text permission code, Tier 2 1D integer address, Tier 3 binary bitmask를 같은 닫힌 주소 공간으로 연결한다.

패키지: `permission-engine`
운영 흐름: `[S2]` 권한 해소/검사 — [runtime-flows.spec.md](../../operations/runtime-flows.spec.md)
패키지 인덱스: [README.md](README.md)

## 상태

implemented

## 1. 3-tier 프로토콜 스택

### 1.1 레이어 역할

| Tier | 표현 | 주 용도 | canonical API |
|---|---|---|---|
| Tier 1 | text: `"shop/payment.api.admin/teams.GET"` | 로그, 디버그, 설정 파일, 사람이 읽는 계약 | `encode()`, `decodeToText()` |
| Tier 2 | integer: `42`, serialized text: `"perm:v1:42"` / `"perm:42"` | DB 저장, 이벤트 태깅, 서비스 간 전달 | `encode*()`, `decode()`, `serialize()`, `parse()` |
| Tier 3 | bitmask: `Uint8Array` | 클라이언트 세션/JWT, O(1) permission check | `createMask()`, `grantTo()`, `check()`, `listGrants*()` |

- Tier 1의 문자열 형식은 `permission-code.ts`의 `{service}.{type}.{resource}.{action}` 규칙을 따른다.
- Tier 2의 정수 주소는 `WeightedIndex([services, types, resources, actions])`가 계산하는 0-based 1D address다.
- Tier 3은 Tier 2 주소를 bit position으로 사용하는 plain binary mask다.

### 1.2 차원 순서

`PermissionCodec`의 내부 차원 순서는 항상 다음과 같이 고정된다.

```text
[service, type, resource, action]
```

- `CodecDims` 배열 순서가 각 차원의 1-based ordinal을 결정한다.
- 같은 ID 집합이라도 배열 순서가 달라지면 다른 주소 공간이 된다.
- 따라서 `PermissionCodec`, `PrefixCodec`, `MetaCodec` 사이의 호환성은 차원 순서와 entry 순서가 완전히 같을 때만 성립한다.

### 1.3 계층 경계

- Tier 1 parsing/formatting 자체는 `parsePermCode()` / `formatPermCode()`가 담당한다.
- Tier 2 좌표 계산은 `WeightedIndex`가 담당한다.
- Tier 3 bit 조작은 `weighted-index`의 `createMask`, `setBit`, `clearBit`, `hasBit`, `popcount`에 위임한다.
- `PermissionCodec`은 이 세 층을 이어 주는 도메인 특화 어댑터다.

---

## 2. 공개 export 타입

소스: `packages/permission-engine/src/permission-codec.ts`

| export | 형태 | 계약 |
|---|---|---|
| `CodecDims` | interface | `services`, `types`, `resources`, `actions` 배열. 배열 순서가 1-based ordinal이다. |
| `DecodedPerm` | interface | `decode()` / `listGrantsDecoded()`의 반환 구조체. `service`, `type`, `resource`, `action`, `address`를 포함한다. |
| `CodecSnapshot` | interface | `{ version, dims, mask? }` 형태의 외부 snapshot shape. 현재 구현에는 이 타입을 직접 생산/소비하는 `PermissionCodec` 메서드가 없다. |
| `PermissionCodec` | class | Tier 1 ↔ Tier 2 ↔ Tier 3 변환 API를 제공하는 코덱 클래스 |

### 2.1 `CodecDims`

```ts
interface CodecDims {
  services: readonly string[];
  types: readonly string[];
  resources: readonly string[];
  actions: readonly string[];
}
```

제약:

- 각 배열은 비어 있으면 안 된다. 내부 `WeightedIndex`가 빈 차원을 허용하지 않는다.
- 각 배열의 값은 중복되면 안 된다. 내부 `LabelRegistry`가 중복 ID를 거부한다.
- 이 타입은 네 차원이 모두 닫힌 집합임을 전제한다.

### 2.2 `DecodedPerm`

```ts
interface DecodedPerm {
  service: string;
  type: string;
  resource: string;
  action: string;
  address: number;
}
```

용도:

- Tier 2 정수 주소를 사람이 읽을 수 있는 구조체로 복원한다.
- `listGrantsDecoded()`에서 service/type 기반 후처리를 하기 위한 중간 표현이다.

### 2.3 `CodecSnapshot`

```ts
interface CodecSnapshot {
  version: string;
  dims: CodecDims;
  mask?: string; // base64
}
```

주의:

- public export이지만 현재 `PermissionCodec`에는 `toSnapshot()` / `fromSnapshot()` 같은 대응 메서드가 없다.
- 따라서 이 타입은 "현재 구현된 클래스 API"라기보다 permission codec 상태를 외부에서 기술할 수 있는 공개 데이터 shape로 보아야 한다.

---

## 3. PermissionCodec

### 3.1 생성과 읽기 전용 표면

```ts
new PermissionCodec(version: string, dims: CodecDims)
```

읽기 전용 표면:

| 속성/게터 | 타입 | 설명 |
|---|---|---|
| `index` | `WeightedIndex` | shape=`[services, types, resources, actions]`인 내부 주소 계산기 |
| `version` | `string` | Tier 2 colon 직렬화 시 사용되는 버전 식별자 |
| `size` | `number` | 전체 슬롯 수 (`services × types × resources × actions`) |
| `dims` | `CodecDims` | 생성 시 전달한 차원 정의 |

내부 구현:

- string → ordinal 변환은 custom map이 아니라 `LabelRegistry`에 위임한다.
- unknown label은 low-level `EntityNotFoundError` 대신 stable `RangeError("Unknown <label>: ...")`로 노출한다.

### 3.2 Tier 1 → Tier 2

| API | 입력 | 반환 | 계약 |
|---|---|---|---|
| `encode(text)` | Tier 1 문자열 | `number` | `parsePermCode()`로 text를 분해한 뒤 address를 계산 |
| `encodeCode(code)` | `PermissionCode` 유사 객체 | `number` | 구조화된 4개 파트를 직접 encode |
| `encodeRaw(service, type, resource, action)` | 4개 raw string | `number` | 각 파트를 직접 encode |

에러 계약:

- Tier 1 문자열 형식이 잘못되면 `parsePermCode()`에서 `RangeError`.
- 등록되지 않은 label은 `RangeError("Unknown service/type/resource/action: ...")`.

### 3.3 Tier 2 → Tier 1

| API | 입력 | 반환 | 계약 |
|---|---|---|---|
| `decode(address)` | `number` | `DecodedPerm` | 정수 address를 4개 파트 + `address`로 복원 |
| `decodeToText(address)` | `number` | `string` | `decode()` 후 `formatPermCode()`로 text 직렬화 |

복원 규칙:

- 결과 문자열은 항상 canonical Tier 1 형식 `{service}.{type}.{resource}.{action}`이다.
- `address`는 `[0, size)` 범위의 0-based 정수여야 한다.

### 3.4 Tier 2 직렬화

| API | 반환 | canonical 형식 |
|---|---|---|
| `serialize(address, schema = "perm")` | `string` | `{schema}:{version}:{address}` |
| `parse(serialized)` | `number` | canonical 입력인 `{schema}:{version}:{address}`와 단축형 `{schema}:{address}`를 지원 |

예시:

```ts
const codec = new PermissionCodec("v1", dims);
const address = codec.encode("shop/payment.api.admin/teams.GET");

codec.serialize(address);      // "perm:v1:42"
codec.parse("perm:v1:42");     // 42
codec.parse("perm:42");        // 42
```

현재 구현 기준 주의:

- `parse()`는 마지막 `:` 뒤의 숫자 세그먼트와 주소 범위만 검증한다.
- 즉 canonical 사용 예시는 `perm:v1:42`와 `perm:42`지만, 구현상 schema/version 문자열의 동등성 자체는 검사하지 않는다.
- 문서화된 상호운용 형식은 `serialize()`가 생성하는 canonical 형식을 기준으로 삼아야 한다.

### 3.5 Tier 3 bitmask helper

| API | 반환/효과 | 설명 |
|---|---|---|
| `createMask()` | `Uint8Array` | `size` 슬롯을 담을 수 있는 빈 mask 생성 |
| `grantTo(mask, text)` | `void` | Tier 1 문자열 permission을 grant |
| `revokeFrom(mask, text)` | `void` | Tier 1 문자열 permission을 revoke |
| `check(mask, text)` | `boolean` | Tier 1 문자열 permission grant 여부 |
| `grantRaw(mask, service, type, resource, action)` | `void` | raw 파트 기반 grant |
| `checkRaw(mask, service, type, resource, action)` | `boolean` | raw 파트 기반 check |
| `countGrants(mask)` | `number` | 현재 grant된 slot 수 |
| `listGrants(mask)` | `string[]` | 현재 grant된 모든 Tier 1 text 목록 |
| `listGrantsDecoded(mask)` | `DecodedPerm[]` | 현재 grant된 모든 slot의 구조화 목록 |

복잡도:

- `grantTo`, `revokeFrom`, `check`, `grantRaw`, `checkRaw`는 address 계산 후 단일 bit 조작이므로 O(1)이다.
- `listGrants*()`는 전체 주소 공간을 선형 순회하므로 O(size)다.

### 3.6 Tier 3와 다른 mask 타입의 관계

- `PermissionCodec`이 다루는 Tier 3은 plain `Uint8Array` bitmask다.
- `PermissionSet`은 `[feature, role]` 2D closed space를 감싼 higher-level runtime type이다.
- `TernaryMask`는 authoring/inheritance를 위한 dual-mask model이다.
- 즉 `PermissionCodec`의 Tier 3 helper는 `PermissionSet`이나 `TernaryMask`를 직접 생성하지 않고, 더 낮은 수준의 bitmask 연산만 제공한다.

---

## 4. PrefixCodec / SemanticAddress 연동

### 4.1 PrefixCodec과의 주소 동등성

동일한 label registry와 차원 순서를 사용하면 `PermissionCodec`과 `PrefixCodec`은 같은 address를 생성한다.

```ts
permissionCodec.encodeRaw("shop/payment", "api", "admin/teams", "GET")
===
prefixCodec.encodeFromIds("perm", {
  service: "shop/payment",
  type: "api",
  resource: "admin/teams",
  action: "GET",
}).id
```

필수 조건:

- prefix name은 `perm`
- prefix labels 순서는 `["service", "type", "resource", "action"]`
- 각 label version의 entry 순서는 `CodecDims`와 동일
- prefix version은 `PermissionCodec.version`과 semantic하게 동일한 snapshot을 가리켜야 함

### 4.2 PartialBinder와의 결합

`createBinder(prefixCodec, "perm", { service: "shop/payment" })`로 부분 바인딩을 만들면 남은 자유 차원에 대해 `PermissionCodec.encodeRaw()`와 같은 Tier 2 주소를 계산할 수 있다.

```ts
binder.resolveId({
  type: "api",
  resource: "admin/teams",
  action: "GET",
})
===
permissionCodec.encodeRaw("shop/payment", "api", "admin/teams", "GET")
```

이는 `PermissionCodec`이 닫힌 4D permission space의 domain-specific facade이고, `PrefixCodec`/`PartialBinder`가 같은 수학 모델의 generic facade라는 뜻이다.

### 4.3 SemanticAddress와의 관계

Tier 2의 canonical colon 문자열은 다음 `SemanticAddress`와 같은 의미를 가진다.

```ts
{ schema: "perm", version: "v1", index: 42 }
```

대응 관계:

| PermissionCodec 개념 | SemanticAddress 개념 |
|---|---|
| `schema` 인자 (`serialize` 기본값 `perm`) | `schema` |
| `version` 속성 | `version` |
| 정수 address | `index` |

즉 `serialize(42)`가 `"perm:v1:42"`를 반환할 때, 이는 weighted-index의 colon protocol이 직렬화하는 `SemanticAddress`와 동등하다.

주의:

- `PermissionCodec`은 `SemanticAddress` 객체를 직접 노출하지 않는다.
- `perm:42` 단축형은 full `SemanticAddress` 정보 중 version을 생략한 편의 표현이다.

---

## 5. index-meta MetaCodec 호환성

`PermissionCodec`과 `MetaCodec`이 같은 4D permission space를 표현하려면 `DecodeMap`이 아래 조건을 만족해야 한다.

| DecodeMap 필드 | 요구사항 |
|---|---|
| `indexId` | `"perm"` |
| `versionId` | `PermissionCodec.version`과 같은 version |
| `dims[].dimId` 순서 | `service`, `type`, `resource`, `action` |
| `dims[].entries` | 각 차원마다 `CodecDims`와 같은 entry 순서 |
| `shape` | `[services.length, types.length, resources.length, actions.length]` |

이 조건에서 다음 계약이 성립한다.

```ts
permissionCodec.encodeRaw(service, type, resource, action)
===
metaCodec.encode({ service, type, resource, action }).value
```

즉:

- `MetaCodec.encode()`의 결과는 full `VersionedValue { indexId, versionId, value }`
- 그중 `value` 필드가 `PermissionCodec` Tier 2 정수 주소와 동일하다
- 따라서 `PermissionCodec` Tier 2는 index-meta에서 저장하는 address payload의 value 부분과 호환된다

직렬화 호환성:

```ts
permissionCodec.serialize(address)
===
AddressProtocolManager.serialize({
  indexId: "perm",
  versionId: "v1",
  value: address,
})
```

정리:

- `PermissionCodec`은 permission domain 전용의 "thin codec"
- `MetaCodec`은 DecodeMap 기반 범용 정보 해석 코덱
- 두 코덱은 같은 shape/entries를 공유하면 같은 Tier 2 address space를 본다

---

## 6. 공개 export 커버리지 매트릭스

이 표는 `packages/permission-engine/src/permission-codec.ts`의 모든 직접 export가 본 문서에 반영되었는지 확인하기 위한 체크리스트다.

| export | 본 문서 위치 |
|---|---|
| `CodecDims` | 2, 2.1, 5 |
| `DecodedPerm` | 2, 2.2, 3.3, 3.5 |
| `CodecSnapshot` | 2, 2.3 |
| `PermissionCodec` | 3 전체, 4 전체, 5 |

## 7. 구현 경계

- 이 문서는 현재 구현된 `PermissionCodec` public surface를 기준으로 작성되었다.
- `CodecSnapshot`은 public type이지만 class method surface에는 아직 연결되지 않았다.
- `parse()`는 canonical 형식을 생성하는 `serialize()`와 달리 permissive parser다. schema/version strict validation이 필요하면 호출자가 추가 검증해야 한다.
