---
def:
  id: perm-codec-interop
  address: def_document:v1:3225
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: permission-engine
  tags: [security, tier-backend]
  links:
    - target: perm-codec-stack
      type: depends_on
    - target: permission-encoding
      type: depends_on
    - target: perm-codec-spec
      type: refines
---

# PermissionCodec 상호운용 계약

## 목적 ^purpose

PermissionCodec이 PrefixCodec, SemanticAddress, MetaCodec과 같은 address space를 공유하도록 만드는 상호운용 계약을 분리해, permission 주소의 저장·전송 경계를 안정적으로 맞춘다.

## 구성 ^overview

- **PrefixCodec 동등성**: prefix name `perm`, label 순서 `[service, type, resource, action]`, entry 순서 일치 시 동일 Tier 2 address 생성
- **SemanticAddress 대응**: `perm:v1:42` 형식으로 schema/version/index 매핑, version 생략 단축형(`perm:42`) 지원
- **MetaCodec 호환**: DecodeMap의 indexId/versionId/dims 순서/shape가 조건을 만족하면 동일 address space 공유
- **호출자 책임**: strict schema/version 검증과 catalog drift 방지는 PermissionCodec이 아닌 호출자가 담당

## 1. PrefixCodec과의 주소 동등성

다음 조건이 동시에 맞으면 `PermissionCodec`과 `PrefixCodec`은 같은 Tier 2 address를 생성한다.

- prefix name이 `perm`이다.
- prefix label 순서가 `["service", "type", "resource", "action"]`다.
- 각 label entry 순서가 `CodecDims` 배열과 같다.
- prefix version snapshot이 `PermissionCodec.version`과 같은 의미를 가진다.

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

- `createBinder(prefixCodec, "perm", { service: "shop/payment" })` 같은 부분 바인딩도 같은 주소 공간 위에서 동작한다.
- 따라서 PermissionCodec은 permission 도메인 전용 facade이고, PrefixCodec/PartialBinder는 같은 수학 모델의 범용 facade다.

## 2. SemanticAddress 대응

Tier 2 colon 문자열은 다음 의미를 갖는다.

```ts
{ schema: "perm", version: "v1", index: 42 }
```

| PermissionCodec 개념 | SemanticAddress 개념 |
|---|---|
| `serialize()`의 `schema` 인자 | `schema` |
| `version` 속성 | `version` |
| 정수 address | `index` |

- `perm:v1:42`는 full semantic address다.
- `perm:42`는 version을 생략한 단축형이다.
- `PermissionCodec`은 SemanticAddress 객체 자체를 public surface로 노출하지 않는다.

## 3. MetaCodec 호환 조건

DecodeMap이 아래 조건을 만족하면 `MetaCodec`의 `value`는 PermissionCodec Tier 2 address와 동일하다.

| DecodeMap 필드 | 요구사항 |
|---|---|
| `indexId` | `"perm"` |
| `versionId` | `PermissionCodec.version`과 동일한 snapshot |
| `dims[].dimId` 순서 | `service`, `type`, `resource`, `action` |
| `dims[].entries` | `CodecDims`와 같은 entry 순서 |
| `shape` | `[services.length, types.length, resources.length, actions.length]` |

```ts
permissionCodec.encodeRaw(service, type, resource, action)
===
metaCodec.encode({ service, type, resource, action }).value
```

- 저장 계층에서 `AddressProtocolManager.serialize({ indexId, versionId, value })`를 쓰더라도 value는 같은 address space를 본다.
- 즉 PermissionCodec은 thin codec, MetaCodec은 DecodeMap 기반 범용 코덱이라는 역할 차이만 있다.

## 4. 구현 경계와 호출자 책임

- strict schema/version 검증은 PermissionCodec이 아닌 호출자 책임이다.
- 상호운용은 shape와 entry 순서가 동일할 때만 성립하므로, catalog drift를 허용하면 address 동등성이 깨진다.
- permission text의 semantic validation은 여전히 [perm-external-system.md](perm-external-system.md)의 resource/service-ref 규칙을 따라야 한다.
