---
def:
  id: pipeline-monitoring
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  svc: ingest-server
  tags: [observability]
  links:
    - target: metrics-spec
      type: depends_on
---
# 파이프라인 자체 모니터링

## 목적 ^purpose

파이프라인 자체의 관측 메트릭. Phase 1/2 처리량, 지연, DLQ 크기, 재시도 횟수, reconstruction 성공률을 수집한다.

## 구성 ^overview

파이프라인 모니터링은 세 계층으로 구성된다.

1. **MetricsCollector** — 인메모리 카운터/게이지 레지스트리
2. **Ingest 경로 카운터** — Phase 1에서 요청/레코드 수 기록
3. **`/v1/metrics` 엔드포인트** — Prometheus text format으로 모든 메트릭 노출

소스:
- `packages/ingest-server/src/lib/metrics-collector.ts`
- `packages/ingest-server/src/routes/metrics.ts`

## MetricsCollector 인터페이스

```typescript
interface MetricsCollector {
  inc(name: string, labels?: Record<string, string>, delta?: number): void;
  getCounters(): Map<string, Map<string, number>>;
}
```

- `inc()`: 카운터 증가. 기본 delta=1. labels는 `{key: "val"}` 형태
- `getCounters()`: 전체 카운터 맵 반환. 키 구조: `name → labelString → value`
- label 직렬화: `{status="202",method="POST"}` (Prometheus 형식)

## 수집 메트릭 목록

### 카운터 (counter)

| 메트릭 이름 | labels | 설명 |
|-------------|--------|------|
| `ingest_requests_total` | `{status="202"}`, `{status="500"}` | Ingest HTTP 요청 수 (상태별) |
| `ingest_records_total` | — | 수집된 이벤트 레코드 총 수 |
| `rate_limit_rejected_total` | — | Rate limiter에 의해 거부된 요청 수 |
| `convergence_flush_total` | — | Convergence 파이프라인 flush 횟수 |
| `convergence_sessions_classified_total` | — | 패턴 분류된 세션 수 |
| `convergence_anomalies_detected_total` | — | 감지된 이상 패턴 수 |

### 게이지 (gauge)

| 메트릭 이름 | 설명 |
|-------------|------|
| `process_uptime_seconds` | 프로세스 가동 시간 (초) |
| `process_heap_used_bytes` | V8 힙 사용량 |
| `process_heap_total_bytes` | V8 힙 전체 크기 |
| `process_rss_bytes` | Resident Set Size |
| `dlq_depth` | DLQ 대기 항목 수 (-1이면 조회 실패) |
| `sse_connections_active` | 활성 SSE 스트림 연결 수 |

## `/v1/metrics` 엔드포인트

소스: `packages/ingest-server/src/routes/metrics.ts`

### 응답 형식

Prometheus text format (`text/plain; version=0.0.4; charset=utf-8`)

```
# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds gauge
process_uptime_seconds 3600

# HELP dlq_depth Current DLQ pending depth
# TYPE dlq_depth gauge
dlq_depth 5

# HELP ingest_requests_total Total ingest HTTP requests by status
# TYPE ingest_requests_total counter
ingest_requests_total{status="202"} 1500
ingest_requests_total{status="500"} 3
```

### 수집 순서

1. 프로세스 메트릭 (uptime, heap, rss)
2. DLQ depth (조회 실패 시 -1)
3. SSE 연결 수 (registry 설정 시)
4. 카운터 메트릭 (MetricsCollector에서)

## Ingest 경로 카운터 기록 시점

소스: `packages/ingest-server/src/routes/ingest.ts`

```
POST /v1/ingest
  ├── 성공 (202) → inc("ingest_requests_total", {status: "202"})
  │              → inc("ingest_records_total", {}, envelope.records.length)
  └── 실패 (500) → inc("ingest_requests_total", {status: "500"})
```

## Health 체크 엔드포인트

소스: `packages/ingest-server/src/routes/health.ts`

| 경로 | 설명 | DB 체크 |
|------|------|---------|
| `GET /health` | 전체 상태 | O (latencyMs 포함) |
| `GET /health/live` | Liveness | X (`{ ok: true }`) |
| `GET /health/ready` | Readiness | O |

DB 연결 실패 시 `503` 응답. 정상 시 `200` + `{ ok, version, uptime_seconds, db: { connected, latency_ms } }`.
