# QA-SDK Specifications

> 시스템 전체 스펙을 **관심사(concern)** 기준으로 관리한다. 패키지 경계가 아닌 도메인 관심사별로 스펙을 배치하여 횡단 흐름을 한눈에 파악할 수 있게 한다.

## 관심사별 인덱스

### data-model/ — 시스템 공유 타입 & 포트

시스템 전체가 공유하는 도메인 모델과 저장소 포트 계약.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [record.spec.md](data-model/record.spec.md) | EventRecord 타입 + RecordStore 포트 | @qa-sdk/core | implemented |
| [trace.spec.md](data-model/trace.spec.md) | Trace 메타데이터 + TraceStore 포트 | @qa-sdk/core | implemented |
| [session.spec.md](data-model/session.spec.md) | QaSession + SessionStore 포트 | @qa-sdk/core | implemented |
| [transmission.spec.md](data-model/transmission.spec.md) | TransmissionEnvelope + TransmissionStore 포트 | @qa-sdk/core | implemented |
| [scenario-spec-store.spec.md](data-model/scenario-spec-store.spec.md) | ScenarioSpec + ScenarioSpecStore 포트 | @qa-sdk/core | implemented |
| [graph.spec.md](data-model/graph.spec.md) | RuntimeGraph / SpecGraph + GraphStore 포트 | @qa-sdk/core | implemented |
| [verdict.spec.md](data-model/verdict.spec.md) | VerdictReport + VerdictStore 포트 | @qa-sdk/core | implemented |
| [dlq-store.spec.md](data-model/dlq-store.spec.md) | DlqPhase / DlqInsert / StoredDlqItem + DlqStore 포트 | @qa-sdk/core | implemented |
| [utils.spec.md](data-model/utils.spec.md) | ID 생성 (ULID), Clock 유틸리티 | @qa-sdk/core | implemented |

### event-vocabulary/ — 이벤트 어휘

Core Event 정의, payload 가이드, 그래프 의미론 힌트.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [core-pattern.spec.md](event-vocabulary/core-pattern.spec.md) | Core Pattern v1 — 8개 카테고리 60개 이벤트 | @qa-sdk/event-catalog | implemented |
| [payload-guide.spec.md](event-vocabulary/payload-guide.spec.md) | v1 핵심 20개 이벤트 payload 필드 가이드 | @qa-sdk/event-catalog | implemented |
| [graph-hint.spec.md](event-vocabulary/graph-hint.spec.md) | 이벤트 그래프 의미론 (role, goal_eligible, loopable) | @qa-sdk/event-catalog | implemented |

### collection/ — SDK 수집 계층

클라이언트 사이드 이벤트 수집, 컨텍스트 관리, 마스킹, 전송.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [logger.spec.md](collection/logger.spec.md) | QaLogger — 이벤트 수집 진입점 + LogParams/SpanParams | @qa-sdk/sdk | implemented |
| [context.spec.md](collection/context.spec.md) | TraceContext — trace/span 스택 관리 | @qa-sdk/sdk | implemented |
| [masking.spec.md](collection/masking.spec.md) | applyMasking — 클라이언트 payload 마스킹 | @qa-sdk/sdk | implemented |
| [transport.spec.md](collection/transport.spec.md) | Transport 인터페이스 + HttpTransport/NoopTransport | @qa-sdk/sdk | implemented |

### pipeline/ — 엔진 & 오케스트레이션

4단계 파이프라인(Reconstruction → Compile → Match → Verdict)과 ingest 오케스트레이션.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [pipeline.spec.md](pipeline/pipeline.spec.md) | 4단계 순수 연산 파이프라인 | @qa-sdk/engine | implemented |
| [ingest.spec.md](pipeline/ingest.spec.md) | POST /v1/ingest — 수집 + 저장 + 후처리 오케스트레이션 | @qa-sdk/ingest-server | implemented |

### server/ingest/ — Ingest Server 엔드포인트

Ingest Server의 조회, 스트리밍, 시나리오 관리, 운영 엔드포인트.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [query.spec.md](server/ingest/query.spec.md) | GET /v1/traces, /v1/sessions — 조회 API | @qa-sdk/ingest-server | implemented |
| [stream.spec.md](server/ingest/stream.spec.md) | GET /v1/streams — SSE 실시간 스트리밍 | @qa-sdk/ingest-server | implemented |
| [scenario.spec.md](server/ingest/scenario.spec.md) | ScenarioSpec CRUD | @qa-sdk/ingest-server | implemented |
| [verdict.spec.md](server/ingest/verdict.spec.md) | Verdict 조회 + 재계산 | @qa-sdk/ingest-server | implemented |
| [admin.spec.md](server/ingest/admin.spec.md) | DLQ 관리, TTL 정리 | @qa-sdk/ingest-server | implemented |
| [infrastructure.spec.md](server/ingest/infrastructure.spec.md) | health check, rate limit, graceful shutdown | @qa-sdk/ingest-server | implemented |

### server/registry/ — Registry Server & Client

서비스·이벤트 메타데이터 관리와 검증 클라이언트.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [services.spec.md](server/registry/services.spec.md) | Service CRUD API | @qa-sdk/registry-server | implemented |
| [events.spec.md](server/registry/events.spec.md) | Event 정의 CRUD + 버전 관리 | @qa-sdk/registry-server | implemented |
| [client.spec.md](server/registry/client.spec.md) | RegistryClient — 이벤트 검증 + 캐시 | @qa-sdk/registry-client | implemented |

### storage/ — 영속 계층

PostgreSQL 스키마와 어댑터 구현.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [schema.spec.md](storage/schema.spec.md) | PostgreSQL 테이블 스키마 | @qa-sdk/store | implemented |
| [adapters.spec.md](storage/adapters.spec.md) | Drizzle / InMemory 어댑터 | @qa-sdk/store | implemented |

### visualization/ — 그래프 시각화

SpecGraph DAG 시각화, 실시간 SSE 업데이트, UI 패널.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [graph-renderer.spec.md](visualization/graph-renderer.spec.md) | dagre 레이아웃 + SVG 렌더링 + 실시간 업데이터 | @qa-sdk/viz-web | implemented |
| [panels.spec.md](visualization/panels.spec.md) | 시나리오 선택기, 이벤트 로그, Verdict 표시 패널 | @qa-sdk/viz-web | implemented |

### roleplay/ — 롤플레이 폼 빌더

DOM 트리 모델 기반 비주얼 폼 빌더, QA 이벤트 발생.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [form-builder.spec.md](roleplay/form-builder.spec.md) | DOM 트리 모델, 트리 뷰, 속성 편집기, auto-layout, 폼 렌더러 | @qa-sdk/roleplay-web | implemented |
| [qa-bridge.spec.md](roleplay/qa-bridge.spec.md) | QaBridge + EventEmitter + 템플릿 렌더링 | @qa-sdk/roleplay-web | implemented |

### browser/ — 브라우저 모니터링 SDK

단일 번들 브라우저 SDK — BeaconTransport, SessionManager, AutoCapture, QaMonitor.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [monitor.spec.md](browser/monitor.spec.md) | QaMonitor API, 초기화 순서, 고정 파라미터, 오류 처리 | @qa-sdk/browser | implemented |
| [lifecycle.spec.md](browser/lifecycle.spec.md) | 표준 생명주기 — 상태 전환 규칙, 각 단계 계약, 사용 패턴 | @qa-sdk/browser | implemented |
| [session.spec.md](browser/session.spec.md) | SessionManager — 저장 스키마, 복원 로직, 탭 생명주기, 키 격리 | @qa-sdk/browser | implemented |
| [transport.spec.md](browser/transport.spec.md) | BeaconTransport — sendBeacon/fetch 전송 체인, 에러 시맨틱 | @qa-sdk/browser | implemented |
| [auto-capture.spec.md](browser/auto-capture.spec.md) | AutoCapture — 수집 모드별 계약, payload 스키마, cleanup 프로토콜 | @qa-sdk/browser | implemented |

### web/ — 웹 공통 인프라

API 클라이언트, iframe 통신 프로토콜.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [api-client.spec.md](web/api-client.spec.md) | REST fetch 래퍼 + WebSocket 구독 + cursor 기반 세션 레코드 조회 | @qa-sdk/viz-web | implemented |
| [iframe-protocol.spec.md](web/iframe-protocol.spec.md) | postMessage 양방향 통신 프로토콜 | @qa-sdk/viz-web, @qa-sdk/roleplay-web | implemented |

### indexing/ — 인덱스 인코딩

가중진법 기반 다차원 좌표 ↔ 정수 ID 변환, 레이블/prefix 버전 관리, ID 포맷 적합성, 스키마 메타 DB.

> 개념 루트 문서: [`indexing/README.md`](indexing/README.md)

| 문서 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [README.md](indexing/README.md) | 인덱싱 관심사 개념 맵 — 레이어 구조, 문서 체계, 관심사 흐름 | — | — |
| [foundation.md](indexing/foundation.md) | 근본 원리 — 닫힌 공간, 전단사, 버전화된 공간 계열 | weighted-index + index-meta | — |
| [patterns.md](indexing/patterns.md) | 사용 패턴 — EntityId 이동, cross-index 참조, 활성/비활성 | weighted-index + index-meta | — |
| [conventions.md](indexing/conventions.md) | 관례/규칙 — ID 네이밍, 예약 토큰, EntityId 정규화, 커스텀 포맷 등록 절차 | weighted-index + index-meta | — |
| [weighted-index/README.md](indexing/weighted-index/README.md) | weighted-index 패키지 인덱스 — 수학 엔진, partial binder, pack format, range query 구성 | weighted-index | implemented |
| [weighted-index/core.spec.md](indexing/weighted-index/core.spec.md) | WeightedIndex / LabelRegistry / PrefixCodec — 수학 엔진 + 버전 관리 | weighted-index | implemented |
| [weighted-index/partial-binder.spec.md](indexing/weighted-index/partial-binder.spec.md) | PartialBinder / createBinder — 부분 차원 캐시, full path canonicalization, PrefixCodec 연동 | weighted-index | implemented |
| [weighted-index/pack-format.spec.md](indexing/weighted-index/pack-format.spec.md) | PackFormat / FormatRegistry / SemanticAddress / AddressConverter — 포맷·프로토콜·적합성 | weighted-index | implemented |
| [index-meta/registry.spec.md](indexing/index-meta/registry.spec.md) | MetaRegistry — 축·스냅샷·버전 스키마 + 활성 manifest | index-meta | implemented |
| [permission-engine/README.md](indexing/permission-engine/README.md) | permission-engine 패키지 인덱스 — core layer, 레이어 구조, 모듈 의존 관계 | permission-engine | implemented |
| [permission-engine/core.spec.md](indexing/permission-engine/core.spec.md) | PermissionSet / TernaryMask / ScopedEngine — binary/ternary mask, 상속, scope routing | permission-engine | implemented |
| [permission-engine/codec.spec.md](indexing/permission-engine/codec.spec.md) | PermissionCodec — 3-tier protocol stack, text↔integer↔bitmask, PrefixCodec/index-meta 호환성 | permission-engine | implemented |
| [permission-engine/resource.spec.md](indexing/permission-engine/resource.spec.md) | resource / service-ref / permission-code — canonical resource 규칙, ServiceContext, permission text address | permission-engine | implemented |
| [permission-engine/migration.spec.md](indexing/permission-engine/migration.spec.md) | migration.ts — shape 변경 시 grant 재배치, ID 매칭 자동 변환, `CoordMapper` 커스텀 변환 | permission-engine | implemented |

### services/ — 서비스 분리 스펙

인덱싱 시스템의 마이크로서비스 분리 API 계약. decode, gate, query 3개 독립 서비스.

| 스펙 | 설명 | 기반 모듈 | 상태 |
|---|---|---|---|
| [decode-service.spec.md](services/decode-service.spec.md) | Decode Service — DecodeMap 번들 기반 독립 decode, REST API, Edge/Node.js/임베디드 배포 | PrefixDecoder, MetaResolver | implemented |
| [gate-service.spec.md](services/gate-service.spec.md) | Gate Service — 주소 상태 관리 분산 서비스, RPC 계약, cascade 전파, 정합성 모델 | GateEngine, invalid-ranges | planned |
| [query-service.spec.md](services/query-service.spec.md) | Query Service — 관계형 질의 + 정책 해소 + gate 통합, 규칙 영속화, 충돌 전략 | RelationalEngine, policy-resolver | planned |

### operations/ — 운영 시나리오

런타임 흐름 정의와 심볼 체계. 모듈 스펙에서 `[S2]`, `[A5]` 등으로 cross-reference한다.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [runtime-flows.spec.md](operations/runtime-flows.spec.md) | 동기(S)/비동기(A)/디버깅(D) 3경로 흐름 정의, 심볼 체계, 모듈 참여 맵 | planned |

### tasks/ — 구현 태스크

runtime-flows 심볼 기반 도출 태스크. 📋/🔧 → ✅ 전환 작업 단위.

> 인덱스: [`tasks/README.md`](tasks/README.md)

| 태스크 | 대상 흐름 | spec.todo 매핑 |
|---|---|---|
| [test-bigint.md](tasks/test-bigint.md) | — | B-1 ~ B-3 |
| [infra-debug-store.md](tasks/infra-debug-store.md) | D3 | 신규 |
| [infra-sql-adapters.md](tasks/infra-sql-adapters.md) | S4 | H-1 ~ H-3 |
| [unit-1-async-worker.md](tasks/unit-1-async-worker.md) | A2→A4 | 신규 |
| [service-gate.md](tasks/service-gate.md) | S2, A4 | E-1 ~ E-4 |
| [service-query.md](tasks/service-query.md) | S2, A5 | F-1 ~ F-5 |
| [unit-2-pipeline.md](tasks/unit-2-pipeline.md) | A1, A5, A6 | I-1 ~ I-6 |
| [unit-3-monitoring.md](tasks/unit-3-monitoring.md) | A6 조회 | 신규 |

### infra/ — 인프라 도구

로깅 등 횡단 인프라 유틸리티.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [logger.spec.md](infra/logger.spec.md) | pino 기반 구조화 JSON 로거 | @qa-sdk/pino | implemented |

## 패키지 → 스펙 위치 매핑

코드 변경 시 관련 스펙을 찾기 위한 참조표.

| 패키지 | 스펙 위치 |
|---|---|
| @qa-sdk/core | `data-model/` |
| @qa-sdk/event-catalog | `event-vocabulary/` |
| @qa-sdk/sdk | `collection/` |
| @qa-sdk/engine | `pipeline/pipeline.spec.md` |
| @qa-sdk/store | `storage/` |
| @qa-sdk/ingest-server | `pipeline/ingest.spec.md` + `server/ingest/` |
| @qa-sdk/registry-server | `server/registry/services.spec.md`, `server/registry/events.spec.md` |
| @qa-sdk/registry-client | `server/registry/client.spec.md` |
| weighted-index | `indexing/weighted-index/README.md`, `indexing/weighted-index/core.spec.md`, `indexing/weighted-index/partial-binder.spec.md`, `indexing/weighted-index/pack-format.spec.md`, `indexing/weighted-index/range-query.spec.md` |
| demo-snapshot | `indexing/README.md` (데이터 카탈로그 섹션) |
| @qa-sdk/demo-tests | `indexing/README.md` (통합 테스트 섹션) |
| platform-demo | `indexing/README.md` (플랫폼 데모 섹션) |
| permission-engine | `indexing/permission-engine/README.md`, `indexing/permission-engine/core.spec.md`, `indexing/permission-engine/codec.spec.md`, `indexing/permission-engine/resource.spec.md`, `indexing/permission-engine/migration.spec.md` |
| index-meta | `indexing/index-meta/README.md` + `indexing/index-meta/` |
| @qa-sdk/pino | `infra/logger.spec.md` |
| @qa-sdk/browser | `browser/monitor.spec.md` |
| @qa-sdk/viz-web | `visualization/`, `web/` |
| @qa-sdk/roleplay-web | `roleplay/`, `web/iframe-protocol.spec.md` |
