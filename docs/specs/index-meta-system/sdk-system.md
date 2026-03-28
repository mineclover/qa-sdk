---
def:
  id: sdk-system
  level: module
  address: def_document:v1:3224
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: mediation
  svc: index-meta
  tags: [structural, tier-infra]
  links:
    - target: sdk-api-surface
      type: contains
    - target: sdk-constants
      type: contains
    - target: sdk-dim-views
      type: contains
---

# sdk-system

## 목적 ^purpose

index-meta SDK의 퍼블릭 API. MetaCodec 통합, reserved tokens, constants 빌드, 용량/주소 뷰.

index-meta SDK의 퍼블릭 API. MetaCodec 통합, reserved tokens, constants 빌드, 용량/주소 뷰.

## 구성 문서

| 문서 | id | 설명 |
|------|-----|------|
| [sdk-api-surface.spec.md](sdk-api-surface.spec.md) | sdk-api-surface | MetaCodec 통합 인터페이스 |
| [sdk-constants.spec.md](sdk-constants.spec.md) | sdk-constants | constants() 빌드 로직과 RESERVED_TOKENS |
| [sdk-dim-views.spec.md](sdk-dim-views.spec.md) | sdk-dim-views | DimCapacityInfo와 DimFullView |

## 구성 ^overview

- `sdk-api-surface`: index-meta SDK의 퍼블릭 API.
- `sdk-constants`: constants() 빌드 로직과 RESERVED_TOKENS.
- `sdk-dim-views`: DimCapacityInfo(용량 정보)와 DimFullView(전체 주소 공간 뷰).

MetaRegistryInput 하나로 즉시 사용 가능한 경량 소비 레이어.
개발자는 entity name만 입력하면, 내부에서 VersionedValue로 압축/해석한다.

### 역할

```
MetaRegistry (게이트웨이)       MetaCodec (정보 해석)      IndexSDK (소비 레이어)
├── serialize/parse            ├── encode/decode          ├── client() -> IndexClient
├── createCodec()              └── decodeValue            |   ├── encode/decode
└── validate                                              |   ├── constants()
                                                          |   ├── dimCapacity()
                                                          |   └── entries()
                                                          └── constants() (dim-level)
```

IndexSDK는 MetaRegistry + MetaCodec + MetaResolver를 내부에서 조합한다.
개발자는 이 세 클래스를 직접 조합할 필요 없이, `createIndexSDK(input)` 하나로 시작한다.

### 설계 원칙

1. **버전 고정**: `client(indexId, versionId)`로 index + version을 한 번 바인딩하면, 이후 모든 호출에서 반복하지 않는다.
2. **예약 토큰 필터링**: `constants()`는 정규 값만 반환. 슬롯 마커와 inactive 항목은 자동 제외.
3. **캐싱**: 동일 `indexId + versionId` client 재생성 비용 없음. `Object.freeze()` 불변성 보장.
4. **환경 무관**: `index-meta/client` 진입점으로 브라우저, Edge 런타임, 프론트엔드에서 안전하게 사용 가능.

## 원본

분할 전 원본: `docs/specs/indexing/index-meta/sdk.spec.md` (index-meta-sdk-spec)
