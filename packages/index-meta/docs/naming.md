# index-meta — 네이밍 체계

## 패키지 정체성

**index-meta**: 구조화된 다차원 식별자 레지스트리.
`weighted-index`(좌표 ↔ 정수 수학) 위에 스키마 선언, 버전 관리, 캐싱, 저장소를 구성한다.

---

## 네이밍 패밀리

### 기존 축

| 패밀리 | 접두사 | 핵심 역할 | 대표 모듈 |
|--------|--------|----------|----------|
| **Meta** | `Meta*` | 스키마 정의 + encode/decode 코어 | `MetaRegistry`, `MetaCodec`, `MetaResolver` |
| **Address** | `Address*` | 주소 공간 상태 관리 + 캐시 | `AddressStateStore`, `AddressRangeCache`, `AddressProtocolManager` |
| **Prefix** | `Prefix*` | 주소 공간 DAG 라우팅 | `PrefixRegistry`, `PrefixRouter` |
| **Index** | `Index*` | 인덱스 레벨 정의 + 저장 | `IndexDef`, `IndexMetaStore`, `IndexSDK` |
| **Dim** | `Dim*` | 차원(축) 레벨 정의 | `DimDef`, `DimSnapshot`, `DimRange` |
| **Table** | `Table*` | 선언적 스키마 DSL | `TableDef`, `TableVersion` |
| **Entry** | `Entry*` | 엔트리 데이터 관리 | `EntryRecord`, `EntryFlagStore`, `EntryCache` |

### 신규 축

| 이름 | 레벨 | 역할 | 설명 |
|------|------|------|------|
| **EntryLifecycle** | 프로세스 | 데이터 흐름 | entry가 버전을 거치며 진화하는 전체 라이프사이클. draft→released→active→deprecated 전이, 마이그레이션 체이닝, 비활성화 모드(strict/flexible) 분기를 포괄 |
| **PositionEngine** | 시스템 | 축 엔진 | EntryLifecycle을 지탱하는 인프라. Position 안정 축 위에 버전 관리, 마이그레이션 이력, 캐시 계층, 메타데이터를 제공하는 구성요소 묶음 |

---

## EntryLifecycle — 데이터 흐름

entry 하나가 생성부터 비활성화까지 거치는 전체 과정.

```
                    ┌─────────────────────────────┐
                    │       EntryLifecycle         │
                    │                              │
  entry 추가 ──────►│  draft ── 계획/수정/비활성화  │
                    │    │                         │
                    │    ▼                         │
                    │  released ── 확정, append-only│
                    │    │                         │
                    │    ▼                         │
                    │  active ── 권장 버전          │
                    │    │                         │
                    │    ▼                         │
                    │  deprecated ── 읽기 전용      │
                    └─────────────────────────────┘
```

### 비활성화 모드

| 모드 | 흐름 | 이력 |
|------|------|------|
| **strict** | draft에서만 비활성화 → release 시 확정 | MigrationStore (불변) |
| **flexible** | 런타임 즉시 토글 | EntryFlagStore (가변) |

### 범위

- 버전 상태 전이 (draft → released → active → deprecated)
- 마이그레이션 체이닝 (EntityId 변경/비활성화 이력)
- Cross-version entry sync (prefix 단위 추가 → 멀티 버전 전파)
- 비활성화 모드 분기 (strict vs flexible)

---

## PositionEngine — 구성요소 시스템

EntryLifecycle을 구동하는 인프라 레이어.
**Position**이라는 단일 안정 축 위에 모든 구성요소가 올라간다.

```
Position (불변 축) ─────────────────────────────────
    │
    ├── VersionLifecycleStore  버전 상태 머신
    │     createDraft / release / activate / deprecate
    │
    ├── MigrationStore         버전 간 변경 이력
    │     saveMappings / getHistory / resolveToLatest
    │
    ├── EntryMetadataStore     position 기반 관계형 메타데이터
    │     set / get / getAll / findByKey
    │
    ├── EntryCache (L1)        prefix+version 양방향 캐시
    │     CoalescingCache 기반, 영구 캐싱
    │
    └── MigrationCache (L2)    불변 마이그레이션 캐시
          CoalescingCache 기반, 영구 캐싱
```

### 핵심 불변식

1. **Position ↔ EntityId 강결합**: 한번 결정되면 해당 버전 내에서 불변
2. **Position 순서 불변**: 모든 버전에서 position N은 항상 N
3. **금지**: position 순서 변경, position 완전 삭제
4. **허용**: EntityId 수정, 비활성화 (soft delete), capacity 확장

### 캐시 계층

| 레이어 | 이름 | 키 | 갱신 정책 |
|--------|------|-----|----------|
| L1 | EntryCache | prefix + versionId | 불변 (영구 유효) |
| L2 | MigrationCache | prefix + fromVersion + toVersion | 불변 (영구 유효) |
| L3 | AddressRangeCache (기존) | prefix + versionId + label | release 시 계산 |
| L4 | IndexMetaStore (기존) | — | DB backing store |

---

## 기존 축과의 관계

```
┌─────────────────────────────────────────────────┐
│  Meta* — 스키마 + encode/decode                  │
│  MetaRegistry, MetaCodec, MetaResolver           │
├─────────────────────────────────────────────────┤
│  PositionEngine — entry 관리 인프라               │  ◄── 신규
│  VersionLifecycleStore, MigrationStore,           │
│  EntryCache, MigrationCache, EntryMetadataStore   │
├─────────────────────────────────────────────────┤
│  Address* — 주소 공간 상태 관리                    │
│  AddressStateStore, AddressRangeCache             │
├─────────────────────────────────────────────────┤
│  Prefix* — DAG 라우팅                             │
│  PrefixRegistry, PrefixRouter                     │
├─────────────────────────────────────────────────┤
│  Index* / Entry* — 저장소                         │
│  IndexMetaStore, EntryFlagStore                   │
└─────────────────────────────────────────────────┘

EntryLifecycle = Meta* ←→ PositionEngine ←→ Address* 를 관통하는 데이터 흐름
```

---

## 네이밍 규칙 요약

| 레벨 | 패턴 | 예시 |
|------|------|------|
| 프로세스/흐름 | `*Lifecycle` | EntryLifecycle |
| 구성요소 시스템 | `*Engine` | PositionEngine |
| 스키마/코어 | `Meta*` | MetaRegistry, MetaCodec |
| 주소 관리 | `Address*` | AddressStateStore |
| DAG 라우팅 | `Prefix*` | PrefixRegistry |
| 인덱스 정의 | `Index*` | IndexDef, IndexMetaStore |
| 차원 정의 | `Dim*` | DimDef, DimSnapshot |
| 선언 DSL | `Table*` | TableDef |
| 데이터 레코드 | `Entry*` | EntryRecord, EntryCache |
| 버전 상태 | `Version*` | VersionRecord, VersionLifecycleStore |
| 마이그레이션 | `Migration*` | MigrationStore, MigrationCache |
| 저장소 어댑터 | `InMemory*` / `Sql*` | InMemoryVersionLifecycleStore |
| 에러 | `*Error` (extends IndexMetaError) | EntryNotFoundError |
