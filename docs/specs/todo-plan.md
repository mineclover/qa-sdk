# 작업 패키지 배치 계획 (todo-plan)

> spec.todo.md의 모든 작업 항목에 대해 패키지 위치, 의존성, 산출물을 사전 정의한다.

---

## 패키지 레이아웃 전체 맵

```
packages/
  # ── Layer 0: 수학 엔진 ──────────────────────────────────
  weighted-index/              순수 수학 (encode/decode/bitmask)
  weighted-wasm/        [구현됨] Rust→WASM (batch encode/decode, bitmask u64 popcount) — 20KB, 7 Rust tests
  weighted-gpu/         [삭제됨 2026-10-29] WebGPU compute shader (encode/decode/reduce) — WGSL 3개 + GPUEncoder 클래스

  # ── Layer 1: 스키마 + 메타 ──────────────────────────────
  index-meta/                  스키마 레지스트리, 코덱, 게이트, 관계 엔진
  permission-engine/           비트마스크 권한 엔진

  # ── Layer 2: 런타임 인프라 ──────────────────────────────
  key-cache/            [신규] KeyCache 포트 + Memory/Redis/KV 어댑터
  pipeline/             [신규] Aggregator + MaterializedView + Streaming consumer

  # ── Layer 3: 서비스 ─────────────────────────────────────
  decode-service/       [완료] Hono.js — decode API (39 tests)
  gate-service/         [E-1 구현] Hono.js — gate 상태 관리 API (SQLITE_DRIVER/PATH env 분리)
  query-service/        [F-1~F-4 구현] Hono.js — 관계형 질의 + 정책 해소 API (SQLITE_DRIVER/PATH env 분리)
  ingest-server/        [구현 완료] Hono.js — 이벤트 수집 + 비동기 Worker (--mode worker, BullMQ)

  # ── Layer D: 데모/테스트 ────────────────────────────────
  demo-snapshot/               데이터 SSOT (Axis 카탈로그)
  demo-tests/                  통합 테스트 (39파일, 654 tests)
  platform-demo/               프론트엔드 시각화
  platform-demo-api/           데모 백엔드 API
```

> Unit 1 update: 계획상 `packages/task-queue-bullmq/` standalone 패키지를 고려했지만, 실제 구현은 `packages/ingest-server/src/lib/bullmq-task-queue.ts` package-local adapter로 완료했다. worker runtime은 `packages/ingest-server/src/server.ts --mode worker`가 담당한다.

---

## Tier 1 — 테스트 갭 보강

| ID | 작업 | 패키지 | 파일 위치 | 의존성 | 산출물 |
|---|---|---|---|---|---|
| B-1 | SemanticAddressBig 프로토콜 테스트 | `demo-tests` | `src/index-meta/bigint-address.test.ts` | weighted-index, index-meta | 테스트 파일 |
| B-2 | INV-9 MetaCodec 동등성 테스트 | `demo-tests` | `src/index-meta/bigint-codec-equiv.test.ts` | index-meta | 테스트 파일 |
| B-3 | MetaCodecBig.matchRanges 대형 shape | `demo-tests` | `src/index-meta/bigint-ranges.test.ts` | index-meta | 테스트 파일 |

---

## Tier 2 — 서비스 레이어

### decode-service (D-1 ~ D-4 ✅, D-5 잔여, merge-plan Phase 4 반영)

```
packages/decode-service/          [구현 완료]
  package.json                    deps: index-meta, hono, @hono/node-server, pino, zod
  tsconfig.json
  src/
    server.ts                     진입점 (@hono/node-server, graceful shutdown)
    app.ts                        D-1: createApp 팩토리 (registry-server 패턴)
    config/
      env.ts                      Zod 환경 변수 (PORT, CACHE_TTL_MS)
    lib/
      decoder-pool.ts             D-2: DecoderPool — TTL 기반 PrefixDecoder 인스턴스 풀
      errors.ts                   D-4: AppError + IndexMetaError → HTTP 매핑
      logger.ts                   Pino 로거
    middleware/
      error-handler.ts            D-4: AppError/ZodError/IndexMetaError 통합 핸들러
      request-id.ts               x-request-id 전파
    routes/
      decode.ts                   D-1: 4개 엔드포인트 + D-3: resolveDecoder 자동 감지
      health.ts                   GET /health
    schemas/
      decode.ts                   Zod 요청 스키마 (decode, batch, deep)
    app.test.ts                   39 tests
```

| ID | 파일 | 상태 | 설명 |
|---|---|---|---|
| D-1 | `routes/decode.ts`, `app.ts` | ✅ | 4개 엔드포인트, registry-server 패턴 |
| D-2 | `lib/decoder-pool.ts` | ✅ | DecoderPool (load/get/evict/clear/values, TTL 자동 만료) |
| D-3 | `routes/decode.ts` (resolveDecoder) | ✅ | 5분기: 직접조회/불완전에러/number에러/auto-detect/실패 |
| D-4 | `lib/errors.ts`, `middleware/error-handler.ts` | ✅ | IndexMetaError→AppError→HTTP, ZodError→400, 통합 포맷 |
| D-5 | 미구현 | 잔여 | PrefixDecoderBig — BigInt index decode 확장 |

> **merge-plan Phase 4 반영**: `/decode/deep` 라우트가 `PrefixDecoder.decodeDeepDetailed()`를 호출하여 unresolved ref 수집을 라이브러리에 위임. 서비스 라우트에서 `dim.kind.type === "index_ref"` 순회 제거됨.

### gate-service (E-1 ~ E-4)

```
packages/gate-service/            [E-1 구현 완료, E-2~E-4 잔여]
  package.json                    deps: index-meta, hono, @hono/node-server, pino, zod
  tsconfig.json
  vitest.config.ts
  src/
    server.ts                     진입점
    app.ts                        createApp 팩토리
    config/
      env.ts                      PORT, SQLITE_DRIVER, SQLITE_PATH
    lib/
      logger.ts                   Pino 로거
      errors.ts                   AppError + IndexMetaError 매핑
      gate-service.ts             package-local facade + optional GateEngine
    middleware/
      request-id.ts               x-request-id 전파
      error-handler.ts            AppError/ZodError/IndexMetaError 통합 처리
    routes/
      health.ts                   GET /health
      gate.ts                     6개 gate RPC 엔드포인트
    schemas/
      gate.ts                     Zod 요청 스키마
    app.test.ts                   endpoint contract tests
```

### query-service (F-1 ~ F-5)

```
packages/query-service/           [F-1~F-4 구현 완료, F-5 잔여]
  package.json                    deps: index-meta, drizzle-orm, hono, @hono/node-server, pino, zod
  tsconfig.json
  vitest.config.ts
  src/
    server.ts                     진입점
    app.ts                        createApp 팩토리
    index.ts                      public exports
    config/
      env.ts                      QUERY_DEFAULT_STRATEGY, GATE_*, SQLITE_DRIVER, SQLITE_PATH
    lib/
      logger.ts                   Pino 로거
      errors.ts                   AppError/HTTP 매핑
      rule-service.ts             규칙 CRUD + conflict preflight
      query-service.ts            MetaRegistry facade + gate-aware query
      gate-client.ts              gate-service HTTP 클라이언트
    middleware/
      request-id.ts               x-request-id 전파
      error-handler.ts            AppError/ZodError/IndexMetaError 통합 처리
    routes/
      health.ts                   GET /health
      rules.ts                    규칙 CRUD 5종
      query.ts                    질의 엔드포인트 5종
    schemas/
      policy-rule.ts              규칙 요청/쿼리 스키마
      query.ts                    질의 요청 스키마
    stores/
      policy-rule-store.ts        F-1: StoredPolicyRule 포트
      in-memory-policy-rule-store.ts
      sql-policy-rule-store.ts
      policy-rule.schema.ts       Drizzle SQLite 스키마
      policy-rule-store.test.ts   Memory/SQL contract tests (NodeSqliteDriver from index-meta)
    app.test.ts                   route integration tests
```

---

## Tier 3 — 인프라 보강

### SQL 어댑터 (H-1 ~ H-3)

기존 `index-meta` 패키지 내에 추가. 포트 인터페이스는 이미 존재, 어댑터만 신규.

| ID | 파일 위치 | 설명 |
|---|---|---|
| H-1 | `index-meta/src/adapters/sql-version-lifecycle-store.ts` | VersionLifecycleStore SQL 구현 |
| H-2 | `index-meta/src/adapters/sql-migration-store.ts` | MigrationStore SQL 구현 |
| H-3 | `index-meta/src/adapters/sql-prefix-router.ts` | PrefixRouter SQL 구현 |

### SQLite 드라이버 분리 [구현 완료]

| 드라이버 | 파일 | 백엔드 | 용도 |
|---|---|---|---|
| `NodeSqliteDriver` | `index-meta/src/adapters/node-sqlite-driver.ts` | `node:sqlite` (내장) | 로컬 개발, CI 테스트 |
| `BetterSqliteDriver` | `index-meta/src/adapters/better-sqlite-driver.ts` | `better-sqlite3` (npm) | 프로덕션 Node.js 서버 |
| `D1SqlDriver` | `index-meta/src/adapters/d1-driver.ts` | Cloudflare D1 | 엣지 |
| `createSqliteDriver()` | `index-meta/src/adapters/create-sqlite-driver.ts` | 팩토리 | `{ driver, path, schema }` 런타임 선택 |

서비스별 env: `SQLITE_DRIVER` (node\|better), `SQLITE_PATH` (gate-service.sqlite, query-service.sqlite 등)

### key-cache (I-1, I-4)

```
packages/key-cache/               [신규]
  package.json                    deps: 없음 (순수 포트). adapters에서 ioredis 등 optional
  src/
    index.ts                      export
    key-cache.ts                  I-1: KeyCache 포트 인터페이스
    adapters/
      memory.ts                   I-1: InMemoryKeyCache (Map + TTL)
      redis.ts                    I-4: RedisKeyCache (ioredis)
      cloudflare-kv.ts            I-4: CloudflareKVCache
```

```ts
// key-cache.ts — 포트 인터페이스
interface KeyCache<K = bigint, V = unknown> {
  get(key: K): Promise<V | undefined>
  set(key: K, value: V, ttlMs?: number): Promise<void>
  delete(key: K): Promise<boolean>
  has(key: K): Promise<boolean>
}
```

### pipeline (I-2, I-3, I-5, I-6)

```
packages/pipeline/                [신규]
  package.json                    deps: weighted-index, key-cache
  src/
    index.ts                      export
    aggregator.ts                 I-2: Aggregator 포트 인터페이스
    materialized-view.ts          I-3: MaterializedView 스키마 + CRUD
    streaming/
      consumer.ts                 I-5: StreamConsumer 인터페이스
      kafka-consumer.ts           I-5: Kafka 어댑터
      sse-consumer.ts             I-5: SSE 어댑터
    axis-projection.ts            I-6: 부분 decode 최적화 (특정 축만 추출)
```

```ts
// aggregator.ts — 포트 인터페이스
interface Aggregator {
  groupByKey(keys: bigint[]): Promise<Map<bigint, AggregateResult>>
  projectAxis(keys: bigint[], axisIndex: number, shape: number[]): Promise<Map<number, AggregateResult>>
}

interface AggregateResult {
  count: number
  lastSeen: number
}
```

```ts
// axis-projection.ts — 전체 decode 없이 특정 축 추출
function projectAxis(key: number, axisIndex: number, strides: number[], shape: number[]): number {
  return Math.floor(key / strides[axisIndex]) % shape[axisIndex]
}
```

---

## Tier 4 — 하드웨어 가속 + 스트리밍

### weighted-wasm (G-1, G-4) — ✅ 구현 완료

```
packages/weighted-wasm/           [구현 완료]
  Cargo.toml                     Rust 2024 edition, wasm-bindgen
  src/
    lib.rs                        6개 함수 + 7 Rust tests
  pkg/                            wasm-pack 빌드 산출물 (20KB .wasm)
  js/
    index.ts                      JS 래퍼 — initWasm() + fallback
  package.json
```

| 함수 | 설명 | 가속 원리 |
|---|---|---|
| `encodeBatch(strides, coords, dims, n)` | N건 배치 인코딩 | tight loop, no GC |
| `decodeBatch(strides, shape, addrs, dims)` | N건 배치 디코딩 | Rust 정수 나눗셈 |
| `popcountWasm(mask)` | 비트 카운트 | u64 `count_ones()` (8× throughput) |
| `maskAndWasm(a, b)` | 교집합 | u64 단위 AND |
| `maskOrWasm(a, b)` | 합집합 | u64 단위 OR |
| `masksOverlapWasm(a, b)` | 겹침 확인 | 첫 번째 일치에서 즉시 반환 |

```ts
// JS 래퍼 사용법
import { initWasm, encodeBatch, popcountWasm } from "weighted-wasm/js";
await initWasm();  // WASM 로드 (실패 시 JS fallback 자동)
```

### weighted-gpu (G-2) — ✅ 구현 완료 → 2026-10-29 삭제

```
packages/weighted-gpu/            [구현 완료]
  src/
    index.ts                      GPUEncoder 클래스 (create/destroy + 3 async 메서드)
    shaders/
      encode.wgsl                 compute shader — @workgroup_size(256)
      decode.wgsl                 compute shader — @workgroup_size(256)
      reduce.wgsl                 compute shader — atomic 카운트 집계
  package.json                    deps: @webgpu/types
  tsconfig.json
```

```ts
// 사용법
const gpu = await GPUEncoder.create([10, 7, 2]);
if (gpu) {
  const addrs = await gpu.encodeBatch(coordsBatch);  // N건 동시
  const coords = await gpu.decodeBatch(addrs);
  const counts = await gpu.reduceByKey(keys, maxKey); // group-by
  gpu.destroy();
}
```

### FPGA 인터페이스 (G-3)

FPGA는 하드웨어 종속적이므로 인터페이스만 정의하고, 구현은 하드웨어별 별도 패키지.

```
packages/weighted-index/src/
  fpga-adapter.ts                 G-3: FPGAAdapter 포트 인터페이스 (weighted-index에 추가)
```

```ts
// fpga-adapter.ts — 포트 인터페이스 (weighted-index 내)
interface FPGAAdapter {
  encodeBatch(strides: readonly number[], coords: readonly number[][]): Promise<bigint[]>
  decodeBatch(strides: readonly number[], shape: readonly number[], keys: readonly bigint[]): Promise<number[][]>
  isAvailable(): boolean
}

// 임계값 기반 분기 유틸
function createHybridEncoder(
  cpu: WeightedIndex,
  fpga: FPGAAdapter | null,
  threshold: number = 1024,
) {
  return {
    encodeBatch(coords: number[][]): Promise<number[]> {
      if (fpga?.isAvailable() && coords.length >= threshold) {
        return fpga.encodeBatch(cpu.strides, coords)
      }
      return Promise.resolve(coords.map(c => cpu.encode(c)))
    }
  }
}
```

---

## 의존성 그래프

```
Layer 0 (수학)
  weighted-index ─────────────────────────────────────────┐
  weighted-wasm ──→ weighted-index (타입)                  │
  weighted-gpu ───→ weighted-index (타입)                  │
                                                           │
Layer 1 (스키마)                                           │
  index-meta ─────→ weighted-index ◄──────────────────────┘
  permission-engine → weighted-index

Layer 2 (런타임)
  key-cache ──────→ (없음, 순수 포트)
  pipeline ───────→ weighted-index, key-cache

Layer 3 (서비스)
  decode-service ─→ index-meta, hono, pino, zod
  gate-service ───→ index-meta, key-cache
  query-service ──→ index-meta, key-cache, gate-service(client)

Layer D (데모)
  demo-snapshot ──→ (없음, 순수 데이터)
  demo-tests ─────→ demo-snapshot, index-meta, permission-engine, weighted-index
  platform-demo ──→ demo-snapshot, permission-engine, weighted-index
  platform-demo-api → demo-snapshot, index-meta
```

---

## 작업 ID → 패키지 매핑 요약

| ID | 작업 | 패키지 | 신규/기존 |
|---|---|---|---|
| B-1~B-3 | BigInt 테스트 보강 | demo-tests | 기존 |
| D-1~D-4 | decode 서비스 | decode-service | ✅ **완료** (D-5 잔여) |
| E-1~E-4 | gate 서비스 | gate-service | **신규** |
| F-1~F-5 | query 서비스 | query-service | **신규** |
| G-1, G-4 | WASM 빌드 (encode/bitmask) | weighted-wasm | ✅ **완료** (20KB, 7 Rust tests) |
| G-2 | GPU compute shader | weighted-gpu | ✅ **완료** (WGSL 3개 + GPUEncoder) |
| G-3 | FPGA 인터페이스 | weighted-index | 기존 (추가) |
| H-1~H-3 | SQL 어댑터 | index-meta | 기존 (추가) |
| I-1, I-4 | 캐시 포트 + 어댑터 | key-cache | **신규** |
| I-2, I-3, I-5, I-6 | 파이프라인 + 스트리밍 | pipeline | **신규** |

**신규 패키지 4개**: gate-service, query-service, key-cache, pipeline
**완료 패키지 3개**: decode-service, weighted-wasm, weighted-gpu
