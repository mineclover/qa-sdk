---
def:
  tier: component
  id: coord-version-series
  address: def_document:v2:414855
  scope: flow
  aspect: process_flow
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [runtime, versioning, structural]
  links:
    - target: coord-foundation
      type: refines
sources:
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/index-meta/src/invalid-ranges.ts
  - packages/index-meta/src/invalid-ranges.test.ts
  - packages/index-meta/src/gate-engine.ts
  - packages/index-meta/src/gate-engine.test.ts
  - packages/index-meta/src/version-lifecycle.ts
  - packages/index-meta-store/src/version-lifecycle.test.ts
  - packages/index-meta/src/migrate-address.ts
  - packages/index-meta/src/migrate-address.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts

---

# 버전화된 닫힌 공간의 계열

## 목적 ^purpose

"닫힌 공간"이 단일 버전 수준에서 성립하는 원리, 버전을 통한 마이그레이션 메커니즘, draft 워크플로우, cascade 전파, entries append-only 원칙을 정의한다.

## 버전이 닫힌 공간을 식별한다

"닫힌 공간"이라는 제약은 **단일 버전 수준에서만 성립하면 충분하다.**

```
perm:iv1:13  →  iv1 기준 닫힌 공간(shape=[3,3,3], stride=[9,3,1])에서의 13번
perm:iv2:13  →  iv2 기준 닫힌 공간(shape=[4,3,3], stride=[9,3,1])에서의 13번
```

`indexId + versionId`가 "어떤 닫힌 공간 기준인가"를 명시한다. 공간 자체가 바뀌어도 저장된 값은 해당 버전으로 항상 decode 가능하다.

실제로 관리하는 것은 **버전화된 닫힌 공간들의 계열**이다:
- `indexId` = 어떤 조합 스키마 (어떤 축들이 어떤 순서로)
- `versionId` = 그 스키마의 특정 시점 스냅샷 (각 축의 capacity가 확정된 닫힌 공간)
- `value` = 그 닫힌 공간 내의 정수

## 버전은 복합 축에서 핵심이다

단일 축은 stride가 항상 1이므로 버전 관리가 이력 기록에 가깝다. **복합 축에서 버전은 마이그레이션의 핵심 메커니즘**이다:

1. **DimSnapshot이 stride를 고정한다** — 각 버전은 확정된 capacity(=shape)를 가지며, 이것이 stride를 결정한다. 버전이 다르면 stride가 다르므로 같은 정수가 완전히 다른 의미를 갖는다.

2. **decode(old) → encode(new)로 마이그레이션한다** — 저장된 정수를 old version의 stride로 decode하면 좌표를 복원할 수 있고, 그 좌표를 new version의 stride로 re-encode하면 새 주소를 얻는다.

```
저장값: perm:v1:59

[v1 decode]  stride=[20,5,1]  →  59 → 좌표 [2, 3, 4]
                                         ↓ 좌표는 엔티티 의미를 보존
[v2 encode]  stride=[30,5,1]  →  좌표 [2, 3, 4] → 79

결과: perm:v2:79  (같은 의미, 새 주소)
```

3. **read-repair 패턴** — DB에서 읽은 시점에 old version이면 즉시 변환. 일괄 마이그레이션 없이 점진적으로 전환된다.

## 복합 축에서 prefix 참조(index_ref)와 버전 전파

복합 축이 다른 인덱스를 `index_ref`로 참조할 때, **참조되는 prefix의 버전이 바뀌면 복합 축의 stride도 바뀔 수 있다.**

```
leaf index "role":   v1 shape=[5]  →  v2 shape=[8]   (capacity 확장)
leaf index "action": v1 shape=[4]

composite "perm":  dims = [index_ref("role"), index_ref("action")]
  v1: shape=[5, 4]  →  stride=[4, 1]
  v2: shape=[8, 4]  →  stride=[4, 1]   ← role capacity가 선행이므로 stride 불변!

  하지만:
  v1: shape=[4, 5]  →  stride=[5, 1]   (dims 순서가 [action, role]이면)
  v2: shape=[4, 8]  →  stride=[8, 1]   ← role이 후행이므로 stride 변경!
```

leaf index의 capacity 변경은 composite의 shape을 바꾸고, 그 위치에 따라 stride가 변할 수 있다. 이것이 **leaf → composite cascade 전파**가 필요한 이유이며, GateEngine의 cascade recompute가 이 문제를 다룬다.

## entries append-only 원칙

DimSnapshot의 entries 배열은 append-only다. 기존 위치를 건드리지 않고 끝에 추가하면, capacity headroom 내에서 **공간이 확장되면서도 기존 주소가 보존된다.**

이 원칙이 보장하는 것:
- 단일 축: entries 추가 = 주소 안정 (stride 무관)
- 복합 축 + headroom 내: entries 추가 = 주소 안정 (shape 불변 → stride 불변)
- 복합 축 + headroom 소진: 새 버전 생성 필요 (capacity 확장 → stride 변경 → 마이그레이션)

## Draft 워크플로우 — 버전 생성의 실제 패턴

운영 중에는 headroom 내에서 entries를 추가하면 되므로 버전이 바뀌지 않는다. **버전이 바뀌는 것은 headroom이 소진되거나 스키마 구조를 변경해야 할 때**이며, 이때 draft cycle이 시작된다.

### 2-Phase 운영 모델

```
Phase 1: 평시 (headroom 내)
  → 참조 주소 기반 동작
  → entries append만 발생
  → stride 불변, 마이그레이션 없음
  → 단일 축은 실제 식별값까지 안정적

Phase 2: Draft Cycle (headroom 소진 또는 구조 변경)
  → 관련 축들을 draft로 전환
  → capacity 조정, entries 재구성
  → release 시 stride 확정 + migration mapping 계산
  → activate 후 read-repair로 점진 마이그레이션
```

### Draft에서의 cascade

draft 축이 draft 축을 참조하면, 참조되는 축이 확정되지 않았으므로 참조하는 축도 확정될 수 없다. 이것은 자연스러운 상태다.

```
leaf "role":     draft (capacity=20, entries 추가/삭제 자유)
leaf "action":   draft (capacity=10)

composite "perm": draft
  → refs: role(draft), action(draft)
  → shape = [20, 10] (잠정), stride = [10, 1] (잠정)
  → 확정 아님 — 참조 축이 draft니까 당연히 미확정
```

개발 중에 변경이 생기면:

```
"action에 PATCH 추가" → action draft에 append → perm shape 변동 없음 (headroom 내)
"role 25개 필요"      → role capacity 20→30 조정 → perm stride 재계산
                        draft니까 패널티 없음, 저장된 주소도 없음
```

**draft에서도 capacity를 미리 잡아두는 것이 권장된다.** capacity는 draft 단계에서 "주소 공간 예산"의 역할을 한다:

| 단계 | capacity 의미 | stride | 수정 | 저장된 주소 |
|------|--------------|--------|------|------------|
| **draft** | 예산 (가이드라인) | 잠정 계산 | 조정 가능 | 없음 |
| **released** | 확정 | 고정 | 불가 | 아직 없음 |
| **active** | 확정 | 고정 | 불가 | 있음 (마이그레이션 대상) |

- Capacity Guard가 draft 단계에서 overflow를 사전 경고할 수 있다
- stride를 미리 계산하여 주소 공간 크기를 예측할 수 있다
- release 전까지는 자유롭게 조정할 수 있으므로 설계 반복에 비용이 없다

### Release — 전체 확정

모든 draft가 정리되면 한번에 release한다:

1. 각 leaf draft의 capacity/entries 확정 → stride 고정
2. composite draft의 refs가 확정된 leaf 버전을 가리킴 → composite stride 고정
3. 이전 active 버전과의 migration mapping 계산 (old stride → new stride, decode → re-encode)
4. activate하면 새 버전이 운영에 투입, 이전 버전은 read-repair 대상

### 실제 사용 시나리오: DB 스키마 표현

```
leaf "column_type":   [int, varchar, boolean, timestamp]     capacity=16
leaf "constraint":    [primary_key, not_null, unique, fk]    capacity=8
composite "column":   [table_ref, column_type, constraint]

→ column_type에 json 추가: headroom 내이므로 append만. 버전 불변.
→ column_type이 16개를 넘으면: draft cycle 진입.
   column_type draft (capacity=32) → column도 draft → release → migrate
```

headroom을 충분히 잡으면 대부분의 스키마 진화가 Phase 1(평시)에서 처리되고, draft cycle은 드물게 발생한다.

> **버전 운영 상세**: [`version-operations.md`](version-operations.md) — DraftWorkspace, 배포 워크플로우, 다중 버전 관리, 저장값 마이그레이션
