---
def:
  id: adr-address-separation
  address: def_document:v2:273538
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: [decision]
  links:
    - target: index-codec-spec
      type: constrains
    - target: resolver-spec
      type: constrains
    - target: index-meta-sdk-spec
      type: constrains
---

# ADR: Address 직렬화 — AddressProtocolManager 분리

## 목적 ^purpose

상태: **구현 완료** (2026-03-15)

관련 스펙: [registry.spec.md](registry.spec.md), [address.spec.md](address.spec.md)
유저 시나리오: [scenarios.spec.md](scenarios.spec.md) §17–19
구현: `address-protocol-manager.ts`, `address-protocol-manager.test.ts`

---

## 맥락

MetaRegistry가 현재 담당하는 영역:

| 영역 | 주요 API |
|---|---|
| 스키마 관리 | `getDimDef`, `getDimSnapshot`, `getIndexDef`, `getIndexVersion` |
| 코덱 생성 | `createCodec` |
| 매니페스트 | `getActiveManifest`, `isEntryActive` |
| 마이그레이션 | `getMigration`, `traceMigration`, `validateMigration` |
| Address 직렬화 | `serialize`, `parse`, `converter`, `defaultProtocol` |
| Address 검증 | `_validateAddressConfig` (생성자) |
| 복제 | `toInput` |

이 중 Address 직렬화(serialize/parse/converter/defaultProtocol/_validateAddressConfig)를
별도 `AddressProtocolManager` 클래스로 분리하는 안이 검토되었다.

```
제안:  MetaRegistry = 스키마 관리 + 코덱 생성 + 매니페스트 + 마이그레이션
       AddressProtocolManager = serialize + parse + converter + protocol 검증
```

---

## 결정

**AddressProtocolManager로 분리한다.** MetaRegistry는 `address` 프로퍼티로 위임하되, `reg.serialize()`/`reg.parse()` backward compat을 유지한다. `reg.parse()`는 loose parse에 registry 검증을 추가한다.

---

## 근거

### 1. parse()가 registry 검증에 강하게 결합

`parse()`는 문자열을 VersionedValue로 변환한 뒤 반드시 registry 검증을 수행한다:

```ts
// meta-registry.ts:606-613
parse(input: string, protocol?: string): VersionedValue {
  // ... AddressConverter에 위임해 파싱 ...
  this._getIndexVersion(vv.indexId, vv.versionId);  // indexId/versionId 존재 검증
  const wi = this._getWeightedIndex(vv.indexId, vv.versionId);
  if (vv.value < 0 || vv.value >= wi.size) { ... }  // value 범위 검증
  return vv;
}
```

`AddressProtocolManager`를 분리하면 이 검증을 위해 registry의 부분 interface를 주입받아야 한다:

```ts
// 분리 시 필요한 interface
interface RegistryLookup {
  getIndexVersion(indexId: string, versionId: string): IndexVersion;
  getWeightedIndex(indexId: string, versionId: string): WeightedIndex;
}
```

이 interface의 소비자가 `AddressProtocolManager` 하나뿐이므로, 간접 참조만 늘어나고 실질적 이득이 없다.

### 2. 독립 사용 시나리오가 없음

모든 테스트/실제 코드에서 serialize/parse는 항상 registry 경유로 사용된다:

```ts
// 정규 사용 패턴 — 항상 reg와 codec이 함께 동작
const pk = reg.serialize(codec.encode(entityIds));
const restored = codec.decode(reg.parse(pk));
```

분리하면 사용 패턴이 간접적으로 변하나 이점은 없다:

```ts
// 분리 후 — 간접 참조 추가, 동일 기능
const pk = reg.address.serialize(codec.encode(entityIds));
const restored = codec.decode(reg.address.parse(pk));
```

`AddressProtocolManager`만 단독으로 생성하는 use-case가 존재하지 않는다.
parse가 반드시 registry의 indexId/versionId/size를 참조하기 때문이다.

### 3. 실제 코드 규모가 작음

Address 관련 코드는 MetaRegistry 전체(1022줄) 대비 약 13%:

| 구분 | 라인 수 | 내용 |
|---|---|---|
| `serialize()` | 4줄 | `fromVersionedValue` → `_converter.serialize` 위임 |
| `parse()` | ~25줄 | `_converter.parse` 위임 + registry 검증 |
| getter 2개 | 각 1줄 | `converter`, `defaultProtocol` |
| `_validateAddressConfig` | ~85줄 | 생성자에서 1회 실행 |
| constructor 바인딩 | ~18줄 | `createAddressConverter` + layout 등록 |

serialize/parse의 실제 로직은 `weighted-index`의 `AddressConverter`에 위임하는
얇은 어댑터이며, MetaRegistry가 추가하는 것은 registry 검증뿐이다.

### 4. 의미 있는 분리는 이미 완료됨

MetaCodec 추출이 진짜 핵심 분리였다:

```
분리 전:  MetaRegistry = 스키마 + 코덱(encode/decode) + 직렬화
분리 후:  MetaRegistry = 스키마 + 직렬화 (검증 게이트웨이)
          MetaCodec    = entity ID ↔ VersionedValue (LabelRegistry + PrefixCodec)
```

MetaCodec은 복잡한 entity 매핑 로직을 가지며, DecodeMap만으로 registry 없이 독립 동작한다.
반면 serialize/parse는 `AddressConverter` 위임 + registry 검증이라는 단순한 조합이다.

---

## 분리가 정당화되는 시점

아래 세 가지 조건 중 하나라도 해당되면 분리를 재검토한다.

### 조건 1: protocol 관리 자체가 복잡해질 때

현재 protocol 관리는 단순하다:
- 생성자에서 `createAddressConverter()` 호출 (text 프로토콜 자동 등록)
- `input.address`가 있으면 `createLayoutProtocol()` + `register()` 한 번
- serialize/parse에서 protocol 이름을 넘기면 끝

**분리가 필요한 시나리오 예시:**

```ts
// ── 예시 A: 런타임 protocol 추가/제거 ──────────────────────────
// 현재는 생성자에서 한 번 설정하면 불변.
// 프로토콜을 동적으로 등록/해제하는 API가 필요해지면
// protocol lifecycle 관리가 별도 관심사가 된다.
addressManager.register(customProtocol);
addressManager.unregister("layout:uuid");

// ── 예시 B: format negotiation ──────────────────────────────────
// 외부 시스템(클라이언트, API 파트너)마다 지원 포맷이 다를 때
// Accept-Encoding 스타일의 협상 로직이 필요해지면
// 이 로직이 MetaRegistry에 있으면 관심사가 과도하게 섞인다.
const protocol = addressManager.negotiate(
  clientCapabilities,  // ["layout:uuid", "colon"]
  serverPreferences    // ["layout:uuid", "layout:int64"]
);
// → "layout:uuid" (양쪽 모두 지원하는 최우선 포맷)

// ── 예시 C: protocol versioning ─────────────────────────────────
// UUID v4 → UUID v7 전환, 또는 layout format의 필드 배치가 변경될 때
// 구버전 파싱 + 신버전 생성을 동시에 지원하는 전환 기간(transition period) 관리.
addressManager.setWriteProtocol("layout:uuid-v7");  // 쓸 때는 v7
addressManager.addReadProtocol("layout:uuid-v4");    // 읽을 때 v4도 허용
// → 전환 기간이 끝나면 v4 읽기 지원 제거

// ── 예시 D: fallback 전략 ───────────────────────────────────────
// 기본 프로토콜 파싱 실패 시 다음 프로토콜로 시도하는 체인.
// 현재는 AddressConverter.parse()가 순서대로 시도하지만,
// 실패 로깅, 메트릭 수집, 부분 성공 처리 등이 추가되면 별도 관리가 필요.
addressManager.setFallbackChain(["layout:uuid", "colon", "uri"]);
addressManager.parse(input); // uuid 실패 → colon 시도 → 성공 + 경고 로그
```

**판단 기준**: `_converter` + `_defaultProtocol` 외에 protocol 관련 private 상태가
2개 이상 추가되거나, protocol 관련 public API가 serialize/parse/converter/defaultProtocol
외에 추가될 때.

### 조건 2: serialize/parse 없이 registry를 사용하는 소비자가 생길 때

현재 모든 소비자가 `reg.serialize`/`reg.parse`를 사용한다.
만약 address 기능 없이 순수 스키마 카탈로그로만 registry를 사용하는 소비자가 등장하면,
address 코드가 dead weight가 된다.

**분리가 필요한 시나리오 예시:**

```ts
// ── 예시 A: 스키마 검증 전용 서비스 ─────────────────────────────
// CI/CD에서 스키마 정합성만 검증하는 worker.
// serialize/parse가 필요 없고, WeightedIndex 캐시도 불필요.
// 그런데 AddressConfig 검증 때문에 schemas/versions 매핑까지 작성해야 한다면 부담.
const registry = new MetaRegistry({
  dims: { ... },
  indices: { ... },
  // address를 안 넣으면 되지만, 실제로는 동일 input을 여러 context에서 공유하므로
  // address가 포함된 input을 받아서 검증만 하고 싶은 경우가 생긴다.
});
registry.getDimDef("role");        // 이것만 필요
registry.getActiveManifest(...);   // 이것도 필요
// registry.serialize(...)          // 이건 안 씀 → _converter 초기화가 낭비

// ── 예시 B: 테스트 환경에서 address 없는 경량 registry ──────────
// 단위 테스트에서 encode/decode만 검증할 때 AddressConfig 작성이 번거로움.
// 현재도 address는 optional이라 문제없지만, 만약 address 관련 초기화 비용이
// 커지거나(예: protocol 플러그인 로딩) registry 생성이 느려지면 분리 이유가 됨.

// ── 예시 C: edge 배포 시 번들 사이즈 ────────────────────────────
// Cloudflare Worker 등 edge 환경에서 weighted-index의 AddressConverter,
// createLayoutProtocol 등이 tree-shaking 되지 않아 번들이 커질 때.
// 스키마 조회만 하는 edge function에서 이 코드가 포함되면 낭비.
```

**판단 기준**: `new MetaRegistry(input)` 호출 후 serialize/parse를 한 번도
호출하지 않는 소비자가 2개 이상 존재할 때.

### 조건 3: registry 없이 AddressProtocolManager를 독립 생성하는 use-case가 생길 때

현재 parse()의 registry 검증(indexId/versionId 존재 + value 범위)은 필수적이다.
그러나 검증 없는 "loose parsing"이 합리적인 시나리오가 존재할 수 있다.

**분리가 필요한 시나리오 예시:**

```ts
// ── 예시 A: 로그 파서 / 감사 도구 ──────────────────────────────
// 과거 로그에서 UUID PK를 파싱해 indexId/versionId를 추출하는 도구.
// 해당 시점의 스키마가 이미 삭제되었을 수 있으므로 registry 검증이 불가능.
// "파싱만 하고 검증은 하지 않는" 독립 파서가 필요.
const parser = new AddressProtocolManager({
  format: PACK_FORMATS.uuid,
  schemaChars: 4,
  versionChars: 2,
  schemas: { perm: 1, content: 2 },     // 매핑만 알면 됨
  versions: { v1: 1, v2: 2, v3: 3 },
});
const vv = parser.parse("00010001-0000-...-002a");
// → { indexId: "perm", versionId: "v1", value: 42 }
// registry가 없으므로 value 범위 검증 없음 — 호출자가 판단

// ── 예시 B: 프록시 / 라우터 ────────────────────────────────────
// UUID의 schema 필드만 읽어서 어느 마이크로서비스로 라우팅할지 결정.
// 전체 스키마를 로드할 필요 없이 schema(indexId) 매핑만 있으면 됨.
const router = new AddressProtocolManager({
  format: PACK_FORMATS.uuid,
  schemaChars: 4,
  versionChars: 2,
  schemas: { perm: 1, content: 2 },
  versions: {},  // 라우팅에 version 상세는 불필요
});
const addr = router.parseSchemaOnly("00010001-...");
// → { schema: "perm" } → route to perm-service

// ── 예시 C: 포맷 변환기 ────────────────────────────────────────
// UUID ↔ colon ↔ int64 간 순수 포맷 변환.
// 스키마 검증 없이 비트 레벨 변환만 수행.
const converter = new AddressProtocolManager({
  format: PACK_FORMATS.uuid,
  schemaChars: 4, versionChars: 2,
  schemas: { perm: 1 }, versions: { v1: 1 },
});
const colon = converter.convert(uuid, "colon");
// → "perm:v1:42" (registry 불필요 — 순수 비트 변환)
```

**판단 기준**: registry 생성 없이 address 파싱/직렬화만 수행하는 코드가
프로덕션에 필요해질 때. 현재는 `weighted-index`의 `AddressConverter`를
직접 사용하면 이미 가능하지만, MetaRegistry가 추가하는 schema/version 이름
↔ 숫자 매핑까지 필요하면서 registry 검증은 불필요한 경우.

---

## 분리 시 예상 설계

분리가 결정되면 아래 구조를 예상한다:

```ts
// AddressProtocolManager — registry와 독립적인 직렬화 게이트웨이
class AddressProtocolManager {
  constructor(config: AddressConfig);
  serialize(vv: VersionedValue, protocol?: string): string;
  parse(input: string, protocol?: string): VersionedValue;  // 검증 없는 loose parse
  get converter(): AddressConverter;
  get defaultProtocol(): string;
}

// MetaRegistry — 검증된 직렬화를 제공하는 wrapper
class MetaRegistry {
  readonly address: AddressProtocolManager;

  // registry 검증을 추가한 parse (기존 동작 유지)
  parse(input: string, protocol?: string): VersionedValue {
    const vv = this.address.parse(input, protocol);
    this._validateVersionedValue(vv);
    return vv;
  }

  // serialize는 그대로 위임 (검증 불필요)
  serialize(vv: VersionedValue, protocol?: string): string {
    return this.address.serialize(vv, protocol);
  }
}
```

기존 `reg.serialize()` / `reg.parse()` API는 유지하되,
`reg.address`로 검증 없는 독립 접근도 가능해진다.

---

## 참고

- MetaCodec 분리 결정과의 비교: MetaCodec은 DecodeMap만으로 registry 없이 독립 동작하며,
  복잡한 entity 매핑 로직(LabelRegistry + PrefixCodec)을 가진다.
  serialize/parse는 `AddressConverter` 위임 + registry 검증이라는 단순한 조합이라
  같은 분리 논리가 적용되지 않는다.
- 현재 `weighted-index`의 `AddressConverter`를 직접 사용하면 registry 없는
  포맷 변환이 이미 가능하다. 분리가 필요한 것은 MetaRegistry가 추가하는
  schema/version 이름 ↔ 숫자 매핑 레이어까지 필요한 경우뿐이다.
