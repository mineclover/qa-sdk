---
def:
  id: index-meta-store-group-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [scenario, index-meta, store]
  links:
    - target: index-meta-store-group
      type: refines
    - target: index-meta-system
      type: depends_on
---

# Index Meta Store 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`index-meta-store-group`(store-contract + store-resolution)이 `index-meta-system`에 의존할 때 기대하는 계약. store 그룹은 index-meta-system 이 제공하는 MetaRegistry, MetaCodec, PrefixRouter, AddressProtocolManager 위에서만 persistence 와 주소 해석을 분리하여 제공한다.

## 시나리오 1: IndexMetaStore 저장/조회 결정성 ^overview

**전제**: `index-meta-system`의 MetaRegistry 가 VersionedValue 기반 entity 등록을 제공.

**동작**: IndexMetaStore 에 entity 저장 후 같은 key 로 조회.

**기대**:
- 저장 직후 조회 → 같은 VersionedValue
- driver 종류(SqlDriver/D1) 무관 결정론적
- 저장 실패 → rollback, partial write 금지

**실패 시 수정 대상**: `index-meta-system.md` §"관련 소스" — IndexMetaStore port 계약이 index-meta-system 에 고정되지 않으면 driver 간 drift.

## 시나리오 2: PrefixRouter 버전 라우팅 ^overview

**전제**: `index-meta-system`의 PrefixRouter 가 cross-version 주소 해석을 담당.

**동작**: store 가 혼재 버전 환경에서 주소 resolve 호출 (v1 + v2 주소 섞임).

**기대**:
- prefix 의 versionId 로 정확한 codec 선택
- 미존재 versionId → reserved 처리 (CON-006)
- 같은 주소 반복 resolve → 같은 결과 (캐시 일관성)

**실패 시 수정 대상**: `index-meta-system.md`의 PrefixRouter 명세 — versionId 미존재 fallback 이 정의되지 않으면 store 가 임의 version 으로 fallback 하여 decode 오류.

## 시나리오 3: MigrationStore + CrossVersionEntrySync ^overview

**전제**: `index-meta-system`의 `MigrateAddress` 가 버전 간 주소 마이그레이션 경로를 제공.

**동작**: store 의 CrossVersionEntrySync 가 v1 entity 를 v2 로 일괄 변환.

**기대**:
- 변환 전/후 addressable identity 보존 (항등 UID 유지)
- 변환 중 실패 → 해당 entry 는 v1 유지 + error 기록 (partial success)
- 변환 완료 entry 는 v1 codec 으로도 decode 가능 (하위 호환)

**실패 시 수정 대상**: `index-meta-system.md`의 `MigrateAddress` — 마이그레이션 시 UID 유지 정책이 빠지면 cross-version 이벤트 추적이 끊어짐.

## 시나리오 4: decode 없는 재사용 전략 ^overview

**전제**: `index-meta-system`의 `resolver-spec` 이 DecodeMap/DimRange/IndexRange/MetaDataset 변환을 제공.

**동작**: 외부 서비스가 decode 없이 MetaDataset 번들만 소비하여 주소 해석.

**기대**:
- DecodeMap 만으로 decode 가능 (MetaRegistry 재생성 불필요)
- DimRange 변경 시 MetaDataset 만 재배포하면 소비자는 transparent 업그레이드
- IndexRange 는 범위 질의 (`from`/`to` 주소) 지원, 결과는 lazy iterable

**실패 시 수정 대상**: `index-meta-system.md`의 `resolver-spec` — MetaDataset 포맷이 고정되지 않으면 소비자가 매번 MetaRegistry hydration 을 수행 (decode 없는 재사용 목표 위배).
