# Enterprise-PM Canary & Scaling — Scaling & Infra

> 시뮬 카나리·스케일링 결정을 실제로 떠받치는 인프라 — replica 모델, outbox 다중 dispatcher 안전성, bitmap 캐시 회복 보장, read replica 토폴로지, 컨테이너 자족성을 한 단으로 정리한다.

## 1. Replica 모델

각 service entry는 `--scale` 가능한 단일 단위다. controller는 Pass 2(`01-decision-model.md` §4)에서 카테고리 verdict를 종합해 목표 replica 수를 산출하고, 다음과 같이 docker compose에 위임한다.

```bash
docker compose --project-name sim up -d \
  --scale sim-approval-api-v1=M \
  --scale sim-approval-api-v2=N
```

서비스명 `sim-approval-api-v1` / `sim-approval-api-v2`는 catalog 등록된 service prefix `sim.svc.approval`(grammar #1, `03-identifier-grammar.md` §2.1)에서 derive하고, 이미지 태그는 grammar #3(§2.3)을 따른다.

**replica 결정 단위**:

- 카나리 진행 중 (`weight < 100`): v2 우선 scale-up. 트래픽이 `weight × 총RPS`만큼 v2로 흐르므로 v2 부담이 비례 증가하고, v1은 잔여 트래픽이 작아 기존 replica로 충분.
- 승격 후 (`weight = 100`, v1 stop): 이제 stable 역할이 된 v2만 scale.
- 롤백 진행 중 (`weight → 0`): v1 우선 scale-up, v2는 동결.

**replica 범위**:

- 최소 replica = 1 (서비스 가용성 보장)
- 최대 replica = `SIM_MAX_REPLICAS_PER_VERSION` (env 기본값 `5`). controller는 cap을 넘는 산출값이 나오면 cap에서 멈추고 `replica-cap-reached` 이벤트를 발행 — observation 카테고리 신호로 자동 승격됨.

**무상태성 점검**: approval-api는 stateful workflow(승인·예산 trace)를 PostgreSQL에 영속하므로 컨테이너 자체는 stateless다. replica 추가/제거 시 inflight 워크플로우 무손실. `SIGTERM` 수신 시 `pg_terminate_backend` 없이 graceful shutdown(현재 처리 중인 요청 종료, outbox poller drain) 후 종료.

**버전 격리**: v1·v2는 동일한 DB 스키마를 공유하지만 *컨테이너 이미지*만 분리된다. 마이그레이션은 별도 stage(시뮬 시작 전)에서 실행되어 두 버전 모두 동일 스키마를 보장 — 카나리 도중 마이그레이션 금지. 스키마 변경이 필요한 변경은 카나리 대상이 아니며, 이는 `02-canary-topology.md` §2 카나리 적용 범위 정의를 따른다.

**Pass 2 알고리즘** 상세 (수치 결정/안전 가드/후보 도출): `01-decision-model.md` §4 위임.

**replica 변경 적용 형태**: controller는 매 사이클 끝에 *목표* replica 벡터 `{v1: M, v2: N}`만 결정한다. 이전 사이클 벡터와 동일하면 docker compose 호출 자체를 생략(no-op idempotency). 다르면 `up -d --scale ...`로 *목표 상태*를 선언하고, docker compose가 차이를 계산해 컨테이너를 추가/삭제한다 — controller가 절대 개별 컨테이너 ID를 추적하지 않는다.

**graceful drain 보장**: scale-down으로 제거되는 replica는 docker compose의 `stop_grace_period: 30s`를 받는다. 이 30초 안에 (a) outbox poller가 현재 batch를 완료, (b) HTTP 서버가 inflight 요청을 종료, (c) lifecycle hook이 `/ready`를 false로 전환해 LB가 새 트래픽을 보내지 않도록 한다. 30초 초과 시 SIGKILL — outbox는 `SKIP LOCKED` 보호로 다른 replica가 즉시 이어받는다(§2.1).

## 2. Outbox 다중 dispatcher 안전성 (이전 평가 #1)

approval-api replica가 N개일 때 모든 replica 안에서 outbox dispatcher 모듈이 동시에 폴링한다. 중복 dispatch 방지와 멱등성 보장은 두 단계로 구성된다.

### 2.1 폴링 락

```sql
SELECT id, aggregate_id, event_name, payload, idempotency_key
FROM sim.approval_outbox_events
WHERE status = 'pending'
ORDER BY occurred_at
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

`SKIP LOCKED`로 같은 row를 두 dispatcher가 동시에 폴링해도, 락 미보유 측은 다음 row로 즉시 넘어간다 — 중복 처리 0, 대기 0. 테이블명 `sim.approval_outbox_events`는 grammar #6(`03-identifier-grammar.md` §2.6) 준수.

### 2.2 멱등성 키

이벤트 발행 시 `idempotency_key`를 첨부한다. 키 grammar는 #12(`03-identifier-grammar.md` §2.12). consumer 측은 처리 직전 다음 INSERT로 중복을 방어한다.

```sql
INSERT INTO sim.outbox_consumer_log (idempotency_key, consumer, processed_at)
VALUES ($1, $2, now())
ON CONFLICT (idempotency_key, consumer) DO NOTHING
RETURNING idempotency_key;
```

`RETURNING`이 비어 있으면 이미 다른 dispatcher가 같은 이벤트를 처리한 것 → silent skip. 결과적으로 중복 처리·중복 효과 0.

(`idempotency_key`, `consumer`) 조합에 UNIQUE 제약을 걸어 race 조건에서도 한 행만 살아남는다.

### 2.3 dispatch 후 status 전이

```sql
UPDATE sim.approval_outbox_events
SET status = 'dispatched', dispatched_at = now()
WHERE id = $1 AND status = 'pending';   -- 동시성 가드
```

`AND status = 'pending'` 조건이 들어 있어 이미 다른 dispatcher가 transition한 row는 건드리지 않는다(`ROW_COUNT = 0` → 자기 시도는 무효 처리하고 계속 진행).

실패 시 status = `'failed'` + `retry_count` 증가, dispatcher가 backoff(1s → 2s → 4s …) 후 재폴링. `retry_count > 5` → status = `'dlq'`로 격리(운영자 개입 신호). DLQ 진입 자체도 outbox 이벤트로 발행되어 controller가 안전 가드 카테고리 신호로 활용한다(`01-decision-model.md` §2 참조).

backoff 시간은 row 자체의 `next_attempt_at` 컬럼으로 관리한다. 폴링 쿼리에 `AND (next_attempt_at IS NULL OR next_attempt_at <= now())`를 추가해 backoff 중인 row는 자연 제외 — 메모리 기반 backoff와 달리 dispatcher가 재시작·교체되어도 backoff 상태가 보존된다.

### 2.4 시뮬 검증

시나리오 #15 `outbox-multi-dispatcher-lock` — 자세한 시드/검증식은 `05-error-and-scenarios.md` §3 위임. 핵심 모양만 적으면:

- replica = 3
- 5건 outbox 이벤트 동시 INSERT
- 검증: 5 이벤트 = 5 ingest 발행(중복 0), 각 dispatcher가 처리한 row 집합이 서로 disjoint, `outbox_consumer_log`에 정확히 5행.

### 2.5 dispatcher 폴링 주기와 backpressure

dispatcher 폴링은 200ms 주기. `LIMIT 10`으로 한 사이클당 최대 10개 row만 잡고, 처리량이 따라가지 못하면 다음 사이클로 자연스럽게 밀린다. replica가 N개면 이론 최대 처리량은 `N × 10 / 0.2s = 50N events/s`. 시뮬 카나리 부하(피크 ~30 events/s)는 N=1로도 수용되므로 outbox dispatcher 자체가 scale-up 트리거가 되는 일은 거의 없다 — scale-up은 거의 항상 HTTP API 쪽 부하에서 발생.

## 3. Bitmap TTL + version-check fallback (이전 평가 #2)

bitmap pub/sub 무효화 메시지가 유실되어도 정합성이 회복되도록, TTL과 version-check를 함께 둔다. pub/sub은 *latency 최적화*로 격하한다.

### 3.1 캐시 entry 형태

```ts
interface BitmapCacheEntry {
  key: string;                    // grammar #11
  prefix: string;                 // catalog 등록 prefix
  prefixVersion: string;          // 발급 시점 version axis 값 (grammar #3)
  mask: Uint8Array;
  issuedAt: number;
  ttlMs: number;                  // 기본 120000 (2분)
}
```

`key`/`prefix`/`prefixVersion` 모두 식별자 grammar(`03-identifier-grammar.md` §2.11, §2.3)를 따른다. issuedAt은 epoch ms.

### 3.2 조회 시 3단계 검증

```ts
async function getBitmap(key: string): Promise<Uint8Array> {
  const cached = lru.get(key);

  // (1) hit + valid TTL + version-check OK → 즉시 반환
  if (cached && Date.now() - cached.issuedAt < cached.ttlMs) {
    const currentVersion = await catalog.getLatestPrefixVersion(cached.prefix);
    if (currentVersion === cached.prefixVersion) {
      return cached.mask;
    }
    // version mismatch → fallthrough (회복 경로)
  }

  // (2) miss / TTL 만료 / version mismatch → auth-api에서 refresh
  const fresh = await authApi.fetchBitmap({ key, prefix: cached?.prefix });
  lru.set(key, {
    key,
    prefix: fresh.prefix,
    prefixVersion: fresh.prefixVersion,
    mask: fresh.mask,
    issuedAt: Date.now(),
    ttlMs: 120_000,
  });
  return fresh.mask;
}
```

(1) hit + TTL 유효 + version 동일 → 캐시값 사용. (2) 그 외(miss, TTL 만료, version 불일치) → auth-api 재조회 후 재캐시.

`catalog.getLatestPrefixVersion`은 `latestPrefixVersion(catalog, prefixId)`(루트 CLAUDE.md "좌표 컨벤션" §1)에 위임 — version axis 값은 catalog가 SSOT.

### 3.3 pub/sub은 *최적화*로 격하

- Redis `bitmap.invalidate` channel은 그대로 유지(평균 invalidation latency 단축).
- 회복 *보장*은 TTL + version-check가 담당 — pub/sub 메시지 유실은 정합성 위협이 아니고 단순 latency 저하로만 표면화.
- subscriber는 메시지 수신 시 LRU에서 즉시 evict — 다음 조회가 §3.2 (1)에서 fallthrough → (2)로 진행한다. evict 자체가 fallthrough trigger.

이 격하 결정의 핵심은 *정합성 보장과 latency 최적화의 책임 분리*다. pub/sub은 latency만 책임지므로 메시지 큐 신뢰성에 대한 운영 SLA가 정합성 SLA로 승격되지 않는다. 운영 측면에서는 Redis가 잠시 내려가도 시스템이 stale 캐시로 계속 동작하다가 TTL/version-check 시점에 자연 회복된다.

### 3.4 시뮬 검증

시나리오 #16 `bitmap-cache-version-fallback` — 자세한 fault injection(pub/sub drop)·assertion은 `05-error-and-scenarios.md` §3 위임. 골자는: pub/sub 메시지를 100% drop한 상태에서 prefix version을 bump하고, TTL 만료 이전이라도 version-check 단계에서 fallthrough가 발생해 정합성이 회복됨을 확인한다.

### 3.5 LRU 크기와 hit-rate 관측

LRU 용량은 `SIM_BITMAP_CACHE_MAX_ENTRIES`(env 기본값 `1024`). evict는 LRU 정책(가장 오래 미사용 entry 제거). hit-rate는 `/metrics`의 `bitmap_cache_lookup_total{result="hit|miss|version_mismatch"}` counter로 노출. `version_mismatch` 비율이 비정상적으로 높을 경우(예: 5% 초과)는 catalog 측 prefix 변동 빈도가 비정상이라는 운영 신호로 본 사이클에서는 메트릭으로만 노출하고, 결정 모델 카테고리로의 승격은 후속 sub-project(`06-roadmap.md` §4)에 분리한다.

## 4. Read replica 토폴로지

### 4.1 PG streaming replication

```yaml
qa-sdk-db:                       # primary
  image: postgres:16
  command: postgres -c wal_level=replica -c max_wal_senders=4 -c hot_standby=on
  volumes:
    - qa-sdk-db-data:/var/lib/postgresql/data
    - ./infra/pg/init-primary.sql:/docker-entrypoint-initdb.d/
  networks: [qa-sdk-net]
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 5s

qa-sdk-db-replica:               # standby
  image: postgres:16
  command: |
    bash -c "
      until pg_basebackup -h qa-sdk-db -U replicator -D /var/lib/postgresql/data -P -R; do sleep 1; done
      && postgres -c hot_standby=on
    "
  depends_on:
    qa-sdk-db:
      condition: service_healthy
  networks: [qa-sdk-net]
```

`init-primary.sql`이 `replicator` role(replication 권한)과 replication slot(`sim_read_replica_slot` — grammar #13 / `03-identifier-grammar.md` §2.13)을 생성한다. slot으로 standby가 이탈해도 primary가 WAL을 보존, 복귀 시 자동 캐치업.

slot은 시뮬 라이프사이클과 정렬한다.

- `pnpm sim:up` — slot 존재 여부 확인 후 없으면 생성(idempotent).
- `pnpm sim:down --volumes` — primary 데이터 볼륨까지 제거하므로 slot도 함께 사라짐.
- `pnpm sim:down`(볼륨 보존) — slot 유지. 다음 `sim:up`이 캐치업으로 재가동.

WAL 보존 한도는 `max_slot_wal_keep_size = 1GB`로 둔다. 시뮬이 며칠 방치되어 standby가 분리된 채 primary에 쓰기가 누적되면 slot이 자동 invalidate되어 primary 디스크 폭주를 막는다 — slot invalidate 자체도 controller의 `replicationHealth` 카테고리 신호로 감지된다.

### 4.2 DataSource 분리

`db-bootstrap` 패키지가 두 DataSource를 동시에 노출한다.

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export interface DataSources {
  write: ReturnType<typeof drizzle>;
  read: ReturnType<typeof drizzle>;
}

export function createDataSources(env: SimEnv): DataSources {
  return {
    write: drizzle(postgres(env.SIM_DB_WRITE_URL, { max: 20 })),
    read:  drizzle(postgres(env.SIM_DB_READ_URL,  { max: 20 })),
  };
}
```

서비스에서는 명시적 토큰으로 주입한다.

```ts
@Injectable()
export class BudgetReportingQueryService {
  constructor(
    @Inject(READ_DATA_SOURCE) private readDb: ReturnType<typeof drizzle>,
  ) {}
  // SELECT만, INSERT/UPDATE 호출 금지 (lint rule로 강제)
}
```

env 키 `SIM_DB_WRITE_URL`/`SIM_DB_READ_URL`는 본 사이클 식별자 grammar의 명시 항목은 아니며, 루트 CLAUDE.md "환경변수 처리" 컨벤션(서비스 `config/env.ts` zod 스키마)을 따른다.

### 4.3 어떤 slice가 read replica를 쓰는가

- `reporting-api/*` 전체 → read
- 모든 `presentation/bff/*` → read (BFF 컨벤션과 정확히 정렬)
- 그 외 query (조회 후 같은 트랜잭션에서 결정/쓰기) → write (read-after-write 보장 필요)

라우팅은 코드 컨벤션 + lint rule 두 층으로 강제한다.

- BFF 모듈에서 write DataSource를 import → 정적 lint 에러
- read DataSource로 INSERT/UPDATE/DELETE 호출 → 런타임 에러(드라이버 자체가 read-only 연결로 거부)

이 라우팅 결정은 `02-canary-topology.md` §3 slice 분류와 직교(같은 slice가 write/read 둘 다 갖지 않음).

**read-after-write 회피 패턴**: 사용자가 직전 PUT/POST의 결과를 즉시 GET으로 확인해야 하는 흐름은 BFF가 아니라 *write slice가 직접 응답에 포함*시키는 패턴으로 처리한다. 즉 PUT 응답 본문이 변경 후 상태를 그대로 담아 클라이언트에 돌려줌으로써 별도 GET을 호출할 필요가 없다 — replication lag에 노출되지 않는다.

**lag 노출 명세화**: BFF 응답에는 `X-DB-Source: read-replica` 헤더와 `X-Replication-Lag-Ms` 헤더를 부착해 클라이언트(특히 통합 테스트)가 lag 가시성을 확보할 수 있다. 시뮬 시나리오는 이 헤더로 어떤 응답이 read replica를 거쳤는지 정확히 단정할 수 있다.

### 4.4 lag-injector

별도 컨테이너가 아니라 controller 내부 모듈로 통합한다.

```ts
// controller가 fault scenario 활성 시
async injectReplicationLag(ms: number): Promise<void> {
  // (a) primary 측 — slot advance 지연
  await pg.query(
    `SELECT pg_replication_slot_advance($1, pg_current_wal_lsn())`,
    ["sim_read_replica_slot"],
  );
  // (b) standby 측 — recovery 임시 sleep 트리거
  await pgReplica.query(`SELECT pg_sleep($1)`, [ms / 1000]);
}
```

slot명은 grammar #13으로 시나리오 fixture가 빌드(직접 문자열 입력 금지). `pg_sleep` 호출 후 controller는 30초 사이클 안에서 lag이 회복되는지 함께 측정한다.

lag-injector는 idempotent하지 않다 — 같은 시나리오에서 두 번 호출하면 누적된다. 이를 명시적으로 다루기 위해 controller는 시나리오 종료 시 항상 `await lagInjector.reset()`을 호출(slot 재진행 + standby 재기동 신호). 시나리오 fixture가 강제 종료되어도 controller의 `finally` 절에서 reset이 호출되도록 라이프사이클을 보장한다.

### 4.5 replicationLagMs 측정

```sql
-- on primary
SELECT EXTRACT(MILLISECONDS FROM replay_lag) AS lag_ms
FROM pg_stat_replication
WHERE application_name = 'qa-sdk-db-replica';
```

controller가 30s 사이클마다 폴링 → `replicationHealth` 카테고리 신호 산출(`01-decision-model.md` §2 결정 모델 카테고리 정의 참조). 임계치 초과 시 v2 scale-up 보류·롤백 트리거 후보로 들어간다.

대상 메트릭은 두 가지를 동시에 본다.

- `lag_ms` — wall-clock 기준. read-after-write 관점의 사용자 영향.
- `replay_lsn` 차이 — bytes 단위. 트래픽 폭주 vs 단순 idle 구분.

둘 다 `db_replication_lag_ms` / `db_replication_lag_bytes` gauge로 metrics-collector에 export. controller는 `lag_ms`를 1차 verdict 입력으로 사용하고, `lag_bytes`는 카테고리 verdict 표면에 보조 컨텍스트로 첨부.

## 5. dbPool 측정 (resource-headroom.dbPoolUtilization)

각 서비스가 `postgres-js` pool stats를 두 곳에 동시 노출한다.

```ts
{
  pool_max:    20,
  pool_active: 14,
  pool_idle:    6,
  utilization: 0.70,             // active / max
}
```

- `/health` 응답 본문에 포함 — 사람·시뮬 둘 다 같은 표면.
- Prometheus `/metrics`에 `db_pool_utilization{service,replica,db_role}` gauge로 노출 (`db_role`은 `write` 또는 `read`).

metrics-collector가 모든 service replica의 평균을 집계하고 controller가 카테고리 verdict(`resource-headroom.dbPoolUtilization`)를 산출한다. 임계치는 `01-decision-model.md` §2 카테고리 표 참조. utilization > 임계치 → scale-up 후보로 자동 포함.

집계는 단순 평균뿐 아니라 *피크 추적*을 같이 둔다.

- `avg_utilization` — 전 replica 평균 (sustained pressure 지표).
- `max_utilization` — 단일 replica 최대치 (특정 replica가 hot spot인지 식별).

`max_utilization`이 평균보다 0.2 이상 높게 지속되면(=skew) 메트릭만 노출하고 자동 scale-up 보류 로직은 본 사이클 결정 카테고리에 포함하지 않는다 — skew 기반 LB 진단은 후속 sub-project(`06-roadmap.md` §4)로 분리한다. 본 사이클 controller는 평균 dbPool만 `resource-headroom` 카테고리 입력으로 사용한다.

pool size 자체(`pool_max=20`)는 dev/CI 기본값이다. 운영 환경에서는 `SIM_DB_POOL_MAX` env로 오버라이드 — 키는 루트 CLAUDE.md "환경변수 처리" 컨벤션을 따른다.

## 6. host.docker.internal 제거 (이전 평가 #5)

### 6.1 변경

```bash
# .env.sim.example 변경 (BEFORE)
QA_INGEST_URL=http://host.docker.internal:3200
OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318

# (AFTER) — 동일 docker network 안의 서비스명 사용
QA_INGEST_URL=http://qa-sdk-ingest:3200
OTEL_EXPORTER_OTLP_ENDPOINT=http://qa-sdk-otel-collector:4318
```

서비스명 `qa-sdk-ingest`/`qa-sdk-otel-collector`는 시뮬 외부 인프라이므로 본 사이클 service prefix(grammar #1) 등록 대상이 아니다 — qa-sdk 본체의 service identity 컨벤션을 그대로 따른다. env 키는 기존 QA_* fallback 컨벤션(루트 CLAUDE.md "환경변수 처리") 그대로.

### 6.2 docker-compose 보강

`qa-sdk-net` 네트워크에 다음 entry를 등록한다.

- `qa-sdk-ingest` — 외부 ingest-server를 alias로 join하거나(§6.3 컨테이너화 옵션 사용 시 직접 띄움), 로컬 개발에서는 host alias를 외부 url로 매핑.
- `qa-sdk-otel-collector` — opt-in. OTel 비활성 환경에서는 entry 자체를 omit하고 env에서 `OTEL_EXPORTER_OTLP_ENDPOINT`를 비워두면 SDK가 export skip.

macOS·Linux·CI 모두 동일 동작이 보장된다(`host.docker.internal`은 macOS/Windows 전용 — Linux에서 별도 host-gateway 필요했음).

기존 host-gateway가 필요한 경우(로컬 디버그 한정) `extra_hosts: ["host.docker.internal:host-gateway"]`를 opt-in fallback으로만 둔다 — 시뮬 default 경로에서 제거.

### 6.3 ingest-server 컨테이너화

`qa-sdk-ingest`는 docker-compose의 service entry로 시뮬 안에서 직접 띄운다(이미지: `@qa-sdk/ingest-server` 빌드 산출물). 시뮬 외부 의존 0.

```yaml
qa-sdk-ingest:
  image: qa-sdk/ingest-server:latest    # qa-sdk catalog version axis 적용 (grammar #3)
  ports:
    - "3200:3200"
  networks: [qa-sdk-net]
  environment:
    - QA_INGEST_STORE_DRIVER=memory     # 시뮬 default — 휘발 OK
  healthcheck:
    test: ["CMD-SHELL", "curl -f http://localhost:3200/health || exit 1"]
    interval: 5s
    timeout: 3s
    retries: 5
  depends_on:
    qa-sdk-db:
      condition: service_healthy
```

이로써 시뮬은 *완전 자족* — `pnpm sim:up` 한 명령으로 ingest까지 같이 부팅된다. 호스트 ingest 인스턴스 별도 기동 불필요.

이미지 태그 `qa-sdk/ingest-server:latest`는 단순 dev 용. CI/release 빌드는 grammar #3 version axis 값이 들어간 태그(`qa-sdk/ingest-server:0.42.0`)로 고정 핀.

**빌드 제약 (Plan A 단계 1.1 구현 검증으로 확정).** `packages/ingest-server/Dockerfile`은 모노레포 root 컨텍스트에서 빌드되며 다음 제약을 갖는다. 상세 Dockerfile 텍스트는 `docs/superpowers/plans/2026-04-28-canary-scaling/A-stage-1-host-and-ingest.md` Task 1.1을 SSOT로 참조한다.

- pnpm filter 문법은 path 기반(`"...{./packages/ingest-server}"`)이 아니라 **package-name 기반**(`"@qa-sdk/ingest-server..."`)을 사용한다. path 기반은 transitive deps를 매치하지 않아 빌드가 깨진다.
- 루트 `tsconfig.json`을 빌더 컨텍스트에 함께 COPY해야 한다. sub-package들이 `"extends": "../../tsconfig.json"`로 참조하기 때문.
- 런타임 stage는 `ENV CI=true`를 갖는다. pnpm 10.30.3이 TTY 부재 시 modules dir 정리 confirmation을 요구하기 때문.
- 빌드 set에서 `@qa-sdk/spec-core`는 `--filter "!@qa-sdk/spec-core"`로 제외한다. spec-core는 본 사이클 외부의 pre-existing 빌드 결함(`spec-transition`/`dkg`/`@qa-sdk/core` import 미해결)이 있고, ingest-server는 이를 `*_ENABLED=true`일 때만 dynamic import 하므로 default(memory) 부팅에 영향이 없다.
- 빌드 set에서 `viz-core`도 `--filter "!viz-core"`로 함께 제외한다. `packages/core`의 devDeps에 `viz-core`가 등록되어 있고(`packages/core/src/**/*.test.ts`에서만 사용되어 core tsconfig는 test 파일을 제외함) `viz-core`의 prod deps에 `@qa-sdk/core`가 있어 devDeps cycle이 형성된다. pnpm은 cycle 시 토폴로지 정렬을 포기하고 두 패키지를 병렬 빌드하므로 `viz-core` DTS 단계가 `@qa-sdk/core/dist/index.d.ts` 부재 상태에서 `TS2307`로 실패한다. `viz-core`는 ingest-server runtime과 무관하므로 안전하게 제외 가능.
- 위 두 결함(spec-core 빌드 / core↔viz-core devDeps cycle)은 본 사이클 범위 밖의 모노레포 build hygiene 이슈로, 별도 sub-project로 처리한다(`06-roadmap.md` §4 후속 항목으로 추가 후보).

### 6.4 OTel collector 옵션 처리

OTel 비활성 환경(default sim)에서는 `qa-sdk-otel-collector` entry 자체를 docker-compose의 별도 profile(`profiles: ["telemetry"]`)에 둔다. `pnpm sim:up`은 default profile만 띄우므로 OTel 컨테이너 미기동·env 미설정이 자연스럽게 정합한다. telemetry 검증이 필요한 시나리오만 `pnpm sim:up --profile telemetry`로 활성화 — 시나리오 fixture가 명시적으로 require하면 controller가 launch 단계에서 검증.

### 6.5 네트워크 격리

`qa-sdk-net`은 docker bridge driver. 시뮬 외부에서 컨테이너로 직접 접근할 필요가 없으므로 `internal: true` 설정을 검토할 수 있으나, 개발자가 호스트에서 `psql`로 DB에 붙거나 ingest를 curl로 찌르는 경로를 막지 않기 위해 default는 `internal: false` 유지. 다만 `/metrics`·`/health` 같은 운영 포트는 host port mapping을 두지 않아 외부 노출 표면을 최소화한다 — controller도 `qa-sdk-net` 내부에서 동작하므로 host port 없이 충분하다.

### 6.6 CI 환경 정렬

CI(GitHub Actions runner) 위에서 시뮬을 띄울 때 `host.docker.internal`은 별도 host-gateway 설정 없이 동작하지 않는다. §6.1 변경으로 host alias 의존이 사라졌으므로 CI에서 별도 setup 없이 `pnpm sim:up`만으로 부팅이 성공한다 — macOS 개발 머신과 Linux CI runner의 동작 차이가 0이 된다.

CI 시간 단축을 위해 컨테이너 이미지는 GHCR에 사전 push되어 있고, `pnpm sim:up`은 항상 `--pull never` 옵션을 받아 이미 준비된 이미지를 즉시 사용한다(워크플로우 step에서 `docker pull`을 별도 캐시 단계로 분리). 시뮬 부팅 자체에서 네트워크 대기가 사라져 controller가 결정 사이클을 즉시 시작할 수 있다.

## 7. 컴포넌트 변경 요약

| 컴포넌트 | 변경 내용 |
|---|---|
| `db-bootstrap` 패키지 | `{ writeUrl, readUrl }` 동시 노출, write/read DataSource 분리 (§4.2) |
| `db-bootstrap` init SQL | `replicator` role + replication slot(`sim_read_replica_slot`, grammar #13) 생성 |
| `sim-bitmap-cache` 패키지 | TTL + version-check 3단계 검증 추가, pub/sub은 최적화 격하 (§3) |
| `approval-api` outbox dispatcher | `SKIP LOCKED` 폴링 + `idempotency_key` 첨부 + status 전이 동시성 가드 (§2) |
| `sim.outbox_consumer_log` 테이블 | NEW. `(idempotency_key, consumer)` UNIQUE 제약 (§2.2) |
| `docker-compose.sim.yml` | `qa-sdk-db-replica`, `qa-sdk-ingest`, `qa-sdk-otel-collector`(옵션) 신규 service entry (§4.1, §6) |
| `.env.sim.example` | `host.docker.internal` 제거, `qa-sdk-*` 서비스명 기반 url로 교체 (§6.1) |
| `controller` | `replicationLagMs` 폴러, lag-injector 모듈, `dbPoolUtilization` 집계, replica cap 가드 (§1, §4.4–§4.5, §5) |
| 모든 서비스 `/health` + `/metrics` | `db_pool_utilization` gauge 추가 (`db_role` 라벨 포함) (§5) |
| BFF/reporting slice | read DataSource 토큰만 import, lint rule로 write 차단 (§4.3) |
