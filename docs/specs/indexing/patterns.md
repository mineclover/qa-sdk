---
def:
  id: coord-patterns
  type: knowledge
  knowledge_kind: pattern
  address: def_document:v2:136320
  scope: flow
  aspect: user_scenario
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, observability, structural]
  links:
    - target: coord-foundation
      type: depends_on
    - target: conventions-system
      type: depends_on
---

# 인덱싱 시스템 사용 패턴

## 목적 ^purpose

시스템을 **어떻게 쓰는가** — 버전 이동, index 합성, 필터링 패턴.
기반 원리는 [`foundation.md`](foundation.md), 프로젝트 관례는 [`../indexing-core-system/conventions-system.md`](../indexing-core-system/conventions-system.md)를 참조한다.

- [`weighted-index/`](weighted-index/README.md)
- [`index-meta/`](index-meta/README.md)

## 구성 ^overview

- **암묵적 버전 이동**: EntityId가 양쪽 스냅샷에 존재하면 decode→re-encode로 자동 좌표 대응
- **명시적 좌표 이동**: DimSnapshotMigration의 indexMap으로 좌표 변환 동선을 직접 기록, BFS로 다중 버전 체인 가능
- **Cross-index 참조**: 한 index의 encode 결과를 다른 index의 차원 값으로 사용하여 계층 형성
- **dim-level vs entry-level**: 축 전체가 특정 index 참조(DimKind.index_ref)이거나 개별 entry가 참조(entryRefs)
- **차원 고정 탐색**: cross-index 참조 + partialQueryBase로 특정 차원을 스코프로 고정하고 나머지를 순회
- **활성/비활성 분리**: entryFlags로 inactive 처리 — encode/decode는 검사하지 않고 소비자가 manifest로 필터
- **설계 흐름**: 닫힌 공간 정수화 → 명명+버전화 → 변화 추적 → 공간 연결 → 차원 고정 → 활성 필터링

---


## 참조

관련 스펙:

## 1. EntityId 기반 식별

DimSnapshot의 각 entry는 고유한 EntityId를 가진다. 내부적으로 `idToIndex: Map<EntityId, number>` bijection이 유지된다.

### 암묵적 버전 이동

EntityId가 양쪽 스냅샷에 모두 존재하면 `decode → re-encode` 패턴으로 자동 대응된다:

```
v1 저장값  →  decode(v1)  →  { role: "editor", action: "read" }
                                    ↓ 동일한 EntityId
                              encode(v2)  →  v2 저장값
```

entries에 같은 EntityId가 있는 한, 위치가 바뀌어도 `idToIndex.get(entityId)`로 새 위치를 자동으로 찾는다.

### 명시적 좌표 이동 (DimSnapshotMigration)

EntityId로 자동 처리가 어려운 경우 — 의미론적 변경(같은 위치에 다른 엔티티), decode/re-encode 없이 좌표를 직접 변환해야 하는 경우 — `DimSnapshotMigration`의 `indexMap`으로 좌표 변환 동선을 기록한다.

```
indexMap: { 2: 3, 3: 2 }   ← "v1의 position 2가 v2에서는 position 3으로 갔다"
```

`traceMigration`이 등록된 migration edge를 BFS로 chain해서 v1 → v5도 한 번에 계산한다.

### 두 방식의 관계

| | EntityId 기반 (암묵적) | indexMap 기반 (명시적) |
|---|---|---|
| 작동 수준 | EntityId (의미) | 좌표 (1-based index) |
| 필요 조건 | 같은 EntityId가 양쪽에 존재 | migration 등록 |
| 적합한 경우 | 구성이 같은 버전 간 이동 | 순서 재배치, 엔티티 교체 |
| 비용 | decode + encode | 좌표 translate |

---

## 2. Cross-index 참조

하나의 index의 encode 결과(1D 정수)를 다른 index의 차원 값으로 사용할 수 있다. 이를 통해 index 간에 계층이 형성된다.

```
doc_meta  = format × lang          encode → 정수 0~3
article   = quality_tier(→ doc_meta) × priority
```

`quality_tier` dim의 entries에 doc_meta 압축값이 들어간다. decode하면 그 숫자가 반환되고, 호출자가 doc_meta를 다시 decode해서 format + lang을 얻는다.

### dim-level vs entry-level 참조

| | dim-level (`DimKind.index_ref`) | entry-level (`entryRefs`) |
|---|---|---|
| 선언 | 축 전체가 특정 index의 압축값 | 특정 위치 entry 하나가 압축값 |
| `versionId` | 수집 안 함 (데이터 적재 시 관리) | 수집함 (엔진 확장에 필요) |
| 대상 | 모두 같은 `indexId` 계열 | entry마다 다른 `indexId + versionId` 가능 |

### 차원 고정과 부분 탐색

cross-index 참조와 `partialQueryBase`를 결합하면, 특정 차원을 고정한 상태에서 나머지 차원을 순회하는 패턴이 가능하다. 고정된 차원 조합이 "스코프" 역할을 하고, 자유 차원이 그 스코프 내의 탐색 공간이 된다.

---

## 3. 활성/비활성 책임 분리

entries에서 항목을 삭제하면 좌표가 깨진다. 대신 `entryFlags`로 inactive 처리한다.

**meta 레이어 (index-meta):**
- `IndexActiveManifest`로 각 dim의 `total`(shape)과 `activeIndices`(현재 사용 가능한 좌표)를 제공한다
- `encode`와 `decode`는 inactive를 검사하지 않는다

**프로그래밍 레이어 (소비자):**
- manifest를 받아 선택지를 필터한다
- inactive 좌표로 encode를 시도할지 말지 결정한다
- 기존에 inactive 좌표로 인코딩된 값을 decode하는 것은 항상 허용된다

이 분리 덕분에 "deprecated지만 이미 저장된 데이터는 깨지지 않는다"가 보장된다.

---

## 설계 흐름 요약

```
닫힌 공간을 정수로 (WeightedIndex)
  → 공간을 의미있게 명명하고 버전화 (index-meta DimSnapshot/IndexVersion)
    → 공간의 변화를 추적 (DimSnapshotMigration + EntityId 기반 암묵적 이동)
      → 공간을 다른 공간의 차원으로 연결 (index_ref)
        → 특정 차원을 고정해 식별자처럼 활용 (partialQueryBase)
          → 활성/비활성으로 선택지 필터링 (IndexActiveManifest)
```
