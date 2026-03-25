---
def:
  id: gate-service-spec
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [security]
  links:
    - target: gate-engine-spec
      type: depends_on
---
# Gate Service 스펙

> 주소 상태 관리 분산 서비스 — GateEngine의 상태 계산·캐시·cascade 전파를 네트워크 경계 너머로 확장한다.

관련 스펙: [../indexing/index-meta/gate-engine.spec.md](../indexing/index-meta/gate-engine.spec.md) · [../indexing/coordinate-query.spec.md](../indexing/coordinate-query.spec.md)
참조 구현: `packages/index-meta/src/gate-engine.ts`, `invalid-ranges.ts`, `gate-aware-query.ts`, `packages/gate-service/src/lib/gate-service.ts`, `packages/gate-service/src/routes/gate.ts`
운영 흐름: `[S2]` checkGate · `[A4]` recompute (MQ 트리거) · `[A5]` gateFilterRanges — [runtime-flows.spec.md](../operations/runtime-flows.spec.md)

## 상태

implemented (`E-1`)

현재 구현 범위:

- `packages/gate-service` 패키지 스캐폴딩 완료
- 6개 RPC 엔드포인트 구현 완료
- package-local facade + in-memory 기본 store + optional GateEngine 주입 구현
- `E-2~E-4`는 planned 유지 (MQ/브로드캐스트/강한 일관성 경로 미연결)

---

## 1. 목적

### 문제

GateEngine은 단일 프로세스 내에서 주소 상태를 관리한다. 마이크로서비스 환경에서:

- 여러 서비스가 동일 주소 공간의 gate 상태를 필요로 함
- release/flag 이벤트가 한 서비스에서 발생하면 다른 서비스의 캐시가 무효화되어야 함
- composite index의 cascade 전파가 서비스 경계를 넘어야 할 수 있음

### 해법

GateEngine을 RPC 서비스로 노출하여 중앙 집중 또는 분산 캐시 관리를 제공한다.

```
Service A (encode)      Gate Service             Service B (query)
  ├── checkGate ─────→ AddressStateStore ←────── gateFilterRanges
  ├── release ────────→ recompute ──────────────→ 캐시 무효화 알림
  └── setFlag ────────→ cascadeRecompute ────→    composite 갱신
```

---

## 2. RPC 계약

### 상태 조회

현재 `POST /gate/check`, `POST /gate/classify`, `GET /gate/state/:prefix/:version`로 구현됨.

```
checkGate(prefix, versionId, address) → GateResult
  - encode/decode 가능 여부, 상태, shouldVerify 플래그

classifyAddress(prefix, versionId, address) → AddressState
  - active | inactive | open | reserved

getStateRanges(prefix, versionId) → AddressStateCacheRecord | null
  - 전체 범위 데이터 (reserved/inactive/open)
```

### 상태 계산

현재 `POST /gate/recompute`, `POST /gate/cascade-recompute`로 수동 호출 가능하다.
단, `[A4]` MQ 트리거 경로는 아직 미연결이다.

```
recompute(prefix, versionId) → void
  - 단일 prefix의 DimStateSpec 재생성 + 범위 재계산

cascadeRecompute(prefix, versionId) → void
  - leaf → composite 역참조 그래프 DFS 전파
```

### 범위 필터

현재 `POST /gate/filter-ranges`로 구현되어 query-service가 조회 경로에서 사용한다.

```
gateFilterRanges(prefix, versionId, ranges, mode) → [number, number][]
  - mode: "encodable" | "decodable" | "active"
  - 입력 범위에서 gate 차단 범위를 제거
```

### 에러 코드

| 코드 | 의미 |
|---|---|
| `NOT_FOUND` | prefix/versionId 미등록 |
| `NOT_COMPUTED` | 아직 recompute 미실행 (= 전체 active) |
| `STALE_CACHE` | shouldVerify = true (open 상태 캐시 무효 가능) |

---

## 3. 비동기 무효화

### 이벤트 트리거

| 이벤트 | 트리거 소스 | Gate Service 동작 |
|---|---|---|
| `version.released` | VersionLifecycleStore.release() | `recompute(prefix, versionId)` + cascade |
| `entry.flagChanged` | EntryFlagStore.setFlag() | flexible 모드: `recompute` + cascade; strict: no-op |
| `schema.updated` | MetaRegistry 변경 | 전체 관련 prefix recompute |

### cascade over network

composite index가 다른 서비스에 속한 경우:

1. Gate Service가 leaf prefix의 recompute 완료
2. `prefixRegistry.getReverseRefs()` → composite prefix 목록
3. composite prefix 담당 서비스에 `recompute` RPC 요청
4. 재귀적으로 전파

### Idempotency

- recompute는 멱등: 같은 (prefix, versionId)에 대해 반복 호출해도 동일 결과
- 네트워크 재시도 안전
- computedAt 타임스탬프로 중복 실행 감지 가능

---

## 4. 분산 전략

### 단일 인스턴스

```
모든 서비스 → Gate Service (단일) → AddressStateStore (DB)
```

- 가장 단순한 구성
- 적합: 소규모 배포, prefix 수십 개 이하

### 복제 (Read Replica)

```
서비스 A → Gate Service Primary ←sync→ Gate Service Replica ← 서비스 B
                    ↓                          ↓
            AddressStateStore (Primary)   AddressStateStore (Read)
```

- 쓰기(recompute)는 Primary만
- 읽기(checkGate, getStateRanges)는 Replica 분산
- 적합: 읽기 부하가 쓰기 대비 10x 이상

### 캐시 무효화 브로드캐스트

```
서비스 A (로컬 캐시) ←── 무효화 이벤트 ──→ 서비스 B (로컬 캐시)
           ↑                                    ↑
           └──── Gate Service (source of truth) ─┘
```

- 각 서비스가 AddressStateCacheRecord를 로컬 캐시
- Gate Service가 recompute 시 무효화 이벤트 브로드캐스트
- 적합: 최저 지연 요구, 네트워크 파티션 허용

---

## 5. 정합성 모델

### Eventual Consistency

Gate Service는 **최종 일관성** 모델을 채택한다.

| 시점 | 보장 |
|---|---|
| recompute 완료 직후 | Primary의 상태 정확 |
| 복제 전파 중 | Replica가 이전 상태를 반환할 수 있음 |
| 캐시 무효화 전파 중 | 로컬 캐시가 이전 상태를 사용할 수 있음 |

### shouldVerify 재확인

`GateResult.shouldVerify === true`인 경우 (open 상태):

1. 클라이언트가 open 주소에 encode 시도
2. Gate Service에 재확인 요청: `checkGate(prefix, versionId, address)`
3. 최신 상태 기반 판정

shouldVerify는 open 상태에서만 true — open은 capacity headroom이므로 새 entry 추가 시 상태가 active로 변경될 수 있다.

### 강한 일관성이 필요한 경우

encode 시점의 gate 검증은 **Primary 직접 조회**를 권장:

```
encode 요청 → checkGate(Primary) → active 확인 → encode 실행
```

decode는 최종 일관성으로 충분 (inactive 주소도 decode 가능).
