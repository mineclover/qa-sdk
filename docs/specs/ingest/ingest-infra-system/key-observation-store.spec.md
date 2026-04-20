---
def:
  id: key-observation-store
  level: leaf
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  svc: ingest-server
  tags: [observability, materialized-view]
  links:
    - target: ingest-infra-system
      type: refines
    - target: ingest-runtime-operations
      type: depends_on
---

# Key Observation Store

## 목적 ^purpose

packed_key(좌표 인코딩 결과)의 관측 빈도·시점·페이로드 요약을 영속 추적하여, 설계한 좌표 공간과 실제 관측된 좌표 공간의 gap을 파악한다.

## 구성 ^overview

- **key_observations 테이블** — packed_key 단위 관측 기록 (count, first_seen, last_seen, payload_summary, registered).
- **key_observation_prefixes 테이블** — prefix 레벨 집계 (distinct_keys, total_count).
- **Ingest-time upsert** — RecordStore.insertBatch() 성공 후 fail-open으로 observeBatch() 호출.
- **extractKeyObservations 헬퍼** — RecordInsert[]에서 addressContext 기반 KeyObservationEntry[] 추출.

## 소비처 ^consumes

| # | 소비처 | 패턴 | 핵심 쿼리 |
|---|--------|------|----------|
| UC-1 | InsightsStore | PrefixUsageInsight, CoverageInsight 대체 | `findByPrefix(prefixId)` |
| UC-2 | GateEngine 피드백 | drift 감지 (미등록 key), dead coordinate | `findUnregistered()` |
| UC-3 | Capacity Planning | prefix별 사용률 = distinct_keys / totalSpace | `prefixSummary()` + registry lookup |
| UC-4 | CLI 보고 | `dkg audit-events` 좌표 관측 현황 | `summary()`, `findByPrefix()` |
| UC-5 | 시나리오 스펙 검증 | 기대 좌표 조합 실관측 여부 | packed_key lookup |

## 스키마 ^defines

### key_observations

| 컬럼 | 타입 | 설명 |
|------|------|------|
| packed_key | TEXT PK | 인코딩된 좌표 주소 |
| prefix_id | TEXT NOT NULL | packed_key에서 추출한 prefix 식별자 |
| registered | INTEGER DEFAULT 0 | 레지스트리 등록 여부 (0=미등록, 1=등록) |
| count | INTEGER DEFAULT 1 | 관측 횟수 |
| first_seen | TEXT NOT NULL | 최초 관측 시점 (ISO-8601) |
| last_seen | TEXT NOT NULL | 최근 관측 시점 (ISO-8601) |
| payload_summary | TEXT DEFAULT '{}' | JSON: { fieldFrequency, sampleValues } |

인덱스: prefix_id, last_seen, count DESC, registered.

### key_observation_prefixes

| 컬럼 | 타입 | 설명 |
|------|------|------|
| prefix_id | TEXT PK | prefix 식별자 |
| distinct_keys | INTEGER DEFAULT 1 | 관측된 고유 좌표 수 |
| total_count | INTEGER DEFAULT 0 | 총 관측 횟수 |
| first_seen | TEXT NOT NULL | 최초 관측 시점 |
| last_seen | TEXT NOT NULL | 최근 관측 시점 |

### PayloadSummary 구조

```typescript
interface PayloadSummary {
  fieldFrequency: Record<string, number>;  // payload 필드별 누적 출현 횟수
  sampleValues: Record<string, unknown>;   // 최신 관측값 샘플 (최대 5 필드)
}
```

## 포트 인터페이스 ^method

```typescript
interface KeyObservationStore {
  observe(entry: KeyObservationEntry): Promise<void>;
  observeBatch(entries: readonly KeyObservationEntry[]): Promise<void>;
  findByPrefix(prefixId: string, opts?: { limit?: number; orderBy?: "count" | "last_seen" }): Promise<KeyObservation[]>;
  summary(): Promise<KeyObservationSummary>;
  findStale(before: string, limit?: number): Promise<KeyObservation[]>;
  findUnregistered(opts?: { limit?: number }): Promise<KeyObservation[]>;
  prefixSummary(prefixId?: string): Promise<PrefixObservationSummary[]>;
}
```

정의: `@qa-sdk/core/ports/key-observation-store.port.ts`

## 통합 지점 ^delegates

```
RecordInsert[]
  → RecordStore.insertBatch()
  → try { KeyObservationStore.observeBatch(extractKeyObservations(records, knownPrefixes)) }
    catch { logger.warn({ err }, "key observation failed — fail-open") }
```

- **fail-open 원칙**: 관측 기록 실패가 ingest 파이프라인을 절대 차단하지 않음.
- **registered 판정**: `knownPrefixes` (IngestDeps에서 주입) 기반. 없으면 전부 unregistered.
- **payloadSummary**: 기존 값을 조회하여 fieldFrequency를 누적 merge. sampleValues는 최신 값으로 갱신.

## 드라이버 구현 현황

| 드라이버 | 상태 | 파일 |
|---------|:---:|------|
| D1/SQLite | 완료 | `ingest-server/src/stores/d1-key-observation-store.ts` |
| Drizzle/PG | 미구현 | StoreSet에서 optional, D1과 동일 Drizzle ORM |
| ClickHouse | DDL만 | `ingest-server/src/stores/clickhouse-schema.sql.ts` |

## 테스트

| 대상 | 파일 | 케이스 |
|------|------|:---:|
| D1 Store | `ingest-server/src/stores/d1-stores.test.ts` | 8 |
| extractKeyObservations | `ingest-server/src/lib/extract-key-observations.test.ts` | 4 |
| fail-open 통합 | `ingest-server/src/routes/ingest.test.ts` | 1 |

검증 항목: observe 라운드트립, count 누적, batch 처리, summary 집계, stale 탐지, drift 감지, prefix 집계, orderBy, registered 판정, payload 샘플 최대 5 필드, observeBatch 실패 시 ingest 정상 진행.

## 설계 결정

- **Ingest-time upsert 선택**: 별도 배치 스케줄러 없이 항상 최신. 단일 upsert 오버헤드는 무시 수준.
- **summary() SQL 집계**: 전건 로드 대신 COUNT/SUM으로 메모리 안전 보장.
- **payloadSummary merge**: 덮어쓰기가 아닌 누적 merge로 fieldFrequency 정확도 유지.
- **findStale limit**: 기본 500건. 무제한 반환 방지.
- **2테이블 분리**: 좌표 단위(key_observations)와 prefix 집계(key_observation_prefixes)를 분리하여 쿼리 최적화. capacity planning은 prefix 테이블만 조회.
