# 스펙별 작업 필요 사항

> 2026-03-18 기준. 각 스펙의 구현 상태, 갭, 후보 작업을 정리한다.

---

## 분리 단위 적절성 판단

현재 7개 스펙 문서는 **모듈 스펙 3건 + 서비스 스펙 3건 + 인덱스 1건**으로 나뉜다.

| 구분 | 스펙 | 작업 단위로 적절? | 이유 |
|---|---|---|---|
| 모듈 | gate-engine.spec.md | ✅ 적절 | 구현 완료, 독립 모듈 경계 명확 |
| 모듈 | bigint-addressing.spec.md | ✅ 적절 | 횡단이지만 BigInt 경로가 Number와 독립 |
| 모듈 | coordinate-query.spec.md | ⚠️ 재검토 | 4개 모듈(policy/cross-index/version/relational)을 하나로 묶음. 모듈당 분리 시 병렬 작업 가능하나, 현재 규모에서는 단일 스펙이 적절 |
| 서비스 | decode-service.spec.md | ✅ 적절 | 가장 단순, 독립 배포 가능 |
| 서비스 | gate-service.spec.md | ✅ 적절 | 단독 진행 가능, decode보다 복잡도 높음 |
| 서비스 | query-service.spec.md | ⚠️ 분할 고려 | 규칙 CRUD + 질의 실행 + gate 통합이 혼재. "rule-store" vs "query-runtime"으로 분리 가능 |

**결론**: 현재 단위로 진행 가능. query-service만 구현 시점에 분할 여부 재판단.

---

## A. gate-engine.spec.md

**상태**: `implemented` — 코드·테스트·스펙 완전 일치

| 항목 | 상태 | 상세 |
|---|---|---|
| invalid-ranges 순수 함수 | ✅ 완료 | 6개 함수 전부 구현+export |
| GateEngine 클래스 | ✅ 완료 | 5개 메서드, 6개 의존성 |
| Decorator 2종 | ✅ 완료 | GateAwareVersionLifecycleStore, GateAwareEntryFlagStore |
| gate-aware-query 합성 | ✅ 완료 | gateFilterRanges, gateAwareResolve, buildDenialSpecs |
| Store 어댑터 | ✅ 완료 | Memory + SQL 모두 존재 (AddressStateStore, AddressRangeCache, EntryFlagStore) |
| 테스트 | ✅ 완료 | 24/24 시나리오 (S1-6, GA-1-8, G1-6, E1-4) |
| INV-6/7/8 | ✅ 검증됨 | |

### 작업 필요 사항: 없음

**VersionLifecycleStore SQL 어댑터 포함** — gate-service/query-service 배포 전제 해소.

---

## B. bigint-addressing.spec.md

**상태**: `implemented` — 핵심 구현 완료, 테스트 갭 존재

| 항목 | 상태 | 상세 |
|---|---|---|
| WeightedIndexBig | ✅ 완료 | encode/decode/unsafe 4종 |
| calc-big 범위 연산 | ✅ 완료 | calcWeightsBig, calcAddressRangesBig, mergeRangesBig, containsAddressBig |
| 시뮬레이션 유틸 | ✅ 완료 | simEncode/DecodeBig, simPackUUID/HexBig, maxProductBig, utilizationBig, dimMaxBig |
| SemanticAddressBig 프로토콜 | ✅ 완료 | createLayoutProtocolBig, 타입 3종, 변환 함수 2종 |
| MetaCodecBig | ✅ 완료 | encode/decode/matchRanges/decodeBatch |
| Capacity Guard | ✅ 완료 | computeShapeProductBig, fitsNumber, CapacityOverflowError, strict/non-strict |
| PrefixDecoder BigInt 거부 | ✅ 완료 | 생성 시 ValidationError |
| Number 전용 메서드 BigInt 차단 | ✅ 완료 | createCodec, getWeightedIndex, serialize, parse |

### 작업 필요 사항: ✅ 전부 완료

| # | 작업 | 상태 | 테스트 파일 |
|---|---|---|---|
| B-1 | SemanticAddressBig 프로토콜 테스트 | ✅ | `demo-tests/src/index-meta/bigint-address.test.ts` (11 tests) |
| B-2 | INV-9 MetaCodec 동등성 테스트 | ✅ | `demo-tests/src/index-meta/bigint-codec-equiv.test.ts` (9 tests) |
| B-3 | MetaCodecBig.matchRanges 대형 shape 테스트 | ✅ | `demo-tests/src/index-meta/bigint-ranges.test.ts` (12 tests) |

---

## C. coordinate-query.spec.md

**상태**: `implemented` — 코드·테스트·스펙 완전 일치

| 항목 | 상태 | 상세 |
|---|---|---|
| Pattern Lattice (❶) | ✅ 완료 | 6개 함수 (constraintContains, patternContains, patternMeet, patternJoin, patternSpecificity, coordMatchesPattern) |
| Policy Resolution (❷) | ✅ 완료 | matchRules, resolvePolicy(4전략), detectConflicts. 타입 4종 |
| Cross-Index Query (❸-A) | ✅ 완료 | composeQuery(5단계), deepDecode(재귀+visited set) |
| Version Query (❸-B) | ✅ 완료 | queryAcrossVersions, entityVersionSpan, translateConstraint |
| RelationalEngine | ✅ 완료 | 12개 facade 메서드, 2-level resolveRelation |
| 테스트 | ✅ 완료 | 1,557줄 (5개 테스트 파일) |

### 작업 필요 사항: 없음

---

## D. decode-service.spec.md

**상태**: `implemented` — 서비스 패키지 구현 완료 (39 tests)

| 항목 | 라이브러리 | 서비스 |
|---|---|---|
| PrefixDecoder (decode facade) | ✅ 277줄, 완전 | ✅ 래핑 완료 |
| MetaResolver (DecodeMap 번들) | ✅ 193줄, 완전 | ✅ (pool.load 경유) |
| AddressProtocolManager (포맷 감지) | ✅ 완전 | ✅ resolveDecoder auto-detect |
| REST 엔드포인트 4종 | — | ✅ /decode, /decode/batch, /decode/deep, /decode-map |
| DecoderPool (TTL 캐시) | — | ✅ load/get/evict/clear + TTL 자동 만료 |
| 에러 매핑 | — | ✅ IndexMetaError → AppError → HTTP |
| resolveDecoder 분기 | — | ✅ 5가지 경로 (직접/불완전/number/auto-detect/실패) |

### 완료된 작업

| # | 작업 | 상태 |
|---|---|---|
| D-1 | decode-service 패키지 스캐폴딩 | ✅ Hono.js, registry-server 패턴 |
| D-2 | DecodeMap 캐시 레이어 (DecoderPool) | ✅ TTL 기반 인스턴스 풀 |
| D-3 | 입력 자동 감지 (resolveDecoder) | ✅ string auto-detect + 불완전 파라미터 에러 |
| D-4 | 에러 응답 스키마 | ✅ AppError/ZodError/IndexMetaError 통합 핸들러 |

### 잔여 작업

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|---|---|---|---|
| D-5 | **PrefixDecoderBig** | 낮 | 중 | BigInt index decode 지원 (현재 PrefixDecoder가 거부) |

---

## E. gate-service.spec.md

**상태**: `implemented` — E-1 완료, E-2~E-4 planned

| 항목 | 라이브러리 | 서비스 |
|---|---|---|
| GateEngine (상태 계산) | ✅ 260줄, 완전 | ✅ package-local facade에서 조회/재계산 위임 |
| invalid-ranges (순수 함수) | ✅ 완전 | ✅ route contract에서 재사용 |
| AddressStateStore (영속화) | ✅ Memory + SQL | ✅ 기본 Memory store + optional engine injection |
| RPC 엔드포인트 6종 | — | ✅ `/gate/check`, `/gate/classify`, `/gate/state`, `/gate/recompute`, `/gate/cascade-recompute`, `/gate/filter-ranges` |
| 비동기 무효화 프로토콜 | — | 📋 planned (MQ 미연결) |
| 분산 전략 | — | 📋 planned |

### 작업 필요 사항

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|---|---|---|---|
| E-1 | **gate-service 패키지 스캐폴딩** | ✅ 완료 | 중 | Hono.js 앱, package-local GateService facade, 6개 RPC 엔드포인트 |
| E-2 | **이벤트 발행 인터페이스** | planned | 중 | release/flagChange 이벤트 → recompute 트리거. cascade의 네트워크 전파 기반 |
| E-3 | **캐시 무효화 브로드캐스트** | planned | 높 | 분산 환경에서 recompute 결과를 다른 서비스에 전파 |
| E-4 | **정합성 모델 구현** | planned | 중 | shouldVerify 재확인 흐름, Primary 직접 조회 경로 |

---

## F. query-service.spec.md

**상태**: `implemented` — F-1~F-4 완료, F-5 planned

| 항목 | 라이브러리 | 서비스 |
|---|---|---|
| RelationalEngine | ✅ 226줄, 완전 | ✅ query facade로 래핑 |
| PolicyResolver | ✅ 170줄, 완전 | ✅ resolve/rule conflict preflight에 사용 |
| CrossIndexQuery | ✅ 206줄, 완전 | ✅ compose-query/resolve-relation에서 사용 |
| VersionQuery | ✅ 202줄, 완전 | ✅ query-across-versions에서 사용 |
| 규칙 CRUD 5종 | — | ✅ POST/GET/PUT/DELETE `/rules` + conflict handling |
| 질의 엔드포인트 5종 | — | ✅ `/resolve`, `/match-ranges`, `/compose-query`, `/query-across-versions`, `/resolve-relation` |
| PolicyRule 영속화 | — | ✅ Memory + SQL 어댑터 |
| Gate 통합 | — | ✅ gate client + fail-open/fail-closed |

### 작업 필요 사항

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|---|---|---|---|
| F-1 | **PolicyRule 저장소 인터페이스 + 어댑터** | ✅ 완료 | 중 | StoredPolicyRule 타입, CRUD 포트, Memory + SQL 어댑터 |
| F-2 | **규칙 CRUD 엔드포인트** | ✅ 완료 | 중 | POST/GET/PUT/DELETE `/rules` + detectConflicts 사전 검증 + `force` 지원 |
| F-3 | **질의 엔드포인트** | ✅ 완료 | 중 | `/resolve`, `/match-ranges`, `/compose-query`, `/query-across-versions`, `/resolve-relation` |
| F-4 | **Gate Service 클라이언트** | ✅ 완료 | 중 | gateFilterRanges, gateAwareResolve 연동. fail-open/fail-closed 전략 |
| F-5 | **규칙 버전 마이그레이션** | planned | 높 | index version 변경 시 translateConstraint로 규칙 자동 변환 |

---

## H. 횡단 인프라 갭 (스펙 무관)

스펙에 속하지 않지만 서비스 구현 전 해결이 필요한 인프라 항목.

### SQL 어댑터 현황

| Store 인터페이스 | Memory | SQL | 영향 스펙 |
|---|---|---|---|
| VersionLifecycleStore | ✅ | ✅ | gate-service 프로덕션 전제 충족 |
| MigrationStore | ✅ | ✅ | coordinate-query version 횡단 질의 전제 충족 |
| EntryMetadataStore | ✅ | ❌ | 직접 영향 낮음 |
| PrefixRouter | ✅ | ✅ | decode-service 멀티 prefix 라우팅 전제 충족 |

### 테스트 인프라

| 항목 | 상태 | 설명 |
|---|---|---|
| demo-tests 패키지 | ✅ 완료 | 37개 테스트 파일 (583 tests) — index-meta 21개 + permission-engine 7개 + 통합 4개 + merge-contract 5개 + AXIS 반영 |
| weighted-wasm 패키지 | ✅ 완료 | Rust→WASM 20KB, 6개 함수, 7 Rust tests, JS fallback 래퍼 |
| weighted-gpu 패키지 | ✅ 완료 | WebGPU WGSL 3 shaders, GPUEncoder 클래스, GPU 미지원 시 null |
| demo-snapshot 패키지 | ✅ 완료 | AXIS 기반 5개 도메인 데이터 카탈로그 (15축) + MetaRegistry 입력 빌더 |
| index-meta 단위 테스트 | ✅ 33개 | 코어 알고리즘 유닛 테스트 패키지 내 잔류 |
| permission-engine 테스트 | ✅ 5개 | 비트마스크 엔진 유닛 테스트 패키지 내 잔류 |
| platform-demo 권한엔진 페이지 | ✅ 완료 | /perm-engine — PermissionSet v1→v2 마이그레이션 비교 시각화 |

---

## G. 하드웨어 가속 (CPU / GPU / FPGA)

**상태**: `implemented` — weighted-wasm (Rust→WASM 20KB, 7 tests), weighted-gpu (WebGPU WGSL 3 shaders)

### 현재 CPU 성능 기준 (Node.js, Apple Silicon)

| 연산 | 4D (100) | 8D (172K) | 32D (4.3B) | 특성 |
|---|---|---|---|---|
| encode | 138M ops/s (7ns) | 73M ops/s (14ns) | 24M ops/s (41ns) | O(d) 곱셈 |
| decode | 49M ops/s (20ns) | 16M ops/s (62ns) | 8.6M ops/s (116ns) | O(d) 나눗셈 |
| matchRanges | 6M ops/s (162ns) | 2.3K ops/s (426μs) | — | O(2^wildcard) 지수적 |
| bitmask popcount | ~1B ops/s | — | — | SIMD 활용 가능 |

### 연산별 가속 적합성

| 연산 | GPU | FPGA | 근거 |
|---|---|---|---|
| **batch encode** | ✅ 최적 | ✅ 최적 | 완전 병렬, 각 좌표 독립 — SIMT/파이프라인 모두 적합 |
| **batch decode** | ✅ 최적 | ✅ 최적 | 완전 병렬, 각 주소 독립 |
| **bitmask AND/OR/popcount** | ✅ 적합 | ✅ 적합 | 벡터 연산, 대형 PermissionSet에서 유리 |
| **matchRanges 확장** | ⚠️ 부분 | ⚠️ 부분 | 범위→개별주소 확장은 병렬, 범위 계산 자체는 분기 많음 |
| **aggregation (group by key)** | ✅ 적합 | ✅ 적합 | reduction 연산, GPU compute shader 적합 |
| **스키마 해석 / string lookup** | ❌ 부적합 | ❌ 부적합 | 해시맵 탐색, 분기 다수 — CPU 최적 |
| **cross-index 재귀 traversal** | ❌ 부적합 | ❌ 부적합 | 포인터 체이싱, 불규칙 메모리 접근 |
| **matchRanges 범위 계산** | ❌ 부적합 | ⚠️ 부분 | 와일드카드 조합 분기 — CPU 최적, FPGA 특수 파이프라인 가능 |

### 가속 적용 전략

```
write path (ingestion):
  event → [CPU] resolver/schema → [GPU/FPGA] batch encode → [CPU] store

read path (query):
  query → [CPU] resolver → [GPU/FPGA] batch decode → [CPU] cache/return

hot path (permission check):
  request → [CPU] encode (단건, 7ns) → [CPU] cache lookup
  → CPU 단독이 최적 (GPU 전송 오버헤드 > 연산 비용)

cold path (batch aggregation):
  stored keys → [GPU] group-by reduction → materialized view
  → 대량 데이터에서 GPU 유리
```

### 핵심 판단 기준

```
단건 연산 (< 1μs): CPU 단독 최적 (GPU/FPGA 전송 오버헤드 > 연산 비용)
배치 > 1K건:       GPU 전송 비용 상쇄 시작
배치 > 10K건:      GPU compute shader 우위
스트리밍 연속:      FPGA 파이프라인 우위 (전송 오버헤드 없음)
```

### 작업 필요 사항

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|---|---|---|---|
| G-1 | **encodeBatch / decodeBatch WASM** | ✅ 완료 | — | weighted-wasm: Rust encode_batch/decode_batch (u32, tight loop) |
| G-2 | **GPU compute shader PoC (WebGPU)** | ✅ 완료 | — | weighted-gpu: encode.wgsl, decode.wgsl, reduce.wgsl + GPUEncoder 클래스 |
| G-3 | **FPGA 인터페이스 설계** | 낮 | 높 | FPGAAdapter 인터페이스 + threshold 기반 CPU/FPGA 분기 |
| G-4 | **bitmask u64 최적화** | ✅ 완료 | — | weighted-wasm: popcountWasm, maskAndWasm, maskOrWasm, masksOverlapWasm (u64 단위) |
| G-5 | **JS vs WASM 실측 벤치마크** | 중 | 낮 | batch 1K/10K/100K 기준 JS fallback vs WASM 성능 비교 측정 |
| G-6 | **GPU vs CPU 실측 벤치마크** | 중 | 중 | batch 10K/100K 기준 WebGPU vs CPU 비교 (브라우저 환경) |

---

## I. 데이터 파이프라인 (Aggregation / Cache / Streaming)

**상태**: `planned` — 라이브러리 완성, 파이프라인 계층 없음

### 현재 구현

| 계층 | 구현 | 비고 |
|---|---|---|
| Event 수집 | platform-demo-api `POST /api/logs` | D1 insert, 데모 수준 |
| Key 기반 저장 | `svc_addr`, `perm_addr`, `evt_addr` 컬럼 | packed_key per index |
| 범위 쿼리 | `MetaCodec.matchRanges()` → `[from, to][]` | DB `BETWEEN` 매핑 가능 |
| 캐시 | `MetadataCache` (메타데이터 only) | 쿼리 결과 캐시 없음 |
| 집계 | 없음 | — |
| 스트리밍 | 없음 | — |

### 목표 구조

```
[ Event Source ] → [ Ingest API ] → [ Resolver → Encoder ] → [ Store ]
                                                                 ↓
                                                          [ Aggregation ]
                                                                 ↓
                                                       [ Materialized View ]

[ Query API ] → [ Cache L1 (in-process) ] → [ Cache L2 (Redis) ] → [ Store ]
                                                                       ↓
                                                              [ axis projection decode ]
```

### Cache 전략

| 계층 | 구현체 | Key | TTL | 용도 |
|---|---|---|---|---|
| L1 | `Map<bigint, Result>` | packed_key | 요청 수명 | hot path O(1) lookup |
| L2 | Redis / Cloudflare KV | `prefix:packed_key` | 분~시 | 서비스 간 공유 |
| L3 | Materialized View (DB) | group-by packed_key | batch 주기 | 집계 결과 영속화 |

### Aggregation 방식

| 방식 | 장점 | 단점 | 적합 케이스 |
|---|---|---|---|
| **key 기반** (`GROUP BY packed_key`) | 극고속, 인덱스 직접 활용 | 부분 축 조건 불가 | 정확한 key 매칭 |
| **axis projection** (decode → 축 추출) | 유연한 부분 집계 | decode 비용 O(d) per row | ad-hoc 분석 |
| **hybrid** (L1: key, L2: partial index) | 양쪽 장점 결합 | 구현 복잡도 | 프로덕션 권장 |

### Streaming 구조

```
event stream (Kafka/SSE)
  ↓
consumer group
  ↓
batch encoder (GPU offload 가능)
  ↓
┌──────────────────────┐
│ store (packed_key)   │
│ materialized view    │
│ cache invalidation   │
└──────────────────────┘
```

### 작업 필요 사항

| # | 작업 | 우선순위 | 난이도 | 설명 |
|---|---|---|---|---|
| I-1 | **Cache 인터페이스 + Memory 어댑터** | 높 | 낮 | `KeyCache { get(key): Result, set(key, result, ttl) }` 포트 + InMemory |
| I-2 | **Aggregation 인터페이스** | 높 | 중 | `Aggregator { groupByKey(keys), projectAxis(keys, axes) }` 포트 |
| I-3 | **Materialized View 스키마** | 중 | 중 | `{ packed_key, count, last_seen, payload_summary }` 테이블 정의 |
| I-4 | **Redis/KV 캐시 어댑터** | 중 | 중 | Cloudflare KV 또는 Redis 어댑터 |
| I-5 | **Streaming consumer PoC** | 낮 | 높 | Kafka/SSE consumer → batch encode → store 파이프라인 |
| I-6 | **axis projection 최적화** | 낮 | 중 | 부분 decode (특정 축만 추출) — 전체 decode 없이 shift/modulo로 단축 |

---

## 구현 우선순위 요약

### Tier 1 — 테스트·스펙 갭 보강 ✅ Phase 1~2 완료

**테스트 보강 (Phase 1) — +45 tests, 7건 태스크**

| 태스크 | 파일 | tests | 상태 |
|---|---|---|---|
| B-1 BigInt address | `demo-tests/.../bigint-address.test.ts` | 11 | ✅ |
| B-2 BigInt codec equiv | `demo-tests/.../bigint-codec-equiv.test.ts` | 9 | ✅ |
| B-3 BigInt ranges | `demo-tests/.../bigint-ranges.test.ts` | 12 | ✅ |
| permission-code | `demo-tests/.../permission-code.test.ts` 보강 | 9 | ✅ |
| api-payload | `index-meta/src/api-payload.test.ts` | 9 | ✅ |
| schema-sync | `index-meta/src/schema-sync.test.ts` | 7 | ✅ |
| backup | `index-meta/src/backup.test.ts` | 8 | ✅ |
| wasm-js | `weighted-wasm/js/index.test.ts` | 9 | ✅ |
| gpu-fallback | `weighted-gpu/src/index.test.ts` | 3 | ✅ |

**스펙 보강 (Phase 2) — 6건 문서, 1,953줄**

| 태스크 | 파일 | 줄 수 | 상태 |
|---|---|---|---|
| permission-engine README | `permission-engine/README.md` | 80 | ✅ |
| permission-engine core | `permission-engine/core.spec.md` | 378 | ✅ |
| permission-engine codec | `permission-engine/codec.spec.md` | 336 | ✅ |
| permission-engine resource | `permission-engine/resource.spec.md` | 477 | ✅ |
| permission-engine migration | `permission-engine/migration.spec.md` | 330 | ✅ |
| partial-binder | `weighted-index/partial-binder.spec.md` | 352 | ✅ |

**최종 게이트**: 3 build ✅ · demo-tests 37 files / 583 tests ✅ · decode-service 39 tests ✅

### Tier 2 — 서비스 레이어 (라이브러리 → 서비스 전환)

| 순서 | 서비스 | 이유 | 주요 작업 |
|---|---|---|---|
| ~~1~~ | ~~**decode-service**~~ | ~~외부 의존 없음, 가장 단순~~ | ✅ D-1~D-4 완료 |
| ~~2~~ | ~~**gate-service**~~ | ~~decode보다 복잡하나 단독 진행 가능~~ | ✅ E-1 완료, E-2~E-4 planned |
| ~~3~~ | ~~**query-service**~~ | ~~규칙 영속화 신규 구축 + gate 연동 필요~~ | ✅ F-1~F-4 완료, F-5 planned |

### Tier 3 — 인프라 보강

| ID | 작업 | 영향 |
|---|---|---|
| ~~H-1~~ | ~~VersionLifecycleStore SQL 어댑터~~ | ✅ gate-service 프로덕션 배포 전제 충족 |
| ~~H-2~~ | ~~MigrationStore SQL 어댑터~~ | ✅ query-service 버전 횡단 질의 전제 충족 |
| ~~H-3~~ | ~~PrefixRouter SQL 어댑터~~ | ✅ decode-service 멀티 prefix 전제 충족 |
| D-5 | PrefixDecoderBig | BigInt index decode 지원 확장 |
| F-5 | 규칙 버전 마이그레이션 | 운영 단계 진입 시 필요 |
| I-1 | Cache 인터페이스 + Memory 어댑터 | 서비스 레이어 성능 전제 |
| I-2 | Aggregation 인터페이스 | 분석/모니터링 전제 |

### Tier 4 — 하드웨어 가속 + 스트리밍

| ID | 작업 | 영향 |
|---|---|---|
| G-5 | JS vs WASM 실측 벤치마크 | batch 성능 비교 기준선 확보 |
| G-6 | GPU vs CPU 실측 벤치마크 | batch 10K+ 성능 검증 |
| I-3 | Materialized View 스키마 | 실시간 집계 기반 |
| I-5 | Streaming consumer PoC | 이벤트 파이프라인 확장 |
| G-3 | FPGA 인터페이스 설계 | 전용 하드웨어 가속 경로 |
