---
def:
  id: coordinate-states-spec
  address: def_document:v2:206979
  scope: state
  aspect: system_state
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: []
  links:
    - target: coord-foundation
      type: depends_on
    - target: data-design-spec
      type: depends_on
---
# 좌표 상태 모델 — 용어집 및 전이 규칙

## 목적 ^purpose

이 좌표계는 **닫힌 계의 경우의 수를 결정하는 시스템**이다.
특정 정보 축이 다른 정보 축을 추가로 가질 때, 그 축들의 조합으로 발생하는 경우의 수를 유일한 정수(좌표)로 결정한다.
이 특성은 온톨로지 시스템에서 실제 좌표를 결정하는 구조와 닿아있고, 정적 타입 시스템과 잘 맞는다.

기반: [foundation.md](foundation.md) · [version-operations.md](version-operations.md) · [data-design.md](data-design.md)

구현: `index-meta/src/version-lifecycle.ts` · `index-meta/src/invalid-ranges.ts` · `index-meta/src/entry-flag-store.ts` · `index-meta/src/gate-engine.ts`

---

## 핵심 정체성

### 닫힌 계의 경우의 수를 결정하는 시스템

```
데이터 A가 있다
데이터 A를 N차원 축 중 1개로 사용한다
나머지 축들과 조합하면 좌표가 결정된다

role="admin" + env="prod" + svc="payment"
→ 이 조합은 정확히 하나의 정수 (좌표)
→ 이 좌표가 이 조합의 identity
```

이것이 온톨로지와 닿는 지점: **엔티티의 속성들이 개념 공간에서의 위치를 결정하는 것**과 같은 구조. 차원의 교차점이 곧 정체성.

### 서비스 전역 공유 타입 시스템으로서의 역할

이 시스템의 특성 — position 항등성, append-only, 버전 스냅샷, capacity headroom — 은 **정적 타입 시스템과 잘 맞는다.** 프로젝트에 쓰인 타입을 정확하게 기록하는 것은 이 특성이 가능하게 하는 목표 중 하나다.

좌표계는 이 타입을 서비스 전역에서 공유하기 위한 메커니즘이고, prefix는 "내가 쓰는 타입의 버전"을 결정한다.

### 전제: 단일 원천(Single Source of Truth)

타입 자체가 어디에 저장되어 있을지 모르지만, 어딘가에 존재하는 데이터베이스의 **단일 원천을 prefix로 잡는** 시스템이다.

```
데이터베이스 (단일 원천, 어딘가에 존재)
    ↑ prefix가 이것을 잡는다
prefix (단일 원천의 좌표 참조)
    ↓ 좌표계가 공유 어휘를 제공
서비스 전역 (같은 좌표 = 같은 뜻)
```

### 하네스 원칙

1. **관측을 기록한다**: 만드는 것이 아니라 결정된 것을 기록. 스냅샷.
2. **변경은 append/비활성화로만**: 새 타입 추가 = append, 사라짐 = 비활성화. 제거/수정 없음.
3. **정규화를 전제한다**: 같은 뜻이 두 번 저장되지 않는다.
4. **단일 원천**: 각 prefix는 하나의 단일 원천을 참조한다.

---

## CORE / EXTENSION / PERIPHERAL 구분

핵심(CORE)은 **닫힌 계에서 고정된 축 값의 조합 → 유일한 정수** 하나뿐이다.

| 구분 | 기능 | 이유 |
|---|---|---|
| **CORE** | VersionedAxis + entries + capacity | 축 자체. 없으면 좌표 없음. |
| **CORE** | DimRef: axis | 축 → prefix 연결. |
| **CORE** | DimRef: prefix_ref | 좌표 공간 합성. 닫힌 계 유지. |
| **CORE** | encode/decode (mixed-radix) | 좌표 결정 산술. |
| **CORE** | getPrefixShape | shape 없으면 stride 없음. |
| **EXTENSION** | resolveAddress, decomposeAddress | 좌표 해석. 유용하지만 산술 밖. |
| **EXTENSION** | encodePrefixByValue | 편의 래퍼. 핵심은 position 기반 encode. |
| **EXTENSION** | verifyRoundTrip | 검증 도구. |
| **PERIPHERAL** | DimRef: table_ref | 인코딩에서 제외됨. 타입 주석일 뿐. |
| **PERIPHERAL** | TableSchema, ColumnRef | 관계형 메타데이터. 좌표 산술 밖. |
| **PERIPHERAL** | DEMO_KO | 프레젠테이션. |
| **PERIPHERAL** | demo-compat.ts | 레거시 호환 심. |

PERIPHERAL은 유용하지만 좌표 결정의 핵심이 아니다. 코드 책임을 섞지 않도록 CORE와 분리 유지.

---

## 데이터 출처별 축 분류

축의 값(entries)이 어디서 오느냐에 따라 세 가지로 나뉜다. **좌표 시스템 입장에서는 전부 axis**지만, 관리 방식이 다르다.

### 정적 축 (Static Axis)

코드/스키마에 하드코딩. 변경 = 코드 커밋 + 새 버전 seal.

```
env: ["dev", "stage", "prod", "test", "local"]     ← 코드에 고정
action: ["read", "write", "delete", "admin"]        ← 코드에 고정
```

가장 단순. version 변경이 드물다.

### 동적 enum 축 (Dynamic Enum Axis)

DB의 카테고리 테이블에서 관리. **유한하지만 동적으로 변한다.** 이것이 가장 복잡한 케이스.

```
상품 카테고리 (DB category 테이블):
  v1: [전자제품, 의류, 식품, 도서]            ← 4개
  → 런타임: addEntry("가구")                   ← 5개, headroom 내, stride 불변
  → 런타임: deactivate("의류")                 ← 4개 활성, position 1 보존
  → headroom 소진: 새 draft → capacity 확장 → seal → 마이그레이션
```

**별도 개념이 아니라 기존 CORE의 조합으로 표현:**

| 메커니즘 | 역할 |
|---|---|
| axis entries | 현재 시점의 enum 값 목록 |
| capacity headroom | 추가해도 stride 불변 보장 |
| `CrossVersionEntrySync.addEntry()` | 런타임에 entry 추가 (append-only) |
| `EntryFlagStore` active/inactive | position별 비활성화 |
| `DeactivationMode: flexible` | sealed 상태에서도 런타임 즉시 비활성화 허용 |

DB의 카테고리 테이블은 이 axis의 **저장소**일 뿐. 좌표 시스템 관점에서는 axis다.

```
           좌표 시스템                     DB
           ──────────                     ──
axis       ←── sync ───                category 테이블
  entries: [전자제품, 의류, ...]           rows: [{id:1, name:"전자제품"}, ...]
  capacity: 16
  활성 영역: {0, 2, 3, 4}                 active: [전자제품, 식품, 도서, 가구]

DB row 추가 → addEntry() → axis entries append → 좌표 반영
DB row 삭제 → deactivate() → 활성 영역에서 제거 → 좌표 보존
```

### 무한 인스턴스 (Unbounded Instance)

member:42, item:1 같은 동적 인스턴스. 경우의 수가 무한이거나 매우 큼.

**좌표에 인코딩하지 않는다.** 이것이 table_ref의 역할 — 타입만 선언하고 인스턴스는 런타임에 참조.

### 분류 요약

| 분류 | 경우의 수 | 관리 위치 | 좌표 인코딩 | 메커니즘 |
|---|---|---|---|---|
| **정적 축** | 고정 | 코드 | ✓ | axis (sealed 후 불변) |
| **동적 enum 축** | 유한, 변동 | DB 카테고리 테이블 | ✓ | axis + flexible + headroom |
| **무한 인스턴스** | 무한 | DB 엔티티 테이블 | ✗ | table_ref (타입 주석) |

핵심 판단 기준: **경우의 수가 유한하고 좌표에 인코딩해야 하면 axis. 무한이면 table_ref.**

동적 enum은 axis의 운영 모드일 뿐 별도 개념이 아니다.

---

## 핵심 모델: 활성 영역 선언

1D 축의 한 버전은 **entries 배열 + 활성 영역**이다. 활성 영역은 "현재 이 variant를 쓴다/안 쓴다"를 선언하는 bitmask다.

```
v1: { 0: admin, 1: dev, 2: op,  3: viewer, 4: ro,  5: _        }
v2: { 0: admin, 1: dev, 2: _,   3: viewer, 4: ro,  5: customer }
```

`_` = 공간은 존재하지만 비활성. 제거된 것이 아니라 **현재 안 쓴다고 선언된 것**.

이것이 좌표 상태의 전부다. 각 position은:

| 상태 | 표기 | 의미 |
|---|---|---|
| **활성** | `"admin"` | 이 position은 현재 버전에서 쓰고 있음 |
| **비활성** | `_` | 이 position은 현재 버전에서 안 씀. 공간은 남아있음. |

entry가 한번 할당된 position은 영구히 그 entry와 연결된다 (append-only). `_`로 비활성화해도 entry 자체는 보존된다. position 2는 어느 버전에서든 "op"이다 — 다만 v2에서는 안 쓸 뿐.

---

## 버전: 현재 상황의 스냅샷

### VersionStatus

| Status | 의미 |
|---|---|
| **draft** | 설계 중. 활성 영역과 entries를 자유롭게 변경 가능. 저장값 없음. |
| **sealed** | 확정. 활성 영역과 capacity가 고정된 불변 스냅샷. 영구 존재. |

```
draft ────→ sealed
(가변)       (불변, 영구)
```

sealed는 종단 상태. 변경이 필요하면 새 draft를 만든다.

### 버전 시퀀스 (변경기록)

sealed 버전들은 append-only 변경기록을 형성한다. 항상 앞으로만 전진.

```
versions: [v1, v2, v3]
                    ↑ latest. 값은 여기에 적재.
```

| 개념 | 의미 |
|---|---|
| **latest** | 시퀀스 마지막. 현재 좌표계. 새 인코딩 대상. 상태가 아니라 **위치**. |
| **previous** | latest가 아닌 sealed 버전. decode를 위해 영구 존재. 마이그레이션 대상. |
| **diff** | 두 버전 간 차이. 코드 commit diff에서 도출 가능. position 항등성 보장. |

version ≈ commit. 스키마가 코드에 있으므로 좌표계 버전 = 스키마 변경 커밋. VCS에서 추출 가능.

### 세 가지 안정화 메커니즘

| 메커니즘 | 목적 |
|---|---|
| **capacity** | 좌표계 유지. headroom이 남아있는 한 버전 변경 없이 entries 추가. stride 불변. |
| **version** | 변경 기록. 내용이 달라져도 position은 동일 의미 유지. 차이는 version diff에서만 발생. |
| **position** | variant 항등성. position N은 어느 버전에서든 같은 용도. |

### sealed에서 허용되는 변경

sealed 후에도 활성 영역은 변경될 수 있다 (mode에 따라):

| Mode | sealed에서 활성→비활성 | sealed에서 비활성→활성 | 용도 |
|---|---|---|---|
| **strict** | ✗ (새 draft 필요) | ✗ (새 draft 필요) | 권한 스키마 |
| **flexible** | ✓ (런타임 즉시) | ✓ (런타임 즉시) | 피처 플래그, **동적 enum** |

entries 추가 (headroom append)는 mode 무관 항상 허용.

---

## Version Diff

두 버전의 활성 영역을 비교하여 변경사항을 도출한다.

### 축 diff

```
v1: { 0: admin, 1: dev, 2: op,  3: viewer, 4: ro,  5: _        }  cap=6
v2: { 0: admin, 1: dev, 2: _,   3: viewer, 4: ro,  5: customer }  cap=6

diff(v1, v2):
  stable:      {0, 1, 3, 4}         admin, dev, viewer, ro
  빠짐:        {2}                   op (활성 → 비활성)
  들어옴:      {5}                   customer (비활성 → 활성)
  capacity:    6 → 6                 변동 없음
```

### Position 변경 유형

| 유형 | v1 → v2 | 의미 |
|---|---|---|
| **stable** | 활성 → 활성 | 변경 없음 |
| **added** | 비활성(`_`) → 활성 | 새로 쓰기 시작 |
| **removed** | 활성 → 비활성(`_`) | 더 이상 안 씀 |
| **expanded** | (없음) → 비활성(`_`) | capacity 확장으로 새 빈 자리 생성 |

### Prefix 영향

| 영향 유형 | 조건 | 마이그레이션 |
|---|---|---|
| **no-impact** | shape 불변, 활성 영역 변동 없음 | 불필요 |
| **state-only** | shape 불변, 활성 영역만 변동 | 비활성 주소 필터링 갱신 |
| **stride-break** | capacity 변경 → shape 변경 | 모든 주소 re-encode |

### DX 워크플로우

```
1. 코드에서 스키마 변경 (entry 추가, capacity 조정, position 비활성화)
2. diff(v_prev, v_next) 실행
   → position 변경 목록 (stable / added / removed / expanded)
   → stride 영향 판정 (no-impact / state-only / stride-break)
3. 개발자 확인
4. seal → 새 버전 확정
5. migration 적용
```

---

## 합성 규칙: composite 주소

composite 주소의 활성 여부 = **각 차원의 활성 여부의 AND**.

```
composite.active = dim₁.active AND dim₂.active AND … AND dimₙ.active
```

하나의 차원이라도 비활성(`_`)이면 composite 주소 전체가 비활성.

### prefix_ref 차원

prefix_ref 차원의 활성 여부는 참조된 prefix의 해당 주소의 활성 여부를 승계.

### 구현 AddressState와의 대응

구현의 4-state는 활성 영역 모델에서 파생되는 **런타임 최적화**:

| 활성 영역 관점 | entry 유무 | 구현 AddressState | encode | decode |
|---|---|---|---|---|
| 활성 | 있음 | `active` | ✓ | ✓ |
| 비활성 | 있음 | `inactive` | ✗ | ✓ |
| 비활성 | 없음 | `open` | ✓ | ✗ |
| 비활성+비활성 (합성) | — | `reserved` | ✗ | ✗ |

개발자가 직접 다루는 개념이 아니다.

---

## 파일별 책임 경계

| 파일 | 책임 | 하지 않는 것 |
|---|---|---|
| `demo-catalog.ts` | CORE 타입 정의 (axes, prefixes, DimRef) + PERIPHERAL (TableSchema, table_ref) | 런타임 데이터, 인스턴스 |
| `demo-accessors.ts` | CORE encode/decode + EXTENSION resolve/decompose | table_ref 인스턴스 처리 |
| `demo-compat.ts` | PERIPHERAL 레거시 호환 | 신규 개념 |
| `demo-bridge.ts` | PERIPHERAL 외부 시스템 어댑터 | 좌표 산술 |
| `event-schema.test.ts` | PERIPHERAL 이벤트 패턴 증명 | 인스턴스/관계 |

---

## 용어 정리

### 정규 용어

| 용어 | 정의 |
|---|---|
| **활성** | position이 현재 버전의 활성 영역에 포함됨 |
| **비활성 (`_`)** | position이 현재 버전의 활성 영역에서 제외됨 |
| **draft** | 가변 좌표 체계. 확정 전. |
| **sealed** | 불변 좌표 체계. 확정 후 영구 존재. |
| **latest** | sealed 시퀀스의 마지막. 현재 좌표계. |
| **previous** | latest가 아닌 sealed 버전. |
| **capacity** | 축의 최대 position 수. headroom 포함. |
| **headroom** | capacity - (할당된 entry 수). 비활성 빈 자리. |
| **stride** | shape에서 결정되는 mixed-radix 가중치. sealed 후 불변. |
| **diff** | 두 버전의 활성 영역 차이. |
| **stride-break** | capacity 변경으로 stride가 바뀌는 것. 전체 주소 re-encode 필요. |
| **position 항등성** | position N은 어느 버전에서든 같은 용도. |
| **정적 축** | 코드에 고정된 axis. 변경 = 새 버전. |
| **동적 enum 축** | DB 카테고리 테이블에서 관리되는 axis. axis + flexible + headroom. |
| **table_ref** | 무한 인스턴스 테이블의 타입 주석. 좌표에 인코딩되지 않음. PERIPHERAL. |

### 구현 용어 대응

| 구현 타입/값 | 정규 용어 |
|---|---|
| `VersionStatus: "draft"` | **draft** |
| `VersionStatus: "released" / "active" / "deprecated"` | 모두 **sealed** (차이는 운영 메타데이터) |
| `AddressState: "active"` | **활성** (활성 영역 안 + entry 있음) |
| `AddressState: "inactive"` | **비활성** (활성 영역 밖 + entry 있음) |
| `AddressState: "open"` | **비활성** (활성 영역 밖 + entry 없음, headroom) |
| `AddressState: "reserved"` | **비활성** (합성 emergent) |
| `DeactivationMode: "strict"` | sealed에서 활성 영역 변경 불가 |
| `DeactivationMode: "flexible"` | sealed에서 활성 영역 런타임 변경 가능. **동적 enum 축의 운영 모드.** |
| `CrossVersionEntrySync.addEntry()` | 동적 enum 축의 런타임 entry 추가 |
| `EntryFlagStore` | position별 활성/비활성 관리 |

### 삭제된 용어

| 삭제 용어 | 이유 |
|---|---|
| `deprecated` (VersionStatus) | sealed은 영구. 전진만 한다. |
| `active` (VersionStatus) | latest 위치로 대체. |
| `rollback` | 역방향 전이 금지. |
| `routing` / `active pointer` | 좌표계에 선택 없음. |

---

## 불변식

1. **append-only**: sealed에서 활성 position의 entry를 제거할 수 없다. 비활성화는 가능.
2. **capacity 단조증가**: sealed 후 capacity 축소 불가.
3. **entry 보존**: 한번 할당된 entry 문자열은 변경/삭제 불가.
4. **position 항등성**: position N은 어느 버전에서든 같은 용도.
5. **stride 결정론**: sealed 후 shape → stride 고정. 영구.
6. **합성 AND**: composite 활성 = 각 차원 활성의 AND.
7. **prefix_ref 승계**: prefix_ref 차원의 활성 여부는 참조된 주소의 활성 여부를 승계.
8. **버전 단조 전진**: 버전 시퀀스는 append-only. 역방향 금지.
9. **sealed 영구**: sealed된 좌표 체계는 소멸하지 않는다. decode 영구 가능.
10. **닫힌 계**: 좌표에 인코딩되는 것은 경우의 수가 유한한 축만. 무한 인스턴스는 좌표 밖.

---

## 미완성 계층 (이 문서 범위 밖)

| 계층 | 상태 | 내용 |
|---|---|---|
| ✅ **타입** | 완료 | 축, prefix, encode/decode, 활성 영역 |
| ○ **인스턴스** | 미구현 | EventInstance: 발생한 이벤트 기록 |
| ○ **관계** | 미구현 | Edge: 이벤트 간 연결 |
| ○ **상태** | 미구현 | State: 이벤트 전/후 세계 상태 |
| ○ **제약** | 미구현 | Policy: 허용/금지 규칙 |
| ○ **수집** | 미구현 | QA System: 런타임 관측 |
