# QA-SDK 로깅 벤치마크 결과

## 실행 환경
- Node.js v24, macOS, localhost (네트워크 지연 ≈ 0)
- ingest-server: InMemory store (DB 쓰기 없음)
- 순수 프로토콜 + 서버 처리 성능 측정

## 결론

### 순차 요청 (p50 지연)
| Transport | 1 record | 10 records |
|-----------|:--------:|:----------:|
| JSON string | 0.23ms | 0.16ms |
| JSON binary | 0.19ms | 0.15ms |
| QAPB | 0.16ms | 0.15ms |

**→ 순차에서는 프로토콜 차이 무의미 (0.15~0.23ms)**

### Concurrent 요청 (req/s)
| 동시성 | JSON | QAPB | 차이 |
|-------:|-----:|-----:|-----:|
| 1 | 1,424 | 1,744 | QAPB 1.2x |
| 5 | 3,258 | 5,190 | QAPB 1.6x |
| 20 | 5,399 | 9,299 | **QAPB 1.7x** |
| 50 | 8,641 | 7,319 | JSON 1.2x |

**→ 동시 5~20 요청에서 QAPB가 1.6~1.7배 빠름**
**→ 동시 50+ 요청에서는 차이 소멸 (서버 CPU 포화)**

### Batch 효과 (가장 큰 영향)
| 구성 | rec/s |
|------|------:|
| JSON 1건씩 | 6,035 |
| JSON 12건 batch | 14,951 |
| QAPB 12건 batch | 59,141 |

**→ batching이 프로토콜 선택보다 2~10배 더 중요**

## 실전 권장

```
성능 최적화 우선순위:
  1. Batching (2~10x) — 이벤트를 세션/시간 윈도우로 묶기
  2. QAPB 바이너리 (1.2~1.7x) — 동시 요청 5~20일 때 효과
  3. 프로토콜 변경 (≈1x) — 순차 요청에서는 차이 없음
```

### 가장 빠른 설정
- **브라우저**: BeaconTransport + batch (페이지 이탈 시 flush)
- **Node.js 서비스**: ProtobufTransport + 시간/건수 윈도우 batch (5초 or 50건)
- **고부하 서비스**: ProtobufTransport + concurrent 10~20 + batch 50건

## 실행
```bash
# ingest-server 시작 후
node benchmarks/logging-transport.js
```

## QaLogger 버퍼링 성능 (실제 SDK 사용)

QaLogger.log()를 연속 호출 → 내부 버퍼 → auto batch flush → Transport 전송.

| batchSize | ev/s | ms/event | HTTP 요청 수 | 비고 |
|----------:|-----:|---------:|:------------:|------|
| 1 | 3,908 | 0.256 | 200 | 매 이벤트 즉시 전송 |
| 10 | 41,137 | 0.024 | 20 | **10.5배** |
| 50 | 51,148 | 0.020 | 10 | **13배** |
| 100 | 54,335 | 0.018 | 10 | **14배** (수렴) |

### 핵심 수치
- **batchSize=1 → 50: 13배 성능 차이** (3,908 → 51,148 ev/s)
- **batchSize=50 이후 수렴** — 50~100 차이 미미
- **타이머 flush**: 30건 emit (0.7ms) → 버퍼에 쌓임 → 1초 후 자동 전송
- **이벤트 유실 없음**: flush 실패 시 buffer 재삽입

### 실전 권장 설정
```typescript
const logger = new QaLogger({
  transport: new HttpTransport({ endpoint: "http://ingest:3200/v1/ingest" }),
  batchSize: 50,          // ← 최적 (50건마다 flush)
  flushIntervalMs: 5_000, // 5초마다 타이머 flush (저트래픽 대응)
  maxBufferSize: 500,     // 버퍼 상한 (500건 = 약 10회 전송분)
  ...config,
});
```

## Codec microbench (`qa-bench-micro`)

codec·envelope hot path를 **코드 변경 전에** 재현 가능한 JSON으로 기록하는 microbench다.
위 transport 벤치마크(ingest-server 왕복, JSON vs QAPB)와 달리 네트워크·서버 없이 in-process 함수 호출만 잰다.

### 기존 벤치마크와의 경계

| 항목 | 담당 |
|------|------|
| JSON vs QAPB transport, batch·동시성 효과 | `node benchmarks/logging-transport.js`, `benchmarks/logger-buffer-test.js` (위 표) |
| prefix encode/decode, 주소 파싱, browser-codec, record 배열 JSON 직렬화 | `qa-bench-micro` |

QAPB(protobuf) 직렬화는 transport 벤치마크가 이미 다루므로 microbench에 넣지 않는다.
`envelope.json/<n>`은 transport가 아니라 record 배열의 `JSON.stringify` + `JSON.parse` 비용만 잰다.

### 실행

```bash
corepack pnpm --filter '@qa-sdk/bench...' build
node --expose-gc packages/bench/dist/micro/cli.js --cold --out benchmarks/results/codec-$(git rev-parse --short HEAD).json
```

| 옵션 | 기본값 | 설명 |
|------|-------:|------|
| `--iterations <n>` | 10000 | warm case당 측정 반복 수 (warmup 1000회 후 측정) |
| `--cold` | off | warmup 없는 cold case를 별도로 추가. warm 측정보다 먼저 전부 실행한다 |
| `--cold-iterations <n>` | 100 | cold case당 측정 반복 수 (p99 최소 표본 수) |
| `--filter <substring>` | - | case id에 substring이 포함된 case만 측정 |
| `--out <path>` | `benchmarks/results/codec-<commit>.json` | report 저장 경로 |

- **`--expose-gc` 필요**: 없으면 `heapDeltaBytesPerOp`는 `null`로 기록하고 경고한다 (0이나 추정값을 쓰지 않는다).
- `heapDeltaBytesPerOp`는 GC 타이밍 영향을 받는 **allocation 상한 추정**이다. 정확한 allocation profile은 G2에서 `--heap-prof`로 별도 측정한다.
- 표본이 100 미만이면 `p99`는 `null`이다.
- cold는 프로세스 안에서 warmup 없이 처음 실행한 측정이다. 같은 함수를 공유하는 앞선 case(예: 다른 prefix의 `encodePrefix`)가 JIT를 일부 데우므로, 프로세스 단위의 진짜 cold start와는 다르다.
- 측정 중 예외가 나면 그 case만 `skipped`로 기록하고 이유(`skipReason`)를 보존한다. 전체 실행은 멈추지 않는다.

### case 구성

전부 `DEMO_CATALOG`에서 파생한다 (prefix 개수·version 하드코딩 없음).

| case id | 내용 |
|---------|------|
| `core.encodePrefix/<prefix>@<latest>` | prefix마다 1개. 모든 dim position 0 |
| `core.decodePrefix/<prefix>@<latest>` | prefix마다 1개. suite 생성 시 1회 encode한 주소 |
| `core.parseSerializedAddress` | 대표 prefix(`service`, 없으면 첫 prefix)의 직렬화 주소 |
| `browser-codec.encode/<대표 prefix>` / `browser-codec.decode/<대표 prefix>` | `flattenForBrowser(catalog)` 결과로 각 dim 첫 값 encode/decode |
| `envelope.json/<n>` | `n` ∈ {1, logger `DEFAULT_BATCH_SIZE`} 건 record 배열 |

`envelope.json`에 logger buffer 상한(`maxBufferSize` 기본값 500)은 넣지 않았다. `@qa-sdk/logger`가 `DEFAULT_MAX_BUFFER_SIZE`를 공개 export하지 않아 suite에서 파생할 수 없고, baseline 트랙은 측정 대상 패키지를 수정하지 않기 때문이다. logger가 그 상수를 export하면 `ENVELOPE_RECORD_COUNTS`에 추가한다.

### 결과 포맷과 비교 규칙

결과는 `BenchmarkReportV1` JSON(`packages/bench/src/micro/report-schema.ts`)이며 CLI가 `validateReport`로 검증한 뒤 쓴다.
`commitSha`, node 버전, platform/arch, `cpuModel`, `cpus`, `gcExposed`, `catalogId`, `catalogDigest`를 함께 기록한다.

- **같은 `cpuModel`끼리만 수치를 비교한다.** 하드웨어가 다르면 비교하지 않는다 (CI runner와 로컬 baseline도 직접 비교 금지).
- warm과 cold case는 섞어 비교하지 않는다.
- `createdAt`은 메타데이터다. 결과 동일성 판정에 쓰지 않는다.
- `catalogDigest`는 `computeCatalogDigest(DEMO_CATALOG)`(`sha256:<64 hex>`)다. T0 머지 전에 기록된 결과(최초 baseline 포함)는 `null`이며, digest가 다른 결과끼리는 같은 catalog 측정으로 비교하지 않는다.
- 회귀 임계값은 이 트랙에서 정하지 않는다. G2 착수 판정에서 baseline 분산을 보고 정한다.

### 보관 (retention)

- `benchmarks/results/`: 로컬·CI 실행 결과. git에 커밋하지 않는다 (`.gitignore`).
- CI artifact: `bench-<sha>`, 30일 보관.
- `benchmarks/baseline/`: 최초 baseline 1건만 커밋한다. G2 착수 판정 때 1회 갱신한다.

### 최초 baseline

`benchmarks/baseline/codec-24cbafbb.json` — commit `24cbafbb`(측정 대상 코드 변경 전), Apple M3 Pro × 12, Node v24.22.1, darwin/arm64, `--expose-gc --cold`, warm 10000 / cold 100 iterations, `catalogDigest: null`.

- case 282건 = (prefix 68개 × encode·decode 2 + 주소 파싱 1 + browser-codec 2 + envelope 2) × warm·cold
- **skipped: 0건.** R-11 prefix(`build_event`, `test_event`, `pattern_anomaly`)는 layout이 없는 v1이 아니라 latest(v2)로 측정되므로 통과한다. v1 layout 결함은 이 suite의 측정 범위 밖이다.

### CI (`.github/workflows/bench.yml`)

- PR (`packages/bench/**`, `packages/core/src/catalog/**`, `packages/browser-codec/src/**` 변경 시): smoke 500 iterations. 수치로 실패하지 않으며, 실행 오류와 report 검증 실패만 실패로 본다.
- nightly(18:00 UTC)·`workflow_dispatch`: full 측정 (기본 10000 iterations).
