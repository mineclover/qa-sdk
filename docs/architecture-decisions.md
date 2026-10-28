---
def:
  id: architecture-decisions
  type: knowledge
  knowledge_kind: adr
  scope: constraint
  aspect: tech_constraint
  depth: overview
  lifecycle: approved
  tags: [entry-point, decision, cross-scope]
  links:
    - target: guides-system
      type: refines
---
# Architecture Decisions

## 목적 ^purpose

ADR-001~009 아키텍처 결정 기록. 불변 주소, 단방향 의존, fail-open 게이트 등 시스템 핵심 설계 결정의 근거와 대안을 보존한다.


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
  용도: 이벤트 등록 여부 검증 (GET /api/event-schemas/{service}/{event}/{version})
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
11. [ ] 서비스 포트가 SERVICE_PORTS 레지스트리와 일치하는가? (ADR-005)
12. [ ] 멀티 카탈로그가 필요하면 CatalogRegistry + catalogId를 사용하는가? (ADR-005)

---

## ADR-005: 멀티 카탈로그 런타임

### 결정

하나의 런타임에서 여러 Catalog를 CatalogRegistry(인메모리 Map)로 관리한다. DKG 상태는 단일 SQLite + `catalog_id` 컬럼으로 격리한다. 주소 형식은 기존 3파트와 4파트(catalogId 포함)를 양립한다.

### 배경

Phase 1-5까지 DEMO_CATALOG 단일 인스턴스. 멀티 테넌트/조직을 지원하려면 카탈로그별 독립 관리가 필요하지만 기존 3파트 주소와의 하위 호환을 깨면 안 된다.

### 규칙

| 규칙 | 설명 |
|---|---|
| **CatalogRegistry는 인메모리** | O(1) 조회. 프로세스당 1개. SQLite는 DKG 상태 저장 전용 |
| **기본값 "demo"** | catalogId 미지정 시 항상 "demo". 3파트 주소 = 기본 카탈로그 |
| **4파트 주소 양립** | `parseSerializedAddress()`로 3/4파트 자동 판별. `split(":")` 직접 사용 금지 |
| **단일 SQLite + catalog_id** | 파일 분리 대신 컬럼 추가. 크로스 카탈로그 쿼리 가능. `listCatalogIds()` |
| **registry-service CRUD** | `/catalogs` REST 엔드포인트. CatalogStore 인터페이스 (SQL + in-memory) |
| **서비스 포트 충돌 경고** | 각 서비스 시작 시 `warnPortConflict()` 호출. 다른 서비스 기본 포트와 겹치면 WARN |
| **포트 할당 SSOT** | `@qa-sdk/core` → `SERVICE_PORTS` 상수. 서비스별 env.ts 기본값과 일치 필수 |

---

## ADR-006: 이벤트 패턴 분류 체계

### 결정

세션 수준의 이벤트 시퀀스를 **식별 모드(IdentificationMode) × 행동 패턴(BehaviorPattern)** 2축으로 자동 분류한다. 분류 결과는 좌표계(`pattern_match` prefix)로 인코딩되어 convergence 분석에 통합된다.

### 배경

QA 플랫폼에서 "어떤 이벤트가 발생했는가"는 추적하지만 "이 세션이 어떤 유형의 사용자 행동인가"는 추적하지 않았다. 식별된 구매 vs 비식별 탐색 vs 봇 크롤링을 구분하지 못하면 수집 품질과 비즈니스 의미를 평가할 수 없다.

### 핵심 개념

```
패턴(Pattern) > 시나리오(Scenario) > 이벤트(Event)

패턴    = 세션의 의미적 분류 (purchase_complete, cart_abandon, bot_crawl)
시나리오 = 패턴의 구체적 step 정의 (ScenarioSpec)
이벤트   = 개별 발생 (EventRecord)
```

### 2축 분류

| 축 | 값 | 판별 기준 |
|---|---|---|
| **identification_mode** | anonymous, identified, pseudonymized, service | actor_id/user_id 유무 + platform |
| **behavior_pattern** | purchase_complete, browse_only, cart_abandon, checkout_fail, error_recovery, return_visit, anonymous_browse, anonymous_cart, api_integration, bot_crawl, health_check, unclassified | event_key 시퀀스 + 시간 패턴 |

### 규칙

| 규칙 | 설명 |
|---|---|
| **PatternRule 선언적 정의** | 규칙은 코드가 아닌 선언적 조건(requiredKeys, excludedKeys, actorCondition 등)으로 정의 |
| **우선순위 기반 매칭** | 복수 규칙 매칭 시 priority 높은 규칙 우선. 동률이면 먼저 정의된 규칙 |
| **미분류 = 이상 감지 대상** | unclassified 패턴은 자동으로 anomaly observation 생성 |
| **좌표계 인코딩** | 분류 결과는 `pattern_match:v1:{address}` 형태로 address_context에 태깅 |
| **패턴 통계 = convergence** | 패턴별 빈도/비율은 convergence 레이어의 metric으로 관리 |
| **규칙 변경 = DKG decision** | 새 규칙 추가/삭제는 DKG decision 노드로 기록 |
| **이상 감지 6종** | unclassified, ratio_shift, volume_spike, new_sequence, abnormal_speed, abnormal_duration |

### 인프라 흐름

```
이벤트 수집 → 세션 완료 → 패턴 분류 → 좌표 인코딩 → convergence 집계
                                            ↓
                                  이상 감지 → DKG observation
                                            ↓
                                  통계 → metric-registry → self-check 보고
```

---

## ADR-007: GraphPort 3단 추상화

### 결정

DKG 그래프 저장소의 소비자를 3단계로 분리한다.

### 배경

DKG GraphRegistry는 15종 노드 + 18종 엣지의 구체 타입을 가진 그래프 저장소다. convergence 분석 함수(15개), 서비스 동적 import(ingest/registry), CLI/skills가 모두 같은 그래프를 사용하지만 필요한 정보 범위가 다르다.

모든 소비자가 GraphRegistry를 직접 import하면:
- convergence가 DkgNode 15종에 결합 → 노드 추가 시 빌드 영향 확대
- 서비스가 optional peer를 정적 import 불가
- 테스트에서 전체 구현 mock 필요

### 구조

| 레벨 | 인터페이스 | 반환 타입 | 소비자 | 파일 수 |
|------|-----------|----------|--------|--------|
| **GraphPort** | `shared/graph-port.ts` | `{ kind, id }` | convergence/schema/skills | 27 |
| **GraphRegistryPort** | 서비스 `types/spec-core-ports.ts` | `{ kind, id, [key] }` | 동적 import 서비스 | 2 |
| **GraphRegistry** | `dkg/graph-registry.ts` | `DkgNode` 15종 | bootstrap/store/lifecycle/mermaid | 9 |

### 규칙

| 규칙 | 설명 |
|------|------|
| **GraphPort 우선** | 새 함수 작성 시 GraphPort로 충분하면 GraphPort 사용 |
| **구체 타입 정당성** | `replaceNode`, `hasNode`, Table 질의 등 Port에 없는 메서드가 필요할 때만 GraphRegistry 사용 |
| **Port 확장 검토** | 3개 이상 파일이 같은 Registry-only 메서드를 사용하면 Port에 승격 검토 |
| **서비스 포트 최소화** | GraphRegistryPort는 `getAllNodes` + `getNodesByKind` 2메서드만 유지 |

---

## ADR-008: DKG Table 의존 추적

### 결정

Catalog의 `tables` 섹션을 DKG 그래프에 `TableNode`로 자동 파생하고, column-level 엣지로 DB ↔ prefix ↔ service 의존 체인을 추적한다.

### 배경

로깅 시스템이 "어떤 DB가 어떤 이벤트에 영향 받는가"를 질의하려면 테이블-prefix 관계가 구조화되어야 한다. 기존에는 prefix의 `table_ref` dim이 단순 문자열 참조였고, DKG에 테이블 노드가 없어 역추적이 불가능했다.

### 구조

```
Catalog.tables → catalog-derive → TableNode + column edges
  column axis_ref  → composes 엣지 (dimKind: "column_axis")
  column prefix_ref → references 엣지
  column table_ref  → references 엣지 (meta: { fk: true })

GraphRegistry 전용 질의:
  getPrefixesForTable(tableId)  — 테이블을 참조하는 prefix
  getTablesForPrefix(prefixId)  — prefix가 참조하는 테이블
  getTableColumnRefs(tableId)   — 컬럼별 참조 대상
  cascadeFromTable(tableId)     — 변경 시 영향 prefix + FK 체인

ServiceTopology 추론:
  getTablesForService(serviceId, graph)  — prefix 소유에서 추론
  getServicesForTable(tableId, graph)    — 역방향 추론
```

### 규칙

| 규칙 | 설명 |
|------|------|
| **Table 질의는 GraphRegistry 전용** | GraphPort에 Table 메서드를 추가하지 않음. Table은 구체 구현의 확장 기능 |
| **CLI로 조회** | `dkg tables` (목록), `dkg table <id>` (상세 + impact) |
| **DEMO_CATALOG 6개 테이블** | members, orgs, items, orders, carts, cart_items |

---

## ADR-009: Transition Spec DSL — 좌표계 위의 상태 해석 계층

### 결정

좌표계(DEMO_CATALOG)는 불변 primitive로 유지하면서, 상태 전이 해석을 외부 spec으로 분리한다. 상태는 별도 vocabulary가 아닌 기존 축(axis)의 entry로 표현한다.

### 배경

기존 시스템은 "이 흐름이 올바른가?"(Verdict: pass/fail)만 판단했다. "이 흐름으로 무슨 상태가 되었는가?"를 알려면 이벤트 시퀀스에 상태 전이 의미를 부여하는 해석 계층이 필요했다. 별도 slot vocabulary를 만들면 축 시스템과 이중 관리가 되므로, 기존 축을 그대로 사용한다.

### 구조

```
DEMO_CATALOG (좌표 + 축) ← 불변
  ↓ match (좌표 패턴)
TransitionSpec (해석 규칙) ← 버전별 진화
  ↓ output (축 entry 설정)
StateStore (축별 상태) ← 런타임 파생
```

TransitionEngine 7단계: collect → match → bind → load → validate → apply → emit

### 핵심 타입

- `StateCondition` — axis + eq/neq/in/exists (축 entry 기반 전제조건)
- `StateAssignment` — axis + value (축 entry 설정, null = 제거)
- `TransitionInstance` — 전이 결과 (input/output 스냅샷 포함)
- `TransitionSpecNode` — DKG 노드 (matchAxes/inputAxes/outputAxes 역할별 분리)

### DKG 통합

- `consumes` 엣지: TransitionSpecNode → 참조 축
- `depends-on` 엣지: outputAxes ∩ inputAxes로 전이 간 상태 의존성 자동 파생
- `satisfies` 엣지: slotRefs ∩ DSL member axes로 invariant 형식 구현 연결
- `CON-EFFECT-VOCAB`: effect kind 정규 vocabulary 제약

### Ingest 통합 (Phase 2.5)

```
Phase 2.3: Verdict
Phase 2.5: Decode + Transition Matching (TRANSITION_ENGINE_ENABLED)
Phase 2.6: Convergence Notification
```

에러 격리: Phase 2.5 전체 실패 → verdict/convergence 미영향.

### 규칙

| 규칙 | 설명 |
|------|------|
| **상태는 축으로 표현** | 별도 slot vocabulary 만들지 않음. `flow_step`, `lifecycle_state` 등 기존 축 사용 |
| **TransitionSpec이 SSOT** | DKG TransitionSpecNode는 bridge 자동 파생. 수동 정의 금지 |
| **address_context 디코딩** | TransitionEngine은 디코딩된 이벤트만 받음. decode 책임은 호출자 |
| **effect vocabulary 통제** | create/update/move/consume/open/close. 추가 시 DKG Decision 필수 |
| **metric은 주입** | autoRunnable: false. Phase 2.5 결과에서 값을 계산하여 주입 |

---

## ADR-010: Coordinate Context Binding (CatalogSnapshot)

### 결정

정수 주소의 의미는 `(catalogId, snapshot digest, codecVersion, prefix, version)` 문맥으로만 해석한다. 문맥 없이 숫자만으로 decode하지 않는다.

### 배경

SDK(capacity 기준 stride)와 DecodeMap(entries 기준 stride)이 같은 주소를 서로 다른 값으로 해석했고, 실패 시 `null`·일반 `Error`·조용한 skip이 섞여 있었다. (`docs/proposals/swc-next-qa-sdk-optimization/` R-1)

### 구조

- `@qa-sdk/core` `catalog/snapshot/`: `CatalogSnapshot`, `PrefixLayout`, `buildCatalogSnapshot`, `resolveDecodeLayout`, `CodecContractError`
- digest: RFC 8785 부분집합 canonical JSON + SHA-256(WebCrypto), `sha256:<64 hex>`
- layout 호환: 같은 dim 순서·kind·source·capacity에서 entry append만 호환

### 규칙

- `documentVersion`(문서), `snapshotVersion`(catalog), `codecVersion`(wire ABI), `analyzerVersion`은 서로 다른 축이다
- 같은 prefix version 안의 breaking layout 변경은 금지 — `findUnversionedBreakingChanges`가 비어 있어야 snapshot을 발행한다
- 실패는 `CodecContractError.code` 9종으로만 표현한다. `null` 반환·조용한 skip은 신규 코드에서 금지
