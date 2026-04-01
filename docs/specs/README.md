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
| [system-data-flow.spec.md](system/system-data-flow.spec.md) | 4단계 순수 연산 파이프라인 + ingest 전체 데이터 흐름 | @qa-sdk/engine | implemented |
| [ingest.spec.md](pipeline/ingest.spec.md) | POST /v1/ingest — 수집 + 저장 + 후처리 오케스트레이션 | @qa-sdk/ingest-server | implemented |

### transition/ — 전이 해석 계층

좌표계 위의 상태 전이 DSL. 이벤트 시퀀스에 상태 의미를 부여한다.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [plan/transition-spec-dsl/README.md](../plan/transition-spec-dsl/README.md) | Transition Spec DSL 전체 설계 | @qa-sdk/spec-core | implemented |
| [plan/transition-spec-dsl/tier-1-types-and-schema.md](../plan/transition-spec-dsl/tier-1-types-and-schema.md) | 타입 + 스키마 + registry | @qa-sdk/spec-core | implemented |
| [plan/transition-spec-dsl/tier-2-state-and-engine.md](../plan/transition-spec-dsl/tier-2-state-and-engine.md) | 축 기반 상태 + 7단계 엔진 | @qa-sdk/spec-core | implemented |
| [plan/transition-spec-dsl/tier-3-pipeline-integration.md](../plan/transition-spec-dsl/tier-3-pipeline-integration.md) | ingest 통합 + metric + API | @qa-sdk/spec-core + ingest + query | implemented |

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
| [viz-surface-system.md](viz-system/viz-surface-system.md) | dagre 레이아웃 + SVG 렌더링 + 실시간 업데이터 | @qa-sdk/viz-web | implemented |
| [viz-panel-layout.spec.md](viz-system/viz-panel-layout.spec.md) | 시나리오 선택기, 이벤트 로그, Verdict 표시 패널 | @qa-sdk/viz-web | implemented |

### roleplay/ — 롤플레이 폼 빌더

DOM 트리 모델 기반 비주얼 폼 빌더, QA 이벤트 발생.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [viz-roleplay-system.md](viz-system/viz-roleplay-system.md) | DOM 트리 모델, 속성 편집기, auto-layout, QA bridge 런타임 | @qa-sdk/roleplay-web | implemented |

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
| [conventions-system.md](indexing-core-system/conventions-system.md) | 관례/규칙 — ID 네이밍, 예약 토큰, EntityId 정규화, 커스텀 포맷 등록 절차 | weighted-index + index-meta | — |
| [weighted-index/README.md](indexing/weighted-index/README.md) | weighted-index 패키지 인덱스 — 수학 엔진, partial binder, pack format, range query 구성 | weighted-index | implemented |
| [wi-trace-group.md](weighted-index-system/wi-trace-group.md) | 변경 전파 추적성 — 3-tier 핀 구조, 변경 유형별 전파 경로, DKG·qa-sdk 계약 | weighted-index | implemented |
| [wi-api.spec.md](weighted-index-system/wi-api.spec.md) | WeightedIndex / LabelRegistry / PrefixCodec — 퍼블릭 API와 엔트리포인트 | weighted-index | implemented |
| [weighted-index/partial-binder.spec.md](indexing/weighted-index/partial-binder.spec.md) | PartialBinder / createBinder — 부분 차원 캐시, full path canonicalization, PrefixCodec 연동 | weighted-index | implemented |
| [wi-pack-format-system.md](weighted-index-system/wi-pack-format-system.md) | PackFormat / FormatRegistry / SemanticAddress / AddressConverter — 포맷·프로토콜·적합성 | weighted-index | implemented |
| [index-meta/registry.spec.md](indexing/index-meta/registry.spec.md) | MetaRegistry — 축·스냅샷·버전 스키마 + 활성 manifest | index-meta | implemented |
| [permission-engine/README.md](indexing/permission-engine/README.md) | permission-engine 패키지 인덱스 — core layer, 레이어 구조, 모듈 의존 관계 | permission-engine | implemented |
| [permission-system.md](permission/permission-system.md) | PermissionSet / TernaryMask / ScopedEngine — 권한 모델, codec, migration 시스템 인덱스 | permission-engine | implemented |
| [permission-engine/codec.spec.md](indexing/permission-engine/codec.spec.md) | PermissionCodec — 3-tier protocol stack, text↔integer↔bitmask, PrefixCodec/index-meta 호환성 | permission-engine | implemented |
| [permission-engine/resource.spec.md](indexing/permission-engine/resource.spec.md) | resource / service-ref / permission-code — canonical resource 규칙, ServiceContext, permission text address | permission-engine | implemented |
| [permission-engine/migration.spec.md](indexing/permission-engine/migration.spec.md) | migration.ts — shape 변경 시 grant 재배치, ID 매칭 자동 변환, `CoordMapper` 커스텀 변환 | permission-engine | implemented |
| [signal-model.md](indexing/signal-model.md) | Signal Model — Signal = 1회 qaTrack() 호출, 7 SignalRole, prefix→role 매핑, chain(requires) | viz-3d | implemented |
| [dimension-operations.md](indexing/dimension-operations.md) | 차원 연산 — cross-axis 선택, env 주입, deploy-time 해상도 | demo-snapshot + viz-3d | implemented |
| [table-system.md](indexing/table-system.md) | 테이블 시스템 — table_ref DimRef, 좌표↔관계형 양방향 | demo-snapshot | implemented |
| [dsl-bundle.md](indexing/dsl-bundle.md) | DSL 번들 — prefix 그룹핑, 버전 스큐 감지, 커버리지 분석 | spec-core | implemented |

### spec-engine/ — 작은 세계의 구조 정의 도구

좌표 시스템 위에서 "왜 이 구성인가, 밖에서 어떻게 보이는지"를 정의하는 레이어.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [README.md](spec-engine/README.md) | 프로젝트 정체성, indexing 레이어와의 경계, 핵심 개념 | design |
| [spec-core-types-group.md](spec-engine-system/spec-core-types-group.md) | ExportSurface, Schema(6종), PrefixSpec, SpecDocument, Registry API | implemented |
| [spec-architecture-system.md](spec-engine-system/spec-architecture-system.md) | NestJS 모듈 매핑, 계층 분리, decorator/interceptor 설계 | implemented |
| [spec-phases-group.md](spec-engine-system/spec-phases-group.md) | 5단계 구현 계획 + 검증 기준 + 기술 스택 | implemented |
| [dkg-system.md](dkg-system/dkg-system.md) | Design Knowledge Graph — 설계 시점 메타데이터 그래프와 성장 나선 모델 | design |
| [dkg-skills-system.md](dkg-system/dkg-skills-system.md) | DKG Skills — 종단 파이프라인, migrator 추론, VersionEvent 파생, Decision 템플릿, skill 카탈로그 | implemented |
| [spec-prop-system.md](spec-engine-system/spec-prop-system.md) | Spec Propagation — 스펙 작성 → registry 고정 → 소비자 전파 → codegen → DKG 기록 종단 파이프라인 | implemented |

### apm/ — APM 인프라

텔레메트리 파이프라인 고도화 — n차원 인덱싱 주소 체계 위의 APM 시스템.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [README.md](apm/README.md) | APM 관심사 개요 — 레이어 다이어그램, Snapshot Supply 전략 | spec-complete |
| [dsl-schemas.spec.md](apm/dsl-schemas.spec.md) | Git/K8s DSL 축 + composite + snapshotSupply 전략 | spec-complete |
| [address-context.spec.md](apm/address-context.spec.md) | EventRecord/Envelope 주소 태깅 계약 + 전략별 포맷 | spec-complete |
| [metrics.spec.md](apm/metrics.spec.md) | Metric RecordKind + 집계 모델 | spec-complete |
| [codegen.spec.md](apm/codegen.spec.md) | Protobuf + CLI 타입 공급 + snapshotSupply 코드젠 | spec-complete |
| [pipeline.spec.md](apm/pipeline.spec.md) | 파이프라인 고도화 — 미들웨어, Phase 2 metric, Range Query | spec-complete |

### dkg-system/ — 설계 지식 그래프

좌표계 성장 나선을 추적하는 메타데이터 그래프. 노드 16종, 엣지 18종, skill 39개.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [dkg-system.md](dkg-system/dkg-system.md) | DKG 시스템 모듈 — 전체 구성 overview | implemented |
| [dkg-node-types.spec.md](dkg-system/dkg-node-types.spec.md) | 16종 노드 타입 (Axis, Prefix, Decision, Observation, Skill 등) | implemented |
| [dkg-edge-types.spec.md](dkg-system/dkg-edge-types.spec.md) | 18종 엣지 타입 (composes, governs, observes 등) | implemented |
| [dkg-skills-system.md](dkg-system/dkg-skills-system.md) | 39개 skill 시스템 — read/write/analysis/chain 4카테고리 | implemented |
| [dkg-skill-catalog.spec.md](dkg-system/dkg-skill-catalog.spec.md) | SkillNode 타입, specialization, 등록 체계, 전체 목록 | implemented |
| [dkg-state-store.spec.md](dkg-system/dkg-state-store.spec.md) | 로컬 SQLite 상태 저장소 (5 테이블) | implemented |
| [dkg-constraint.spec.md](dkg-system/dkg-constraint.spec.md) | CON-001~CON-007 불변 조건 | implemented |
| [dkg-growth-spiral.spec.md](dkg-system/dkg-growth-spiral.spec.md) | 고정 축 → 운용 → 발견 → 새 고정 축 성장 모델 | implemented |

### meta-semantic/ — 메타 시맨틱 아키텍처

데이터 흐름을 검증 가능한 단위로 정의하는 체계. 9가지 원자 개념 + PipeFlow 29종 + ConnectionKind 8종 + 실행 엔진 + 표준 호환.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [meta-semantic-system.spec.md](meta-semantic/meta-semantic-system.spec.md) | 전체 시스템 그룹 — 2레이어 + 실행 엔진 + 표준 호환 | draft |
| [meta-semantic-concepts.spec.md](meta-semantic/meta-semantic-concepts.spec.md) | 9가지 원자 개념 — 패싯→바운더리→계약→이벤트→파이프→Folding→검증→경로→UID | draft |
| [meta-semantic-folding.spec.md](meta-semantic/meta-semantic-folding.spec.md) | Semantic Folding — 모듈/파이프에서 하위 패싯을 접어 인터페이스로 끌어올림 | draft |
| [meta-semantic-ir.spec.md](meta-semantic/meta-semantic-ir.spec.md) | Module·Data·Pipe IR 구조 | draft |
| [meta-semantic-spacetime-uid.spec.md](meta-semantic/meta-semantic-spacetime-uid.spec.md) | Spacetime UID — 분기 경로 + 시간 축 주소 | draft |
| [meta-semantic-scope.spec.md](meta-semantic/meta-semantic-scope.spec.md) | scope→aspect 경로 모델 + 검증 전략 (ScopeRegistry 구현 완료) | draft |
| [meta-semantic-extraction.spec.md](meta-semantic/meta-semantic-extraction.spec.md) | LLM 기반 추출 — 검증 가능 함수 식별 | draft |
| [meta-semantic-pipe-impl.spec.md](meta-semantic/meta-semantic-pipe-impl.spec.md) | PipeFlow 29종 + ConnectionKind 8종 + 시뮬레이션 + 분석 (구현 완료, 399 tests) | draft |
| [meta-semantic-data-contract.spec.md](meta-semantic/meta-semantic-data-contract.spec.md) | 데이터 계약 — 스키마 + 관계 + 계보 + 버전 (구현 완료) | draft |
| [meta-semantic-event-standard.spec.md](meta-semantic/meta-semantic-event-standard.spec.md) | CloudEvents 호환 + 서비스 버전 매니페스트 + 라이프사이클 (구현 완료) | draft |
| [meta-semantic-execution-semantics.spec.md](meta-semantic/meta-semantic-execution-semantics.spec.md) | Phase 3 런타임 — 조건 평가 + 에러 전파 + 취소 + PipeRunner (구현 완료) | draft |
| [meta-semantic-test-tracking.spec.md](meta-semantic/meta-semantic-test-tracking.spec.md) | 테스트 추적 — 패싯별 검증 루프 (스펙만) | draft |
| [meta-semantic-v2-migration.spec.md](meta-semantic/meta-semantic-v2-migration.spec.md) | v2 마이그레이션 계획 — Phase 1~4 | draft |

### skill-catalog/ — 스킬 카탈로그

Claude/Codex skill + DKG skill의 목적·맥락·관계를 experience 계층에서 관리.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [skill-catalog-system.md](skill-catalog/skill-catalog-system.md) | 전체 그룹 구조 — 5개 그룹, 3디렉토리 경계 | implemented |
| [claude-skill-group.md](skill-catalog/claude-skill-group.md) | definition-catalog 중심 Claude skill 11개 | implemented |
| [dkg-skill-group.md](skill-catalog/dkg-skill-group.md) | DKG 자동화 39개 — 현황 + 도메인 계층 연결 | implemented |

### quality-gates/ — 품질 게이트 & 하네스

11개 FSM 머신, 8개 번들, 24개 게이트 문서. 하네스가 문서/코드 생명주기를 상태 머신으로 관리하고, 품질 원장이 gate 실행 결과를 영속한다.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [quality-gates-system.md](quality-gates/quality-gates-system.md) | 루트 모듈 — 8개 번들 + quality-ledger + dkg-harness-bridge | implemented |
| [quality-ledger.spec.md](quality-gates/quality-ledger.spec.md) | gate 실행 원장 — SQLite 스키마, 검증 판정 로직 | implemented |
| [dkg-harness-bridge.spec.md](quality-gates/dkg-harness-bridge.spec.md) | DKG skill ↔ 하네스 연결 — skill 발견 → 하네스 상태 영향 | implemented |
| [harness-state-model.spec.md](quality-gates/harness-state-model.spec.md) | 4단계 구조 상태 (concept → contract → gate → verified) | implemented |

### services/ — 서비스 분리 스펙

인덱싱 시스템의 마이크로서비스 분리 API 계약.

| 스펙 | 설명 | 기반 모듈 | 상태 |
|---|---|---|---|
| [registry-api.spec.md](registry-system/registry-api.spec.md) | Registry Service — 중앙 prefix DAG와 버전 라이프사이클 API 계약 | PrefixRegistry, VersionLifecycle | implemented |
| [decode-api.spec.md](decode-system/decode-api.spec.md) | Decode Service — DecodeMap 번들 기반 독립 decode와 REST API | PrefixDecoder, MetaResolver | implemented |
| [gate-api.spec.md](gate/gate-api.spec.md) | Gate Service — 주소 상태 관리 API와 cascade 정합성 모델 | GateEngine, invalid-ranges | implemented |
| [query-api.spec.md](query-system/query-api.spec.md) | Query Service — 관계형 질의, 정책 해소, gate 통합 API | RelationalEngine, policy-resolver | implemented |

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
| @qa-sdk/engine | `spec-engine-system/spec-phases-runtime.spec.md`, `system/system-data-flow.spec.md` |
| @qa-sdk/store | `storage/` |
| @qa-sdk/ingest-server | `ingest/ingest-interface-pipeline.spec.md` + `server/ingest/` |
| @qa-sdk/registry-server | `registry-system/registry-api.spec.md`, `server/registry/services.spec.md`, `server/registry/events.spec.md` |
| @qa-sdk/registry-client | `server/registry/client.spec.md` |
| weighted-index | `weighted-index-system/wi-system.md`, `weighted-index-system/wi-api.spec.md`, `indexing/weighted-index/partial-binder.spec.md`, `weighted-index-system/wi-pack-format-system.md`, `indexing/weighted-index/range-query.spec.md` |
| demo-snapshot | `indexing/README.md` (데이터 카탈로그 섹션) |
| @qa-sdk/demo-tests | `indexing/README.md` (통합 테스트 섹션) |
| platform-demo | `indexing/README.md` (플랫폼 데모 섹션) |
| permission-engine | `permission/permission-system.md`, `permission/perm-codec-system.md`, `permission/perm-external-system.md`, `permission/perm-migration-system.md` |
| index-meta | `indexing/index-meta/README.md` + `indexing/index-meta/` |
| @qa-sdk/pino | `infra/logger.spec.md` |
| @qa-sdk/browser | `browser/monitor.spec.md` |
| @qa-sdk/viz-web | `visualization/`, `web/` |
| @qa-sdk/roleplay-web | `roleplay/`, `web/iframe-protocol.spec.md` |
| viz-3d | `indexing/signal-model.md`, `indexing/dimension-operations.md` |
| spec-core | `spec-engine/`, `dkg-system/` |
| @qa-sdk/cli | `spec-engine/` (codegen), `dkg-system/` (dkg 명령), `skill-catalog/` (skill 메타) |
| meta-semantic | `meta-semantic/` |
| shop-web | — (데모 사이트, 별도 스펙 없음) |
| platform-demo | — (3D 모니터 + 레이아웃 데모) |
| e2e | — (Playwright E2E 테스트) |
