---
def:
  id: perm-codec-stack
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
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

## 5. 구현 경계

- `CodecSnapshot`은 공개 타입이지만 현재 클래스 메서드 surface에 직접 연결되지 않았다.
- strict schema/version 검증이 필요하면 `parse()` 이후 호출자가 추가 확인해야 한다.
- 외부 식별자 규칙은 [perm-external-system.md](perm-external-system.md)가 맡고, PermissionCodec은 그 결과를 닫힌 주소 공간으로 투영하는 단계만 책임진다.
