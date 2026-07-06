---
def:
  tier: component
  id: coord-id-allocation-design
  type: knowledge
  knowledge_kind: adr
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, runtime, versioning]
  links:
    - target: coord-foundation
      type: refines
    - target: coord-closed-space
      type: depends_on
    - target: coord-stride-stability
      type: depends_on
    - target: coord-version-series
      type: depends_on
    - target: coord-layer-separation
      type: depends_on
sources:
  - packages/weighted-index/src/protocol/semantic-address.ts
  - packages/weighted-index/src/protocol/semantic-address.test.ts
  - packages/weighted-index/src/protocol/pack-format.ts
  - packages/weighted-index/src/protocol/pack-format.test.ts
  - packages/weighted-index/src/protocol/capacity-planner.ts
  - packages/weighted-index/src/protocol/capacity-planner.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/address-index/src/index.ts
  - packages/address-index/src/types.ts
  - packages/address-index/src/port.ts
  - packages/address-index/src/memory-store.ts
  - packages/address-index/src/address-index.test.ts
  - packages/address-index/package.json
  - packages/browser-codec/src/browser-codec.ts
  - packages/browser-codec/src/catalog-loader.ts
  - packages/browser-codec/src/catalog-loader.test.ts
  - packages/browser-codec/src/smoke.test.ts

---

# ID 할당과 좌표 주소 설계

## 목적 ^purpose

Snowflake, TiDB, Kafka의 ID/주소/offset 설계를 비교하여 qa-sdk의 좌표 주소가 무엇을 맡고, 무엇을 맡지 않아야 하는지 정의한다. qa-sdk는 분산 ID 생성기가 아니라 RAG, text-to-SQL, 사용자 친화적 검색 인덱스 관리를 위한 의미론 관리와 인덱싱 솔루션이다.

## 처음 이해해야 할 5문장

1. ID는 하나가 아니다. 같은 숫자처럼 보여도 유일성, 순서, 저장 분산, 의미 복원은 서로 다른 책임이다.
2. Snowflake는 분산 환경에서 조정 없이 유일하고 대략 시간 정렬되는 row/event identity를 만든다.
3. TiDB `AUTO_RANDOM`과 `SHARD_ROW_ID_BITS`는 상위 비트로 write hotspot을 줄이고, 하위 allocation 공간으로 유일성을 유지한다.
4. Kafka는 전역 순서를 만들지 않고 `topic + partition + offset` 안에서만 순서를 보장한다.
5. qa-sdk의 `address`는 record identity가 아니라 `prefix + version + shape`에 묶인 semantic coordinate이며, 검색·추론·쿼리 생성이 공유할 의미 기준점이다.

## 책임 분리

하나의 ID에 너무 많은 기대를 넣으면 설계가 흐려진다.

| 기대 | 질문 | 잘못 합치면 생기는 문제 |
|---|---|---|
| 유일성 | 이 이벤트 인스턴스가 하나뿐인가? | 같은 좌표의 반복 이벤트를 구분하지 못함 |
| 순서 | 무엇이 먼저 발생했는가? | 분산 쓰기에서 전역 순서라는 환상을 만듦 |
| 저장 분산 | 어떤 노드/region/partition에 쓸 것인가? | semantic range가 랜덤화되어 탐색이 깨짐 |
| 의미 복원 | 이 숫자를 어떤 좌표로 decode할 수 있는가? | shape 변경 시 과거 주소가 다른 의미로 재해석됨 |
| 범위 탐색 | 특정 축 조건을 빠르게 찾을 수 있는가? | shard/random bit가 semantic address에 섞이면 range 계산이 복잡해짐 |

## 솔루션 비교

| 사례 | 최적화한 것 | 장점 | 대가 | qa-sdk 적용 |
|---|---|---|---|---|
| Snowflake | 분산 유일 ID + 대략 시간 정렬 | 중앙 sequence 없이 compact한 `recordId` 생성 | clock rollback, machine id 운영, causal order 부재 | event envelope id, audit row id |
| TiDB `AUTO_INCREMENT` | 쉬운 row identity | RDBMS 사용자에게 익숙하고 단순 | 분산 cache jump, 전역 연속성 착각, hotspot 가능 | 작은 로컬 table 관리 ID |
| TiDB `AUTO_RANDOM` | write hotspot 완화 + 유일성 | shard bits로 Region 분산, increment bits로 allocation | shard bits 증가 시 allocation 공간 감소, bit layout 변경 어려움 | storage row id, physical locality |
| TiDB `SHARD_ROW_ID_BITS` | implicit row id 분산 | PK가 없거나 non-clustered인 table hotspot 완화 | 내부 row id 성격이 강함, domain identity로 부적합 | storage placement knob |
| Kafka | partition 범위 순서 + 병렬 처리 | `topic + partition + offset`으로 replay와 order scope가 명확 | 전역 순서 없음, partition key 변경 비용 | ingest stream pointer, consumer progress |
| WeightedIndex | 의미 조합의 닫힌 공간 주소 | `prefix + version + address`로 decode/range/coverage 가능 | shape 변경 시 새 version 필요, record instance 구분 불가 | `address_context`, semantic analysis |

## qa-sdk 기본 모델

```ts
type RecordIdentity = {
  recordId: string;       // opaque. Snowflake, ULID, UUID 등
};
type SemanticAddress = {
  prefixId: string;
  version: string;
  address: number;        // WeightedIndex address
};

type StreamPointer = {
  streamId: string;       // Kafka topic에 해당
  shardId: number;        // Kafka partition 또는 storage shard
  sequence: number;       // Kafka offset 또는 shard-local sequence
};

type StoragePlacement = {
  bucketId: number;
  timeBucket?: string;
};
```

## 최적화 선택표

| 목적 | 우선 선택 | 이유 |
|---|---|---|
| 이벤트 인스턴스 유일성 | Snowflake/ULID/UUID류 `recordId` | 의미와 무관한 opaque identity가 안전 |
| 같은 의미 조합 집계 | `prefix + version + address` | decode, range query, coverage 분석 가능 |
| 고쓰기 ingest 분산 | `StoragePlacement` 또는 TiDB식 shard bits | semantic address를 건드리지 않고 hotspot 완화 |
| 처리 순서/replay | Kafka식 `stream + shard + sequence` | 순서 scope가 명확하고 consumer progress와 맞음 |
| 전역 causal 분석 | record timestamp + stream pointer + semantic address 조합 | 단일 숫자보다 evidence를 남기는 편이 안전 |
| RAG 검색 기준 | semantic catalog + address filter | chunk text 이전에 의미 범위를 좁힐 수 있음 |
| text-to-SQL grounding | schema/entity semantic index | 자연어 표현을 안정된 table/field/relationship 후보로 제한 |
| 사용자 친화 검색 | label/alias/tag + semantic address | 사람이 쓰는 용어와 기계 좌표를 같이 관리 |
| UI/운영자 이해 | tuple을 그대로 노출 | packing된 scalar보다 책임이 보임 |
| wire/storage compactness | 내부 packing | 기본 계약을 먼저 tuple로 정의한 뒤 최적화 |

## 설계 규칙

1. `address` 단독 저장 금지. 항상 `prefixId`와 `version`을 함께 저장한다.
2. `recordId`를 decode하려 하지 않는다. opaque identity는 의미를 갖지 않는다.
3. write hotspot을 해결하려고 semantic address에 random/shard bit를 섞지 않는다.
4. 전역 순서를 요구하지 않는다. 순서는 `streamId + shardId + sequence` 범위에서 정의한다.
5. entry는 append-only로 배정한다. 기존 entry position 재사용이나 재정렬은 금지한다.
6. capacity가 부족하면 기존 prefix를 수정하지 않고 새 version을 만든다.
7. tuple 모델을 먼저 이해 가능한 계약으로 유지하고, scalar packing은 성능 요구가 확인된 뒤 도입한다.

## 예시

같은 사용자가 같은 액션을 두 번 수행했다.

```ts
const eventA = {
  recordId: "01J...",
  address_context: { cart_event: "cart_event:v2:5" },
  stream: { streamId: "ingest.cart", shardId: 3, sequence: 9181 },
};

const eventB = {
  recordId: "01K...",
  address_context: { cart_event: "cart_event:v2:5" },
  stream: { streamId: "ingest.cart", shardId: 3, sequence: 9182 },
};
```

두 이벤트는 같은 semantic address를 가진다. 따라서 "cart add 계열 이벤트" 집계에서는 같은 bucket에 들어간다. 그러나 `recordId`와 stream sequence가 다르므로 이벤트 인스턴스와 replay 위치는 구분된다.

이 분리가 없으면 다음 문제가 생긴다.

- `address`를 record id로 쓰면 eventA와 eventB를 구분하지 못한다.
- `recordId`를 분석 key로 쓰면 같은 의미 조합을 집계하지 못한다.
- `sequence`를 semantic address로 쓰면 partition이 바뀌는 순간 의미가 깨진다.
- shard bit를 address에 섞으면 range 탐색과 decode가 복잡해진다.

## 외부 사례에서 가져올 원칙

| 사례 | 가져올 것 | 가져오지 않을 것 |
|---|---|---|
| Snowflake | bit budget을 명시한 opaque distributed id | semantic coordinate로 decode하려는 시도 |
| TiDB `AUTO_RANDOM` | storage-aware shard bit와 allocation bit의 trade-off 사고 | semantic address 랜덤화 |
| TiDB `SHARD_ROW_ID_BITS` | hotspot은 물리 배치 문제라는 관점 | 내부 row id를 도메인 identity로 승격 |
| Kafka | 순서 scope를 partition으로 제한하는 정직함 | 전역 offset 환상 |
| WeightedIndex | versioned closed space와 range 계산 | 무한 증가 identity를 차원으로 넣기 |
