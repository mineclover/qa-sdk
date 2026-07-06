---
def:
  id: sdk-scenario-multi-service-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [scenario, index-meta, sdk]
  links:
    - target: sdk-scenario-multi-service
      type: refines
    - target: sdk-system
      type: depends_on
sources:
  - packages/index-meta/src/index-sdk.ts
  - packages/index-meta/src/index-sdk.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
---

# SDK 멀티 서비스 시나리오 — 소비자 기대 시나리오

## 목적 ^purpose

`sdk-scenario-multi-service`(FE/BE/분석 서비스가 동일 스키마 공유, VersionedValue + DecodeMap 기반 독립 소비)가 `sdk-system`에 의존할 때 기대하는 계약. SDK 는 MetaRegistryInput 하나로 IndexSDK 를 조합해 주며, 소비 서비스 간 역할이 다르더라도 같은 의미로 해석되어야 한다.

## 시나리오 1: FE encode ↔ BE decode 라운드트립 ^overview

**전제**: `sdk-system`이 `createIndexSDK(input)` 으로 IndexClient 를 반환 (encode/decode/constants/dimCapacity/entries 공개).

**동작**: FE 가 `client.encode(entity)` → HTTP 전송 → BE 가 `client.decode(encoded)` 호출.

**기대**:
- FE/BE 가 같은 MetaRegistryInput 으로 SDK 생성 시 encode/decode 결과 identity
- 버전 mismatch 시 BE 는 decode 실패를 명시적으로 보고 (silent 잘못된 entity 복원 금지)
- constants() 로 빌드된 enum 이 FE/BE 양쪽에서 동일

**실패 시 수정 대상**: `sdk-system.md` §"역할" — MetaRegistryInput 이 SDK 생성의 단일 진입점임을 명문화해야 양쪽이 stable 한 스키마로 조합.

## 시나리오 2: DecodeMap 독립 decode ^overview

**전제**: `index-meta-system`의 `resolver-spec`이 DecodeMap 을 외부 번들로 제공, SDK 가 MetaRegistry 없이 MetaCodec + DecodeMap 만으로 decode 가능해야 한다.

**동작**: 분석 서비스가 경량 DecodeMap 만 import 하여 raw packed int → entity 복원.

**기대**:
- MetaRegistry instantiate 없이 decode 성공
- DecodeMap 버전이 맞지 않으면 explicit error
- 분석 서비스는 encode 기능 없이 decode-only 경로로 동작

**실패 시 수정 대상**: `index-meta-system.md`의 `resolver-spec` + `sdk-system.md` — DecodeMap 만으로 SDK 객체 없이 decode 가능한지 명시. SDK 필수라면 경량 소비 불가.

## 시나리오 3: constants 기반 타입 안전 입력 ^overview

**전제**: `sdk-system`의 `sdk-constants`가 constants() 빌드 + RESERVED_TOKENS 규칙을 제공.

**동작**: TypeScript 클라이언트가 `client.encode({ role: Constants.Role.ADMIN })` 처럼 constants 사용.

**기대**:
- constants 와 문자열 직접 입력("ADMIN") 의 encode 결과 동일
- reserved token entry 는 encode/decode 가능하지만 constants read model 에서는 제외
- custom reservedTokens 는 constants 필터와 fullView reserved 분류를 바꿈

**실패 시 수정 대상**: `sdk-system.md`의 `sdk-constants` — constants / 문자열 동등성이 보장되지 않으면 FE 타입 안전과 BE string 경로가 drift.

## 시나리오 4: 혼재 버전 라우팅 ^overview

**전제**: `sdk-system`이 MetaRegistry + MetaCodec + MetaResolver 를 내부에서 조합하여 `createIndexSDK(input)` 하나로 시작.

**동작**: 같은 SDK 인스턴스에 v1 + v2 주소가 혼재 입력.

**기대**:
- 호출자가 versionId에 맞는 version-pinned client 또는 MetaCodec을 선택해야 함
- 미지원 versionId를 다른 version-pinned client로 decode하면 명시적으로 실패
- capacity 혼재 (v1 smaller, v2 larger) 시 `dimCapacity()` 가 version-aware 응답

**실패 시 수정 대상**: `sdk-system.md`의 `sdk-dim-views` — dimCapacity 가 version-aware 가 아니면 혼재 환경에서 잘못된 capacity headroom 리포트.
