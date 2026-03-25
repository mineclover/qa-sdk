---
def:
  id: address-scenarios
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: deprecated
  tags: [testing]
  links:
    - target: index-codec-spec
      type: traces_to
---

# 외부 시스템 통합 시나리오 (AddressProtocolManager)

## 목적 ^purpose

구현: `AddressProtocolManager` (`address-protocol-manager.ts`)
테스트: `address-protocol-manager.test.ts`
ADR: [adr-address-separation.md](adr-address-separation.md)
Core 시나리오: [scenarios.spec.md](scenarios.spec.md)

## 상태

implemented

MetaRegistry에서 분리된 `AddressProtocolManager`가 제공하는
외부 시스템 통합 시나리오를 3개 영역으로 구분한다.

---

## 영역 구조

```
§17 Loose Parsing        — registry 없이 독립 파싱/변환
│ ├─ 17-0 loose vs validated   (LOOSE-0)
│ ├─ 17-1 로그 파서 + 변환     (LOOSE-1~3, 7~9)
│ └─ 17-2 프록시/라우터        (LOOSE-4~6)
│
§18 Protocol Lifecycle   — 프로토콜 수명 관리
│ ├─ 18-1 등록/해제/교체       (PROTO-DYN-1~4)
│ ├─ 18-2 포맷 협상            (PROTO-NEG-1~2)
│ ├─ 18-3 버전 전환            (PROTO-VER-1~4)
│ └─ 18-4 Fallback 체인       (PROTO-FB-1~5)
│
§19 Schema-only Consumer — 직렬화 없는 스키마 소비
  ├─ 19-1 CI/CD 검증          (SCHEMA-ONLY-1~3)
  └─ 19-2 Edge 배포           (SCHEMA-ONLY-4~6)
```

## 관계: loose parse vs validated parse

```
┌─────────────────────────────────────────────────────┐
│  AddressProtocolManager (loose)                     │
│  ├─ serialize(vv)          → 프로토콜 문자열         │
│  ├─ parse(input)           → VV (검증 없음)          │
│  ├─ parseSchemaOnly(input) → { schema }             │
│  ├─ convert(input, proto)  → 프로토콜 문자열         │
│  ├─ register / unregister                            │
│  ├─ negotiate                                        │
│  ├─ setWriteProtocol / addReadProtocol / removeRead  │
│  └─ setFallbackChain / getFallbackStats              │
├─────────────────────────────────────────────────────┤
│  MetaRegistry (validated)                            │
│  ├─ reg.address              → loose 접근            │
│  ├─ reg.serialize(vv)        → address.serialize     │
│  └─ reg.parse(input)         → address.parse         │
│                                + indexId 존재 검증     │
│                                + versionId 존재 검증   │
│                                + value 범위 검증       │
└─────────────────────────────────────────────────────┘
```

---

## 17. Loose Address Parsing (registry 없는 주소 파싱)

> 목적: MetaRegistry 없이 schema/version 이름 ↔ 숫자 매핑만으로 주소를 파싱·변환.
> registry 검증(indexId/versionId 존재, value 범위)이 불가능하거나 불필요한 외부 시스템 통합.

### 17-0. loose vs validated parse 분기

AddressProtocolManager 분리의 핵심 가치.
동일 PK에 대해 `reg.address.parse()` (loose)와 `reg.parse()` (validated)의 동작이 다름.

```ts
const reg = new MetaRegistry(inputWithAddress);

// 매우 큰 value — 실제 스키마에 존재하지 않는 주소
const bigVV = { indexId: "perm", versionId: "iv1", value: 999999 };
const pk = reg.address.serialize(bigVV);

// loose parse: value 범위 검증 안 함 → 통과
reg.address.parse(pk);  // → { indexId: "perm", versionId: "iv1", value: 999999 }

// validated parse: registry 검증 → value out of range → ParseError
reg.parse(pk);  // → ParseError
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| LOOSE-0 | loose vs validated 분기 | 동일 PK에 대해 address.parse()는 통과, reg.parse()는 ParseError |

### 17-1. 로그 파서 / 감사 도구

과거 로그에서 UUID PK를 파싱해 indexId/versionId/value를 추출하는 도구.
해당 시점의 스키마가 이미 삭제되었을 수 있으므로 registry 검증이 불가능하다.

registry 없이 포맷 변환(`convert`)도 가능하다 — 디버깅 시 UUID를 colon으로 변환해
사람이 읽을 수 있는 형태로 확인하거나, cross-format round-trip으로 데이터 무결성을 검증.

> **§7 PK-RT-1과의 관계**: §7은 MetaRegistry 경유 round-trip (registry 검증 포함).
> 여기서는 AddressProtocolManager 단독으로 동일 변환이 가능함을 증명한다.
> 변환 로직 자체는 동일하지만, "registry 의존성 없음"이 핵심 주장.

```ts
const parser = new AddressProtocolManager({
  format: PACK_FORMATS.uuid,
  schemaChars: 4, versionChars: 2,
  schemas: { perm: 1, content: 2 },
  versions: { v1: 1, v2: 2, v3: 3 },
});

// 2024년 로그에서 발견된 UUID — 당시 v1 스키마는 이미 폐기
const vv = parser.parse("00010001-0000-0000-0000-00000000002a");
// → { indexId: "perm", versionId: "v1", value: 42 }
// value 범위 검증 없음 — 호출자가 판단

// 디버깅: UUID → colon으로 사람이 읽을 수 있게
parser.convert(uuid, "colon"); // → "perm:v1:42"
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| LOOSE-1 | 폐기 스키마 UUID 파싱 | registry 없이 UUID → VersionedValue 추출. indexId/versionId 이름 복원 |
| LOOSE-2 | 미등록 schema 숫자 | schemas 매핑에 없는 schema 숫자 → 명시적 에러 (silent 통과 금지) |
| LOOSE-3 | value 범위 무검증 | registry가 없으므로 value 범위를 검증하지 않음. 반환된 value 그대로 사용 |
| LOOSE-7 | UUID → colon 변환 | registry 없이 순수 비트 변환. round-trip 보장 |
| LOOSE-8 | colon → UUID 변환 | 역방향 변환도 동일 결과 |
| LOOSE-9 | cross-format 변환 | UUID ↔ int64 등 format 간 변환. 동일 VersionedValue |

### 17-2. 프록시 / 라우터

UUID의 schema 필드만 읽어 어느 마이크로서비스로 라우팅할지 결정.
전체 스키마를 로드할 필요 없이 schema(indexId) 매핑만 있으면 된다.

```ts
const router = new AddressProtocolManager({
  format: PACK_FORMATS.uuid,
  schemaChars: 4, versionChars: 2,
  schemas: { perm: 1, content: 2, billing: 3 },
  versions: {},  // 라우팅에 version 상세는 불필요
});

// API gateway에서 UUID를 받아 서비스 라우팅
const addr = router.parseSchemaOnly("00010001-...");
// → { schema: "perm" } → route to perm-service

const routeMap = { perm: "perm-service:8080", content: "content-service:8081" };
const target = routeMap[addr.schema];
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| LOOSE-4 | schema-only 파싱 | UUID에서 schema 필드만 추출. version/value 파싱 불필요 |
| LOOSE-5 | 라우팅 결정 | schema → 서비스 매핑으로 정확한 라우팅 |
| LOOSE-6 | 미등록 schema 라우팅 | 매핑에 없는 schema → ParseError |

---

## 18. Protocol Lifecycle Management (런타임 프로토콜 관리)

> 목적: 프로토콜의 동적 등록/해제, 포맷 협상, 버전 전환, fallback 체인 등
> protocol 관리 자체가 독립 관심사가 되는 시나리오.

### 18-1. 런타임 protocol 등록/해제/교체

서비스 운영 중 커스텀 프로토콜을 추가하거나, 기존 프로토콜을 폐기하는 시나리오.

```ts
// 운영 중 파트너 A 전용 프로토콜 추가
addressManager.register(partnerAProtocol);
const pk = addressManager.serialize(vv, "partner-a:hex32");

// 파트너 A 계약 종료 → 프로토콜 해제
addressManager.unregister("partner-a:hex32");
// 이후 "partner-a:hex32" 사용 시 에러

// 프로토콜 업그레이드: 같은 이름으로 register → 덮어쓰기
addressManager.register(improvedProtocol); // name이 같으면 교체
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| PROTO-DYN-1 | 런타임 등록 | register 후 해당 프로토콜로 serialize/parse 정상 |
| PROTO-DYN-2 | 런타임 해제 | unregister 후 해당 프로토콜 사용 시 에러 |
| PROTO-DYN-3 | unregister 후 나머지 정상 | 해제된 프로토콜 외의 다른 프로토콜은 정상 동작 유지 |
| PROTO-DYN-4 | 동일 이름 register 교체 | 같은 name으로 register하면 기존 프로토콜 덮어쓰기. 목록에 중복 없음 |

### 18-2. Format negotiation (포맷 협상)

외부 시스템(클라이언트, API 파트너)마다 지원 포맷이 다를 때
양쪽이 공통으로 지원하는 최적 포맷을 선택하는 시나리오.

```ts
const clientCaps = ["layout:uuid", "colon"];
const serverPrefs = ["layout:uuid", "layout:int64", "colon"];

const protocol = addressManager.negotiate(clientCaps, serverPrefs);
// → "layout:uuid" (서버 우선순위에서 클라이언트도 지원하는 첫 번째)

// 레거시 클라이언트 (UUID 미지원) → "colon"으로 자동 fallback
addressManager.negotiate(["colon", "compact"], serverPrefs); // → "colon"

// 공통 포맷 없음 → NegotiationError
addressManager.negotiate(["custom:v3"], serverPrefs); // → NegotiationError
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| PROTO-NEG-1 | 공통 포맷 선택 + 레거시 fallback | 서버 우선순위 교집합 최우선 반환. UUID 미지원 시 colon으로 자동 fallback |
| PROTO-NEG-2 | 공통 없음 에러 | 교집합 비어있으면 NegotiationError |

### 18-3. Protocol versioning (프로토콜 버전 전환)

UUID v4 → UUID v7 등 layout format의 필드 배치가 변경될 때,
구버전 읽기 + 신버전 쓰기를 동시에 지원하는 전환 기간(transition period) 관리.

```ts
// 전환 기간 설정: 쓸 때는 v7, 읽을 때는 v4도 허용
addressManager.setWriteProtocol("layout:uuid-v7");
addressManager.addReadProtocol("layout:uuid-v4");

// 새로 생성하는 PK → uuid-v7
const newPK = addressManager.serialize(vv);
// → uuid-v7 형식

// DB에서 읽은 기존 PK → uuid-v4도 파싱 가능
const oldVV = addressManager.parse(oldUuidV4PK);
// → 정상 파싱 (read protocol에 v4가 포함되어 있으므로)

// 전환 완료 후: v4 읽기 지원 제거
addressManager.removeReadProtocol("layout:uuid-v4");
// 이후 v4 PK 파싱 시도 → ParseError
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| PROTO-VER-1 | write/read 프로토콜 분리 | serialize는 write protocol, parse는 read protocol 목록 사용 |
| PROTO-VER-2 | 전환 기간 양방향 | 신규 PK(v7)와 기존 PK(v4) 모두 파싱 가능 |
| PROTO-VER-3 | 전환 완료 후 차단 | read protocol 제거 후 구버전 PK 파싱 → ParseError |
| PROTO-VER-4 | 전환 중 round-trip | v4 parse → v7 serialize → v7 parse → 동일 VV |

### 18-4. Fallback 체인

기본 프로토콜 파싱 실패 시 다음 프로토콜로 시도하는 체인.
메트릭 수집으로 운영 가시성 제공.

```ts
addressManager.setFallbackChain(["layout:uuid", "colon", "uri"]);

// uuid 형식 → 첫 번째에서 성공
addressManager.parse("00010001-...");
// → 즉시 성공, fallback 미발생

// colon 형식 → uuid 실패 → colon 성공
addressManager.parse("perm:v1:42");
// → uuid 실패 → colon 성공

// 어떤 프로토콜도 인식 못함
addressManager.parse("completely-invalid-input");
// → 전체 체인 실패 → ParseError (시도한 프로토콜 목록 포함)

// fallback 메트릭
const stats = addressManager.getFallbackStats();
// → { "layout:uuid": { attempted: 100, succeeded: 85 },
//     "colon":        { attempted: 15, succeeded: 15 } }
```

**우선순위**: fallback 체인과 readProtocols가 동시에 설정된 경우 **fallback이 우선**한다.
fallback 체인은 순서와 메트릭이 포함된 명시적 정책이므로, readProtocols의 단순 필터링보다
우선하는 것이 의도된 동작이다.

| ID | 항목 | 검증 내용 |
|---|---|---|
| PROTO-FB-1 | 첫 프로토콜 성공 | fallback 미발생, 즉시 반환 |
| PROTO-FB-2 | fallback 성공 | 첫 번째 실패 → 두 번째 성공 → 정확한 VV 반환 |
| PROTO-FB-3 | 전체 실패 | 모든 프로토콜 실패 → ParseError (시도 목록 포함) |
| PROTO-FB-4 | fallback 메트릭 | 프로토콜별 시도/성공 횟수 추적 |
| PROTO-FB-5 | fallback vs readProtocols 우선순위 | 둘 다 설정 시 fallback 체인이 우선 |

---

## 19. Schema-only Registry Consumer (직렬화 없는 스키마 소비)

> 목적: serialize/parse 없이 순수 스키마 카탈로그로만 MetaRegistry를 사용하는 시나리오.
> address 코드가 불필요한 소비자 패턴.

### 19-1. CI/CD 스키마 검증 서비스

스키마 정합성만 검증하는 CI worker. serialize/parse가 불필요하고
AddressConfig 없이 동일한 MetaRegistryInput을 사용하고 싶은 경우.

```ts
const input: MetaRegistryInput = loadProductionConfig();
const registry = new MetaRegistry(input);

// 이것만 필요:
registry.getDimDef("role");
registry.getActiveManifest("perm", "v2");
registry.getVersionIds("perm");

// 이것은 안 씀:
// registry.serialize(...)  — CI에서 불필요
// registry.parse(...)      — CI에서 불필요
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| SCHEMA-ONLY-1 | address 없이 스키마 조회 | MetaRegistryInput에서 address 제거 후 생성 → 모든 조회 API 정상 |
| SCHEMA-ONLY-2 | dim/index 정합성 검증 | getDimDef, getIndexDef, getActiveManifest만으로 스키마 무결성 확인 |
| SCHEMA-ONLY-3 | address 포함 input 호환 | address가 포함된 동일 input으로 생성해도 조회 API 동작 변화 없음 |

### 19-2. Edge 배포 경량 registry

Cloudflare Worker 등 edge 환경에서 스키마 조회/codec만 필요할 때.

```ts
// edge function — codec으로 encode/decode만 수행
// serialize/parse는 origin server에서 처리
const registry = new MetaRegistry(schemaInput); // address 미설정
const codec = registry.createCodec("perm", "v1");

const vv = codec.encode({ role: "admin", action: "read" });
const ids = codec.decode(vv);
// 직렬화는 origin으로 전달
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| SCHEMA-ONLY-4 | address 미설정 codec | address 없이 createCodec → encode/decode 정상 동작 |
| SCHEMA-ONLY-5 | address 미설정 text 프로토콜 | address 미설정에서도 colon/uri serialize/parse 가능 |
| SCHEMA-ONLY-6 | 동일 입력 분할 사용 | 동일 schemaInput으로 edge(codec only) + origin(serialize/parse) 동시 운용 |

---

## 시나리오 전체 맵

| 영역 | ID | 항목 | 핵심 검증 |
|---|---|---|---|
| **§17 Loose** | LOOSE-0 | loose vs validated 분기 | address.parse 통과, reg.parse ParseError |
| | LOOSE-1 | 폐기 스키마 UUID 파싱 | registry 없이 VV 추출 |
| | LOOSE-2 | 미등록 schema 숫자 | 명시적 에러 |
| | LOOSE-3 | value 범위 무검증 | registry 없으므로 범위 미검증 |
| | LOOSE-4 | schema-only 파싱 | UUID → schema 이름만 추출 |
| | LOOSE-5 | 라우팅 결정 | schema → 서비스 매핑 |
| | LOOSE-6 | 미등록 schema 라우팅 | ParseError |
| | LOOSE-7 | UUID → colon | 순수 비트 변환 |
| | LOOSE-8 | colon → UUID | 역방향 round-trip |
| | LOOSE-9 | cross-format 변환 | UUID ↔ int64 |
| **§18 Lifecycle** | PROTO-DYN-1 | 런타임 등록 | register → serialize/parse 정상 |
| | PROTO-DYN-2 | 런타임 해제 | unregister → 에러 |
| | PROTO-DYN-3 | unregister 후 나머지 정상 | 다른 프로토콜 정상 동작 |
| | PROTO-DYN-4 | 동일 이름 교체 | register overwrite, 중복 없음 |
| | PROTO-NEG-1 | 포맷 협상 성공 | 서버 우선순위 + 레거시 fallback |
| | PROTO-NEG-2 | 공통 없음 | NegotiationError |
| | PROTO-VER-1 | write/read 분리 | serialize=write, parse=read |
| | PROTO-VER-2 | 전환 기간 양방향 | v4+v7 모두 파싱 |
| | PROTO-VER-3 | 전환 완료 후 차단 | v4 제거 → ParseError |
| | PROTO-VER-4 | 전환 중 round-trip | v4→v7→v7 round-trip |
| | PROTO-FB-1 | 첫 프로토콜 성공 | fallback 미발생 |
| | PROTO-FB-2 | fallback 성공 | 1st 실패 → 2nd 성공 |
| | PROTO-FB-3 | 전체 실패 | ParseError |
| | PROTO-FB-4 | fallback 메트릭 | attempted/succeeded 추적 |
| | PROTO-FB-5 | fallback vs readProtocols | fallback 우선 |
| **§19 Schema-only** | SCHEMA-ONLY-1 | address 없이 조회 | 모든 조회 API 정상 |
| | SCHEMA-ONLY-2 | 정합성 검증 | manifest/dimIds/indexIds |
| | SCHEMA-ONLY-3 | address 포함 호환 | 조회 동작 변화 없음 |
| | SCHEMA-ONLY-4 | address 없는 codec | encode/decode 정상 |
| | SCHEMA-ONLY-5 | address 미설정 text 프로토콜 | colon/uri 사용 가능 |
| | SCHEMA-ONLY-6 | 분할 사용 | edge(codec) + origin(serialize) |
