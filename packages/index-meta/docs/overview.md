# index-meta — 프로젝트 개요

## 한 줄 요약

**구조화된 다차원 식별자 레지스트리** — n개의 카테고리 차원을 조합해 고유한 정수 식별자를 부여하고, 스키마가 변경되어도 기존 식별자를 보존하는 버전 관리 구조.

---

## 해결하는 문제

### Before

권한이나 리소스 경로를 문자열로 관리하면 변경에 취약하다.

```
shop.user : page://home:read, page://profile:read, page://profile:write
```

- 경로가 바뀌면 권한이 뿌려진 모든 곳을 찾아서 수동으로 바꿔야 한다
- 문자열 split, 정규식, 컨벤션에 의해 느슨하게 지켜지는 규칙이 2차적 제약이 된다
- codegen으로 상수를 만들어도 원본 상수의 유지 관리 문제가 남는다
- `admin`을 `pms:admin`으로 바꿔야 할 때 하드코딩된 모든 지점이 장애 포인트가 된다

### After

모든 의미 부여된 정보가 고정된 숫자로 치환된다.

```
api:v1:10 의 권한을 role:v1:1 에게 준다
```

- 이름, 경로, 라벨이 바뀌어도 숫자 식별자는 안정적으로 유지된다
- 유효 권한 검증이 숫자 인덱스 범위 체크로 단순화된다
- 스키마 변경 시 read-repair 패턴으로 마이그레이션이 자동 수행된다

---

## 핵심 메커니즘

### Mixed-Radix Positional Encoding + Versioned Schema

n개의 차원(role, action, resource 등)이 각각 entries 배열을 갖고, 각 엔티티는 1-based 좌표를 받는다. 좌표 조합은 stride 연산으로 단일 정수에 매핑된다.

```
shape = [3, 4, 5]  →  weights = [20, 5, 1]
좌표 [a, b, c]     →  주소 = 20a + 5b + c
```

이 정수가 곧 식별자이며, decode하면 원래 엔티티 조합을 복원할 수 있다.

### 버전 보존 전략

- **capacity headroom**: entries보다 큰 capacity를 선언하면, 항목을 추가해도 shape/weight가 불변. 기존 주소가 보존된다
- **append-only entries**: 한 번 부여된 좌표는 불변. 제거 대신 entryFlags로 inactive 처리
- **DimSnapshot 버전**: entries 구성이 바뀔 때 새 스냅샷을 추가. IndexVersion이 각 dim의 스냅샷을 고정
- **read-repair 마이그레이션**: 일괄 마이그레이션 없이, 읽을 때 decode(old) → encode(new)로 즉시 전환

### index_ref를 통한 DAG 구조 탐색

dim kind로 `index_ref`를 선언하면 다른 인덱스의 압축값을 엔트리로 가질 수 있다. 이를 통해 인덱스 간 참조 체인이 형성되고, `deepDecode`로 재귀 탐색하거나 `composeQuery`로 하위 조건 → 상위 범위를 계산한다.

---

## 구현된 기능

| 기능 | 설명 |
|------|------|
| **n차원 encode/decode** | 임의 개수의 차원 조합 → 단일 정수. 양방향 변환 |
| **버전 스냅샷 + 마이그레이션** | capacity headroom, append-only, read-repair 즉시 마이그레이션 |
| **DAG 탐색** | `deepDecode` (재귀 순방향), `composeQuery` (하위 조건 → 상위 범위) |
| **DecodeMap 캐싱** | MetaCodec은 DecodeMap만으로 독립 동작. 레지스트리 없이 외부 서비스에서 decode 가능 |
| **분산 설계** | PrefixRouter → D1 라우팅, DistributedStoreClient 멀티 스토어 조율 |
| **게이트 제어** | 4-state 모델(active/inactive/open/reserved), 주소별 encode/decode 허용을 O(log n)으로 판정 |
| **정책 해석** | 좌표 패턴 기반 규칙 매칭, 충돌 감지, 전략별 해석 (most-specific, priority 등) |
| **UUID 주소 표현** | layout 프로토콜로 semantic address를 UUID(128bit) 포맷으로 직렬화/파싱 |
| **런타임 entry 관리** | `applyEntryBatch`로 capacity 내 점진적 적재, `EntryFlagStore`로 상태 이력 관리 |
| **역참조 탐색** | PrefixRegistry `getReverseRefs`로 특정 leaf를 참조하는 composite 탐색 (cascade 감지) |

---

## 활용 가능성

encode/decode 구조 자체가 범용적이므로 권한 관리 외에도 다양한 도메인에 적용 가능하다.

| 활용 | 근거 |
|------|------|
| **로깅 payload 경량화** | 이벤트 속성을 정수로 압축. DecodeMap을 수신 측에서 캐싱하면 원본 복원 가능 |
| **검색 인덱싱 보조 라벨** | 순수 정수 로직이므로 Elasticsearch, ClickHouse 등의 numeric field로 직접 저장 가능 |
| **MCP/CLI DX** | 스키마가 선언적/규칙 기반이므로 품질 검사, 마이그레이션 권장, codegen 자동화에 적합 |
| **메모리 압축** | shape가 결정적이므로 ArrayBuffer 수준 패킹으로 전환 가능 |
| **Graph Engine 분화** | index_ref DAG 위에 역방향 탐색, 경로 쿼리, adjacency 캐시를 추가하면 그래프 엔진으로 확장 가능 |
| **Vocabulary 관리** | append-only + inactive 패턴 위에 토크나이저 어댑터, fuzzy matching을 추가하면 자연어 vocabulary 관리로 확장 가능 |

---

## 제약사항

| 제약 | 설명 | 대응 |
|------|------|------|
| **주소 예측 가능성** | 주소 공간이 결정적이므로 하나의 주소를 알면 같은 스키마의 다른 주소를 열거할 수 있다 | 주소는 내부 식별자로만 사용. 외부 노출 시 전송 계층에서 암호화 |
| **soft 삭제 누적** | entries는 append-only이므로 inactive 항목도 주소 공간을 영구적으로 점유한다 | inactive 비율이 높아지면 새 스냅샷으로 마이그레이션하여 compaction |
| **영구 제거 = 마이그레이션** | inactive를 완전히 제거하려면 새 스냅샷 + `indexMap` position 재매핑이 필요. in-place compaction 없음 | read-repair 패턴으로 점진적 전환. 일괄 마이그레이션 불필요 |
| **Number 정밀도 한계** | `product(shape)`이 `2^53`을 초과하면 정밀도 손실. 13 hex chars 이상에서 캡 발생 | BigInt 대안 필요 (미구현) |
