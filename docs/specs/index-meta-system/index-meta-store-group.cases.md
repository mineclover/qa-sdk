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
sources:
  - docs/specs/index-meta-system/index-meta-store-group/index-meta-store-contract.spec.md
  - docs/specs/index-meta-system/index-meta-store-group/index-meta-store-resolution.spec.md
  - packages/index-meta/src/adapters/memory-store.test.ts
  - packages/index-meta-store/src/adapters/sql-store.test.ts
  - packages/index-meta-store/src/adapters/d1-store.ts
  - packages/index-meta-store/src/adapters/d1-driver.ts
  - packages/index-meta/src/cross-version-entry-sync.test.ts
  - packages/index-meta/src/address-resolver.test.ts
---

# Index Meta Store 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`index-meta-store-group`(store-contract + store-resolution)이 `index-meta-system`에 의존할 때 기대하는 계약. store 그룹은 index-meta-system 이 제공하는 MetaRegistry, MetaCodec, PrefixRouter, AddressProtocolManager 위에서만 persistence 와 주소 해석을 분리하여 제공한다.

## 시나리오 1: IndexMetaStore 저장/조회 결정성 ^overview

**전제**: `index-meta-system`의 `IndexMetaStore` port가 schema_version과 entry 저장 계약을 제공.

**동작**: schema_version 등록 후 entry를 저장하고 같은 prefix/version/position 또는 value로 조회.

**기대**:
- 저장 직후 조회 → 같은 EntryRecord 의미(prefix/version/position/value)
- capacity fast-path, range query, sparse position ordering이 memory/sql store에서 동일
- transaction-capable SqlDriver의 migration은 rollback 가능
- D1 경로는 개별 statement 원자성만 갖고 multi-entry rollback을 source-backed 보장으로 주장하지 않음

**실패 시 수정 대상**: `index-meta-store-contract` — IndexMetaStore port 계약 또는 driver별 transaction caveat가 drift.

## 시나리오 2: PrefixRouter database 라우팅 ^overview

**전제**: `index-meta-system`의 PrefixRouter가 prefix별 D1 database placement를 담당하고, PrefixRegistry/address protocol은 version/address 해석을 담당.

**동작**: prefix를 database id에 route하고, 재라우팅과 database별 prefix 목록을 조회.

**기대**:
- 미등록 prefix는 null
- 동일 prefix 재라우팅은 최신 database id로 덮어씀
- 같은 database를 공유하는 prefix 목록은 분리되어 조회됨
- versionId fallback 또는 codec 선택은 PrefixRouter가 수행하지 않음

**실패 시 수정 대상**: `index-meta-store-resolution`의 PrefixRouter 절 — routing 책임과 address resolution 책임이 다시 섞임.

## 시나리오 3: MigrationStore + CrossVersionEntrySync ^overview

**전제**: `MigrationStore`는 modified/deactivated 이력을 저장하고, `CrossVersionEntrySync`는 새 entry를 writable versions에 같은 position으로 전파한다.

**동작**: active version에 새 value를 추가하고 draft/released/active 버전에 동일 position으로 동기 전파.

**기대**:
- active version이 position SSOT
- capacity 부족/duplicate/occupied non-active version은 skipped로 보고
- active 삽입은 필수이며, added + skipped = writable versions
- 기존 version 간 EntityId 변경/비활성화 이력은 MigrationStore의 별도 책임

**실패 시 수정 대상**: `index-meta-store-resolution`의 CrossVersionEntrySync 절 — sync와 migration history 책임이 섞임.

## 시나리오 4: decode 없는 재사용 전략 ^overview

**전제**: PrefixRegistry가 shape/address resolution을 제공하고 weighted-index range 계산이 주소 범위 재사용을 제공한다.

**동작**: leaf 값을 모두 decode하지 않고, 이미 계산된 dim/address range를 composite query에 재사용.

**기대**:
- leaf 주소의 shape/refs/valid 정보를 복원
- role/env 같은 dim 고정 조건을 연속 또는 파편 range로 산술 계산
- article composite query에서 perm range를 재사용해 range scan 가능
- MetaDataset 배포/lazy iterable API는 현재 store group의 source-backed 범위가 아님

**실패 시 수정 대상**: `index-meta-store-resolution`의 주소 해석/재사용 절 — registry shape와 arithmetic range proof가 어긋남.
