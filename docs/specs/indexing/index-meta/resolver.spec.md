---
def:
  id: resolver-spec
  address: def_document:v2:68788
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-infra]
  links:
    - target: table-schema-spec
      type: depends_on
    - target: index-meta-store
      type: depends_on
    - target: canonical-format-spec
      type: depends_on
---

# MetaResolver 스펙

## 목적 ^purpose

MetaRegistry의 데이터를 외부 소비용 번들(DecodeMap, DimRange, IndexRange, MetaDataset)로 변환한다.

디코딩 파이프라인: [../pipeline.md](../pipeline.md)

## 구성 ^overview

- **DecodeMap**: MetaRegistry 없이 외부에서 value → entity ID 복원을 가능하게 하는 최소 디코딩 번들
- **DimRange**: 특정 dim의 모든 snapshot(버전 이력) 조회
- **IndexRange**: 특정 index의 모든 version(shape/size/dims 포함) 조회
- **MetaDataset**: 전체 레지스트리 데이터를 index별 + dim별로 그룹핑한 내보내기
- **역할 분리**: MetaRegistry(게이트웨이) → MetaCodec(정보 해석) → MetaResolver(projection)
- **불변성 보장**: entries는 매번 복사본 반환, address config는 structuredClone으로 캐시 제공
- **에러 전파**: IndexNotFoundError, IndexVersionNotFoundError, DimNotFoundError를 MetaRegistry에서 위임

## 참조

패키지 인덱스: [README.md](README.md)

## 상태

implemented

---

## 역할

```
MetaRegistry (게이트웨이)       MetaCodec (정보 해석)      MetaResolver (projection)
├── serialize/parse            ├── encode/decode          ├── getDecodeMap()
├── createCodec()              └── decodeValue            ├── getDimRange()
└── validate                                              ├── getIndexRange()
                                                          └── getDataset()
```

---

## 사용 시나리오

| 시나리오 | 메서드 | 전달 대상 |
|---|---|---|
| DB에 디코딩 테이블 동기화 | `getDecodeMap("perm", "v1")` | RDB lookup table |
| 프론트엔드에 decode 번들 전송 | `getDecodeMap("perm", "v1")` | 브라우저 클라이언트 |
| 버전 변경 이력 조회 | `getIndexRange("perm")` | 관리 UI |
| dim 항목 전체 조회 | `getDimRange("role")` | 설정 화면 |
| 전체 스키마 내보내기 | `getDataset()` | 백업, 마이그레이션 도구 |

---

## API

```ts
class MetaResolver {
  constructor(registry: MetaRegistry)

  /** 특정 version의 디코딩 최소 데이터 번들. */
  getDecodeMap(indexId: string, versionId: string): DecodeMap

  /** DecodeMap + 참조 index의 DecodeMap 번들. PrefixDecoder에 직접 전달 가능. */
  getDecodeMapBundle(indexId: string, versionId: string): PrefixDecoderConfig

  /** dim의 모든 snapshot (버전 range). */
  getDimRange(dimId: string): DimRange

  /** index의 모든 version (shape/size/dims 포함). */
  getIndexRange(indexId: string): IndexRange

  /** 전체 레지스트리 데이터셋 (index별 + dim별 그룹핑). */
  getDataset(): MetaDataset
}
```

---

## getDecodeMapBundle — 참조 포함 번들

`index_ref` dim이 있는 index의 경우, 참조 index의 최신 버전 DecodeMap도 포함하여 반환한다.

```ts
interface PrefixDecoderConfig {
  map: DecodeMap;
  refs?: Record<string, DecodeMap>;  // refIndexId → DecodeMap
}
```

반환된 번들을 JSON 직렬화하면 마이크로서비스에서 `new PrefixDecoder(bundle)`로 바로 사용 가능하다.

```ts
const bundle = resolver.getDecodeMapBundle("article", "v1");
// bundle.map = article의 DecodeMap
// bundle.refs = { "perm": perm의 최신 버전 DecodeMap }
```

---

## DecodeMap — 외부 디코딩 번들

MetaRegistry 없이 외부에서 `value → entity ID` 복원을 가능하게 하는 최소 데이터 단위.

```ts
interface DecodeMap {
  indexId: string;
  versionId: string;
  shape: number[];           // WeightedIndex 생성에 사용
  size: number;              // value 유효 범위 [0, size-1]
  dims: {
    dimId: string;
    snapshotId: string;
    kind: DimKind;
    entries: EntityId[];     // entries[coord-1] = entity ID
  }[];
  address?: AddressConfig;   // PK 파싱 정보 (설정된 경우)
}
```

외부 디코딩 절차 (전체 경로는 [`../pipeline.md`](../pipeline.md) 참조):

```
1. weights[i] = product(shape[i+1:])
2. coord[i] = floor(remaining / weights[i]) + 1, remaining %= weights[i]
3. entity = dims[i].entries[coord[i] - 1]
```

---

## DimRange / IndexRange

```ts
// dim의 모든 snapshot
interface DimRange {
  dimId: string;
  kind: DimKind;
  description?: string;
  snapshots: {
    snapshotId: string;
    entries: EntityId[];
    activeIndices: number[];
    total: number;
    capacity: number;       // snapshotCapacity()로 계산
    headroom: number;       // capacity - entries.length
  }[];
}

// index의 모든 version
interface IndexRange {
  indexId: string;
  description?: string;
  dimIds: string[];
  versions: {
    versionId: string;
    shape: number[];
    size: number;
    dims: {
      dimId: string;
      snapshotId: string;
      kind: DimKind;
      entries: EntityId[];
      activeIndices: number[];
      capacity: number;     // snapshotCapacity()로 계산
      headroom: number;     // capacity - entries.length
    }[];
  }[];
}
```

`capacity`와 `headroom` 필드는 snapshot 단위 여유 공간 확인에 사용한다. headroom <= 1이면 draft cycle 검토 필요.

---

## 설계 노트

- `getDecodeMap` 호출 시 address config는 생성자에서 1회 캐싱한 값을 `structuredClone`하여 반환 (호출마다 `toInput()` deep clone 방지)
- entries는 매번 복사본 반환 (원본 불변성 보장)
- 에러는 MetaRegistry에서 전파 (`IndexNotFoundError`, `IndexVersionNotFoundError`, `DimNotFoundError`)
- `getDecodeMapBundle`에서 참조 index는 해당 index의 마지막(최신) 버전을 사용
- `getDimRange`/`getIndexRange`는 `snapshotCapacity()`와 `computeActiveIndices()`를 내부적으로 호출하여 capacity/headroom/activeIndices를 자동 계산
