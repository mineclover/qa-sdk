---
def:
  id: perm-codec-stack
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security, tier-backend]
  links:
    - target: permission-model
      type: depends_on
    - target: perm-external-system
      type: depends_on
    - target: perm-codec-spec
      type: refines
---

# PermissionCodec 스택 계약

## 목적 ^purpose

PermissionCodec의 3-tier codec stack과 공개 API를 분리해, permission text를 정수 address와 bitmask로 일관되게 변환하는 런타임 경계를 정의한다.

## 구성 ^overview

- **3-tier 스택**: Tier 1(사람이 읽는 permission text) → Tier 2(DB/이벤트용 1D 정수 address + colon 직렬화) → Tier 3(Uint8Array bitmask로 O(1) 권한 검사)
- **차원 고정 순서**: `[service, type, resource, action]` — 순서가 바뀌면 다른 주소 공간
- **공개 타입 4종**: CodecDims(닫힌 집합), DecodedPerm(구조화 결과), CodecSnapshot(version/dims/mask), PermissionCodec(변환 facade)
- **Tier 3 특성**: grant/check는 O(1) bit 연산, listGrants는 O(size) 전체 순회, PermissionSet/TernaryMask를 직접 만들지 않고 저수준 bitmask만 조작

## 1. 스택 역할

| Tier | 표현 | 핵심 API | 역할 |
|---|---|---|---|
| Tier 1 | `{service}.{type}.{resource}.{action}` | `encode()`, `decodeToText()` | 사람이 읽는 permission code 계약 |
| Tier 2 | `perm:v1:42`, `42` | `encodeCode()`, `encodeRaw()`, `decode()`, `serialize()`, `parse()` | DB 저장과 이벤트 태깅용 1D address |
| Tier 3 | `Uint8Array` bitmask | `createMask()`, `grantTo()`, `check()`, `listGrants*()` | 세션/JWT 등 빠른 권한 검사 |

- 차원 순서는 항상 `[service, type, resource, action]`이다.
- 같은 값 집합이어도 차원 순서가 바뀌면 다른 주소 공간으로 취급한다.
- `PermissionCodec`은 parsing, weighted-index address 계산, bit 연산을 이어 붙이는 도메인 특화 facade다.

## 2. 공개 표면

| export | 형태 | 계약 |
|---|---|---|
| `CodecDims` | interface | `services`, `types`, `resources`, `actions`의 닫힌 집합 |
| `DecodedPerm` | interface | `decode()`와 `listGrantsDecoded()`가 돌려주는 구조화 결과 |
| `CodecSnapshot` | interface | `{ version, dims, mask? }` 공개 snapshot shape |
| `PermissionCodec` | class | Tier 1~3 사이의 변환 API |

핵심 생성 규칙:

- `new PermissionCodec(version, dims)`는 읽기 전용 `index`, `version`, `size`, `dims`를 노출한다.
- 모든 차원 배열은 비어 있거나 중복될 수 없다.
- 등록되지 않은 label은 low-level 에러 대신 `RangeError("Unknown ...")`로 올려 준다.

## 3. Tier 1 ↔ Tier 2

| API | 입력 | 반환 | 보장 |
|---|---|---|---|
| `encode(text)` | permission code 문자열 | `number` | `parsePermCode()` 후 address 계산 |
| `encodeCode(code)` | 구조화된 4개 파트 | `number` | raw string 직접 encode |
| `encodeRaw(service, type, resource, action)` | 4개 raw string | `number` | label 순서에 맞는 주소 계산 |
| `decode(address)` | 0-based address | `DecodedPerm` | 4개 파트와 address 복원 |
| `decodeToText(address)` | 0-based address | `string` | canonical text 직렬화 |
| `serialize(address)` | 0-based address | `string` | 기본 형식 `perm:{version}:{address}` |
| `parse(serialized)` | `perm:v1:42`, `perm:42` | `number` | 마지막 address segment를 읽는 permissive parser |

- Tier 1 문자열 형식 오류는 `parsePermCode()`의 `RangeError`를 따른다.
- address는 항상 `[0, size)` 범위의 0-based 정수여야 한다.
- canonical 상호운용 형식은 `serialize()`가 생성하는 문자열을 기준으로 삼는다.

## 4. Tier 3 helper

| API | 역할 |
|---|---|
| `createMask()` | 전체 slot 수를 담을 수 있는 빈 mask 생성 |
| `grantTo()` / `revokeFrom()` | text permission을 grant/revoke |
| `check()` / `checkRaw()` | 단일 permission bit 조회 |
| `grantRaw()` | raw 파트 기반 grant |
| `countGrants()` | mask의 set bit 수 계산 |
| `listGrants()` / `listGrantsDecoded()` | 현재 grant된 slot 전체 열거 |

- 단일 grant/check 연산은 address 계산 후 bit 하나를 조작하므로 O(1)이다.
- `listGrants*()`는 전체 주소 공간을 순회하므로 O(size)다.
- Tier 3 helper는 `PermissionSet`이나 `TernaryMask`를 직접 만들지 않고, 더 낮은 수준의 bitmask만 다룬다.

## 5. BitIndex 최적화 레이어

`PermissionCodec`은 WeightedIndex(DB용)와 BitIndex(인메모리 필터용) 두 인코딩을 `IndexBridge`로 연결한다. 모두 lazy 초기화.

| 속성 | 타입 | 초기화 | 용도 |
|------|------|--------|------|
| `bitIndex` | `BitIndex` | lazy | BI packed 인코딩/디코딩 |
| `bridge` | `IndexBridge` | lazy | WI address ↔ BI packed 무손실 변환 |

**변환 API:**

| API | 방향 | 설명 |
|-----|------|------|
| `toBitMaskSet(mask)` | WI → BI | Uint8Array의 모든 set bit을 BI packed로 변환하여 BitMaskSet 생성 |
| `toUint8Mask(bitSet)` | BI → WI | BitMaskSet의 모든 항목을 WI address로 변환하여 Uint8Array 마스크 생성 |
| `createBitMaskSet()` | — | 빈 BitMaskSet 생성 |

**차원 필터링 API:**

```typescript
// 단발 필터 — 매번 WI→BI 변환 수행
codec.filterGrants(mask, { service: "shop/payment" });
// → shop/payment 서비스의 부여된 권한만 DecodedPerm[]로 반환

// 조건은 Partial<Record<"service"|"type"|"resource"|"action", string>>
codec.filterGrants(mask, { service: "shop/payment", type: "api" });
```

`filterGrants()`는 내부적으로 라벨 문자열 → 1-based 인덱스 변환 후 `BitMaskSet.filterByLabels()`로 O(1) 차원 추출, 조건에 맞는 항목만 full decode한다.

## 6. PermissionView — 캐시된 필터 뷰

mask 1개에 대한 캐시된 BitMaskSet. 생성 시 WI→BI 변환 1회, 이후 모든 필터/질의는 O(granted).

**생성:**

```typescript
const view = codec.createView(mask);
```

**O(1) 권한 확인:**

```typescript
view.check("shop/payment", "api", "admin/teams", "GET");  // boolean
```

**차원 필터:**

| API | 설명 |
|-----|------|
| `filterByService(service)` | 서비스별 필터 → `DecodedPerm[]` |
| `filterByType(type)` | 타입별 필터 |
| `filterByResource(resource)` | 리소스별 필터 |
| `filterByAction(action)` | 액션별 필터 |
| `filter(conditions)` | 복합 조건 필터 |
| `listAll()` | 부여된 권한 전체 |

**고유 값 조회:**

| API | 반환 |
|-----|------|
| `distinctServices()` | 부여된 권한의 고유 service 목록 |
| `distinctTypes()` | 고유 type 목록 |
| `distinctResources()` | 고유 resource 목록 |
| `distinctActions()` | 고유 action 목록 |

**점진적 패치 (view 재생성 없이 O(1)):**

```typescript
view.applyGrant("shop/payment", "api", "admin/teams", "POST");   // 추가
view.applyRevoke("shop/payment", "api", "admin/teams", "GET");    // 회수
```

**성능:**

- 단발 `filterGrants`: ~250 ops/s (매번 WI→BI 변환)
- `createView` 1회 + filter N회: ~1,200+ ops/s per filter (6배 향상)

**수명 규칙:** mask가 외부에서 변경되면 view를 새로 생성해야 한다. view는 생성 시점의 mask 스냅샷을 보유한다. `applyGrant()`/`applyRevoke()`는 view 내부만 갱신하며, 원본 mask에는 반영되지 않는다.

## 7. 구현 경계

- `CodecSnapshot`은 공개 타입이지만 현재 클래스 메서드 surface에 직접 연결되지 않았다.
- strict schema/version 검증이 필요하면 `parse()` 이후 호출자가 추가 확인해야 한다.
- 외부 식별자 규칙은 [perm-external-system.md](perm-external-system.md)가 맡고, PermissionCodec은 그 결과를 닫힌 주소 공간으로 투영하는 단계만 책임진다.
