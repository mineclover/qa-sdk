# Architecture Decisions

> 패키지 경계, 인증 전략, 데이터 흐름에 관한 횡단 설계 결정. 각 결정은 **왜** 그렇게 했는지와 **어떤 규칙**을 지켜야 하는지를 명시한다.

---

## ADR-001: 게이트웨이 레벨 인증

### 결정

내부 서비스(registry-server, ingest-server, registry-client)는 **인증을 수행하지 않는다**. 인증은 게이트웨이에서 일괄 처리한다.

### 배경

초기에는 각 서비스가 SHA256 Bearer token 기반 API key 인증을 자체 수행했다. 서비스가 늘어나면서 인증 미들웨어 복제, API key 동기화, 환경 변수 관리 비용이 증가했다.

### 규칙

| 규칙 | 설명 |
|---|---|
| **인증 미들웨어 금지** | 내부 서비스에 `api-key-auth`, `jwt-verify` 등 인증 미들웨어를 추가하지 않는다 |
| **인증 환경 변수 금지** | `API_KEYS`, `API_KEYS_FILE`, `*_API_KEY` 등 인증 관련 환경 변수를 서비스 config에 넣지 않는다 |
| **Authorization 헤더 금지** | 내부 서비스 간 통신에 인증 헤더를 포함하지 않는다 |
| **인프라 미들웨어만 허용** | rate limiting, request ID, graceful shutdown, error handler만 서비스 레벨에서 관리 |

### 현재 미들웨어 스택

```
registry-server:  requestId → logger → routes → errorHandler
ingest-server:    requestId → shutdown → rateLimiter → routes → errorHandler
```

### 향후 계획

- 게이트웨이 서비스 + 인증 전용 DB 구축
- 외부 진입점에서 인증/인가를 일괄 처리
- 내부 서비스는 게이트웨이가 전달하는 컨텍스트(예: `x-user-id`, `x-service-id`)를 신뢰

---

## ADR-002: Event Catalog 정적 데이터 패키지

### 결정

Core Event 정의, Payload Field Guide, v1 Minimal Set, Graph Hint를 **`@qa-sdk/event-catalog`** 독립 패키지로 분리한다. 엔진, 서버, SDK가 이 패키지를 import하여 동일한 이벤트 어휘를 공유한다.

### 배경

이벤트 정의는 여러 소비자(engine, registry-server, SDK)가 참조하는 공유 어휘다. 특정 패키지에 종속시키면 순환 의존이 발생하거나 소비자마다 정의가 분산된다.

### 규칙

| 규칙 | 설명 |
|---|---|
| **런타임 의존성 0** | 이 패키지는 순수 TypeScript const 데이터 + 타입만 포함한다. DB, HTTP, 외부 라이브러리 금지 |
| **버전은 패키지 버전** | 이벤트 정의 버전은 `package.json` 버전으로 추적한다. 별도 DB 버전 관리 없음 |
| **Core는 실행 패턴** | Core event는 `click`, `http_request` 같은 범용 실행 패턴만. 도메인 의미(`signup_completed`)는 Custom |
| **Payload Guide는 v1 핵심만** | Payload field guide는 v1 최소 핵심 세트(20개)에 대해서만 제공. 나머지 40개는 payload 자유 확장 |
| **필수 필드 최소화** | required 필드는 이벤트 의미를 식별하는 핵심만. 누락 시 warn하되 거부하지 않음 |
| **Graph Hint는 정적 힌트** | graph_hint는 이벤트의 그래프 역할(entry/transition/terminal/observation), goal 후보 여부, 반복 가능 여부를 정적으로 제공. engine은 참고하되 시나리오 DSL이 우선 |
| **seed는 registry-server** | registry-server가 이 패키지를 import해서 DB에 seed하는 구조 |

### 패키지 구조

```text
@qa-sdk/event-catalog
├── src/types.ts             ← CoreEventDef, GraphHint, PayloadFieldDef 등 공통 타입
├── src/categories/          ← 8개 카테고리별 이벤트 정의 (const 배열, graph_hint 포함)
│   ├── navigation.ts        (7개)
│   ├── interaction.ts       (10개)
│   ├── form.ts              (5개)
│   ├── session.ts           (6개)
│   ├── network.ts           (8개)
│   ├── execution.ts         (9개)
│   ├── outcome.ts           (7개)
│   └── quality.ts           (8개)
├── src/registry.ts          ← 전체 60개 집계, Map 인덱스, 조회 함수
├── src/payload-guides.ts    ← v1 핵심 20개 payload 필드 가이드
├── src/v1-minimal.ts        ← v1 핵심 20개 서브셋
└── src/index.ts             ← barrel export
```

### 소비 패턴

```typescript
// engine — constraint 비교 시
import { getCoreEvent, getPayloadGuide, isCoreEvent } from "@qa-sdk/event-catalog";

// engine — graph_hint 활용 (trace 시작점 추정, goal 후보 판단, loop 감지)
const def = getCoreEvent("page_view");
if (def?.graph_hint.role === "entry") { /* trace root 후보 */ }
if (def?.graph_hint.goal_eligible) { /* goal node 후보 */ }

// registry-server — DB seed (graph_hint 포함)
import { allCoreEvents } from "@qa-sdk/event-catalog";

// SDK — 자동 수집 대상
import { v1MinimalSet, isV1MinimalEvent } from "@qa-sdk/event-catalog";
```

### Core vs Custom 분기 기준

Core로 둘 것:
- 여러 서비스에서 반복됨
- 자동 수집 가능성 있음
- QA 엔진이 일반화해서 다룰 수 있음
- 특정 비즈니스에 종속되지 않음

Custom으로 둘 것:
- 서비스/도메인 특화 의미
- 조직 내부 용어, 기획 특화 KPI
- 제품 고유 전환 이벤트

---

## ADR-003: 패키지 경계 규칙

### 결정

각 패키지는 명확한 책임 경계를 가진다. 의존 방향은 항상 단방향이며, 순환 의존을 금지한다.

### 의존 그래프

```text
core  ← 모든 패키지가 의존
  ├── event-catalog   (core 무관, 독립 정적 데이터)
  ├── pino            (core 무관, 독립 로거)
  ├── sdk             (core만 의존)
  ├── engine          (core만 의존, 순수 연산)
  ├── store           (core 포트를 Drizzle로 구현)
  ├── registry-client (독립 HTTP 클라이언트)
  ├── registry-server (독립 서비스, event-catalog import 가능)
  └── ingest-server   (core + store + engine + registry-client 조합)
```

### 패키지별 책임

| 패키지 | 책임 | 금지 사항 |
|---|---|---|
| `core` | 공유 타입, 스키마, 포트 인터페이스 | 구현체 포함 금지 |
| `event-catalog` | 이벤트 어휘 정의 (정적 데이터) | 런타임 의존성 금지 |
| `pino` | 구조화 JSON 로깅 | core 의존 금지 |
| `sdk` | 이벤트 수집, 전송 | storage 직접 의존 금지 |
| `engine` | reconstruction, matching, verdict | storage/HTTP 직접 의존 금지 |
| `store` | core 포트의 DB 구현체 | 비즈니스 로직 금지 |
| `registry-client` | 이벤트 검증 HTTP 클라이언트 | 캐시 외 상태 금지 |
| `registry-server` | 서비스·이벤트 메타데이터 CRUD | 다른 서비스 의존 금지 |
| `ingest-server` | Composition Root — 모든 어댑터 바인딩 | (유일하게 여러 패키지 조합 허용) |

### 규칙

| 규칙 | 설명 |
|---|---|
| **단방향 의존** | A → B → C 에서 C → A 금지 |
| **engine은 순수 연산** | DB, HTTP, 파일시스템 import 금지. core 타입만 |
| **store는 포트 구현** | core/ports 인터페이스만 구현. 비즈니스 로직 넣지 않음 |
| **서버만 어댑터 바인딩** | `new DrizzleRecordStore(db)` 같은 구체 생성은 서버의 Composition Root에서만 |
| **event-catalog는 독립** | core 포함 다른 패키지에 의존하지 않음. 타입도 자체 정의 |

---

## ADR-004: 내부 서비스 간 통신

### 결정

내부 서비스 간 통신은 **인증 없는 plain HTTP**로 한다. fail-open 전략을 기본으로 한다.

### 현재 내부 통신 경로

```text
ingest-server → registry-server
  용도: 이벤트 등록 여부 검증 (GET /services/{name}/events/{key}/versions/{ver})
  클라이언트: @qa-sdk/registry-client
  전략: fail-open (레지스트리 장애 시 이벤트 통과)
```

### 규칙

| 규칙 | 설명 |
|---|---|
| **인증 헤더 없음** | 내부 통신에 Authorization, API key 등 포함하지 않음 |
| **fail-open 기본** | 의존 서비스 장애 시 호출자는 정상 동작 계속. 차단하지 않음 |
| **validation mode** | `strict` / `warn` / `off` 세 단계. 기본은 `warn` (경고만 남기고 통과) |
| **캐시 우선** | 반복 호출은 TTL+LRU 캐시로 차단. 레지스트리 부하 최소화 |
| **request ID 전파** | 내부 호출 시 `x-request-id` 헤더를 전파하여 분산 추적 지원 |

---

## 체크리스트: 새 패키지/서비스 추가 시

1. [ ] 의존 방향이 단방향인가? (순환 의존 없음)
2. [ ] 인증 미들웨어를 서비스에 넣지 않았는가? (ADR-001)
3. [ ] 이벤트 정의가 필요하면 event-catalog를 import하는가? (ADR-002)
4. [ ] engine이 storage를 직접 사용하지 않는가? (ADR-003)
5. [ ] 내부 통신에 인증 헤더를 포함하지 않는가? (ADR-004)
6. [ ] fail-open 전략을 적용했는가? (ADR-004)
7. [ ] `docs/specs/` 해당 관심사 폴더에 스펙 문서를 작성했는가?
8. [ ] `docs/specs/README.md` 인덱스를 업데이트했는가?
9. [ ] `packages/<pkg>/specs/README.md` 리다이렉트를 추가했는가?
10. [ ] README.md 의존 그래프를 업데이트했는가?
