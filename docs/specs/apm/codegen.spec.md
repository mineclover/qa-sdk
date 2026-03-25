---
def:
  id: codegen-spec
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [observability, tier-system]
  links:
    - target: dsl-schemas-spec
      type: depends_on
    - target: address-context-spec
      type: depends_on
---

# Codegen — Protobuf + CLI 타입 공급 파이프라인

## 목적 ^purpose

Registry의 SchemaSnapshot에서 protobuf 메시지 정의와 TypeScript 타입을 자동 생성하는 CLI codegen 파이프라인을 정의한다.

## 파이프라인 개요

```
Registry Service                CLI                        SDK / gRPC
     │                           │                            │
     │  GET /schema/export       │                            │
     │◄──────────────────────────│                            │
     │  SchemaSnapshot JSON      │                            │
     │──────────────────────────►│                            │
     │                           │  codegen                   │
     │                           │  ┌──────────────┐          │
     │                           │  │ parse axes   │          │
     │                           │  │ build enums  │          │
     │                           │  │ emit .proto  │          │
     │                           │  │ emit .d.ts   │          │
     │                           │  └──────────────┘          │
     │                           │                            │
     │                           │  .proto + .d.ts            │
     │                           │───────────────────────────►│
```

---

## CLI 명령

### `qa-sdk apm schema pull`

Registry에서 SchemaSnapshot을 로컬로 가져온다.

```bash
qa-sdk apm schema pull --registry http://localhost:3100 --output ./schemas/
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--registry` | `$QA_REGISTRY_URL` | Registry 서버 URL |
| `--output` | `./schemas/` | 저장 디렉토리 |
| `--snapshot-id` | (최신) | 특정 스냅샷 ID 지정 |

**출력**: `./schemas/{snapshot-id}.json`

### `qa-sdk apm codegen`

SchemaSnapshot에서 코드를 생성한다.

```bash
# Protobuf 생성
qa-sdk apm codegen --format proto --input ./schemas/k8s-dsl-v1.json --output ./generated/

# TypeScript 생성
qa-sdk apm codegen --format ts --input ./schemas/k8s-dsl-v1.json --output ./generated/

# 두 형식 동시 생성
qa-sdk apm codegen --format proto,ts --input ./schemas/ --output ./generated/
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--format` | `ts` | 출력 형식: `proto`, `ts`, `proto,ts` |
| `--input` | `./schemas/` | 입력 SchemaSnapshot (파일 또는 디렉토리) |
| `--output` | `./generated/` | 출력 디렉토리 |
| `--package` | `qa.apm.v1` | protobuf package 이름 |

---

## Protobuf 메시지 정의

### 축 → Enum 변환

SchemaSnapshot의 각 축이 protobuf enum으로 변환된다.

```protobuf
syntax = "proto3";
package qa.apm.v1;

// Generated from k8s-dsl-v1 axis: k8s_cluster
enum K8sCluster {
  K8S_CLUSTER_UNSPECIFIED = 0;
  K8S_CLUSTER_PROD_EAST = 1;
  K8S_CLUSTER_PROD_WEST = 2;
  K8S_CLUSTER_STAGING = 3;
  K8S_CLUSTER_DEV = 4;
}

// Generated from k8s-dsl-v1 axis: k8s_workload_type
enum K8sWorkloadType {
  K8S_WORKLOAD_TYPE_UNSPECIFIED = 0;
  K8S_WORKLOAD_TYPE_DEPLOYMENT = 1;
  K8S_WORKLOAD_TYPE_STATEFULSET = 2;
  K8S_WORKLOAD_TYPE_DAEMONSET = 3;
  K8S_WORKLOAD_TYPE_JOB = 4;
  K8S_WORKLOAD_TYPE_CRONJOB = 5;
}
```

**변환 규칙:**
- axis entry → `UPPER_SNAKE_CASE` enum value
- 0번은 항상 `UNSPECIFIED` (proto3 규약)
- entry 순서 = SchemaSnapshot의 entries 배열 순서 = 1-based index (WeightedIndex EntityId 호환)

### 핵심 메시지

```protobuf
// APM 레코드 — EventRecord의 protobuf 표현
message ApmRecord {
  string log_id = 1;
  string trace_id = 2;
  string span_id = 3;
  string timestamp = 4;
  string event_key = 5;
  RecordKind record_kind = 6;

  // Span 필드
  string span_name = 7;
  string start_time = 8;
  string end_time = 9;

  // 주소 컨텍스트 (prefix_id → "prefix:generation:address")
  map<string, string> address_context = 10;

  // Metric 필드 (record_kind == METRIC)
  MetricPayload metric = 11;

  // 기존 payload (자유 형태)
  bytes payload = 20;
  string payload_format = 21;
  string payload_encoding = 22;

  // Actor
  string actor_id = 30;
  string user_id = 31;
  map<string, string> user_attributes = 32;
}

enum RecordKind {
  RECORD_KIND_UNSPECIFIED = 0;
  RECORD_KIND_LOG = 1;
  RECORD_KIND_SPAN = 2;
  RECORD_KIND_METRIC = 3;
}

message MetricPayload {
  MetricType type = 1;
  string name = 2;
  double value = 3;
  string unit = 4;
  map<string, string> labels = 5;
  repeated double buckets = 6;     // histogram 경계
  repeated double quantiles = 7;   // summary 분위수
}

enum MetricType {
  METRIC_TYPE_UNSPECIFIED = 0;
  METRIC_TYPE_COUNTER = 1;
  METRIC_TYPE_GAUGE = 2;
  METRIC_TYPE_HISTOGRAM = 3;
  METRIC_TYPE_SUMMARY = 4;
}
```

### 전송 엔벨로프

```protobuf
message ApmEnvelope {
  string transmission_id = 1;
  string sent_at = 2;

  // Owner
  string owner_type = 3;
  string owner_id = 4;

  // Source
  string service_name = 5;
  string sdk_name = 6;
  string sdk_version = 7;

  // Build
  string env = 8;
  string build_ref = 9;

  // 인프라 컨텍스트 (엔벨로프 전체 적용)
  map<string, string> infra_context = 10;

  // 레코드
  repeated ApmRecord records = 20;
}
```

---

## TypeScript 타입 생성

SchemaSnapshot에서 TypeScript 타입과 상수를 생성한다.

### SchemaSnapshot ID + Prefix 메타데이터

```typescript
// Generated from k8s-dsl-v1

/** SchemaSnapshot ID — stride를 확정한 version */
export const GENERATION = "k8s-dsl-v1" as const;

/** Composite prefix 메타데이터 — id, dims, capacity, stride, snapshotSupply */
export const PREFIXES = {
  k8s_workload_addr: {
    id: "k8s_workload_addr" as const,
    dims: ["schema_version", "k8s_cluster", "k8s_namespace", "k8s_workload_type", "k8s_service"] as const,
    capacity: [32, 32, 128, 8, 256] as const,
    stride: [8388608, 262144, 2048, 256, 1] as const,
    snapshotSupply: "axis" as const,
  },
  k8s_infra_addr: {
    id: "k8s_infra_addr" as const,
    dims: ["k8s_cluster", "k8s_node_pool", "k8s_workload_type"] as const,
    capacity: [32, 16, 8] as const,
    stride: [128, 8, 1] as const,
    snapshotSupply: "implicit" as const,
  },
} as const;
```

> prefix가 capacity/stride를 동반 저장하고, snapshotSupply가 전략을 명시한다.

### 축 상수/타입

```typescript
/** schema_version axis entries (capacity: 32) */
export const SCHEMA_VERSION = {
  S1: "s1",
} as const;
export type SchemaVersion = typeof SCHEMA_VERSION[keyof typeof SCHEMA_VERSION];

/** k8s_cluster axis entries */
export const K8S_CLUSTER = {
  PROD_EAST: "prod-east",
  PROD_WEST: "prod-west",
  STAGING: "staging",
  DEV: "dev",
} as const;
export type K8sCluster = typeof K8S_CLUSTER[keyof typeof K8S_CLUSTER];
```

### Composite 타입

```typescript
/** k8s_workload_addr composite dimensions */
export interface K8sWorkloadAddrDims {
  schema_version: SchemaVersion;
  k8s_cluster: K8sCluster;
  k8s_namespace: K8sNamespace;
  k8s_workload_type: K8sWorkloadType;
  k8s_service: K8sService;
}
```

---

## 전송 최적화

### payload_encoding 확장

```typescript
// 현재
export type PayloadEncoding = "raw" | "base64" | "gzip+base64";

// 확장
export type PayloadEncoding = "raw" | "base64" | "gzip+base64" | "protobuf";
```

### protobuf 인코딩 흐름

```
SDK                           Ingest Server
 │                               │
 │  ApmRecord                    │
 │  → protobuf encode            │
 │  → payload = binary bytes     │
 │  → payload_encoding = "protobuf"
 │  → POST /v1/ingest            │
 │──────────────────────────────►│
 │                               │  protobuf decode → EventRecord
 │                               │  → 기존 Phase 1/2 처리
```

### 크기 비교 (예상)

| 인코딩 | 100 레코드 엔벨로프 | 대비 |
|---|---|---|
| JSON (raw) | ~50 KB | 1× |
| JSON (gzip+base64) | ~8 KB | 0.16× |
| protobuf (binary) | ~15 KB | 0.30× |
| protobuf (gzip) | ~5 KB | 0.10× |

> protobuf는 gzip 없이도 JSON 대비 ~70% 절감. gzip 결합 시 최대 90% 절감.

---

## SDK 사용 예시

### 초기화 (Boot-time)

```typescript
import { createApmLogger } from "@qa-sdk/apm";
import { createBinder } from "@qa-sdk/weighted-index";

// Boot-time: schema_version + K8s Downward API 차원 고정
const k8sBinder = createBinder(codec, "k8s_workload_addr", {
  schema_version: "s1",  // 현재 스키마 마이너 버전
  k8s_cluster: process.env.K8S_CLUSTER!,
  k8s_namespace: process.env.K8S_NAMESPACE!,
});

const apm = createApmLogger({
  // generation은 GENERATION 상수로 address string 조립
  v: GENERATION,  // "k8s-dsl-v1" — stride를 확정한 version
  addressContext: {
    k8s_workload_addr: k8sBinder.resolve({
      k8s_workload_type: "deployment",
      k8s_service: "gateway",
    }),
  },
  encoding: "protobuf",
});
```

### 런타임

```typescript
// Metric 전송
apm.metric("k8s.pod.cpu_usage", 0.85, {
  type: "gauge",
  unit: "percent",
  labels: { pod: "gateway-abc123" },
});

// Log 전송
apm.info("http.request.handled", {
  path: "/api/users",
  status: 200,
  duration_ms: 42,
});

// Span 전송
const span = apm.startSpan("db.query");
// ... 작업 ...
span.end({ status: "ok" });
```

---

## 코드젠 확장 포인트

| 확장 | 설명 | 우선순위 |
|---|---|---|
| `--format json-schema` | JSON Schema 생성 (API 문서 자동화) | low |
| `--format go` | Go struct 생성 | future |
| `--watch` | SchemaSnapshot 변경 감지 → 자동 재생성 | future |
| `--validate` | 생성된 코드와 현재 스키마의 호환성 검증 | medium |
