---
def:
  id: runtime-flows-spec
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: cli-contract-spec
      type: refines
    - target: codegen-spec
      type: refines
---

# 런타임 흐름 스펙

## 목적 ^purpose

운영 시나리오를 **동기 / 비동기 / 디버깅** 3개 경로로 분리하여 정의한다.
각 경로의 단계에 심볼을 부여하고, 모듈 스펙에서 cross-reference로 사용한다.

## 상태

planned

---

## 1. 흐름 심볼 체계

### 접두사 규칙

| 접두사 | 흐름 | 성격 | 정합성 |
|---|---|---|---|
| `S` | Sync | 상태 확정 | 강한 일관성 (트랜잭션) |
| `A` | Async | 이벤트 수집·집계 | 최종 일관성 |
| `D` | Debug | 실시간 관찰 | 베스트 에포트 |

### 표기법

```
[S3]           단일 단계 참여
[S2→S3]        연속 단계 처리
[A5,A7]        비연속 복수 단계
[S2→S3, A6]    복수 흐름 참여
```

스펙 문서에서 타입·함수·인터페이스 옆에 인라인으로 표기:

```markdown
### MetaCodec.encode()  [S2, A6]
### PrefixDecoder.decode()  [S5, D1]
### DecoderPool  [S2→S5]
```

---

## 2. 동기 처리 흐름 (S)

> 요청 → 상태 확정 → 응답. 정합성 보장, 즉시 성공/실패 확정.

```
Client ─→ [S1] Gateway ─→ [S2] App ─→ [S3] State ─→ [S4] DB ─→ [S5] Response
```

| 단계 | 심볼 | 컴포넌트 | 기능 | 입력 | 출력 |
|---|---|---|---|---|---|
| 진입 | **S1** | Gateway | 인증, rate limit, 라우팅 | Client Request | 내부 요청 |
| 처리 | **S2** | App / Service | 검증, encode, 로직 수행 | 내부 요청 | 처리 결과 |
| 전이 | **S3** | App | 상태 전이 결정 | 내부 상태 | DB write 요청 |
| 확정 | **S4** | Core DB | 트랜잭션 commit | write 요청 | 확정 상태 |
| 응답 | **S5** | App | 응답 생성 + 반환 | DB 결과 | Client Response |

### 현재 매핑

| 단계 | 현재 구현 | 비고 |
|---|---|---|
| S1 | Hono middleware (requestId, rateLimiter, cors) | 별도 Gateway 미분리 |
| S2 | `processEnvelope()` — validate, group by trace | ingest-server |
| S3 | trace/session upsert 결정 | |
| S4 | PostgreSQL 트랜잭션 (Drizzle) | source of truth |
| S5 | `202 Accepted` | |

---

## 3. 비동기 수집·집계 흐름 (A)

> DB commit 이후 이벤트 발행 → 버퍼링 → 집계 → 메트릭 저장.

```
[S4] DB commit
  ↓
[A1] Event 생성 ─→ [A2] Producer ─→ [A3] MQ ─→ [A4] Consumer
                                                    ├─→ [A5] Aggregator ─→ [A6] Metrics Store
                                                    └─→ [A7] Archive
```

| 단계 | 심볼 | 컴포넌트 | 기능 | 입력 | 출력 |
|---|---|---|---|---|---|
| 생성 | **A1** | App | DB commit 결과로 이벤트 구성 | 확정 상태 | event payload |
| 발행 | **A2** | MQ Producer | 이벤트 발행 | event | MQ topic |
| 버퍼 | **A3** | MQ (Kafka 등) | 저장, 버퍼링, 순서 보장 | event stream | consumer 전달 |
| 소비 | **A4** | Consumer | 이벤트 수신 | MQ event | 처리 분기 |
| 집계 | **A5** | Aggregator | transition/path/axis 계산 | event sequence | 집계 결과 |
| 저장 | **A6** | Metrics Store | 집계 결과 영속화 | metrics | 저장 |
| 보존 | **A7** | Archive | 원본 이벤트 보존 | raw event | 저장 (replay 가능) |

### 현재 매핑

| 단계 | 현재 구현 | 비고 |
|---|---|---|
| A1 | RecordStreamBroker.publish() | 인메모리, SSE/WS 전달용 |
| A2 | `TaskQueue.enqueue()` | POST /v1/ingest → Phase 1 commit 후 enqueue |
| A3 | BullMQ + Redis | retry/backoff, 순서 보장 |
| A4 | `--mode worker` (ingest-server) | reconstruction → verdict 체이닝, DLQ 연동 |
| A5 | ❌ 없음 | spec.todo §I-2 (Aggregator 인터페이스) |
| A6 | ❌ 없음 | spec.todo §I-3 (Materialized View) |
| A7 | `event_records` 테이블 (immutable) | 이미 보존 중 |

### 인덱싱 시스템 참여 지점

| 단계 | 모듈 | 역할 | 상태 |
|---|---|---|---|
| A1 | `MetaCodec.encode()` | event → packed_key (MQ message key) | 🔧 함수 완성, 흐름 미연결 |
| A5 | `matchRanges()` | 축 조건별 범위 집계 | 🔧 함수 완성, Aggregator 없음 |
| A5 | `projectAxis()` | 전체 decode 없이 특정 축 추출 | 📋 미구현 |
| A6 | `packed_key` PK | Metrics Store의 기본 키 | 📋 Metrics Store 없음 |

---

## 4. 실시간 디버깅 흐름 (D)

> 즉시성 우선. MQ를 거치지 않는 별도 경로.

```
[S2] App 실행 중
  ↓
[D1] Debug 이벤트 생성 ─→ [D2] Channel ─→ [D3] Store (optional) ─→ [D4] UI
```

| 단계 | 심볼 | 컴포넌트 | 기능 | 입력 | 출력 |
|---|---|---|---|---|---|
| 생성 | **D1** | App / Worker | debug 이벤트 구성 (verbose) | 실행 상태 | debug event |
| 전송 | **D2** | Debug Channel | 실시간 push | debug event | stream |
| 보관 | **D3** | Debug Store | TTL 기반 임시 저장 (선택) | debug event | TTL 저장 |
| 표시 | **D4** | Debug UI | 실시간 시각화 | stream | console view |

### 현재 매핑

| 단계 | 현재 구현 | 비고 |
|---|---|---|
| D1 | RecordStreamBroker.publish() | ingest 후 즉시 발행 |
| D2 | SSE (`/v1/streams/`) + WebSocket (`/v1/ws`) | 이미 작동 |
| D3 | `InMemoryDebugStore` + `/v1/debug/.../recent` | TTL 저장 + 최근 레코드 조회 |
| D4 | viz-web (이벤트 로그 + 그래프 + verdict) | 이미 작동 |

---

## 5. 집계 내부 로직

### Transition 계산 [A5]

| 단계 | 기능 |
|---|---|
| 1 | 이벤트 순서 정렬 |
| 2 | (A → B) 전이 쌍 추출 |
| 3 | count 증가 |
| 4 | duration 계산 (B.timestamp - A.timestamp) |
| 5 | window별 집계 (분/시/일) |

### Path 계산 [A5]

| 단계 | 기능 |
|---|---|
| 1 | execution 단위 이벤트 묶기 (trace_id 기준) |
| 2 | 전체 event sequence 생성 |
| 3 | path normalization (순서 보존 정규화) |
| 4 | path_id 생성 (해시) |
| 5 | count 증가 |

---

## 6. 데이터 유형별 흐름 매핑

| 데이터 유형 | 생성 심볼 | 처리 방식 | 저장 위치 | 소비 심볼 | 용도 |
|---|---|---|---|---|---|
| Core State | S3 | 동기 (트랜잭션) | Core DB | S5 | 기준 상태 |
| Raw Event | A1 | 비동기 (MQ) | Archive | A7 | 원본 보존, replay |
| Transition | A5 | 집계 | Metrics Store | A6 | 병목 분석 |
| Path | A5 | 집계 | Metrics Store | A6 | 흐름 분석 |
| Debug | D1 | 실시간 (push) | Debug Store (TTL) | D4 | 실시간 디버깅 |

---

## 7. 모듈 참여 맵

기존 모듈이 어느 흐름 단계에 관여하는지 정리.
구현 상태는 해당 심볼 경로에서 **실제로 호출되는지** 기준으로 판정.

### 상태 범례

| 마커 | 의미 |
|---|---|
| ✅ | 해당 흐름에서 실제 호출됨 |
| 🔧 | 함수 구현 완료, 해당 흐름에는 아직 연결되지 않음 |
| 📋 | 설계만 존재 (인터페이스/스펙), 구현 없음 |

### weighted-index

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `WeightedIndex.encode()` | S2, A1 | 좌표 → 1D 주소 | 🔧 | 라이브러리 완성, S2/A1 흐름에서 직접 호출하는 서비스 코드 없음 |
| `WeightedIndex.decode()` | S5, A5, D1 | 1D 주소 → 좌표 | 🔧 | PrefixDecoder 내부에서 간접 호출 |
| `calcAddressRanges()` | A5 | 축 조건 → 주소 범위 | 🔧 | A5 Aggregator 미구현 |
| `WeightedIndexBig` | S2, A1 | 대형 shape | 🔧 | BigInt 경로 라이브러리 완성 |

### weighted-wasm

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `encodeBatch()` | A1, A5 | 배치 인코딩 (WASM) | 🔧 | Rust 구현 완료, JS 래퍼 있음, 서비스 미연결 |
| `decodeBatch()` | A5 | 배치 디코딩 (WASM) | 🔧 | 동일 |
| `popcountWasm()` | A5 | 비트마스크 집계 | 🔧 | u64 popcount, 서비스 미연결 |

### weighted-gpu

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `GPUEncoder.encodeBatch()` | A1, A5 | GPU 배치 인코딩 | 🔧 | WGSL 셰이더 완성, 서비스 미연결 |
| `GPUEncoder.decodeBatch()` | A5 | GPU 배치 디코딩 | 🔧 | 동일 |
| `GPUEncoder.reduceByKey()` | A5 | GPU group-by 집계 | 🔧 | atomic 카운트 셰이더 완성 |

### index-meta

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `MetaCodec.encode()` | S2, A1 | entity → packed_key | 🔧 | 라이브러리 완성+테스트됨, ingest-server에서 호출 안 함 |
| `MetaCodec.decode()` | S5, A5, D1 | packed_key → entity | 🔧 | PrefixDecoder가 내부 위임. 직접 호출은 테스트에서만 |
| `MetaCodec.matchRanges()` | A5 | 축 조건 → 주소 범위 | 🔧 | A5 Aggregator 미구현 |
| `PrefixDecoder.decode()` | S5, D1 | 경량 decode | ✅ S5 | decode-service `POST /decode`에서 호출 |
| `MetaResolver.getDecodeMap()` | 초기화 | DecodeMap 번들 생성 | 🔧 | DecoderPool.load() 시 사용 예정, 자동 연결 미구현 |
| `GateEngine.recompute()` | A4 | 비동기 상태 재계산 | 🔧 | 함수+데코레이터 완성, MQ 트리거 없음 |
| `gateFilterRanges()` | A5 | 집계 시 유효 범위 필터 | 🔧 | A5 Aggregator 미구현 |
| `RelationalEngine.resolvePolicy()` | S2 | 정책 해소 | ✅ | query-service `POST /resolve`에서 호출 |

### decode-service

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `POST /decode` | S5, D1 | 주소 → entity 복원 | ✅ S5 | 39 tests, 운영 가능 |
| `POST /decode/batch` | A5 | 배치 decode | ✅ 엔드포인트 | A5 Aggregator가 호출하는 구조 미구현 |
| `POST /decode/deep` | D1 | index_ref 확장 | ✅ 엔드포인트 | D1 흐름에서 직접 호출 가능 |
| `GET /decode-map` | 초기화 | DecodeMap 번들 배포 | ✅ 엔드포인트 | Edge/클라이언트 배포용 |
| `DecoderPool` | S5 | decoder 인스턴스 캐시 | ✅ | TTL 기반 캐시 작동 |

### gate-service

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `checkGate()` | S2 | encode 전 유효성 확인 | ✅ | `POST /gate/check`, `POST /gate/classify`, `GET /gate/state/:prefix/:version` live |
| `recompute()` | A4 | 비동기 상태 재계산 | 🔧 | RPC 엔드포인트 구현, MQ 트리거 경로 미구현 |
| `cascadeRecompute()` | A4 | leaf → composite 전파 | 🔧 | RPC 엔드포인트 구현, MQ/네트워크 cascade 미구현 |
| `gateFilterRanges()` | A5, S5 | 유효 범위 필터 | ✅ | `POST /gate/filter-ranges`, query-service gate lookup에 연동 |

### query-service

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `POST /resolve` | S2 | 정책 해소 | ✅ | `withGate` 옵션 포함 |
| `POST /match-ranges` | A5 | 범위 질의 | ✅ | `gateMode` 옵션 포함 |
| 고급 질의 엔드포인트 | A5, S2 | cross-index/version/relation 질의 | ✅ | `/compose-query`, `/query-across-versions`, `/resolve-relation` live |
| 규칙 CRUD | S2→S4 | 정책 규칙 관리 | ✅ | PolicyRule 저장소 + conflict preflight 구현 |

### ingest-server (기존)

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| `POST /v1/ingest` | S1→S5 | 이벤트 수집 + 저장 | ✅ | Phase 1 저장 후 A2 enqueue 또는 sync fallback |
| `RecordStreamBroker` | A1, D1→D2 | 인메모리 pub/sub | ✅ | SSE/WS 전달 작동 |
| `reconstructPendingTraces()` | A4 | 그래프 재구성 | ✅ | worker job + sync fallback 둘 다 사용 |
| `computePendingVerdicts()` | A4 | verdict 계산 | ✅ | worker job + sync fallback 둘 다 사용 |
| SSE `/v1/streams/` | D2 | 실시간 스트림 | ✅ | |
| WebSocket `/v1/ws` | D2 | 시나리오 구독 | ✅ | |
| DLQ | S2/A4 에러 경로 | 실패 항목 관리 | ✅ | worker final failure 기록 + admin retry |

### viz-web (기존)

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| 이벤트 로그 | D4 | 실시간 표시 | ✅ | |
| 그래프 렌더러 | D4 | 실행 그래프 시각화 | ✅ | |
| verdict 패널 | D4 | 테스트 결과 표시 | ✅ | |

### MQ 인프라

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| MQ Producer | A2 | 이벤트 발행 | ✅ | `POST /v1/ingest` → `TaskQueue.enqueue()` |
| MQ Broker | A3 | 버퍼링 + 순서 보장 | ✅ | BullMQ + Redis queue, retry/backoff 적용 |
| MQ Consumer | A4 | 이벤트 수신 + 분기 | ✅ | `--mode worker` + reconstruction→verdict 체이닝 |

### 집계 파이프라인 (planned)

| 모듈 | 참여 심볼 | 역할 | 상태 | 비고 |
|---|---|---|---|---|
| Aggregator | A5 | transition/path 계산 | 📋 | spec.todo §I-2 |
| `projectAxis()` | A5 | 축별 부분 decode | 📋 | spec.todo §I-6, 함수 미구현 |
| Metrics Store | A6 | 집계 결과 영속화 | 📋 | spec.todo §I-3 |
| KeyCache | A5, S5 | 조회 캐시 | 📋 | spec.todo §I-1 |

---

## 8. 심볼 요약 (빠른 참조)

```
S1  Gateway         진입 보호
S2  App             핵심 처리
S3  State           상태 전이
S4  DB              트랜잭션 commit
S5  Response        응답 반환

A1  Event Create    이벤트 생성
A2  MQ Produce      발행
A3  MQ Buffer       버퍼링
A4  MQ Consume      소비
A5  Aggregate       집계
A6  Metrics Store   집계 저장
A7  Archive         원본 보존

D1  Debug Create    debug 이벤트
D2  Debug Channel   실시간 전송
D3  Debug Store     TTL 저장
D4  Debug UI        시각화
```

---

## 9. 흐름별 구현 현황 요약

| 흐름 | 단계 수 | ✅ 작동 | 🔧 함수 완성 | 📋 설계만 | 커버리지 |
|---|---|---|---|---|---|
| **S (동기)** | 5 | S1→S5 전체 | — | — | **100%** |
| **A (비동기)** | 7 | A2, A3, A4, A7 | A1, A5 (부분) | A5 (집계), A6 | **57%** |
| **D (디버깅)** | 4 | D1→D4 전체 | — | — | **100%** |

---

## 10. 도입 순서

| 순서 | Unit | 핵심 변경 | 선행 조건 |
|---|---|---|---|
| 1 | Phase 2 비동기 분리 | [S4] 이후 MQ publish, Worker 분리 | MQ 인프라 (BullMQ/Kafka) |
| 2 | 이벤트 수집 파이프라인 | [A1→A7] 전체 구현 | Unit 1 + Aggregator 설계 |
| 3 | Monitoring API | 집계 데이터 조회 전용 | Unit 2 |
| 4 | Gateway 분리 | [S1] 독립 프로세스 | 트래픽 규모에 따라 |
