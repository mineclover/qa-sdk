# QA-SDK 개발 컨벤션

## 용어집

### 좌표계

| 용어 | 정의 | 예시 |
|------|------|------|
| **Axis** | 유한한 값 집합을 가진 차원. 5Q 체크리스트 통과 필수 | `page`, `role`, `env` |
| **Entry** | 축 내의 개별 값. 정수 position으로 인코딩 | `"home"`, `"admin"`, `"prod"` |
| **Capacity** | 축의 최대 entry 수. `nextPowerOf2(entries × 2)` 이상 | `page` cap: 32 |
| **Headroom** | `capacity - entries.length`. 여유 공간 | headroom ≤ 2 → 경고 |
| **Prefix** | N차원 주소 공간. 비즈니스 도메인의 좌표 정의 | `page_view`, `cart_event` |
| **Address** | prefix 내 1D 정수. mixed-radix 인코딩 결과 | `42` |
| **Serialized Address** | 전송 형식: `prefix:version:address` | `"page_view:v1:42"` |
| **Address Context** | 한 이벤트에 붙는 좌표 집합. `Record<prefixId, serialized>` | `{ page_view: "page_view:v1:42" }` |
| **Infra Context** | envelope 레벨 기본 좌표. record의 address_context가 override | `{ service: "service:v1:65536" }` |

### 차원 참조 (DimRef) 3종

| 종류 | 인코딩 | 용도 | 예시 |
|------|--------|------|------|
| **axis** | O (주소의 일부) | 유한 enum 값 | `action: cart_action` → `"add"/"remove"/"checkout"` |
| **prefix_ref** | O (참조 prefix 주소) | 다른 prefix 좌표 참조 | `svc_ref → service` → 서비스 주소 정수 |
| **table_ref** | X (좌표 밖) | DB 테이블 행 참조 | `actor → members` → member_id는 payload에 |

> table_ref가 좌표에 포함되지 않는 이유: 테이블 행은 무한히 증가하므로 5Q "유한성" 미충족.
> 같은 "장바구니 담기"(좌표)를 다른 사용자(refs)가 수행 → 좌표 동일, payload만 다름.

### 테이블 컬럼 참조 (ColumnRef) 4종

| 종류 | 의미 | 예시 |
|------|------|------|
| **scalar** | 일반 값 | `members.id: integer`, `members.name: string` |
| **axis_ref** | 축 entry 참조 | `members.role → role 축` |
| **prefix_ref** | prefix 주소 참조 | `orgs.region_addr → service prefix` |
| **table_ref** | FK (다른 테이블 참조) | `members.org_id → orgs 테이블` |

### 이벤트

| 용어 | 정의 | 사용처 |
|------|------|--------|
| **EventRecord** | 하나의 기록 단위. log/span/metric 3종 | `@qa-sdk/core` 타입 |
| **record_kind** | EventRecord의 종류 | `"log"`, `"span"`, `"metric"` |
| **event_key** | 이벤트 이름. `도메인.행위` 형식 | `"cart.add"`, `"auth.login"` |
| **event_version** | 이벤트 스키마 버전. 3자리 패딩 | `"001"` |
| **TransmissionEnvelope** | 전송 단위. metadata + records[] | POST /v1/ingest body |
| **transmission_id** | envelope 고유 ID | `"tx_abc123"` |

### 추적

| 용어 | 정의 | 관계 |
|------|------|------|
| **trace_id** | 하나의 요청/흐름을 추적하는 ID | 1 trace = N records |
| **span_id** | 구간 ID (부모-자식 관계 가능) | record 내 필드 |
| **qa_session_id** | 사용자 세션 ID | 1 session = N traces |
| **scenario_id** | 시나리오 정의 ID | verdict 판정 기준 |

### 서비스 정체성

| 용어 | 정의 | 형식 |
|------|------|------|
| **ServiceBootConfig** | 앱 부트 시 서비스 정체성 선언 | `{ namespace, name, env, region }` |
| **service_name** | envelope 전송 시 식별자 | `"namespace/name"` (예: `"shop/shopping-web"`) |
| **svc_name** | catalog service prefix의 축 entry | `"shopping-web"` (namespace 없음) |
| **serviceId** | registry seed의 서비스 식별자 | `"shopping-web"` |
| **svc_ref** | prefix_ref 차원. service prefix 주소 참조 | refEntries 정수값 |

> `ServiceBootConfig`과 `ServiceRef`(permission-engine)는 구조적 호환 (TypeScript structural typing).

### DKG (Design Knowledge Graph)

| 용어 | 정의 |
|------|------|
| **Observation** | 시스템 상태 관측 (metric alert, 수동 관측) |
| **Decision** | 설계 의사결정 (분리, 병합, 승격) |
| **Constraint** | 불변 조건 (DSL invariant) |
| **ScenarioSpec** | 흐름 검증 명세. verdict(pass/fail) 판정 |
| **TransitionSpec** | 상태 전이 명세. 축 값 변화 기록 |
| **Skill** | DKG 분석 능력 (convergence 서비스 묶음) |
| **Convergence** | 수렴 분석 — metric 수집 → observation → decision |

> `analysis`는 deprecated 별칭. `convergence` 사용.

---

## 케이싱 규칙

| 레이어 | 규칙 | 예시 |
|--------|------|------|
| **전송 JSON** (네트워크 데이터) | snake_case | `trace_id`, `event_key`, `address_context` |
| **TypeScript 타입** (전송과 1:1) | snake_case | `EventRecord.trace_id` |
| **Port/Store 메서드 인자** | camelCase (JS 관례) | `traceStore.findById(traceId)` |
| **Catalog axes** | snake_case | `svc_name`, `flow_step`, `cart_action` |
| **Prefix ID** | snake_case | `page_view`, `cart_event`, `flow_point` |
| **Service ID** | kebab-case | `shopping-web`, `ingest-server` |
| **환경변수** | SCREAMING_SNAKE_CASE | `TRACE_DATABASE_URL`, `CORS_ORIGIN` |

---

## 차원 설계 원칙

### 5Q 체크리스트 (축 선택 기준)

| # | 질문 | YES → axis | NO → table_ref 또는 payload |
|---|------|-----------|---------------------------|
| 1 | **유한한가?** 값의 개수에 상한이 있는가 | `role: 5종` | `user_id: 무한` |
| 2 | **의사결정에 쓰이는가?** 이 값으로 흐름이 분기하는가 | `env: prod/dev 분기` | `request_id: 분기 안 함` |
| 3 | **여러 서비스가 공유하는가?** | `page: 여러 서비스` | `internal_flag: 한 서비스` |
| 4 | **안정적인가?** 자주 변하지 않는가 | `http_method: GET/POST` | `build_hash: 배포마다 변경` |
| 5 | **capacity 확보 가능한가?** | headroom ≥ 50% | — |

### 새 prefix 추가 절차

1. **5Q 체크리스트** 통과 확인
2. **svc_ref 필요성**: 여러 서비스에서 발생 → `svc_ref: { kind: "prefix_ref", prefixId: "service" }` 추가
3. **table_ref 판단**: 무한 데이터 참조 → `table_ref` + payload에 실제 ID
4. **category 지정**: `entity` / `event` / `observation` / `policy` / `relation`
5. **version**: 첫 버전은 `v1`. 차원 추가 시 새 버전 (기존 유지)
6. **refEntries**: prefix_ref 차원이 있으면 모든 버전에 `refEntries` 정의
7. **capacity**: `nextPowerOf2(entries × 2)` 이상

### prefix 소유

- prefix는 **비즈니스 도메인의 좌표 공간**이며 특정 서비스의 배타적 소유가 아님
- `svc_ref` 차원이 발생 서비스를 인코딩 → 여러 서비스가 같은 prefix에 이벤트를 씀
- `ownedPrefixes` = **주로 produce하는** prefix (Projection 배치 기준)
- `consumedPrefixes` = **조회/소비하는** prefix

### table_ref 사용 패턴

좌표에 들어가는 것과 밖에 있는 것의 분리:

```
cart_event prefix:
  svc_ref   : prefix_ref → service  (인코딩됨: 어느 서비스)
  actor     : table_ref  → members  (인코딩 안 됨: 누가)
  action    : axis       → cart_action (인코딩됨: 무슨 행위)
  target    : table_ref  → items    (인코딩 안 됨: 무엇을)
```

```typescript
// 인코딩: axis + prefix_ref만 → 1D 주소
const address = encodePrefixByValue(catalog, "cart_event", "v2", {
  svc_ref: svcRefValue,  // prefix_ref → 정수 주소
  action: "add",         // axis → entry position
});
// address = 5 (svc_ref 주소 × cart_action stride + action position)

// 전송: 주소 + 동적 참조는 payload에 분리
const record = {
  address_context: { cart_event: `cart_event:v2:${address}` },
  payload: { actor_id: 42, item_id: 7, qty: 1 },
};
```

### 테이블 ↔ 좌표 경로 탐색

```
cart_event.actor ⊳ members         — 이벤트에서 테이블로
  members.org_id ⊳ orgs            — FK로 테이블 이동
    orgs.region_addr → service     — 테이블에서 좌표 세계로 재진입
      decode(service:v1:65536)     — 좌표 decode → env, region, svc_name
```

---

## 로깅 연동 가이드

### 브라우저 (qa-browser-sdk)

```javascript
import { createQaMonitor } from './qa-browser-sdk.js';

// 1. QaMonitor — 서비스 정체성 선언
const monitor = createQaMonitor({
  ingestUrl: 'http://localhost:3200',
  serviceConfig: { namespace: 'shop', name: 'shopping-web', env: 'dev', region: 'asia' },
  autoCapture: { clicks: true, navigation: true },
});

// 2. svc_ref 자동 주입
const SVC_REF_PREFIXES = new Set(['page_view', 'tracking', 'cart_event', ...]);
const SVC_ADDR = { env: 'dev', region: 'asia', svc_name: 'shopping-web', namespace: 'shop' };

function qaTrack(eventKey, prefixes) {
  const enriched = {};
  for (const [pid, dims] of Object.entries(prefixes)) {
    enriched[pid] = SVC_REF_PREFIXES.has(pid) && !dims.svc_ref
      ? { svc_ref: SVC_ADDR, ...dims } : dims;
  }
  monitor.emitWithCoords(eventKey, enriched);
}

// 3. 이벤트 발생
qaTrack('cart.add', {
  tracking: { trackAction: 'add_to_cart', page: 'product_detail', userType: 'member' },
  endpoint: { resource_type: 'api', http_method: 'POST', api_version: 'v1' },
  cart_event: { action: 'add' },
  // table_ref 데이터(actor, target)는 prefix dims에 안 넣음 → payload로 전달됨
});
```

### Node.js 서버 (@qa-sdk/logger + @qa-sdk/context)

```typescript
import { QaLogger, HttpTransport } from "@qa-sdk/logger";
import { createQaContext } from "@qa-sdk/context";

// Transport 선택
const transport = new HttpTransport({ endpoint: "http://localhost:3200/v1/ingest" });
// 대안: MsgpackTransport (17% 절약), ProtobufTransport (최대 70%), OtlpTransport (외부 Collector)

const logger = new QaLogger({
  transport,
  owner: { owner_type: "tenant", owner_id: "my-service" },
  serviceConfig: { namespace: "shop", name: "payment", env: "prod", region: "asia" },
});

const qa = createQaContext({
  catalog: DEMO_CATALOG,
  serviceConfig: { namespace: "shop", name: "payment", env: "prod", region: "asia" },
});

logger.log({
  event_key: "payment.process",
  payload: { orderId: "ORD-001", amount: 89000 },  // table_ref 데이터는 payload에
  address_context: {
    endpoint: qa.encode("endpoint", { resource_type: "api", http_method: "POST", api_version: "v1" }),
    flow_point: qa.encode("flow_point", { flow_name: "payment", flow_step: "payment", flow_variant: "default" }),
  },
});
```

### CLI 자동 기록

모든 CLI 명령은 `cli_event` prefix로 자동 기록 (`cli_intent × cli_domain × cli_subject`).

새 명령 추가 시 `CLI_COMMAND_MAP`에 좌표 매핑 필수:
```typescript
"my-command": { intent: "query", domain: "registry", subject: "service" },
```

---

## 전송 프로토콜

| 프로토콜 | Content-Type | 크기 | 용도 |
|---------|-------------|------|------|
| **JSON** | `application/json` | 1.00x | 기본, 디버깅 |
| **MessagePack** | `application/msgpack` | 0.83x | 프로덕션 (간편) |
| **Protobuf** | `application/x-protobuf` | ~0.30x | 프로덕션 (최적) |
| **OTLP** | `application/json` | — | Grafana/Datadog 등 외부 Collector |

ingest-server가 Content-Type 헤더로 자동 분기. 클라이언트는 Transport 클래스만 교체.

---

## 시나리오 설계

### ScenarioSpec — "이 흐름이 올바른가?" → verdict (pass/fail)

```typescript
{
  scenario_id: "shop-checkout-complete",
  domain: "commerce",
  steps: [
    { id: "checkout", event_key: "checkout.process", required: true, kind: "sequence",
      constraints: [{ field: "address_context.flow_point", op: "exists" }] },
    { id: "payment", event_key: "payment.success", required: true, kind: "sequence" },
  ],
}
```

### TransitionSpec — "이 흐름이 무슨 의미인가?" → 상태 변화

```typescript
{
  transition: "cart.checkout", version: "v1",
  match: { mode: "ordered", coordinates: [
    { trackAction: "submit", page: "checkout" },
    { flow_name: "checkout", flow_step: "entry" },
  ]},
  input: { all: [{ axis: "lifecycle_state", exists: false }] },
  output: { set: [
    { axis: "lifecycle_state", value: "active" },
    { axis: "resource_location", value: "origin" },
  ]},
  effect: { kind: "create" },
}
```

> ScenarioSpec과 TransitionSpec은 같은 이벤트 스트림을 병렬 소비.

---

## 서비스 등록

### registry-service seed

```typescript
// 서비스 토폴로지
{ serviceId: "my-service", name: "내 서비스", tier: "backend", team: "my-team",
  url: "http://localhost:4000",
  ownedPrefixes: ["my_prefix"], consumedPrefixes: ["service", "endpoint"] }

// 엔드포인트
{ catalogId: "demo", namespace: "shop", svcName: "my-service",
  env: "dev", region: "asia", url: "http://localhost:4000" }
```

### 이벤트 스키마 등록

```bash
# registry-service에 이벤트 스키마 등록
curl -X PUT http://localhost:3300/api/event-schemas/my-service/my.event/001 \
  -H "Content-Type: application/json" \
  -d '{"displayName":"내 이벤트","recordKind":"log"}'

# 검증 (ingest-server의 RegistryClient가 호출하는 경로)
curl http://localhost:3300/services/my-service/events/my.event/versions/001
```

---

## 환경변수 관리

모든 서비스는 `dotenv/config`를 server.ts 최상단에서 import → `.env` 파일 자동 로드.

### 필수 최소 (.env)

```bash
# ingest-server
PORT=3200

# registry-service
PORT=3300
DEV_DASHBOARD_ENABLED=true   # ~/.qa-sdk/state.sqlite 있으면 자동 활성화
```

### 선택 기능 활성화

| 변수 | 서비스 | 기능 |
|------|--------|------|
| `TRACE_DATABASE_URL` | ingest | PostgreSQL (미설정 → in-memory) |
| `REDIS_URL` + `TASK_QUEUE_ENABLED=true` | ingest | Phase 2 비동기 처리 |
| `CONVERGENCE_ENABLED=true` | ingest | 관측 루프 |
| `PATTERN_CLASSIFICATION_ENABLED=true` | ingest | 행동 패턴 분류 |
| `CONSTRAINT_GATE_ENABLED=true` | registry | 활성화 게이트 |
| `CORS_ORIGIN` | 전체 | 프론트엔드 도메인 제한 (기본 `*`) |

---

## 파이프라인 흐름

```
클라이언트 (브라우저/서버)
  │ qaTrack() / logger.log()
  │ encode (mixed-radix) → address_context
  │ table_ref 데이터 → payload
  ▼
Transport.send(TransmissionEnvelope)
  │ JSON | MessagePack | Protobuf
  ▼
POST /v1/ingest
  │ Content-Type 분기 → deserialize
  │ Zod 검증 (transmissionEnvelopeSchema)
  │ registry 검증 (REGISTRY_URL 설정 시)
  ▼
recordStore.insert() + traceStore.upsert()
  │
  ├─→ recordStreamBroker.publish()
  │     └─→ WebSocket broadcast ("*") → monitor.html LIVE
  │
  ├─→ [Phase 2] verdict 평가 (ScenarioSpec)
  ├─→ [Phase 2.5] 상태 전이 (TransitionSpec)
  └─→ [Convergence] metric 수집 → observation → DKG 기록

monitor.html (LIVE)
  │ WebSocket subscribe({ scenarioId: "*" })
  │ record 수신 → decode(serialized) → activateKeys()
  ▼
Three.js: cell glow + selection ring + beam + flow timeline
```

---

## 축 사용 분석

`dkg audit` 명령으로 4경로 축 사용을 수집:

| 경로 | 의미 |
|------|------|
| `prefix-dim` | prefix 좌표 인코딩에서 사용 |
| `transition-match` | TransitionSpec match 조건에서 참조 |
| `transition-input` | TransitionSpec input 전제조건에서 참조 |
| `transition-output` | TransitionSpec output 상태 설정에서 참조 |

`resource_location` 같은 축은 prefix dims에서 직접 안 쓰이지만 TransitionSpec output에서 상태 축으로 사용됨 → 미사용이 아님.

---

## 코드 패턴

### 에러 처리

```typescript
// AppError — 모든 서비스 공통
class AppError extends Error {
  constructor(public code: string, message: string, public statusCode: number) { super(message); }
}

// 사용: badRequest("INVALID_PREFIX", "prefix not found")
// 미들웨어가 자동 처리: app.onError(createErrorHandler(logger))
```

**응답 형식:**
- 성공 (목록): `{ items: [...] }`
- 성공 (생성): `{ accepted: true, id: "..." }` (201 또는 202)
- 에러: `{ error: { code: "NOT_FOUND", message: "..." } }` (4xx/5xx)
- 목록과 에러를 한 응답에 섞지 않음

### Fail-Open 원칙

검증/게이트 실패가 요청을 차단하지 않음:

```typescript
try {
  checkActivationReadiness(graph, prefixId);
} catch {
  // 실패해도 허용 + 경고만
  diagnostics.push("GATE_CHECK_FAILED");
  allowed = true;
}
```

`MODE` 환경변수로 전환: `"strict"` = 차단, `"warn"` = 경고만 (기본).

### Store/Port 패턴

```
@qa-sdk/core/ports/     ← 인터페이스 정의 (의존성 역전)
  RecordStore.port.ts      interface { insertBatch(), findByTraceId(), ... }

packages/store/          ← SQL 구현 (Drizzle ORM)
  DrizzleRecordStore.ts    implements RecordStore

packages/*/stores/       ← InMemory 구현
  InMemoryRecordStore.ts   implements RecordStore (Map 기반)
```

런타임 선택:
```typescript
async function createStores(path: string) {
  if (path === ":memory:") return { store: new InMemoryStore() };
  const driver = new NodeSqliteDriver(path);
  return { store: new SqlStore(driver) };
}
```

### 동적 Import (선택 기능)

optional peer dependency는 정적 import 금지. 환경변수로 활성화 + try/catch:

```typescript
async function buildFeature() {
  if (!env.FEATURE_ENABLED) return undefined;
  try {
    const { FeatureClass } = await import("@qa-sdk/optional-pkg");
    return new FeatureClass(options);
  } catch (error) {
    logger.warn({ error }, "feature init failed — disabled");
    return undefined;
  }
}
```

### 정상 종료

| 서비스 유형 | 함수 | 처리 |
|------------|------|------|
| HTTP + WS + 큐 | `installGracefulShutdown(deps)` | in-flight 요청 대기, 큐 drain, 타임아웃 |
| HTTP only | `installSimpleShutdown({ server, logger })` | SIGTERM/SIGINT → server.close() |

### 헬스체크

모든 서비스는 아래 엔드포인트 제공:

| 엔드포인트 | 용도 | 응답 |
|-----------|------|------|
| `GET /health` | 전체 점검 (DB, 종속서비스) | `{ ok, database: { connected, latencyMs }, uptime, version }` |
| `GET /health/live` | 즉시 응답 (프로세스 생존) | `{ ok: true }` |

Docker HEALTHCHECK가 `/health/live`를 30초 간격으로 호출.

---

## 타임스탬프

ISO-8601 문자열 비교 시 **문자열 비교 금지**:

```typescript
// ❌ Z(0x5A) > .(0x2E) 이므로 밀리초 없는 것이 뒤로 밀림
"10:00:00Z" > "10:00:00.100Z"  // true (잘못됨)

// ✅ Date 변환 비교
import { compareTimestamps, normalizeTimestamp } from "@qa-sdk/core";
compareTimestamps(a, b);           // -1 | 0 | 1
normalizeTimestamp("10:00:00Z");   // "10:00:00.000Z"
```

`now()` 반환값은 정규 형식. 외부 입력은 `normalizeTimestamp` 후 비교.

---

## 테스트 컨벤션

### 카탈로그 파생값 하드코딩 금지

```typescript
// ❌ 축 추가 시 깨짐
expect(axes.length).toBe(74);

// ✅ SSOT에서 파생
expect(axes.length).toBe(Object.keys(DEMO_CATALOG.axes).length);
```

### 라운드트립 검증

모든 prefix는 `verifyRoundTrip`으로 전 범위 정합성 검증:

```typescript
for (const pid of Object.keys(DEMO_CATALOG.prefixes)) {
  const ver = latestPrefixVersion(DEMO_CATALOG, pid);
  const result = verifyRoundTrip(DEMO_CATALOG, pid, ver);
  expect(result.valid).toBe(true);
}
```

### 동적 생성 노드 수 검증

bootstrap이 자동 생성하는 노드(observation, decision)는 `toBeGreaterThan(0)` 사용:

```typescript
expect(observations.length).toBeGreaterThan(0);
// 특정 테스트 데이터 기반 카운트만 하드코딩 허용
```

---

## 의존성 방향

### 4개 레이어

```
Layer 0: 수학/인코딩 ─────────────────────────────────────
  weighted-index → bit-index → permission-engine
  index-meta (WeightedIndex 기반 메타 스토리지)

Layer 1: 플랫폼 코어 ─────────────────────────────────────
  core (타입, 포트, 유틸)
    → logger (Transport 추상화)
    → codec (mixed-radix 인코딩)
    → context (QaContext)
    → sdk (logger + codec + context 통합 facade)
    → engine (Phase 2 verdict 엔진)
    → store (Drizzle ORM 구현)

Layer 2: 분석/지식 ───────────────────────────────────────
  convergence (수렴 분석 — core + weighted-index 의존)
  spec-core (DKG + TransitionSpec — convergence + core + index-meta 의존)

Layer 3: 서비스/앱 ───────────────────────────────────────
  ingest-server, registry-service, gate-service, query-service, decode-service
  shop-web, platform-demo, platform-demo-api, cli
```

### 허용/금지 방향

```
                        허용 방향 (→)
  Layer 3 (서비스) → Layer 2 (분석) → Layer 1 (코어) → Layer 0 (수학)

                        금지 방향 (✗)
  Layer 0 ✗→ Layer 1    수학이 플랫폼에 의존하면 안 됨
  Layer 1 ✗→ Layer 2    코어가 분석에 의존하면 안 됨
  Layer 2 ✗→ Layer 3    분석이 서비스에 의존하면 안 됨
```

### 실제 의존 관계

| 패키지 | 의존 대상 | 레이어 |
|--------|----------|--------|
| **weighted-index** | (없음) | L0 |
| **bit-index** | weighted-index | L0 |
| **permission-engine** | weighted-index, bit-index | L0 |
| **index-meta** | weighted-index | L0 |
| **core** | (없음) | L1 |
| **logger** | core | L1 |
| **codec** | core, weighted-index | L1 |
| **context** | core | L1 |
| **sdk** | core, logger, codec, context | L1 |
| **store** | core | L1 |
| **convergence** | core, weighted-index | L2 |
| **spec-core** | core, convergence, index-meta, weighted-index | L2 |
| **ingest-server** | core, engine, store, registry-client + (spec-core, convergence: optional peer) | L3 |
| **registry-service** | core, index-meta, weighted-index + (spec-core: optional peer) | L3 |
| **cli** | core, spec-core, demo-snapshot | L3 |
| **browser-sdk** | core, browser-codec, sdk | L3 |
| **demo-snapshot** | core, weighted-index | L1 (참조 데이터) |

### optional peer dependency 규칙

L3 서비스가 L2 분석 패키지를 사용할 때:

```
ingest-server
  dependencies: core, engine, store        ← 정적 import (항상 필요)
  peerDependencies (optional):
    spec-core                              ← 동적 import (CONVERGENCE_ENABLED=true 시)
    convergence                            ← 동적 import (CONVERGENCE_ENABLED=true 시)
    demo-snapshot                          ← 동적 import (DEMO_CATALOG 필요 시)
```

**정적 import 금지**인 이유:
- optional peer가 설치 안 되어도 서비스가 기동되어야 함
- 환경변수로 기능 on/off 가능해야 함
- 번들 크기 최소화 (사용 안 하면 로드 안 함)

```typescript
// ❌ 금지 — spec-core 없으면 서비스 기동 실패
import { bootstrapDkg } from "@qa-sdk/spec-core/dkg";

// ✅ 허용 — 조건부 동적 import
if (env.CONVERGENCE_ENABLED) {
  const { bootstrapDkg } = await import("@qa-sdk/spec-core/dkg");
}
```

### 포트 인터페이스 (의존성 역전)

L3 서비스가 L2 타입을 직접 참조하지 않도록 최소 인터페이스를 L1(core) 또는 서비스 자체에 정의:

```
core/ports/           ← 인터페이스 (RecordStore, TraceStore, ...)
spec-core/dkg/        ← 구체 타입 (DkgNode, GraphRegistry, ...)
ingest-server/types/  ← 최소 포트 (ConvergencePipelinePort, GraphPort-like)
```

```typescript
// ingest-server/types/spec-core-ports.ts
// spec-core의 구체 타입을 import하지 않는 최소 인터페이스
interface ConvergenceGraphPort {
  getAllNodes(): { kind: string; id: string }[];
  getNodesByKind(kind: string): { kind: string; id: string }[];
}
```

### demo-snapshot의 위치

`demo-snapshot`은 L0/L1 경계에 있는 **참조 데이터 패키지**:
- core에 의존 (Catalog 타입)
- weighted-index에 의존 (refEntries 계산)
- 어떤 서비스든 import 가능 (L3 → demo-snapshot 허용)
- 하지만 demo-snapshot → 서비스 의존은 금지

---

## 포트 할당

| 범위 | 용도 | 예시 |
|------|------|------|
| 3xxx | 인프라 서비스 | ingest:3200, registry:3300, gate:3400, query:3500, decode:3600 |
| 4xxx | 비즈니스 서비스 | backend:4100, auth:4200, payment:4300, gateway:4400 |
| 5xxx | 프론트엔드 | platform-demo:5176, shop-web:5220 |
| 8xxx | Cloudflare Workers | platform-demo-api:8787 |
| 9xxx | 모니터링 | prometheus:9090 |

새 서비스 추가 시 `SERVICE_PORTS` 배열에 등록 + `warnPortConflict()` 호출.

---

## Seed 자동 갱신

registry-service 기동 시 DEMO_CATALOG의 SHA-256 해시를 비교:

- 해시 동일 → 스킵
- 해시 다름 → 자동 upsert (catalog + axis profiles + configs + endpoints)
- SQLite 삭제 불필요

```typescript
const currentHash = contentHash(JSON.stringify(catalog));
const stored = await catalogStore.get("demo");
if (stored?.hash === currentHash) return; // 변경 없음
await catalogStore.upsert({ id: "demo", data: catalog, hash: currentHash });
```
