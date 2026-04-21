# 보완 전략 (증명 미포함, 설계 메모)

[← 진입점](README.md)

카탈로그 외에 weighted-index와 상호작용 가능한 전략들. 본 저장소에서는 아직 실측 증명하지 않음.

---

## Z-order / Hilbert curve

mixed-radix와 **다른 종류의 평탄화**.

- mixed-radix: lex order로 한 축 우선 (현재 weighted-index 기본)
- Z-order/Hilbert: 다차원 공간 locality 보존 — 근접 좌표끼리 주소도 가깝게 배치

### 언제

- 공간 쿼리(`WHERE role BETWEEN ... AND action BETWEEN ...`)가 잦은 경우
- 다축 범위 쿼리가 단일 축 범위보다 흔할 때

### 주의

- weighted-index는 기본적으로 mixed-radix만 제공
- Z-order 필요 시 별도 구현 (bit interleaving) 또는 PG의 `gist_trgm_ops` 같은 공간 인덱스 검토

---

## Bloom filter on addresses

관측된 주소의 존재 여부를 O(1) negative test.

```ts
if (!bloom.mayContain(address)) return null; // 확실히 없음
const row = await db.select().from(events).where(eq(events.address, address));
```

### 언제

- sparse 공간에서 "이벤트가 발생했는가?" 체크가 잦은 경우
- DB 조회 전 필터링으로 I/O 절감

### 주의

- false positive는 DB 조회로 검증 — correctness 영향 없음
- false negative는 없음 (있으면 반드시 mayContain=true)
- 주소 공간 크기에 맞는 비트 수 설계 필요

---

## Aggregates materialized view

축별 집계 precompute.

```sql
CREATE MATERIALIZED VIEW events_by_role AS
  SELECT role_id, COUNT(*) AS n FROM events GROUP BY role_id;
```

### 언제

- 실측 집계가 필요한 경우 (이론 카디널리티와 대조)
- 대시보드, 리포팅

### 주의

- weighted-index의 shape 산술은 **이론만** 제공 — 관측 집계는 MV 영역
- 갱신 정책(refresh) 설계 필수

---

## Sharding by address hash

전단사라 균등 분포 — hash 없이 `address % N`으로도 균등 샤딩.

```ts
const shardId = Number(BigInt(address) % BigInt(N_SHARDS));
```

### 언제

- 수평 분산 시 address를 샤드 키로
- encode가 결정론적이라 재샤딩 예측 가능

### 주의

- 같은 version의 address만 같이 샤딩해야 의미 보존
- 권장 샤드 키: `hash(prefixId + version) XOR (address % N)`
- version 무시하면 다른 shape의 address가 섞여 의미 오염
