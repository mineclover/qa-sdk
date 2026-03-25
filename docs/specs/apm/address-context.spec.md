---
def:
  id: address-context-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: deprecated
  tags: [observability, tier-system]
  links:
    - target: record-spec
      type: depends_on
    - target: transmission-spec
      type: depends_on
---

# Address Context — 주소 태깅 계약

## 목적 ^purpose

EventRecord와 TransmissionEnvelope에 n차원 주소 컨텍스트를 부착하는 계약을 정의한다. 기존 필드(`source.service_name`, `build.env`)를 유지하면서 인덱싱 주소 공간으로의 확장을 제공한다.

## 기존 타입 현황

### EventRecord (현재)

```typescript
interface EventRecord {
  log_id: string;
  timestamp: string;
  record_kind: RecordKind;        // "log" | "span"
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  event_key: string;
  event_version: string;
  payload_format: PayloadFormat;
  payload_encoding: PayloadEncoding;
  payload_masking_applied: boolean;
  payload_masked_fields: string[];
  payload: unknown;
  qa_session_id?: string;
  actor_id?: string;
  user_id?: string;
  user_attributes?: Record<string, string>;
}
```

### TransmissionEnvelope (현재)

```typescript
interface TransmissionEnvelope {
  transmission_id: string;
  sent_at: string;
  owner: TransmissionOwner;
  source: TransmissionSource;     // { service_name, sdk_name, sdk_version }
  runtime: TransmissionRuntime;
  build: TransmissionBuild;       // { env, build_ref?, release_version? }
  records: EventRecord[];
}
```

---

## 확장 설계

### EventRecord 확장

```typescript
interface EventRecord {
  // ... 기존 필드 유지 ...

  /**
   * n차원 주소 컨텍스트.
   * key: prefix_id (composite 또는 axis ID)
   * value: "prefix:generation:address" 형식의 인코딩된 주소 문자열
   *        generation = capacity/stride 세대, address에 schema_version 축 포함
   *
   * 예: { "k8s_workload_addr": "k8s_workload_addr:v1:17043713" }
   */
  address_context?: Record<string, string>;
}
```

### TransmissionEnvelope 확장

```typescript
interface TransmissionEnvelope {
  // ... 기존 필드 유지 ...

  /**
   * 엔벨로프 전체에 적용되는 인프라 컨텍스트.
   * SDK boot-time에 PartialBinder로 고정된 차원을 여기에 배치.
   * 개별 레코드의 address_context가 이를 override 가능.
   *
   * 예: { "k8s_workload_addr": "k8s_workload_addr:v1:17043713" }
   */
  infra_context?: Record<string, string>;
}
```

---

## 머지 규칙

Phase 1 ingest 시점에서 `enrichAddressContext` 미들웨어가 적용하는 머지 전략:

```
최종 address_context = { ...envelope.infra_context, ...record.address_context }
```

| 우선순위 | 소스 | 설명 |
|---|---|---|
| base | `envelope.infra_context` | SDK boot-time 고정. 엔벨로프 내 모든 레코드에 공통 적용 |
| override | `record.address_context` | 레코드별 개별 지정. 동일 key가 있으면 레코드 값 우선 |

### 머지 시맨틱

- **key가 infra_context에만 존재** → 그대로 사용
- **key가 address_context에만 존재** → 그대로 사용
- **key가 양쪽에 존재** → `record.address_context` 값 우선 (레코드 수준 override)
- **양쪽 모두 undefined** → address_context 없이 저장 (기존 동작 유지)

### Zero-Allocation 최적화

```typescript
// infra_context도 address_context도 없으면 skip
if (!envelope.infra_context && !record.address_context) {
  return record; // 기존 동작 그대로
}

// infra_context만 있으면 참조 공유 (복사 없음)
if (!record.address_context) {
  record.address_context = envelope.infra_context;
  return record;
}

// 양쪽 다 있으면 머지
record.address_context = { ...envelope.infra_context, ...record.address_context };
```

---

## 주소 문자열 형식

```
{prefix_id}:{v}:{1d_address}
```

| 세그먼트 | 설명 | 예시 |
|---|---|---|
| `prefix_id` | composite 또는 axis ID | `k8s_workload_addr` |
| `v` | stride를 확정한 version (기존 version ID) | `v1` |
| `1d_address` | 1D 인코딩된 정수 주소 (schema_version 축 포함) | `17043713` |

### v 세그먼트 = stride를 확정한 version

```
v1 생성 → stride 확정 → v = "v1"
v2 생성 → stride 동일 (headroom) → v = "v1" (변경 없음)
v3 생성 → stride 변경 (capacity 변경) → v = "v3"
```

기존 version ID(v1, v2, v3, ...)를 그대로 사용한다. 별도 generation ID를 만들지 않는다.

### entry snapshot 공급 방식

두 번째 세그먼트(v)가 변하지 않는 동안의 entry 변경은 **snapshotSupply 전략**에 따라 추적한다. 전략은 composite별로 설정된다. (상세: [`indexing/conventions.md §5`](../indexing/conventions.md))

| 전략 | snapshot 위치 | 주소 예시 |
|---|---|---|
| `axis` | index 안 (schema_version 첫 번째 차원) | `k8s_workload_addr:v1:17043713` (17043713에 s2 포함) |
| `envelope` | `envelope.entry_snapshot` 필드 | `git_commit_addr:v1:1337` + envelope: `{ entry_snapshot: "s2" }` |
| `context` | `address_context["prefix.snapshot"]` | `perm:v1:30` + `{ "perm.snapshot": "s2" }` |
| `implicit` | 없음 | `infra:v1:42` |

### prefix는 capacity/stride를 동반

prefix 등록 시 **capacity 배열과 stride 배열이 함께 저장**된다. v 세그먼트만으로 stride를 조회할 수 있고, stride가 있으면 index를 디코드할 수 있다.

```typescript
// registry에 저장되는 prefix 메타
{
  prefix: "k8s_workload_addr",
  v: "v1",
  dims: ["schema_version", "k8s_cluster", "k8s_namespace", "k8s_workload_type", "k8s_service"],
  capacity: [32, 32, 128, 8, 256],
  stride: [8388608, 262144, 2048, 256, 1],
  snapshotSupply: { type: "axis", capacity: 32 },
}
```

### 예시

```
k8s_workload_addr:v1:17043713  → v1 stride로 디코드 → [schema_version=s2, cluster=prod-east, ...]
git_commit_addr:v1:262145        → v1 stride로 디코드 → [repo=qa-sdk, ...]
```

### 파싱

```typescript
function parseAddressString(s: string): { prefix: string; generation: string; address: number } {
  const [prefix, generation, addr] = s.split(":");
  return { prefix, generation, address: Number(addr) };
}
```

---

## 저장 스키마

### event_records 테이블 확장

```sql
ALTER TABLE event_records
  ADD COLUMN address_context JSONB DEFAULT NULL;

-- 주소 컨텍스트 기반 필터링을 위한 GIN 인덱스
CREATE INDEX idx_event_records_address_context
  ON event_records USING GIN (address_context);

-- 특정 prefix_id 존재 여부 빠른 조회
CREATE INDEX idx_event_records_addr_keys
  ON event_records USING GIN (address_context jsonb_path_ops);
```

### 쿼리 예시

```sql
-- 특정 워크로드 주소의 모든 이벤트
SELECT * FROM event_records
WHERE address_context @> '{"k8s_workload_addr": "k8s_workload_addr:v1:42"}';

-- 특정 prefix_id가 존재하는 이벤트
SELECT * FROM event_records
WHERE address_context ? 'git_commit_addr';
```

---

## 기존 필드와의 관계

| 기존 필드 | address_context | 관계 |
|---|---|---|
| `source.service_name` | `k8s_service` 축 | 보완. service_name은 텍스트, 축은 인덱싱된 정수 |
| `build.env` | `k8s_cluster` 축 | 보완. env는 4-value enum, cluster는 세분화된 인프라 위치 |
| `event_key` | — | 직교. event_key는 이벤트 정의, address_context는 인프라 위치 |
| `trace_id` / `span_id` | — | 직교. trace context는 요청 추적, address_context는 공간 위치 |

> address_context는 기존 필드를 **대체하지 않는다**. 기존 필드는 텍스트 기반 식별에, address_context는 n차원 공간 기반 필터/집계에 사용한다.

---

## SDK 사용 패턴

### Boot-time (PartialBinder)

```typescript
import { GENERATION, PREFIXES } from "./generated/k8s-dsl-v1.js";

// schema_version + K8s Downward API 환경변수에서 차원 고정
const binder = createBinder(codec, "k8s_workload_addr", {
  schema_version: "s1",             // 현재 스키마 마이너 버전
  k8s_cluster: process.env.K8S_CLUSTER!,
  k8s_namespace: process.env.K8S_NAMESPACE!,
}, GENERATION);  // "k8s-dsl-v1" — stride를 확정한 version

// infra_context로 엔벨로프에 고정
const transport = createTransport({
  infraContext: {
    k8s_workload_addr: `${PREFIXES.k8s_workload_addr.id}:${GENERATION}:${
      binder.resolveId({
        k8s_workload_type: "deployment",
        k8s_service: "gateway",
      })
    }`,
  },
});
```

### Runtime (레코드별 override)

```typescript
// 특정 레코드에만 Git 컨텍스트 추가
logger.info("deploy.completed", {
  addressContext: {
    git_commit_addr: `git_commit_addr:${GIT_GENERATION}:${
      gitBinder.resolveId({
        git_change_type: "feat",
        git_file_scope: "ingest-server",
      })
    }`,
  },
});
```

---

## Zod 스키마 확장

```typescript
// record.ts
export const eventRecordSchema = z.object({
  // ... 기존 필드 ...
  address_context: z.record(z.string(), z.string()).optional(),
});

// envelope.ts
export const transmissionEnvelopeSchema = z.object({
  // ... 기존 필드 ...
  infra_context: z.record(z.string(), z.string()).optional(),
});
```

## 하위 호환성

- `address_context`와 `infra_context`는 모두 optional — 기존 SDK/서버 코드 변경 없이 동작
- 기존 `source`, `build` 필드는 그대로 유지
- address_context 없는 레코드는 기존과 동일하게 처리 (GIN 인덱스는 NULL 무시)
