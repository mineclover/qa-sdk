---
def:
  id: user-scenarios
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  tags: [testing]
  links:
    - target: index-codec-spec
      type: traces_to
    - target: resolver-spec
      type: traces_to
---

# 유저 시나리오 테스트 커버리지

## 목적 ^purpose

MetaCodec + MetaResolver + MetaRegistry + PrefixRegistry + IndexMetaStore 통합 시나리오.
파일: `meta-codec.test.ts`, `meta-resolver.test.ts`, `meta-registry.test.ts`,
      `prefix-registry.test.ts`, `table-flow.e2e.test.ts`, `address-resolver.test.ts`,
      `migrate-address.test.ts`

외부 시스템 통합 시나리오 (AddressProtocolManager): [scenarios-address.spec.md](scenarios-address.spec.md)



## 참조

패키지 인덱스: [README.md](README.md)

## 상태

implemented

---

## 1. DecodeMap 자립 UUID 디코딩

> 목적: DecodeMap + address 번들만으로 MetaRegistry 없이 UUID → entity ID 전체 복원이 가능함을 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| DM-E2E-1 | UUID → 외부 파싱 → 외부 decode | UUID를 address 역매핑으로 파싱, shape+entries로 entity 복원. MetaRegistry 미사용 |
| DM-E2E-2 | 여러 entity 조합 일관성 | 3개 이상 entity 조합이 모두 외부 decode와 MetaCodec decode 일치 |
| DM-E2E-3 | JSON 직렬화/역직렬화 통과 | DecodeMap을 JSON.stringify → parse 후에도 외부 decode 정상 |

---

## 2. RDB 다중 엔티티 저장/복원

> 목적: UUID PK 생성 → 저장 → 복원 전체 사이클의 정확성과 bijection 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| RDB-1 | 5개 엔티티 저장/복원 | codec.encode → serialize 5회 → 모든 PK 유일 → parse → codec.decode 5회 → 원본 entity 일치 |
| RDB-2 | 전체 space bijection (UUID) | 3×3×3=27 전체 조합 → 27개 UUID 모두 유일 + round-trip |

---

## 3. 버전 마이그레이션 (UUID PK 수준)

> 목적: 구 버전 PK → 신 버전 PK 전환 시 entity ID 보존

| ID | 항목 | 검증 내용 |
|---|---|---|
| MIG-PK-1 | v1 PK → v2 PK 마이그레이션 | parse → v1 codec.decode → v2 codec.encode → serialize → 동일 entity. UUID version 필드 변경 확인 |
| MIG-PK-2 | 신규 entity (v2 전용) | v2에만 있는 entry로 v2 codec.encode 가능, v1 codec에서는 EntryNotFoundError |
| MIG-PK-3 | batch 마이그레이션 | v1 PK 배열 → v2 PK 배열 변환. 전부 복원 가능, 모든 UUID 변경 |

---

## 4. DecodeMap + index_ref (중첩 인덱스)

> 목적: 중첩 인덱스의 DecodeMap이 kind 정보를 포함해 외부 재귀 decode 판단 가능

| ID | 항목 | 검증 내용 |
|---|---|---|
| DM-REF-1 | index_ref kind 포함 | DecodeMap.dims[i].kind = { type: "index_ref", indexId: "..." } |
| DM-REF-2 | 외부 재귀 decode | outer DecodeMap → inner DecodeMap 체이닝으로 재귀 복원 |

---

## 5. DecodeMap address 독립성

> 목적: 반환된 DecodeMap.address 변조가 후속 호출에 영향 없음 (캐시 leak 방지)

| ID | 항목 | 검증 내용 |
|---|---|---|
| DM-ISO-1 | address 변조 격리 | 첫 호출 address 변조 후 두 번째 호출의 address가 원본 유지 |

---

## 6. parse 5개 프로토콜 자동 감지

> 목적: protocol 인자 없이 모든 프로토콜이 자동 감지되어 올바른 VersionedValue 반환

| ID | 항목 | 검증 내용 |
|---|---|---|
| PARSE-AUTO-1 | colon/uri/compact/uuid 자동 감지 | 4개 프로토콜 serialize → parse(인자 없음) → 동일 VV |
| PARSE-AUTO-2 | int64 layout 자동 감지 | int64 format address에서 serialize → parse → 동일 VV |

---

## 7. 전체 프로토콜 encode → serialize → parse → decode round-trip

> 목적: 모든 프로토콜에 대해 codec.encode → serialize → parse → codec.decode round-trip 보장

| ID | 항목 | 검증 내용 |
|---|---|---|
| PK-RT-1 | 4개 프로토콜 round-trip | colon/uri/compact/layout:uuid 각각 codec.encode → reg.serialize → reg.parse → codec.decode → 동일 entity |

---

## 8. 다중 인덱스 PK 혼용

> 목적: 여러 index의 PK가 올바르게 구분되고 절대 충돌하지 않음

| ID | 항목 | 검증 내용 |
|---|---|---|
| MULTI-PK-1 | index별 PK 라우팅 | 서로 다른 index의 PK를 parse하면 올바른 indexId 반환 |
| MULTI-PK-2 | cross-index 충돌 없음 | 모든 index의 모든 PK가 유일 |
| MULTI-PK-3 | DecodeMap index 독립성 | 각 index의 DecodeMap이 해당 index의 dims만 포함 |

---

## 9. MetaCodec 독립 운용

> 목적: MetaRegistry 없이 DecodeMap만으로 MetaCodec이 완전한 encode/decode를 수행함을 보장
> 파일: `meta-codec.test.ts`

| ID | 항목 | 검증 내용 |
|---|---|---|
| CODEC-INDEP-1 | DecodeMap 직접 생성 | `new MetaCodec(decodeMap)` — MetaRegistry 미사용, encode/decode 정상 동작 |
| CODEC-INDEP-2 | JSON 전송 후 독립 decode | DecodeMap을 JSON.stringify → parse → new MetaCodec → decode → 원본 entity 일치 |
| CODEC-INDEP-3 | MetaResolver 경유 생성 | resolver.getDecodeMap() → new MetaCodec(map) → encode/decode 정상 |
| CODEC-INDEP-4 | MetaRegistry.createCodec() | reg.createCodec(indexId, versionId) → 반환된 codec으로 encode/decode 정상 |

---

## 10. MetaCodec cross-version migration

> 목적: 독립 코덱 간 decode → re-encode 패턴으로 버전 이동이 정확히 동작함을 보장
> 파일: `meta-codec.test.ts`

| ID | 항목 | 검증 내용 |
|---|---|---|
| CODEC-MIG-1 | v1 decode → v2 encode | v1 codec.decode(vv) → entity IDs → v2 codec.encode(ids) → v2 codec.decode → 동일 entity |
| CODEC-MIG-2 | v2 전용 entity | v2 codec.encode 성공, v1 codec.encode 시 EntryNotFoundError |
| CODEC-MIG-3 | dim 확장 후 이동 | v1(shape=[3]) → v2(shape=[4]). v1 entity가 v2에서도 encode 가능 |

---

## 11. MetaCodec encode/decode 기본 보증

> 목적: MetaCodec의 encode/decode가 bijection, 불변성, 에러 처리를 올바르게 수행
> 파일: `meta-codec.test.ts`

| ID | 항목 | 검증 내용 |
|---|---|---|
| CODEC-BASE-1 | encode → decode round-trip | 모든 entity 조합에 대해 codec.encode → codec.decode → 원본 일치 |
| CODEC-BASE-2 | bijection | 서로 다른 entity 조합은 서로 다른 value 생성. value 범위 [0, size-1] |
| CODEC-BASE-3 | decode 불변성 | decode/decodeValue 반환값이 Object.freeze 적용. 변조 시 TypeError |
| CODEC-BASE-4 | 미존재 entity | entries에 없는 entity ID로 encode 시 EntryNotFoundError |
| CODEC-BASE-5 | dim 누락 | 필수 dim 누락 시 ValidationError |
| CODEC-BASE-6 | indexId/versionId 불일치 | 다른 codec의 VersionedValue로 decode 시 ValidationError |
| CODEC-BASE-7 | toDecodeMap deep clone | toDecodeMap() 반환값은 독립 복사본. 원본과 공유 없음 |
| CODEC-BASE-8 | number_enum 지원 | number 타입 entity ID encode/decode 정상 동작 |

---

## 12. 주소 해석 (Address Resolution)

> 목적: `"perm:v1:1345"` 같은 주소 문자열에서 capacity / shape / refs를 즉시 복원
> 파일: `address-resolver.test.ts`

```
"perm:v1:1345"
  → prefix="perm", versionId="v1", index=1345
  → PrefixRegistry.getRecord("perm","v1")
  → capacity=2048, shape=[8,4,16,4], refs=[role:v1, action:v1, resource:v1, env:v1]
  → valid: 1345 < 2048 ✓
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| ADDR-1 | colon 주소 파싱 | `"perm:v1:1345"` → `{ prefix, versionId, index, capacity, shape, refs, valid }` 정확 |
| ADDR-2 | 유효 범위 검증 | index < capacity → valid:true, index ≥ capacity → valid:false |
| ADDR-3 | leaf 주소 | leaf prefix는 refs=[], shape=[capacity] |
| ADDR-4 | 미등록 prefix | null 반환 |
| ADDR-5 | shape 정확성 | composite의 shape = refs.map(r → r.capacity). WeightedIndex 직접 생성 가능 |

---

## 13. 디코딩 없는 주소 재사용 (Graph-DB 효율)

> 목적: `perm:v1:1345`를 leaf 값까지 디코딩하지 않고 다른 composite의 dim으로 직접 재사용
> 파일: `address-resolver.test.ts`

핵심 원칙:
- `perm:v1`의 1D 정수는 `article:v1`의 dim으로 저장 가능 (index_ref)
- DB에는 정수 `1345`만 저장 — 디코딩 없이 FK처럼 사용
- `WeightedIndex(shape).rangeFor(dim, coord)` 로 특정 dim 값의 주소 범위 계산 → DB range scan

```
article:v1 = content_type(4) × perm(2048) × lang(2)
  → capacity = 4 × 2048 × 2 = 16384

"role=editor(position 3)인 article만 찾기":
  1. perm:v1에서 role=3인 주소 범위 계산 (WeightedIndex, 디코딩 불필요)
  2. article:v1에서 perm dim이 그 범위에 속하는 주소 범위 계산
  3. DB SELECT * WHERE article_index BETWEEN X AND Y
```

| ID | 항목 | 검증 내용 |
|---|---|---|
| GRAPH-1 | perm 1D를 article dim으로 등록 | `article:v1`의 perm dim 용량 = perm:v1 capacity |
| GRAPH-2 | role dim 주소 범위 계산 | perm:v1에서 role position=3인 모든 주소의 [from,to] 범위 |
| GRAPH-3 | article에서 perm 범위 전파 | perm 범위 → article address 범위 계산 (중첩 범위) |
| GRAPH-4 | DB range scan 시뮬레이션 | article addresses BETWEEN X AND Y → 해당 role의 article만 추출 |
| GRAPH-5 | 디코딩 불필요 확인 | 전체 과정에서 entry 조회 없이 순수 address 연산만으로 필터링 |

---

## 14. PrefixRegistry DAG 관리

> 목적: composite 등록 시 refs DAG가 영속화되고, cascade / 역방향 조회가 동작함
> 파일: `prefix-registry.test.ts`

| ID | 항목 | 검증 내용 |
|---|---|---|
| DAG-1 | syncSchemaToRegistry | compileSchema → 모든 leaf + composite가 refs 포함 등록 |
| DAG-2 | getDeps | perm:v1 → role:v1, action:v1, resource:v1, env:v1 직접 의존 |
| DAG-3 | getTransitiveDeps | 중첩 composite의 모든 deps 평탄화 |
| DAG-4 | getReverseRefs | role:v1 변경 시 영향받는 composite 목록 반환 |
| DAG-5 | capacity 일관성 | composite capacity = refs capacity의 곱과 동일 |

---

## 15. 1D 엔트리 테이블 전체 조회 + 분류

> 목적: capacity 기반 full 1D 뷰에서 normal / reserved / empty를 분류하고 index-label 매핑 획득
> 파일: `table-flow.e2e.test.ts`

| ID | 항목 | 검증 내용 |
|---|---|---|
| TABLE-1 | sparse getEntries | capacity 1000, 일부만 채워진 entries — position 오름차순 반환 |
| TABLE-2 | buildFullView | capacity 크기 배열 구성. empty/reserved/normal 분류 |
| TABLE-3 | index-label 매핑 | `{ index, label }[]` — position이 WeightedIndex 좌표임을 명시 |
| TABLE-4 | label → index 역조회 | label로 1D 주소(position) 역방향 조회 |
| TABLE-5 | 범위 조회 | `getEntriesInRange(from, to)` — WeightedIndex 주소 범위로 부분 조회 |
| TABLE-6 | entry 추가 버전 불변 | 빈 position 채워도 capacity/버전 불변 |

---

## 16. 즉시 마이그레이션 (read-repair)

> 목적: DB에서 읽은 주소를 최신 버전으로 즉각 변환. "나중에 일괄" 대신 "접근할 때 바로".
> 파일: `migrate-address.test.ts`

| ID | 항목 | 검증 내용 |
|---|---|---|
| MIG-LAZY-1 | v1 → v2 즉시 마이그레이션 | migrateAddress(v1 addr, "v2") → migrated=true, entity ID 보존 |
| MIG-LAZY-2 | 이미 최신이면 skip | migrateAddress(v2 addr, "v2") → migrated=false, 원본 반환 |
| MIG-LAZY-3 | 대상 버전에 없는 entity | v2에 없는 entity → EntryNotFoundError |
| MIG-LAZY-4 | entity ID 보존 검증 | 마이그레이션 후 v2 decode → 원래 entity 일치 |
| MIG-LAZY-5 | 전체 v1 조합 마이그레이션 | 모든 v1 entity가 v2로 정확히 변환 |
| MIG-LAZY-6 | migrateValue (VV 수준) | VersionedValue → 직렬화 없이 VV 수준 변환 |
| MIG-LAZY-7 | migrateBatch 일괄 | 여러 주소 일괄 변환, 모두 v2 |
| MIG-LAZY-8 | 혼재 버전 batch | v1+v2 혼재 → v1만 마이그레이션, v2는 skip |
| MIG-LAZY-9 | original 보존 | batch 결과에 원본 주소 포함 |
