# bit-index

차원별 비트 패킹 인덱스 — 각 차원을 독립 비트 필드에 배치하여 **O(1) shift+mask**로 개별 차원을 추출한다.

```ts
import { BitIndex } from "bit-index";

const idx = new BitIndex(
  [10, 50, 8, 20],
  ["region", "page", "action", "resource"],
);

const packed = idx.encode([3, 25, 5, 12]);

// O(1) 단일 차원 추출 — shift+mask 한 번
idx.extractDimByLabel(packed, "region");  // → 3

// 부분 집합 추출 — full decode 불필요
idx.extractDimsByLabel(packed, ["region", "page"]);
// → { region: 3, page: 25 }

// 비트 시프트로 상위 그룹 직접 비교
(packedA >> 8) === (packedB >> 8)  // region+page 동일 여부
```

---

## WeightedIndex와의 관계

**같은 좌표, 다른 인코딩.** 두 모듈은 독립적이며, packed 값은 호환되지 않는다.

```
coords [3, 25, 5, 12]
  ├─ WeightedIndex.encode() → 28891   (mixed-radix 1D 정수)
  └─ BitIndex.encode()      → 0x2C8AB (비트 필드 배치)
```

| | WeightedIndex (mixed-radix) | BitIndex (bit-pack) |
|---|---|---|
| 인코딩 | `Σ (x_i-1) × stride_i` | `[dim0:Nb]‖[dim1:Mb]‖...` |
| 공간 | `⌈log₂(Π shape)⌉` bits — **최적** | `Σ ⌈log₂(shape[i])⌉` bits — 약간 큼 |
| 개별 차원 추출 | **O(d)** — mod/div 체인 | **O(1)** — shift+mask |
| DB BETWEEN 질의 | **적합** — 연속 구간 생성 | **불가** — 비연속 |
| 비트 시프트 그룹핑 | 불가 | **가능** — 상위 비트 = 상위 차원 |

### 선택 기준

```
DB 저장 + 범위 질의가 핵심       → WeightedIndex
개별 차원 추출 + 실시간 필터가 핵심 → BitIndex
둘 다 필요                       → 양쪽 유지, 좌표 기준으로 변환
```

---

## 사용처

### 1. 캐시 키 생성 — 상위 차원 그룹핑

```ts
// region(4b) + page(6b) + action(3b) + resource(5b) = 18 bits
const idx = new BitIndex([10, 50, 8, 20], ["region", "page", "action", "resource"]);

// action+resource(8b)를 날리면 region+page 그룹 키
const groupKey = idx.encode([3, 25, 5, 12]) >> 8;

// 같은 region+page → 같은 groupKey (action, resource 무관)
idx.encode([3, 25, 1, 1]) >> 8 === groupKey  // true
idx.encode([3, 25, 8, 20]) >> 8 === groupKey // true
idx.encode([4, 25, 1, 1]) >> 8 === groupKey  // false (다른 region)
```

**적용:** Redis 캐시 키, CDN 캐시 파티션, 메모리 캐시 버킷.

### 2. 실시간 권한 필터 — 인메모리 O(1) 판정

```ts
// 서버 메모리에 권한 packed 값 Set 보유
const granted: Set<number> = new Set(userPermissions.map(p => idx.encode(p)));

// 요청 시 O(1) 판정
function canAccess(region: number, page: number, action: number, resource: number): boolean {
  return granted.has(idx.encode([region, page, action, resource]));
}

// 또는 "이 region의 모든 권한" 필터링
function permissionsForRegion(region: number): number[] {
  return [...granted].filter(p => idx.extractDim(p, 0) === region);
}
```

**적용:** JWT/세션 기반 권한 체크, WebSocket 실시간 필터, 이벤트 라우팅.

### 3. 이벤트 라우팅 — 차원별 분기

```ts
const event = new BitIndex(
  [5, 100, 3, 10],
  ["service", "endpoint", "method", "status_group"],
);

function routeEvent(packed: number) {
  const service = event.extractDim(packed, 0);
  const method = event.extractDim(packed, 2);

  // 차원별 독립 라우팅 — full decode 없이
  if (service === 3) sendToAnalytics(packed);
  if (method === 1 /* GET */) updateCache(packed);
}
```

**적용:** 로그 분류, 메트릭 라우팅, 알림 필터링.

### 4. 클라이언트 토큰 — 컴팩트 비트 표현

```ts
const token = new BitIndex(
  [16, 64, 8],
  ["role", "resource_group", "access_level"],
);

// 좌표 → 바이트 배열 (JWT claim에 삽입)
const bytes = token.toBytes([3, 42, 5]);  // 3 bytes

// 서버에서 복원
const [role, group, level] = token.fromBytes(bytes);

// 또는 특정 차원만 추출 (role만 확인)
const roleOnly = token.extractDim(token.encode([3, 42, 5]), 0); // → 3
```

**적용:** JWT 커스텀 클레임, 세션 토큰, 쿠키 값.

### 5. 복합 해시맵 키 — 다차원 키를 단일 정수로

```ts
const key = new BitIndex(
  [256, 256, 65536],
  ["tenant", "shard", "entity"],
);

// Map<number, T> 로 다차원 키 관리
const store = new Map<number, UserData>();
store.set(key.encode([12, 5, 30000]), userData);

// 조회
const data = store.get(key.encode([12, 5, 30000]));

// tenant별 순회 — extractDim으로 필터
for (const [packed, val] of store) {
  if (key.extractDim(packed, 0) === 12) { /* tenant 12 */ }
}
```

**적용:** 인메모리 다차원 인덱스, LRU 캐시 키, 테넌트별 데이터 파티셔닝.

---

## 사용하면 안 되는 곳

| 시나리오 | 이유 | 대신 사용 |
|----------|------|-----------|
| DB `WHERE addr BETWEEN ? AND ?` | 차원 제약이 연속 구간을 만들지 않음 | `WeightedIndex` + `calcAddressRanges` |
| 공간 최적화가 최우선 | `Σ⌈log₂⌉ > ⌈log₂Π⌉` (1~수 bits 낭비) | `WeightedIndex` |
| `PrefixCodec` / `SemanticAddress` 연동 | mixed-radix 주소 체계 전용 | `WeightedIndex` |
| 차원 순서 무관한 집합 연산 | 비트 위치가 차원 순서에 의존 | `calcAddressRanges` + 범위 대수 |

---

## API

```ts
import { BitIndex, BitIndexBig, createBitIndex } from "bit-index";

// ── 생성 ─────────────────────────────────────────
new BitIndex(shape: number[], labels?: string[])     // totalBits ≤ 53
new BitIndexBig(shape: number[], labels?: string[])  // 모든 크기
createBitIndex(shape, labels)                         // 자동 선택

// ── encode / decode ──────────────────────────────
idx.encode(coords: number[]): number                  // 1-based → packed
idx.decode(packed: number): number[]                   // packed → 1-based
idx.encodeFromRecord(record): number
idx.decodeToRecord(packed): Record<string, number>
idx.encodeUnsafe(coords): number                       // 검사 생략
idx.decodeUnsafe(packed): number[]

// ── O(1) 차원 추출 (핵심) ────────────────────────
idx.extractDim(packed, dimIndex): number               // shift+mask
idx.extractDimByLabel(packed, label): number
idx.extractDims(packed, dimIndices): Record<string, number>
idx.extractDimsByLabel(packed, labels): Record<string, number>

// ── 직렬화 ───────────────────────────────────────
idx.toBytes(coords): Uint8Array
idx.fromBytes(bytes): number[]
idx.toHex(coords): string
idx.fromHex(hex): number[]

// ── 속성 ─────────────────────────────────────────
idx.shape: readonly number[]
idx.labels: readonly string[]
idx.totalBits: number
idx.totalBytes: number
idx.layout: BitFieldLayout                             // 내부 레이아웃 (advanced)
```

---

## 빌드

```bash
pnpm --filter bit-index build   # tsup → dist/ (ESM + CJS)
pnpm --filter bit-index test    # vitest
```

| 항목 | 값 |
|---|---|
| 포맷 | ESM + CJS (듀얼) |
| 의존성 | `weighted-index` (bit-field-layout, errors) |
| 외부 런타임 의존성 | 없음 |
