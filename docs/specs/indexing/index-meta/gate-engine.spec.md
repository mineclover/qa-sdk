# GateEngine 스펙

> 주소 상태 자동 재계산 — **invalid-ranges**(순수 함수) + **GateEngine**(오케스트레이션) + **gate-aware-query**(합성).
> 주소 공간의 물리적 유효성을 관리하여 encode/decode 가능 여부를 결정한다.

패키지 인덱스: [README.md](README.md)
관련 스펙: [codec.spec.md](codec.spec.md) · [registry.spec.md](registry.spec.md) · [../coordinate-query.spec.md](../coordinate-query.spec.md)
운영 흐름: `[S2]` checkGate · `[A4]` recompute/cascade · `[A5]` gateFilterRanges — [runtime-flows.spec.md](../../operations/runtime-flows.spec.md)

## 상태

implemented

---

## 1. 목적

주소 공간에서 모든 주소가 유효하지는 않다. entity가 비활성화되거나, capacity headroom으로 아직 사용되지 않는 슬롯이 있을 수 있다. 이 모듈은:

- 차원별 inactive/open 좌표를 기반으로 주소 상태를 **자동 계산**한다.
- release/flag 변경 시 **자동 재계산**을 트리거한다.
- composite index에서 leaf 변경이 발생하면 **cascade 전파**한다.
- policy resolution과 gate 상태를 **합성**하여 최종 허용 여부를 결정한다.

---

## 2. 아키텍처

3단 구조로 관심사를 분리한다.

```
┌──────────────────────────────────────────────────────────┐
│  gate-aware-query                                         │
│  gateFilterRanges · gateAwareResolve · buildDenialSpecs   │
│  (RelationalEngine 의미 질의 + GateEngine 물리 상태 합성)    │
├──────────────────────────────────────────────────────────┤
│  GateEngine                                               │
│  buildDimStateSpecs · recompute · cascadeRecompute        │
│  (오케스트레이션 — release/flag 이벤트 → 상태 재계산)         │
├──────────────────────────────────────────────────────────┤
│  invalid-ranges                                           │
│  computeStateRanges · checkGate · classifyAddress          │
│  (순수 함수 — shape + DimStateSpec → 범위 계산)              │
└──────────────────────────────────────────────────────────┘
```

의존 방향: gate-aware-query → GateEngine → invalid-ranges → weighted-index (calcAddressRanges, mergeRanges, subtractRanges)

---

## 3. 4가지 주소 상태

### ADDRESS_GATE 매트릭스

| 상태 | encode | decode | 의미 |
|---|---|---|---|
| `active` | O | O | 정상 사용 가능 |
| `inactive` | X | O | 비활성화된 entity 포함 — 쓰기 차단, 읽기 가능 |
| `open` | O | X | capacity headroom — 쓰기 가능, 아직 entity 없어서 읽기 불가 |
| `reserved` | X | X | inactive ∩ open — 완전 차단 |

```ts
const ADDRESS_GATE: Record<AddressState, { encode: boolean; decode: boolean }> = {
  active:   { encode: true,  decode: true  },
  inactive: { encode: false, decode: true  },
  open:     { encode: true,  decode: false },
  reserved: { encode: false, decode: false },
};
```

### DimStateSpec

차원별 비활성/오픈 상태를 선언한다.

```ts
interface DimStateSpec {
  readonly dimIndex: number;
  readonly state: Exclude<AddressState, "active">;  // inactive | open | reserved
  readonly coords: string | null;   // CoordConstraint 문자열; null = 전체 차원
  readonly reason?: string;
}
```

### computeStateRanges 알고리즘

shape과 DimStateSpec[]로부터 3종류의 주소 범위를 계산한다.

```ts
function computeStateRanges(
  shape: readonly number[],
  specs: readonly DimStateSpec[],
): {
  reservedRanges: [number, number][];
  inactiveRanges: [number, number][];
  openRanges:     [number, number][];
}
```

**알고리즘**:

1. 각 spec에 대해: coords → CoordConstraint 변환, `calcAddressRanges(shape, constraints)` → 범위
2. 상태별 범위 수집 후 `mergeRanges()`
3. **승격 규칙**: `inactive ∩ open → reserved`
   - 교집합 계산: `intersect(mergeRanges(rawInactive), mergeRanges(rawOpen))`
   - reserved에 교집합 추가: `finalReserved = merge([...reservedRanges, ...inactiveAndOpen])`
   - inactive/open에서 교집합 제거: `subtractRanges`
4. 복잡도: O(n log n) — n = 범위 수 (merge/subtract 정렬 기반)

### checkGate

주소 하나의 상태를 판정한다.

```ts
function checkGate(
  address: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
  openRanges:     readonly [number, number][],
): GateResult

interface GateResult {
  readonly encode: boolean;
  readonly decode: boolean;
  readonly state: AddressState;
  readonly shouldVerify: boolean;  // open 상태일 때만 true (캐시 무효 가능성)
}
```

**알고리즘**: `classifyAddress`(O(log n) 이진 탐색) → ADDRESS_GATE 매트릭스 조회.

### classifyAddress

```ts
function classifyAddress(
  address: number,
  reservedRanges: readonly [number, number][],
  inactiveRanges: readonly [number, number][],
  openRanges:     readonly [number, number][],
): AddressState
```

**우선순위**: reserved > inactive > open > active. `containsAddress`(이진 탐색)으로 각 범위 소속 확인.

### 범위 필터 유틸리티

| 함수 | 반환 | 의미 |
|---|---|---|
| `encodableRanges(capacity, reserved, inactive)` | [1, capacity] \ (reserved ∪ inactive) | encode 가능한 주소 |
| `decodableRanges(capacity, reserved, open)` | [1, capacity] \ (reserved ∪ open) | decode 가능한 주소 |
| `activeRanges(capacity, reserved, inactive, open)` | [1, capacity] \ (reserved ∪ inactive ∪ open) | 완전 활성 주소 |

---

## 4. GateEngine 클래스

release/flag 이벤트를 감지하여 AddressStateStore를 자동 갱신하는 오케스트레이터.

### GateEngineDeps

```ts
interface GateEngineDeps {
  readonly prefixRegistry: PrefixRegistry;
  readonly metaStore: IndexMetaStore;
  readonly entryFlagStore: EntryFlagStore;
  readonly versionLifecycleStore: VersionLifecycleStore;
  readonly addressStateStore: AddressStateStore;
  readonly addressRangeCache: AddressRangeCache;
}
```

### API

```ts
class GateEngine {
  constructor(deps: GateEngineDeps)

  /** DimStateSpec[] 생성 — leaf/composite 분기 처리 */
  async buildDimStateSpecs(prefix: string, versionId: string): Promise<DimStateSpec[]>

  /** 단일 prefix의 상태 재계산 */
  async recompute(prefix: string, versionId: string): Promise<void>

  /** leaf → composite cascade 재계산 (역참조 DFS) */
  async cascadeRecompute(prefix: string, versionId: string): Promise<void>

  /** release 이벤트 핸들러 */
  async recomputeOnRelease(prefix: string, versionId: string): Promise<void>

  /** flag 변경 이벤트 핸들러 (flexible 모드 전용) */
  async recomputeOnFlagChange(prefix: string, versionId: string): Promise<void>
}
```

### buildDimStateSpecs 흐름

**Leaf index**:
1. `entryFlagStore.getInactivePositions()` → inactive 좌표
2. capacity - entries.length → open 좌표
3. dimIndex = 0, coords = `positionsToConstraint(positions)`

**Composite index**:
1. 각 dim의 leaf ref에서 개별 DimStateSpec 수집
2. dimIndex = 해당 dim의 인덱스 위치

### recompute 흐름

```
buildDimStateSpecs → computeStateRanges → addressStateStore.save → addressRangeCache.deleteAll
```

미등록 prefix는 no-op.

### cascadeRecompute

```
recompute(leaf) → prefixRegistry.getReverseRefs() → forEach(composite) → recompute(composite)
```

역참조 그래프를 DFS로 탐색하며 모든 영향받는 composite를 재계산한다.

---

## 5. Decorator 패턴

기존 store 인터페이스를 감싸서 side-effect 없이 자동 재계산을 트리거한다.

### GateAwareVersionLifecycleStore

```ts
class GateAwareVersionLifecycleStore implements VersionLifecycleStore {
  constructor(inner: VersionLifecycleStore, engine: GateEngine)

  async createDraft(...)   // → inner 위임
  async release(...)       // → inner 위임 후 engine.recomputeOnRelease
  async activate(...)      // → inner 위임
  async deprecate(...)     // → inner 위임
  async getActive(...)     // → inner 위임
  async getVersion(...)    // → inner 위임
  async getVersions(...)   // → inner 위임
}
```

**핵심**: `release()` 호출 시 자동으로 gate 상태를 재계산한다. draft 생성·활성화·폐기는 gate에 영향 없음.

### GateAwareEntryFlagStore

```ts
class GateAwareEntryFlagStore implements EntryFlagStore {
  constructor(inner: EntryFlagStore, engine: GateEngine)

  async setFlag(record)    // → inner 위임 후 engine.recomputeOnFlagChange
  async getFlag(...)       // → inner 위임
  async getFlags(...)      // → inner 위임
  async getInactivePositions(...)  // → inner 위임
}
```

**핵심**: `setFlag()` 호출 시 **flexible 모드에서만** 자동 재계산. strict 모드에서는 no-op (release 시점에 일괄 처리).

---

## 6. gate-aware-query

RelationalEngine의 의미적 질의 결과와 GateEngine의 물리적 상태를 합성한다.

### gateFilterRanges

범위 목록에 gate 상태를 적용하여 유효한 범위만 남긴다.

```ts
function gateFilterRanges(
  ranges: readonly [number, number][],
  gateRecord: AddressStateCacheRecord | null,
  mode: "encodable" | "decodable" | "active",
): [number, number][]
```

| 모드 | 제거 대상 |
|---|---|
| `encodable` | reserved + inactive |
| `decodable` | reserved + open |
| `active` | reserved + inactive + open |

gateRecord가 null이면 전체 범위가 활성(= 입력 그대로 반환).

### gateAwareResolve

정책 해소 결과와 gate 상태를 합성한다.

```ts
function gateAwareResolve<T>(
  policyResult: ResolveResult<T> | null,
  address: number,
  gateRecord: AddressStateCacheRecord | null,
): GateAwareResult<T> | null

interface GateAwareResult<T> {
  value: T | T[];
  matchedRules: PolicyRule<T>[];
  strategy: ConflictStrategy;
  gateBlocked: boolean;
  gateState: AddressState | null;
  permitted: boolean;  // policy allow AND gate active
}
```

**로직**: classifyAddress → gateBlocked = (state !== "active") → permitted = !gateBlocked

### buildDenialSpecs

정책에서 거부된 position을 DimStateSpec[]으로 변환하여 gate에 반영할 수 있게 한다.

```ts
function buildDenialSpecs(
  deniedPositions: readonly number[],
  dimIndex: number,
  state?: Exclude<AddressState, "active">,  // 기본값 "reserved"
): DimStateSpec[]
```

`positionsToConstraint`로 position 배열을 압축한 후 DimStateSpec으로 변환한다.

---

## 7. 저장소

### AddressStateCacheRecord

```ts
interface AddressStateCacheRecord {
  readonly prefix: string;
  readonly versionId: string;
  readonly specs: readonly DimStateSpec[];        // 감사 로그
  readonly reservedRanges: readonly [number, number][];
  readonly inactiveRanges: readonly [number, number][];
  readonly openRanges:     readonly [number, number][];
  readonly computedAt: string;                    // ISO 8601
}
```

### AddressStateStore

```ts
interface AddressStateStore {
  save(record: AddressStateCacheRecord): Promise<void>;
  get(prefix: string, versionId: string): Promise<AddressStateCacheRecord | null>;
  delete(prefix: string, versionId: string): Promise<void>;
}
```

`get()` 반환 null = 아직 계산된 적 없음 → 전체 주소 공간이 active로 간주.

### 캐시 무효화 전략

- `recompute` 완료 시 `addressRangeCache.deleteAll(prefix, versionId)` 호출
- 범위 캐시가 gate 상태와 일관되도록 항상 무효화 후 재계산

---

## 8. 테스트 맵

### invalid-ranges 단위 테스트

| 태그 | 시나리오 |
|---|---|
| [S1] | `computeStateRanges`: 단일 dim inactive 범위 계산 |
| [S2] | `computeStateRanges`: 다중 dim 조합 범위 계산 |
| [S3] | `computeStateRanges`: inactive ∩ open → reserved 승격 |
| [S4] | `checkGate`: active/inactive/open/reserved 판정 |
| [S5] | `classifyAddress`: 경계값 (범위 시작/끝) |
| [S6] | `encodableRanges`/`decodableRanges`/`activeRanges` 유틸리티 |

### gate-aware-query 단위 테스트

| 태그 | 시나리오 |
|---|---|
| [GA-1] | `gateFilterRanges`: encodable 모드 필터링 |
| [GA-2] | `gateFilterRanges`: decodable 모드 필터링 |
| [GA-3] | `gateFilterRanges`: active 모드 필터링 |
| [GA-4] | `gateFilterRanges`: gateRecord null → 전체 통과 |
| [GA-5] | `gateAwareResolve`: 정책 allow + gate active → permitted |
| [GA-6] | `gateAwareResolve`: 정책 allow + gate blocked → not permitted |
| [GA-7] | `gateAwareResolve`: policyResult null → null 반환 |
| [GA-8] | `buildDenialSpecs`: position 배열 → DimStateSpec 변환 |

### GateEngine 통합 테스트

| 태그 | 시나리오 |
|---|---|
| [G1] | `buildDimStateSpecs`: leaf/composite DimStateSpec[] 생성 |
| [G2] | `recompute`: AddressStateStore save + AddressRangeCache 무효화 |
| [G3] | `cascadeRecompute`: leaf 변경 → composite 전파 |
| [G4] | `GateAwareVersionLifecycleStore`: release() 자동 재계산 |
| [G5] | `GateAwareEntryFlagStore`: flexible 모드 setFlag() 자동 재계산 |
| [G6] | E2E: deactivation → checkGate 반영 확인 |

### SQL E2E 테스트

| 태그 | 시나리오 |
|---|---|
| [E1] | release → AddressStateStore SQL 저장 |
| [E2] | flexible setFlag → 즉시 재계산 |
| [E3] | composite cascade: leaf SQL 변경 → composite SQL 전파 |
| [E4] | 영속성: 재시작 후 저장된 캐시 복원 확인 |

---

## 9. 불변조건

| ID | 내용 | 검증 위치 |
|---|---|---|
| INV-6 | inactive ∩ open 주소는 항상 reserved로 승격 | computeStateRanges |
| INV-7 | recompute 후 AddressRangeCache는 무효화 | GateEngine.recompute |
| INV-8 | strict 모드에서 setFlag은 gate 재계산을 트리거하지 않음 | GateAwareEntryFlagStore |
