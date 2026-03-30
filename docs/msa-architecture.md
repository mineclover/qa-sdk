---
def:
  id: msa-architecture
  type: knowledge
  knowledge_kind: narrative
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [cross-scope, observability, runtime]
  links:
    - target: system-narrative
      type: refines
---
# MSA 구성도 + 백업 시나리오

## 목적 ^purpose

마이크로서비스 토폴로지, 패턴 분류(인코딩→수집→분석→제공), 전이 엔진 구조를 설명한다.


> Phase 6 멀티 카탈로그 런타임 반영
> Created: 2026-03-21

---

## 1. 서비스 토폴로지

```
                              ┌──────────────────────────────┐
                              │        API Gateway           │
                              │   (인증 · Rate Limit · TLS)  │
                              └────┬──────┬──────┬───────────┘
                                   │      │      │
            ┌──────────────────────┘      │      └──────────────────────┐
            ▼                             ▼                            ▼
  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
  │  ingest-server  │         │ registry-server  │         │registry-service │
  │   :3200 (HTTP)  │────────▶│    :3100 (HTTP)  │         │   :3300 (HTTP)  │
  │   :3200 (WS)   │         │                  │         │  SQLite / Mem   │
  │  PostgreSQL +   │         │   PostgreSQL     │         │                 │
  │  Redis (BullMQ) │         │   (Drizzle ORM)  │         │  + CatalogStore │
  └──────┬──────────┘         └──────────────────┘         └─────────────────┘
         │
         │ Task Queue (Redis)
         ▼
  ┌─────────────────┐
  │     worker       │    (ingest-server --mode worker)
  │  Phase-2 처리    │
  │  DLQ 재시도      │
  └─────────────────┘

  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
  │  decode-service  │         │  gate-service    │         │  query-service   │
  │   :3600 (HTTP)  │         │   :3400 (HTTP)  │         │   :3500 (HTTP)  │
  │   Stateless     │         │  SQLite (file)  │◀────────│  SQLite (file)  │
  │   캐시 TTL      │         │  AddressState   │         │  PolicyRule     │
  └─────────────────┘         └─────────────────┘         └─────────────────┘
```

---

## 2. 서비스별 역할

| 서비스 | 포트 | 저장소 | 역할 | 스케일링 |
|--------|------|--------|------|----------|
| **ingest-server** | 3200 | PostgreSQL + Redis | 이벤트 수집, address_context 검증, 실시간 스트림 (SSE/WS) | Horizontal (stateless HTTP + worker 분리) |
| **worker** | — | PostgreSQL + Redis | Phase-2 비동기 처리 (reconstruction, verdict), DLQ | Horizontal (concurrency 조절) |
| **registry-server** | 3100 | PostgreSQL | prefix 메타데이터, 버전 관리, Drizzle 마이그레이션 | Single primary + read replica |
| **registry-service** | 3300 | SQLite/Mem | prefix 등록, **카탈로그 CRUD**, 주소 인코딩 스키마 관리 | Horizontal (SQLite=file, Mem=stateless) |
| **decode-service** | 3600 | In-memory cache | mixed-radix decode, TTL 캐시 풀 | Horizontal (stateless) |
| **gate-service** | 3400 | SQLite (file) | 주소 상태 관리 (reserved/inactive/open), cascade 전파 | Single primary (상태 보존) |
| **query-service** | 3500 | SQLite (file) | 정책 규칙 기반 질의 (4 전략), gate-service 연동 | Horizontal (gate 위임) |

---

## 3. 데이터 흐름

### 3.1 이벤트 수집 파이프라인

```
Client (shop-web / SDK)
   │
   │  POST /v1/transmissions
   ▼
ingest-server (Phase 1)
   ├─ envelope 검증 (Zod schema)
   ├─ infra_context → record.address_context 머지
   ├─ address 건전성 체크 (parseSerializedAddress)
   ├─ registry-client → prefix 유효성 검증 (warn/strict)
   ├─ RecordStore.insertBatch()     → PostgreSQL
   ├─ TraceStore.upsert()           → PostgreSQL
   ├─ TransmissionStore.insert()    → PostgreSQL (감사)
   │
   └─ TaskQueue.enqueue(phase-two)  → Redis (BullMQ)
         │
         ▼
      worker (Phase 2)
         ├─ ScenarioSpec 매칭 → RuntimeGraph 재구성
         ├─ Verdict 판정 (constraint 검사)
         ├─ GraphStore / VerdictStore → PostgreSQL
         └─ 실패 시 DLQ → 3회 재시도
```

### 3.2 주소 인코딩/디코딩

```
CLI (qa-sdk encode/decode)
   │  parseSerializedAddress("perm:v1:42")       → 3파트
   │  parseSerializedAddress("demo:perm:v1:42")  → 4파트
   │
   ├─ encode: encodePrefixByValue(catalog, prefix, ver, dims)
   ├─ decode: decodePrefix(catalog, prefix, ver, address)
   └─ resolve: decode(old) → re-encode(latest)

Browser (shop-web / monitor.html)
   │  import { encode, decode, track } from 'viz-3d-core.js'
   └─ BrowserCodec: 3/4파트 인라인 파싱 (core 미의존)
```

### 3.3 패턴 분류 파이프라인

```
이벤트 수집 (shop-web / SDK)
   │
   │  POST /v1/transmissions
   ▼
ingest-server Phase 1 → Phase 2
   │
   │  convergence pipeline flush (threshold 100건 or timer 60초)
   ▼
sessionId별 그룹핑
   │
   ▼
classifyPattern(세션 이벤트, DEMO_PATTERN_RULES)
   │
   ├─ pattern_match prefix 인코딩
   │   (svc_ref × identification_mode × behavior_pattern × pattern_confidence)
   │
   ├─ aggregatePatternStats()
   │   → 패턴별 빈도/비율/평균 집계
   │
   ├─ detectAnomalies(currentStats, previousStats)
   │   → pattern_anomaly prefix 인코딩
   │     (svc_ref × anomaly_kind × behavior_pattern × anomaly_severity)
   │   → 감지 유형: unclassified, ratio_shift, volume_spike,
   │                new_sequence, abnormal_speed, abnormal_duration
   │
   └─ buildPatternHealthReport()
       → classificationRate, anomaliesDetected, topPatterns
   │
   ▼
DKG observation 저장
   │  OBS-PATTERN-{anomaly_kind}-{date} (날짜 단위 멱등)
   │  OBS-METRIC-{metric.id} (메트릭 관측)
   ▼
┌──────────────────────┬──────────────────────┐
│  CLI 조회            │  Prometheus 수집      │
│  qa-sdk dkg patterns │  /v1/metrics          │
│  qa-sdk dkg          │  convergence_sessions │
│    pattern-stats     │    _classified_total  │
│  qa-sdk dkg converge │  convergence_anomalies│
│    --persist         │    _detected_total    │
└──────────────────────┴──────────────────────┘
```

| 모듈 | 패키지 | 역할 |
|------|--------|------|
| `convergence-pipeline.ts` | ingest-server | Window-based 배치 처리 + 패턴 분류 |
| `pattern-classifier.ts` | spec-core | 규칙 기반 패턴 분류 (classifyPattern) |
| `pattern-anomaly.ts` | spec-core | 이상 감지 (detectAnomalies) |
| `pattern-aggregator.ts` | spec-core | 통계 집계 (aggregatePatternStats) |
| `convergence-graph-provider.ts` | ingest-server | Lazy DKG graph/catalog 초기화 |
| `convergence-scheduler.ts` | ingest-server | 주기적 강제 flush (저트래픽 대응) |

### 3.4 멀티 카탈로그 런타임 (Phase 6)

```
                   ┌─────────────────────┐
                   │  CatalogRegistry    │  (인메모리 Map)
                   │  ┌───────────────┐  │
                   │  │ "demo"        │──│──▶ DEMO_CATALOG
                   │  │ "custom-a"    │──│──▶ 사용자 카탈로그 A
                   │  │ "custom-b"    │──│──▶ 사용자 카탈로그 B
                   │  └───────────────┘  │
                   │  defaultId: "demo"  │
                   └──────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     DkgSqliteStore    DkgSqliteStore    DkgSqliteStore
     (catalog_id=      (catalog_id=      (catalog_id=
      "demo")           "custom-a")       "custom-b")
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                    단일 SQLite 파일
                  (~/.qa-sdk/state.sqlite)
```

---

## 4. 인프라 구성 (Docker Compose)

```yaml
# Layer 1: 코어 (PostgreSQL + Redis 의존)
postgres (5432)  ◀── redis (6379)
     │
     ▼
migrations (한번 실행)
     │
     ├──▶ registry-server (3100)
     │         │
     │         ▼
     └──▶ ingest-server (3200)  ──▶ worker (background)

# Layer 2: 경량 마이크로서비스 (SQLite / Stateless)
registry-service (3300)  ──  SQLite 볼륨
decode-service   (3600)  ──  Stateless
gate-service     (3400)  ──  SQLite 볼륨
     ▲
     │
query-service    (3500)  ──  SQLite 볼륨 + gate-service 연동
```

| 컨테이너 | 이미지 | 볼륨 | Health Check |
|-----------|--------|------|-------------|
| postgres | postgres:16-alpine | pgdata:/var/lib/postgresql/data | pg_isready |
| redis | redis:7-alpine | — | redis-cli ping |
| migrations | Node 22 (Dockerfile.registry-server) | — | exit 0 |
| registry-server | Node 22 (Dockerfile.registry-server) | — | curl /health/live |
| ingest-server | Node 22 (Dockerfile.ingest-server) | — | curl /health/live |
| worker | Node 22 (Dockerfile.ingest-server) | — | disabled |
| registry-service | Node 22 (Dockerfile.services) | registry-service-data:/data | curl /health/live |
| decode-service | Node 22 (Dockerfile.services) | — | curl /health |
| gate-service | Node 22 (Dockerfile.services) | gate-service-data:/data | curl /health |
| query-service | Node 22 (Dockerfile.services) | query-service-data:/data | curl /health |

### 4.1 포트 레지스트리 + 충돌 경고

모든 서비스는 시작 시 포트 충돌을 자동 감지하여 경고합니다.

| 서비스 | 기본 포트 | SSOT |
|--------|-----------|------|
| registry-server | 3100 | `packages/registry-server/src/config/env.ts` |
| ingest-server | 3200 | `packages/ingest-server/src/config/env.ts` |
| registry-service | 3300 | `packages/registry-service/src/config/env.ts` |
| gate-service | 3400 | `packages/gate-service/src/config/env.ts` |
| query-service | 3500 | `packages/query-service/src/config/env.ts` |
| decode-service | 3600 | `packages/decode-service/src/config/env.ts` |

```
# 예시: PORT=3300으로 decode-service를 시작하면
WARN  ⚠ PORT 3300 conflicts with registry-service (default: 3300). Set PORT env to avoid collision.
```

중앙 SSOT: `@qa-sdk/core` → `SERVICE_PORTS` 상수 + `detectPortConflicts()` 유틸리티.
각 서비스는 외부 의존 없이 인라인 `warnPortConflict()` 함수로 경고.

### 4.2 Graceful Shutdown

| 서비스 | 방식 | SIGTERM/SIGINT | 연결 드레이닝 | 타임아웃 |
|--------|------|---------------|-------------|---------|
| ingest-server | `installGracefulShutdown()` | ✓ | SSE + in-flight 요청 | 30s |
| registry-server | server.close → closeClient | ✓ | DB 연결 종료 | — |
| registry-service | server.close | ✓ | — | — |
| decode-service | server.close | ✓ | — | — |
| gate-service | server.close | ✓ | — | — |
| query-service | server.close | ✓ | — | — |

---

## 5. 백업 시나리오

### 5.1 PostgreSQL (registry-server + ingest-server)

가장 중요한 데이터. prefix 정의, 이벤트 레코드, 트레이스, verdict가 여기에 저장됨.

#### 일상 백업 (Daily)

```bash
# 논리적 백업 — 전체 DB dump
pg_dump -h $PG_HOST -U $PG_USER -d $PG_DB \
  --format=custom --compress=9 \
  -f /backup/qa-sdk-$(date +%Y%m%d_%H%M%S).dump

# 별도 DB가 2개인 경우 (registry + trace)
pg_dump -d $REGISTRY_DB -Fc -f /backup/registry-$(date +%F).dump
pg_dump -d $TRACE_DB    -Fc -f /backup/trace-$(date +%F).dump
```

#### WAL 연속 아카이빙 (PITR)

```bash
# postgresql.conf
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
wal_level = replica

# 복원: 특정 시점으로
recovery_target_time = '2026-03-21 14:30:00'
```

#### 복원

```bash
# 전체 복원
pg_restore -h $PG_HOST -U $PG_USER -d $PG_DB \
  --clean --if-exists /backup/qa-sdk-20260321.dump

# 테이블 단위 복원 (예: verdict만)
pg_restore -h $PG_HOST -U $PG_USER -d $PG_DB \
  --table=verdicts /backup/qa-sdk-20260321.dump
```

#### 보존 정책

| 주기 | 보존 | 대상 |
|------|------|------|
| Daily (pg_dump) | 30일 | registry DB + trace DB |
| WAL archive | 7일 | PITR용 |
| Weekly full | 90일 | 장기 보존 |
| Monthly | 1년 | 규정 준수 |

---

### 5.2 DKG SQLite (~/.qa-sdk/state.sqlite)

CLI의 DKG 그래프 + 사용량 스냅샷. 카탈로그별 격리됨.

#### 백업 방법

```bash
# 방법 1: DKG export (JSON, 카탈로그별)
qa-sdk dkg export --output /backup/dkg-demo-$(date +%F).json
qa-sdk --catalog custom.ts dkg export --output /backup/dkg-custom-$(date +%F).json

# 방법 2: SQLite 파일 복사 (전체)
cp ~/.qa-sdk/state.sqlite /backup/state-$(date +%F).sqlite

# 방법 3: sqlite3 online backup
sqlite3 ~/.qa-sdk/state.sqlite ".backup /backup/state-$(date +%F).sqlite"
```

#### 복원

```bash
# JSON import (카탈로그별, 기존 데이터에 머지)
qa-sdk dkg import /backup/dkg-demo-20260321.json

# 파일 복원 (전체)
cp /backup/state-20260321.sqlite ~/.qa-sdk/state.sqlite
```

#### 재생성

DKG bootstrap 데이터는 카탈로그에서 항상 재생성 가능:
```bash
qa-sdk dkg refresh   # bootstrap 재실행 (manual/auto 데이터는 보존)
```

---

### 5.3 gate-service / query-service SQLite

주소 상태와 정책 규칙. 서비스별 독립 파일.

```bash
# 파일 복사
cp data/gate-service.sqlite  /backup/gate-$(date +%F).sqlite
cp data/query-service.sqlite /backup/query-$(date +%F).sqlite

# 복원
cp /backup/gate-20260321.sqlite  data/gate-service.sqlite
cp /backup/query-20260321.sqlite data/query-service.sqlite
```

---

### 5.4 Redis (Task Queue)

BullMQ 작업 큐. 진행 중인 job만 존재. **백업 불필요**.

- Redis는 임시 데이터 저장소 (task queue + singleflight)
- 유실 시: worker 재시작하면 DLQ에서 재처리
- 영속 필요 시: `appendonly yes` + RDB snapshot 설정

---

### 5.5 registry-service 카탈로그 (SQLite / catalogs 테이블)

```bash
# API를 통한 백업
curl -s http://localhost:3300/catalogs | jq . > /backup/catalogs-$(date +%F).json

# 개별 카탈로그 백업
for id in $(curl -s http://localhost:3300/catalogs | jq -r '.[].id'); do
  curl -s "http://localhost:3300/catalogs/$id" > "/backup/catalog-${id}-$(date +%F).json"
done

# 복원
for f in /backup/catalog-*-20260321.json; do
  curl -X POST http://localhost:3300/catalogs \
    -H 'Content-Type: application/json' \
    -d @"$f"
done
```

---

### 5.6 자동 백업/복원 스크립트

수동 백업 절차를 자동화하는 스크립트:

```bash
# 전체 백업 (PostgreSQL + DKG + SQLite + 카탈로그 API)
./scripts/backup.sh

# 드라이런 (실제 실행 없이 대상 확인)
./scripts/backup.sh --dry-run

# 복원 (최신 백업 자동 감지)
./scripts/restore.sh

# 특정 날짜 복원
./scripts/restore.sh --date 20260321

# 백업 무결성 검증
./scripts/backup-verify.sh
```

**Docker Compose에서 cron 기반 자동 백업:**

```bash
# backup 프로필 활성화 (매일 02:00 실행)
docker compose --profile backup up -d backup

# 커스텀 스케줄
BACKUP_CRON_SCHEDULE="0 */6 * * *" docker compose --profile backup up -d backup
```

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| `BACKUP_DIR` | `/backup` | 백업 저장 디렉토리 |
| `BACKUP_RETENTION_DAILY` | `30` | Daily 백업 보존 일수 |
| `BACKUP_RETENTION_WEEKLY` | `90` | Weekly 백업 보존 일수 |
| `BACKUP_MAX_AGE_HOURS` | `24` | verify 스크립트 age 경고 임계값 |
| `BACKUP_CRON_SCHEDULE` | `0 2 * * *` | Docker backup 서비스 cron 스케줄 |

### 5.7 DKG decisions 백업

DKG decisions export/import 흐름:

```
qa-sdk dkg export
   │
   ├─ DkgSqliteStore.getAllNodes(catalogId)
   ├─ DkgSqliteStore.getAllEdges(catalogId)
   └─ DkgSqliteStore.getUsageSnapshots(catalogId)
   │
   ▼
JSON 파일 (노드 + 엣지 + 스냅샷)
   │
   ▼
qa-sdk dkg import <file.json>
   │
   ├─ DkgSqliteStore.upsertNode()   (기존 데이터에 머지)
   ├─ DkgSqliteStore.upsertEdge()
   └─ DkgSqliteStore.saveUsageSnapshot()
```

- bootstrap 데이터는 `qa-sdk dkg refresh`로 항상 재생성 가능
- manual/auto 데이터는 재생성 불가 → 정기 백업 필수
- `--catalog` 옵션으로 카탈로그별 독립 export/import

---

### 5.8 재해 복구 (DR) 시나리오

#### 시나리오 A: 단일 서비스 장애

| 장애 서비스 | 영향 | 복구 |
|-------------|------|------|
| ingest-server | 이벤트 수집 중단. 클라이언트 retry 필요 | 컨테이너 재시작. Redis job 자동 재처리 |
| worker | Phase-2 처리 지연. DLQ 누적 | 컨테이너 재시작. DLQ 자동 재시도 |
| registry-server | prefix 등록/조회 불가. ingest validation 실패 | 컨테이너 재시작. DB는 postgres 볼륨에 보존 |
| decode-service | decode 불가. 캐시 유실 | 컨테이너 재시작. Stateless이므로 즉시 복구 |
| gate-service | 주소 상태 확인 불가. query-service fail-open | 컨테이너 재시작 + SQLite 파일 보존 확인 |

#### 시나리오 B: PostgreSQL 장애

```bash
# 1. 서비스 중단 알림
# 2. 최신 pg_dump 복원
pg_restore -h $NEW_PG -U $PG_USER -d $PG_DB --clean /backup/latest.dump

# 3. WAL 적용 (PITR)
# 4. 서비스 재시작 (DATABASE_URL 업데이트)
# 5. ingest-server validation-mode=warn 일시 전환 (registry 캐시 warm-up)
```

#### 시나리오 C: 전체 노드 손실

```bash
# 1. 새 Docker Compose 환경 프로비저닝
docker compose up -d postgres redis

# 2. PostgreSQL 복원
pg_restore ... /backup/latest.dump

# 3. 마이그레이션 (새 테이블이 있을 수 있음)
docker compose up migrations

# 4. SQLite 파일 복원
cp /backup/gate-latest.sqlite data/gate-service.sqlite
cp /backup/query-latest.sqlite data/query-service.sqlite

# 5. 서비스 시작
docker compose up -d

# 6. DKG 복원 (필요시)
qa-sdk dkg import /backup/dkg-demo-latest.json

# 7. 카탈로그 복원 (필요시)
for f in /backup/catalog-*.json; do
  curl -X POST http://localhost:3300/catalogs -H 'Content-Type: application/json' -d @"$f"
done
```

---

## 6. 데이터 분류 및 백업 우선순위

| 우선순위 | 데이터 | 위치 | 재생성 | 백업 주기 |
|----------|--------|------|--------|-----------|
| **P0** | 이벤트 레코드 + 트레이스 | PostgreSQL (trace DB) | 불가 | Daily + WAL |
| **P0** | prefix 정의 + 버전 히스토리 | PostgreSQL (registry DB) | 불가 | Daily + WAL |
| **P1** | DKG manual/auto 기록 | SQLite (state.sqlite) | manual 불가, auto 재생성 가능 | Daily JSON export |
| **P1** | gate 주소 상태 | SQLite (gate-service.sqlite) | 부분 재생성 가능 | Daily 파일 복사 |
| **P2** | query 정책 규칙 | SQLite (query-service.sqlite) | 코드에서 재생성 가능 | Weekly |
| **P2** | 카탈로그 데이터 | registry-service SQLite | 소스 코드에서 재생성 가능 | Weekly API 백업 |
| **P3** | DKG bootstrap 데이터 | SQLite (state.sqlite) | `dkg refresh`로 재생성 | 백업 불필요 |
| **P3** | Redis task queue | Redis | 재시작 시 DLQ 재처리 | 백업 불필요 |
| **P3** | decode 캐시 | In-memory | Stateless, 자동 리빌드 | 백업 불필요 |

---

## 7. 모니터링 포인트

```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  Health Check │     │  Prometheus Metrics  │     │  Alerts      │
├──────────────┤     ├──────────────────────┤     ├──────────────┤
│ GET /health  │     │ GET /v1/metrics      │     │ DLQ > 100    │
│ GET /health  │     │   (ingest-server)    │     │ 5xx > 1%     │
│   /live      │     │ GET /metrics         │     │ classif <80% │
│              │     │   (registry-service) │     │ service down │
│ pg_isready   │     │                      │     │ RSS > 512MB  │
│ redis ping   │     │ Grafana :3000        │     │              │
└──────────────┘     └──────────────────────┘     └──────────────┘
```

| 지표 | 임계값 | 대응 |
|------|--------|------|
| DLQ depth | > 100 | worker 스케일아웃 또는 근본 원인 조사 |
| Worker processing lag | > 30s | concurrency 증가 또는 인스턴스 추가 |
| PostgreSQL connection pool | > 80% | pool size 증가 또는 쿼리 최적화 |
| ingest-server 5xx rate | > 1% | 로그 확인, DB 연결 점검 |
| Redis memory | > 80% | maxmemory-policy 확인, job TTL 조정 |
| address health rate | < 95% | 카탈로그 버전 불일치 조사 |

---

## 8. 확장 시나리오

### 8.1 수평 확장

```
                    Load Balancer
                    ┌─────┐
                    │ LB  │
                    └──┬──┘
           ┌──────────┼──────────┐
           ▼          ▼          ▼
     ingest-1    ingest-2    ingest-3     (Stateless HTTP)
           │          │          │
           └──────────┼──────────┘
                      ▼
                  PostgreSQL              (Shared state)
                      │
                 ┌────┴────┐
                 ▼         ▼
            worker-1   worker-2           (Redis consumer group)
```

- **ingest-server**: Stateless. LB 뒤에 N개 배치
- **worker**: Redis consumer group으로 자동 분산
- **decode-service**: Stateless. 캐시는 인스턴스별 독립
- **gate-service**: 단일 primary (SQLite). 읽기 분산이 필요하면 read replica

### 8.2 멀티 카탈로그 확장

```
조직 A: --catalog org-a.ts
   └─ CatalogRegistry["org-a"]
   └─ DkgSqliteStore(state.sqlite, "org-a")
   └─ registry-service: POST /catalogs { id: "org-a", ... }

조직 B: --catalog org-b.ts
   └─ CatalogRegistry["org-b"]
   └─ DkgSqliteStore(state.sqlite, "org-b")
   └─ registry-service: POST /catalogs { id: "org-b", ... }

크로스 카탈로그 쿼리:
   SELECT DISTINCT catalog_id FROM dkg_nodes;
   → ["demo", "org-a", "org-b"]
```

### 8.3 이중화 구성 (HA)

`docker-compose.ha.yml` 오버레이로 프로덕션 이중화를 활성화한다.

```bash
docker compose -f docker-compose.yml -f docker-compose.ha.yml up
```

```
                    ┌───── nginx LB ─────┐
                    │   (least_conn)     │
                    └──┬──────────┬──────┘
                       │          │
                 ingest-1    ingest-2        (Stateless HTTP × 2)
                       │          │
                       └────┬─────┘
                            ▼
                    ┌── PostgreSQL ──┐
                    │  primary       │──── streaming repl ────▶ replica
                    └────────────────┘
                            │
                    ┌── Redis ───────┐
                    │  master        │
                    └───┬───┬───┬───┘
                        │   │   │
                   sentinel sentinel sentinel     (quorum=2)
                        │   │   │
                    ┌───┴───┴───┴───┐
                    │  worker-1     │
                    │  worker-2     │  (Redis consumer group)
                    └───────────────┘
```

| 구성 요소 | 방식 | RTO | RPO |
|-----------|------|-----|-----|
| PostgreSQL | Primary + Streaming Replica | < 30s (자동 승격) | 0 (동기 복제 시) |
| Redis | Master + Sentinel × 3 | < 10s (자동 failover) | 0 (메모리 상태) |
| ingest-server | nginx LB × 2 | 0 (자동 제외) | N/A (stateless) |
| worker | Consumer group × 2 | 0 (자동 재분배) | N/A (Redis job 보존) |

**모니터링 인프라** (HA compose에 포함):

| 서비스 | 포트 | 역할 |
|--------|------|------|
| Prometheus | 9090 | 메트릭 수집 (15초 간격) |
| Grafana | 3000 | 대시보드 시각화 |

**메트릭 엔드포인트:**

| 서비스 | 엔드포인트 | 주요 지표 |
|--------|-----------|----------|
| ingest-server | `GET /v1/metrics` | ingest_requests_total, dlq_depth, sse_connections_active, convergence_* |
| registry-service | `GET /metrics` | registry_catalogs_total, registry_axes_total, process_* |

---

## 9. DR 자동화

### 9.1 RTO/RPO 목표

| 시나리오 | RTO 목표 | RPO 목표 | 근거 |
|----------|----------|----------|------|
| 단일 서비스 장애 | < 1분 | 0 | 컨테이너 자동 재시작, 상태 보존 |
| PostgreSQL 장애 | < 5분 | < 1분 | Replica 승격 + WAL |
| Redis 장애 | < 10초 | 0 | Sentinel 자동 failover |
| 전체 노드 손실 | < 30분 | < 24시간 | 최신 백업에서 복원 |

### 9.2 자동 백업 + 검증 cron

```bash
# Docker Compose backup 프로필 활성화
docker compose --profile backup up -d backup
# → 매일 02:00 자동 백업 (BACKUP_CRON_SCHEDULE 커스터마이즈 가능)

# 백업 무결성 검증 (CI 또는 별도 cron)
./scripts/backup-verify.sh
# → pg_dump 파일 존재 + JSON 파싱 + SQLite 열기 + age 경고
```

### 9.3 복원 테스트 (월 1회 권장)

```bash
# 1. 테스트 환경에서 복원 실행
./scripts/restore.sh --date YYYYMMDD

# 2. 서비스 health check 자동 검증 (restore.sh에 내장)
#    → ingest-server, registry-server, registry-service, gate, query, decode

# 3. 결과 기록
```

### 9.4 Failover 절차

**PostgreSQL Replica 승격:**
```bash
# HA compose 환경에서 primary 장애 시
# 1. Replica를 primary로 승격
docker exec postgres-replica pg_ctl promote -D /var/lib/postgresql/data

# 2. 서비스 DATABASE_URL을 replica로 변경
# 3. 새 replica 프로비저닝 (optional)
```

**Redis Sentinel 자동 failover:**
- Sentinel quorum=2가 master 다운 감지 시 자동으로 새 master 선출
- 애플리케이션은 Sentinel을 통해 현재 master 주소를 자동 갱신
- 수동 개입 불필요

### 9.5 알림 규칙 (Prometheus)

`monitoring/alerting-rules.yml`에 정의:

| 알림 | 조건 | 심각도 |
|------|------|--------|
| DlqDepthHigh | dlq_depth > 100 (5분) | warning |
| IngestErrorRateHigh | 5xx > 1% (5분) | critical |
| ClassificationRateLow | classification_rate < 80% (10분) | warning |
| ServiceDown | up == 0 (1분) | critical |
| HighMemoryUsage | RSS > 512MB (10분) | warning |
