---
def:
  id: index-meta-system
  tier: system
  address: def_document:v2:68633
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [structural, entry-point]
  links:
    - target: resolver-spec
      type: contains
    - target: index-codec-spec
      type: contains
    - target: address-spec
      type: contains
    - target: invariants-spec
      type: contains
    - target: index-meta-workers
      type: contains
    - target: user-scenarios
      type: contains
    - target: canonical-format-spec
      type: contains
    - target: benchmark-system
      type: depends_on
    - target: registry-system
      type: depends_on
    - target: wi-system
      type: depends_on
    - target: address-index
      type: contains
---

## 목적 ^purpose

MetaRegistry, PrefixDecoder, 주소 직렬화 등 좌표 시스템의 런타임 메타데이터 관리 레이어.

## 구성 ^overview

- `table-schema-spec`: 테이블 단위 스키마 선언 레이어.
- `resolver-spec`: MetaRegistry의 데이터를 외부 소비용 번들(DecodeMap, DimRange, IndexRange, MetaDataset)로 변환한다.
- `index-codec-spec`: DecodeMap 기반 독립 encode/decode 모듈.
- `index-meta-store-group`: 저장 계약과 주소 해석 흐름을 분리한 index-meta 저장소 그룹.
- `address-spec`: MetaRegistry의 VersionedValue를 UUID 등 고정 포맷 PK로 직렬화하는 설정과 동작 규칙.
- `address-separation-group`: address/registry 분리 결정을 근거와 도입 시점으로 나눈 ADR 그룹.
- `sdk-scenarios`: IndexSDK 기반 클라이언트·서버 운영 시나리오.
- `sdk-system`: MetaRegistryInput 하나로 즉시 사용 가능한 경량 SDK 소비 레이어 그룹.
- `invariants-spec`: 산재된 불변조건을 단일 스펙으로 통합하여 시스템의 정합성 보증을 명문화한다.
- `address-scenarios-group`: 주소 파싱, 프로토콜 lifecycle, schema-only 소비 시나리오 그룹.
- `user-scenarios`: MetaCodec + MetaResolver + MetaRegistry + PrefixRegistry + IndexMetaStore 통합 시나리오.
- `canonical-format-spec`: 4-표현 체계(A=tuple key, B=packed int, C=hierarchical id, D=hash/uuid)에서 C 표현(hierarchical id)의 정규 형식을 지정한다.
- `dx-lifecycle-group`: CLI, codegen, wire format, 타입 추론을 동선과 계약으로 나눈 DX 그룹.
- `benchmark-system`: encode/decode 성능, 차원 확장 한계, cross-index 종단 탐사, 정보 디코딩 파이프라인, 리소스 사용량의 실측 데이터.

## 관련 소스

| 모듈 | 파일 | 역할 |
|------|------|------|
| MetaRegistry | `packages/index-meta/src/meta-registry.ts` | 메타데이터 등록·조회 허브 |
| MetaCodec | `packages/index-meta/src/meta-codec.ts` | DecodeMap 기반 encode/decode |
| MetaCodecBig | `packages/index-meta/src/meta-codec-big.ts` | BigInt 경로 codec |
| MetaResolver | `packages/index-meta/src/meta-resolver.ts` | DecodeMap/DimRange/IndexRange 변환 |
| PrefixDecoder | `packages/index-meta/src/prefix-decoder.ts` | prefix 디코딩 + 의미 해석 |
| PrefixRegistry | `packages/index-meta/src/prefix-registry.ts` | prefix 메타 관리 |
| IndexSDK | `packages/index-meta/src/index-sdk.ts` | 경량 소비 SDK |
| GateEngine | `packages/index-meta/src/gate-engine.ts` | 4-state 게이트 모델 |
| AddressProtocolManager | `packages/index-meta/src/address-protocol-manager.ts` | 주소 직렬화 프로토콜 |
| CrossIndexQuery | `packages/index-meta/src/cross-index-query.ts` | 크로스 인덱스 탐색 |
| MigrateAddress | `packages/index-meta/src/migrate-address.ts` | 버전 간 주소 마이그레이션 |
| RelationalEngine | `packages/index-meta/src/relational-engine.ts` | 관계형 주소 질의 |
| PolicyResolver | `packages/index-meta/src/policy-resolver.ts` | 정책 규칙 해석 |
| IndexMetaStore | `packages/index-meta/src/index-meta-store.ts` | 저장 계약 |
| VersionLifecycle | `packages/index-meta/src/version-lifecycle.ts` | 버전 상태 전이 |
