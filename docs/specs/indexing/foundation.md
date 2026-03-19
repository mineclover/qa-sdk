# 좌표 시스템 기반 원리

> 이 시스템은 **좌표 시스템(Coordinate System)**이다.
> 유한한 개념 조합에 정수 주소를 부여하고, 주소를 해석하고, 주소 공간을 버전 관리한다.
> **데이터를 저장하지 않는다.** 저장은 이 좌표 위에 구축되는 별도 계층의 책임이다.

사용 패턴: [`patterns.md`](patterns.md) · 프로젝트 관례: [`conventions.md`](conventions.md) · 설계 구조: [`data-design.md`](data-design.md)

관련 스펙:
- [`weighted-index/`](weighted-index/README.md)
- [`index-meta/`](index-meta/README.md)

---

## 1. 닫힌 조합 공간

WeightedIndex는 **설계 시점에 상한이 고정된 유한 차원**에만 적용한다.

| 차원 종류 | 적합 | 이유 |
|---|---|---|
| 역할 수, 액션 수, 환경 수 | ✅ | 설계 시 고정된 유한 집합 |
| API 리소스 × 테넌트 조합 | ✅ | 차원 수가 사전에 확정됨 |
| 타임스텝 t (무한 증가) | ❌ | 상한 불명. 외부 Map으로 관리 |
| UUID, 레코드 ID | ❌ | 상한이 2^128 → size 초과 |

> **판단 기준**: 차원의 최댓값이 코드 작성 시점에 확정되지 않으면 WeightedIndex 차원이 아니다. 확정되지 않는 값은 외부에서 키로 관리하고, 그 키마다 독립된 WeightedIndex 공간을 운용한다.

### 전단사(bijection) 보장

모든 인코딩은 겹침 없고 빈 값 없는 전단사다. `[0, size-1]` 범위의 정수가 가능한 모든 조합에 1:1로 대응한다.

이것이 가능하게 하는 것:
- 역변환이 항상 가능하다 — 정수만 있으면 원래 좌표를 복원할 수 있다
- 비트마스크와 호환된다 — 조합 집합을 Uint8Array로 표현할 수 있다
- 범위 쿼리가 가능하다 — 특정 차원을 고정하면 나머지 차원의 조합을 계산할 수 있다

---

## 2. Stride 공식과 주소 안정성

### 2.1 Stride가 주소를 결정한다

Mixed-radix encoding에서 각 차원의 **stride(가중치)**는 후속 차원들의 capacity 곱으로 결정된다.

```
shape    = [N₀, N₁, N₂]
stride   = [N₁×N₂,  N₂,  1]

좌표 [a, b, c]  →  주소 = a×(N₁×N₂) + b×(N₂) + c
```

이 공식에서 핵심은: **stride[i]는 i보다 뒤에 있는 모든 차원의 capacity에 의존한다.**

### 2.2 단일 축: 자연스럽게 안정적

차원이 1개뿐인 인덱스는 stride가 항상 `[1]`이다.

```
shape = [5]   →  stride = [1]  →  "admin"=1, "editor"=2, "viewer"=3
shape = [8]   →  stride = [1]  →  "admin"=1, "editor"=2, "viewer"=3, "guest"=4, ...
```

entries를 추가해도 stride가 바뀌지 않으므로 **기존 인덱스가 자동으로 보존된다.** 버전 관리는 사실상 단어 사전의 이력 기록 수준이며, 마이그레이션이 필요한 상황 자체가 발생하지 않는다(capacity 변경이 아닌 한).

### 2.3 복합 축: Capacity 변경이 주소를 무효화한다

차원이 여러 개이면 **어떤 한 차원의 capacity 변경이 선행 차원 전체의 stride를 바꾼다.**

```
v1: shape = [3, 4, 5]  →  stride = [20, 5, 1]
    좌표 [2, 3, 4]     →  주소 = 2×20 + 3×5 + 4 = 59

v2: shape = [3, 6, 5]  →  stride = [30, 5, 1]   ← N₁이 4→6으로 변경
    좌표 [2, 3, 4]     →  주소 = 2×30 + 3×5 + 4 = 79   ← 같은 좌표인데 주소가 다름!

v1에서 저장한 59를 v2 기준으로 decode하면?
    59 = 1×30 + 5×5 + 4  →  [1, 5, 4]   ← 완전히 다른 의미!
```

이것이 복합 축에서 **capacity headroom을 미리 선언해야 하는 근본 이유**다. capacity를 충분히 크게 잡아두면 항목을 추가해도 shape이 변하지 않고, shape이 변하지 않으면 stride가 불변이므로 기존 주소가 보존된다.

### 2.4 Capacity Headroom — Stride를 고정하는 장치

```
capacity = [10, 10, 10]  →  stride = [100, 10, 1]  (고정)

v1 entries: [3, 4, 5]    →  headroom = [7, 6, 5]  ← 추가 여유분
v2 entries: [3, 6, 5]    →  headroom = [7, 4, 5]  ← 항목 추가했지만 stride 불변
```

headroom이 남아있는 한, entries를 추가해도 **버전 변경 없이** 기존 주소가 보존된다. headroom이 소진되면 capacity를 확장해야 하고, 이때 stride가 바뀌므로 **새 버전 생성 + 마이그레이션**이 필요하다.

---

## 3. 버전화된 닫힌 공간의 계열

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

### 3.1 버전은 복합 축에서 핵심이다

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

### 3.2 복합 축에서 prefix 참조(index_ref)와 버전 전파

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

### 3.3 entries append-only 원칙

DimSnapshot의 entries 배열은 append-only다. 기존 위치를 건드리지 않고 끝에 추가하면, capacity headroom 내에서 **공간이 확장되면서도 기존 주소가 보존된다.**

이 원칙이 보장하는 것:
- 단일 축: entries 추가 = 주소 안정 (stride 무관)
- 복합 축 + headroom 내: entries 추가 = 주소 안정 (shape 불변 → stride 불변)
- 복합 축 + headroom 소진: 새 버전 생성 필요 (capacity 확장 → stride 변경 → 마이그레이션)

### 3.4 Draft 워크플로우 — 버전 생성의 실제 패턴

운영 중에는 headroom 내에서 entries를 추가하면 되므로 버전이 바뀌지 않는다. **버전이 바뀌는 것은 headroom이 소진되거나 스키마 구조를 변경해야 할 때**이며, 이때 draft cycle이 시작된다.

#### 2-Phase 운영 모델

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

#### Draft에서의 cascade

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

#### Release — 전체 확정

모든 draft가 정리되면 한번에 release한다:

1. 각 leaf draft의 capacity/entries 확정 → stride 고정
2. composite draft의 refs가 확정된 leaf 버전을 가리킴 → composite stride 고정
3. 이전 active 버전과의 migration mapping 계산 (old stride → new stride, decode → re-encode)
4. activate하면 새 버전이 운영에 투입, 이전 버전은 read-repair 대상

#### 실제 사용 시나리오: DB 스키마 표현

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

---

## 4. 레이어 분리

| 레이어 | 패키지 | 관심사 | 예시 |
|---|---|---|---|
| **수학** | `weighted-index` | 정수 ↔ n-차원 좌표 변환 | `encode([3,2,1]) → 42` |
| **스키마** | `index-meta` | 축의 의미, 각 위치의 엔티티 정의 | `"role" 축 3번 위치 = "admin"` |
| **데이터** | 사용자 구현 | 실제 값 저장, versionId 추적 | DB에 `"perm:iv1:13"` 저장 |

각 레이어의 경계:

- **수학 레이어는 의미를 모른다.** `WeightedIndex`는 shape(숫자 배열)만 알고, 그 숫자가 역할인지 액션인지 모른다.
- **스키마 레이어는 저장을 모른다.** `MetaRegistry`는 entries와 버전 정보를 들고 있지만, 실제로 DB에 어떻게 저장되는지 모른다. `versionId`가 `DimKind` 정의에 없는 이유: 어떤 버전과 함께 저장할지는 데이터 레이어의 관심사다.
- **데이터 레이어는 구조를 모른다.** DB에는 `"perm:iv1:13"` 문자열만 저장된다. 이 값의 의미를 풀려면 스키마 레이어가 필요하다.

### weighted-index 내부 레이어

`weighted-index` 안에서도 계층이 있다:

| 모듈 | 역할 | 의존 |
|---|---|---|
| `calc` | stride 공식 canonical 구현 (`calcWeights`) + 범위 연산 유틸 | 없음 (순수 함수) |
| `WeightedIndex` | 순수 수학 엔진 (Number) | `calcWeights` (stride 계산 위임) |
| `WeightedIndexBig` | 순수 수학 엔진 (BigInt, shape product > 2^53) | 없음 (shape만) |
| `LabelRegistry` | 레이블별 entity ID ↔ 1-based index | WeightedIndex 불필요 |
| `PrefixCodec` | 레이블 조합 + 버전 관리 + encode/decode | WeightedIndex + LabelRegistry |
| `bitmask`, `obfuscate` | 독립 유틸 | 아무 것에도 의존하지 않음 |

> **Note**: `WeightedIndex`와 `WeightedIndexBig`은 동일한 알고리즘의 Number/BigInt 구현이다. 둘 다 shape만 알면 동작하며, 직렬화 포맷이나 `numberType` 선택에 관여하지 않는다. 엔진 선택은 상위 레이어(어댑터)가 `shapeProduct`/`maxProductBig` 등 패키지 유틸로 shape product를 사후 분석하여 결정한다.
> 검증: [`format-adapter.test.ts`](../../../packages/weighted-index/src/format-adapter.test.ts) §1–§7

`PrefixCodec`와 `MetaRegistry`는 구조적으로 유사하다. `MetaRegistry`가 기능적 상위 호환이지만, `PrefixCodec`는 컴파일 타임 타입 안전성(`InferLabelSchema`)을 제공하고 `weighted-index` 자체를 독립 사용할 수 있는 경로를 유지한다.

---

## 5. 가속 지향 설계 원칙

> 상세: [`acceleration.md`](acceleration.md) — 하드웨어 가속 비전 및 로드맵

인덱싱 시스템의 연산 특성은 하드웨어 가속(FPGA/PCIe 등)에 구조적으로 적합하다. 이 적합성은 부수적 결과가 아니라, 아래 원칙에서 **자연스럽게 도출되는 성질**이다.

### 문자열은 아래로 내려가지 않는다

모든 도메인 값(역할 이름, 액션 이름 등)은 스키마 레이어(MetaCodec)에서 정수 좌표로 변환된다. 수학 레이어(WeightedIndex)는 오직 정수만 다룬다. 이 경계가 곧 가속 경계다.

```
문자열 도메인  →  정수 좌표  →  packed key
                    ↑
              가속 경계 (이 아래는 정수만)
```

### 모든 것은 ref_id로 수렴한다

각 axis의 도메인 값은 DimSnapshot의 position(1-based 정수)으로 수렴한다. 이 position이 ref_id이며, encode/decode의 유일한 입력이다. 문자열 → position 변환은 CPU에서 수행하고, position → packed key 변환만 가속한다.

### packed key는 계산 결과가 아니라 identity다

packed key는 단순 인코딩 결과물이 아니다. 그것이 곧 데이터의 정체성(identity)이다. schema가 불변이고 key가 결정론적이므로, **동일한 의미는 항상 동일한 key로 표현된다.** 이것이 packed key를 캐시 키, DB PK, 비교 연산의 기반으로 사용할 수 있는 근거이며, 하드웨어 lookup table의 안정성을 보장한다.

### 불변성이 가속의 전제 조건이다

shape 확정 → weights 불변. entries 확정 → lookup table 불변. 이 불변성 덕분에:
- FPGA configuration을 런타임에 변경할 필요가 없다 (version 변경 시만 재로드)
- 캐시 일관성 문제가 없다
- 병렬 접근이 안전하다
