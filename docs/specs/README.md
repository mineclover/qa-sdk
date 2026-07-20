---
sources:
  - scripts/design-usefulness-audit.mjs
  - scripts/verify-analysis-os.ts
  - scripts/package-surfaces.mjs
  - docs/specs/system/system-root.md
  - docs/specs/system/system-packages.spec.md
  - docs/specs/connection-system/federated-connection-contract.spec.md
---

# QA-SDK Specifications

> 시스템 전체 스펙을 **관심사(concern)** 기준으로 관리한다. 패키지 경계가 아닌 도메인 관심사별로 스펙을 배치하여 횡단 흐름을 한눈에 파악할 수 있게 한다.

## 관심사별 인덱스

### ingest/ + storage-system/ — 시스템 공유 타입 & 포트

시스템 전체가 공유하는 도메인 모델과 저장소 포트 계약. 예전 `data-model/` 관심사는 현재 ingest 계약과 storage-system 스펙으로 나뉘어 있다.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [record.spec.md](ingest/record.spec.md) | EventRecord 타입 + RecordStore 포트 | @qa-sdk/core | implemented |
| [trace.spec.md](ingest/trace.spec.md) | Trace 메타데이터 + TraceStore 포트 | @qa-sdk/core | implemented |
| [session-spec.md](ingest/session-spec.md) | QaSession + SessionStore 포트 | @qa-sdk/core | implemented |
| [transmission.spec.md](ingest/transmission.spec.md) | TransmissionEnvelope + TransmissionStore 포트 | @qa-sdk/core | implemented |
| [scenario-spec-store.spec.md](storage-system/scenario-spec-store.spec.md) | ScenarioSpec + ScenarioSpecStore 포트 | @qa-sdk/core | implemented |
| [graph.spec.md](storage-system/graph.spec.md) | RuntimeGraph / SpecGraph + GraphStore 포트 | @qa-sdk/core | implemented |
| [verdict.spec.md](storage-system/verdict.spec.md) | VerdictReport + VerdictStore 포트 | @qa-sdk/core | implemented |
| [dlq-store.spec.md](ingest/dlq-store.spec.md) | DlqPhase / DlqInsert / StoredDlqItem + DlqStore 포트 | @qa-sdk/core | implemented |
| [utils.spec.md](storage-system/utils.spec.md) | ID 생성 (ULID), Clock 유틸리티 | @qa-sdk/core | implemented |

### event-vocabulary/ — 이벤트 어휘

Core Event 정의, payload 가이드, 그래프 의미론 힌트.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [core-pattern.spec.md](event-vocab-system/core-pattern.spec.md) | Core Pattern v1 — 8개 카테고리 60개 이벤트 | @qa-sdk/event-catalog | implemented |
| [payload-guide.spec.md](event-vocab-system/payload-guide.spec.md) | v1 핵심 20개 이벤트 payload 필드 가이드 | @qa-sdk/event-catalog | implemented |
| [graph-hint.spec.md](event-vocab-system/graph-hint.spec.md) | 이벤트 그래프 의미론 (role, goal_eligible, loopable) | @qa-sdk/event-catalog | implemented |

### collection/ — SDK 수집 계층

클라이언트 사이드 이벤트 수집, 컨텍스트 관리, 마스킹, 전송.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [logger.spec.md](apm-system/logger.spec.md) | QaLogger — 이벤트 수집 진입점 + LogParams/SpanParams | @qa-sdk/sdk | implemented |
| [context.spec.md](browser-system/context.spec.md) | TraceContext — trace/span 스택 관리 | @qa-sdk/sdk | implemented |
| [masking.spec.md](permission/masking.spec.md) | applyMasking — 클라이언트 payload 마스킹 | @qa-sdk/sdk | implemented |
| [transport.spec.md](apm-system/transport.spec.md) | Transport 인터페이스 + HttpTransport/NoopTransport | @qa-sdk/sdk | implemented |

### pipeline/ — 엔진 & 오케스트레이션

4단계 파이프라인(Reconstruction → Compile → Match → Verdict)과 ingest 오케스트레이션.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [system-data-flow.spec.md](system/system-data-flow.spec.md) | 4단계 순수 연산 파이프라인 + ingest 전체 데이터 흐름 | @qa-sdk/engine | implemented |
| [ingest-interface-pipeline.spec.md](ingest/ingest-api-system/ingest-interface-pipeline.spec.md) | POST /v1/ingest — 수집 + 저장 + 후처리 오케스트레이션 | @qa-sdk/ingest-server | implemented |

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
| [query.spec.md](ingest/query.spec.md) | GET /v1/traces, /v1/sessions — 조회 API | @qa-sdk/ingest-server | implemented |
| [stream.spec.md](ingest/stream.spec.md) | GET /v1/streams — SSE 실시간 스트리밍 | @qa-sdk/ingest-server | implemented |
| [scenario.spec.md](ingest/scenario.spec.md) | ScenarioSpec CRUD | @qa-sdk/ingest-server | implemented |
| [verdict.spec.md](ingest/verdict.spec.md) | Verdict 조회 + 재계산 | @qa-sdk/ingest-server | implemented |
| [admin-api-system.md](ingest/admin-api-system.md) | DLQ 관리, TTL 정리 | @qa-sdk/ingest-server | implemented |
| [ingest-infra-system.md](ingest/ingest-infra-system.md) | health check, rate limit, graceful shutdown | @qa-sdk/ingest-server | implemented |

### server/registry/ — Registry Server & Client

서비스·이벤트 메타데이터 관리와 검증 클라이언트.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [services.spec.md](registry-system/services.spec.md) | Service CRUD API | @qa-sdk/registry-server | implemented |
| [events.spec.md](registry-system/events.spec.md) | Event 정의 CRUD + 버전 관리 | @qa-sdk/registry-server | implemented |
| [client.spec.md](registry-system/client.spec.md) | RegistryClient — 이벤트 검증 + 캐시 | @qa-sdk/registry-client | implemented |

### storage/ — 영속 계층

PostgreSQL 스키마와 어댑터 구현.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [schema.spec.md](storage-system/schema.spec.md) | PostgreSQL 테이블 스키마 | @qa-sdk/store | implemented |
| [adapters.spec.md](storage-system/adapters.spec.md) | Drizzle / InMemory 어댑터 | @qa-sdk/store | implemented |

### visualization/ — 그래프 시각화

SpecGraph DAG 시각화, 실시간 SSE 업데이트, UI 패널.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [viz-surface-system.md](viz-system/viz-surface-system.md) | dagre 레이아웃 + SVG 렌더링 + 실시간 업데이터 | @qa-sdk/viz-web | implemented |
| [viz-panel-layout.spec.md](viz-system/viz-surface-system/viz-panel-layout.spec.md) | 시나리오 선택기, 이벤트 로그, Verdict 표시 패널 | @qa-sdk/viz-web | implemented |

### roleplay/ — 롤플레이 폼 빌더

DOM 트리 모델 기반 비주얼 폼 빌더, QA 이벤트 발생.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [viz-roleplay-system.md](viz-system/viz-roleplay-system.md) | DOM 트리 모델, 속성 편집기, auto-layout, QA bridge 런타임 | @qa-sdk/roleplay-web | implemented |

### browser/ — 브라우저 모니터링 SDK

단일 번들 브라우저 SDK — BeaconTransport, SessionManager, AutoCapture, QaMonitor.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [browser-monitor-api.spec.md](browser-system/browser-runtime-system/browser-monitor-api.spec.md) | QaMonitor API, 초기화 순서, 고정 파라미터, 오류 처리 | @qa-sdk/browser | implemented |
| [browser-lifecycle-system.md](browser-system/browser-lifecycle-system.md) | 표준 생명주기 — 상태 전환 규칙, 각 단계 계약, 사용 패턴 | @qa-sdk/browser | implemented |
| [browser-session-patterns.spec.md](browser-system/browser-lifecycle-system/browser-session-patterns.spec.md) | SessionManager — 저장 스키마, 복원 로직, 탭 생명주기, 키 격리 | @qa-sdk/browser | implemented |
| [transport.spec.md](browser-system/transport.spec.md) | BeaconTransport — sendBeacon/fetch 전송 체인, 에러 시맨틱 | @qa-sdk/browser | implemented |
| [browser-capture-contract.spec.md](browser-system/browser-runtime-system/browser-capture-contract.spec.md) | AutoCapture — 수집 모드별 계약, payload 스키마, cleanup 프로토콜 | @qa-sdk/browser | implemented |

### web/ — 웹 공통 인프라

API 클라이언트, iframe 통신 프로토콜.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [api-client.spec.md](viz-system/api-client.spec.md) | REST fetch 래퍼 + WebSocket 구독 + cursor 기반 세션 레코드 조회 | @qa-sdk/viz-web | implemented |
| [iframe-protocol.spec.md](viz-system/iframe-protocol.spec.md) | postMessage 양방향 통신 프로토콜 | @qa-sdk/viz-web, @qa-sdk/roleplay-web | implemented |

### indexing/ — 인덱스 인코딩

가중진법 기반 다차원 좌표 ↔ 정수 ID 변환, 레이블/prefix 버전 관리, ID 포맷 적합성, 스키마 메타 DB.

> 개념 루트 문서: [`indexing/README.md`](indexing/README.md)

| 문서 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [README.md](indexing/README.md) | 인덱싱 관심사 개념 맵 — 레이어 구조, 문서 체계, 관심사 흐름 | — | — |
| [foundation.md](indexing-core-system/foundation.md) | 근본 원리 — 닫힌 공간, 전단사, 버전화된 공간 계열 | weighted-index + index-meta | — |
| [patterns.md](indexing-core-system/patterns.md) | 사용 패턴 — EntityId 이동, cross-index 참조, 활성/비활성 | weighted-index + index-meta | — |
| [conventions-system.md](indexing-core-system/conventions-system.md) | 관례/규칙 — ID 네이밍, 예약 토큰, EntityId 정규화, 커스텀 포맷 등록 절차 | weighted-index + index-meta | — |
| [weighted-index/README.md](indexing/weighted-index/README.md) | weighted-index 패키지 인덱스 — 수학 엔진, partial binder, pack format, range query 구성 | weighted-index | implemented |
| [wi-trace-group.md](weighted-index-system/wi-trace-group.md) | 변경 전파 추적성 — 3-tier 핀 구조, 변경 유형별 전파 경로, DKG·qa-sdk 계약 | weighted-index | implemented |
| [wi-api.spec.md](weighted-index-system/wi-api.spec.md) | WeightedIndex / LabelRegistry / PrefixCodec — 퍼블릭 API와 엔트리포인트 | weighted-index | implemented |
| [partial-binder.spec.md](weighted-index-system/partial-binder.spec.md) | PartialBinder / createBinder — 부분 차원 캐시, full path canonicalization, PrefixCodec 연동 | weighted-index | implemented |
| [wi-pack-format-system.md](weighted-index-system/wi-pack-format-system.md) | PackFormat / FormatRegistry / SemanticAddress / AddressConverter — 포맷·프로토콜·적합성 | weighted-index | implemented |
| [index-meta/README.md](indexing/index-meta/README.md) | MetaRegistry — 축·스냅샷·버전 스키마 + 활성 manifest | index-meta | implemented |
| [permission-engine/README.md](indexing/permission-engine/README.md) | permission-engine 패키지 인덱스 — core layer, 레이어 구조, 모듈 의존 관계 | permission-engine | implemented |
| [permission-system.md](permission/permission-system.md) | PermissionSet / TernaryMask / ScopedEngine — 권한 모델, codec, migration 시스템 인덱스 | permission-engine | implemented |
| [perm-codec-system.md](permission/perm-codec-system.md) | PermissionCodec — 3-tier protocol stack, text↔integer↔bitmask, PrefixCodec/index-meta 호환성 | permission-engine | implemented |
| [perm-resource-model.spec.md](permission/perm-external-system/perm-resource-model.spec.md) | resource / service-ref / permission-code — canonical resource 규칙, ServiceContext, permission text address | permission-engine | implemented |
| [perm-migration-system.md](permission/perm-migration-system.md) | migration.ts — shape 변경 시 grant 재배치, ID 매칭 자동 변환, `CoordMapper` 커스텀 변환 | permission-engine | implemented |
| [signal-model.md](indexing-core-system/signal-model.md) | Signal Model — Signal = 1회 qaTrack() 호출, 7 SignalRole, prefix→role 매핑, chain(requires) | viz-3d | implemented |
| [dim-ops-system.md](indexing-core-system/dim-ops-system.md) | 차원 연산 — cross-axis 선택, env 주입, deploy-time 해상도 | demo-snapshot + viz-3d | implemented |
| [table-system-group.md](indexing-core-system/table-system-group.md) | 테이블 시스템 — table_ref DimRef, 좌표↔관계형 양방향 | demo-snapshot | implemented |
| [dsl-bundle.md](indexing-core-system/dsl-bundle.md) | DSL 번들 — prefix 그룹핑, 버전 스큐 감지, 커버리지 분석 | spec-core | implemented |

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

### apm-system/ — APM 인프라

텔레메트리 파이프라인 고도화 — n차원 인덱싱 주소 체계 위의 APM 시스템.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [apm-system.md](apm-system/apm-system.md) | APM 관심사 전체 진입점 | approved |
| [apm-schema-system.md](apm-system/apm-schema-system.md) | DSL 축 설계와 `address_context` 형식 | approved |
| [metrics.spec.md](apm-system/metrics.spec.md) | Metric RecordKind + 집계 모델 | approved |
| [apm-codegen-system.md](apm-system/apm-codegen-system.md) | Protobuf/TypeScript codegen 문서군 | approved |
| [apm-runtime-system.md](apm-system/apm-runtime-system.md) | 런타임 흐름과 로거 계약 문서군 | approved |
| [apm-sdk.spec.md](apm-system/apm-sdk.spec.md) | `@qa-sdk/apm` 패키지 구현 surface | approved |

### dkg-system/ — 설계 지식 그래프

좌표계 성장 나선을 추적하는 메타데이터 그래프. 노드 16종, 엣지 18종, skill 39개.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [dkg-system.md](dkg-system/dkg-system.md) | DKG 시스템 모듈 — 전체 구성 overview | implemented |
| [dkg-node-types.spec.md](dkg-system/dkg-node-types.spec.md) | 16종 노드 타입 (Axis, Prefix, Decision, Observation, Skill 등) | implemented |
| [dkg-edge-types.spec.md](dkg-system/dkg-edge-types.spec.md) | 18종 엣지 타입 (composes, governs, observes 등) | implemented |
| [dkg-skills-system.md](dkg-system/dkg-skills-system.md) | 39개 skill 시스템 — read/write/analysis/chain 4카테고리 | implemented |
| [dkg-skill-catalog.spec.md](dkg-system/dkg-skills-system/dkg-skill-catalog.spec.md) | SkillNode 타입, specialization, 등록 체계, 전체 목록 | implemented |
| [dkg-state-store.spec.md](dkg-system/dkg-state-store.spec.md) | 로컬 SQLite 상태 저장소 (5 테이블) | implemented |
| [dkg-constraint.spec.md](dkg-system/dkg-constraint.spec.md) | CON-001~CON-007 불변 조건 | implemented |
| [dkg-growth-spiral.spec.md](dkg-system/dkg-growth-spiral.spec.md) | 고정 축 → 운용 → 발견 → 새 고정 축 성장 모델 | implemented |

### connection-system/ — 원본 식별자와 qa-sdk 연결 계약

원본 시스템의 local ID를 보존하면서 qa-sdk 연결 identity, mapping, typed relation을 관리하는 계약·운영 표면.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [federated-connection-contract.spec.md](connection-system/federated-connection-contract.spec.md) | SourceRef/ConnectionRef, source snapshot/observation, mapping conflict, typed relation, in-memory registry | federated-connection | implemented |
| [federated-connection-runtime.spec.md](connection-system/federated-connection-runtime.spec.md) | SQLite/memory state, impact plan, policy, approval, execute/re-fetch/verify runtime | federated-connection-runtime | implemented |

### meta-semantic/ — 메타 시맨틱 아키텍처

데이터 흐름을 검증 가능한 단위로 정의하는 체계. 9가지 원자 개념 + PipeFlow 29종 + ConnectionKind 8종 + 실행 엔진 + 표준 호환.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [meta-semantic-system.spec.md](meta-semantic/meta-semantic-system.spec.md) | 전체 시스템 그룹 — 2레이어 + 실행 엔진 + 표준 호환 | draft |
| [meta-semantic-concepts.spec.md](meta-semantic/meta-semantic-concepts.spec.md) | 9가지 원자 개념 — 패싯→바운더리→계약→이벤트→파이프→Folding→검증→경로→UID | draft |
| [ms-concept-folding.spec.md](meta-semantic/concepts/ms-concept-folding.spec.md) | Semantic Folding — 모듈/파이프에서 하위 패싯을 접어 인터페이스로 끌어올림 | draft |
| [meta-semantic-ir.spec.md](meta-semantic/meta-semantic-ir.spec.md) | Module·Data·Pipe IR 구조 | draft |
| [ms-concept-spacetime-uid.spec.md](meta-semantic/concepts/ms-concept-spacetime-uid.spec.md) | Spacetime UID — 분기 경로 + 시간 축 주소 | draft |
| [meta-semantic-scope.spec.md](meta-semantic/meta-semantic-ir/meta-semantic-scope.spec.md) | scope→aspect 경로 모델 + 검증 전략 (ScopeRegistry 구현 완료) | draft |
| [meta-semantic-extraction.spec.md](meta-semantic/algorithm/meta-semantic-extraction.spec.md) | LLM 기반 추출 — 검증 가능 함수 식별 | draft |
| [meta-semantic-pipe-impl.spec.md](meta-semantic/meta-semantic-pipe-impl.spec.md) | PipeFlow 29종 + ConnectionKind 8종 + 시뮬레이션 + 분석 (구현 완료, 399 tests) | draft |
| [meta-semantic-data-contract.spec.md](meta-semantic/pipe-impl/model/meta-semantic-data-contract.spec.md) | 데이터 계약 — 스키마 + 관계 + 계보 + 버전 (구현 완료) | draft |
| [meta-semantic-event-standard.spec.md](meta-semantic/interface/meta-semantic-event-standard.spec.md) | CloudEvents 호환 + 서비스 버전 매니페스트 + 라이프사이클 (구현 완료) | draft |
| [meta-semantic-execution-semantics.spec.md](meta-semantic/algorithm/meta-semantic-execution-semantics.spec.md) | Phase 3 런타임 — 조건 평가 + 에러 전파 + 취소 + PipeRunner (구현 완료) | draft |
| [meta-semantic-test-tracking.spec.md](meta-semantic/pipe-impl/meta-semantic-test-tracking.spec.md) | 테스트 추적 — 패싯별 검증 루프 (스펙만) | draft |
| [meta-semantic-v2-migration.spec.md](meta-semantic/migration/meta-semantic-v2-migration.spec.md) | v2 마이그레이션 계획 — Phase 1~4 | draft |

### operational-ontology/ — schema-first operational ontology 초안

taxonomy를 schema로 선언/검증한 뒤 node, relation type, edge, traversal을 좌표화하는 operational ontology 초안.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [operational-ontology-system.spec.md](operational-ontology/operational-ontology-system.spec.md) | schema plane, validation plane, instance plane 전체 구조와 RDF 대응 개요 | draft |
| [operational-ontology-taxonomy-schema.spec.md](operational-ontology/operational-ontology-taxonomy-schema.spec.md) | axis/taxonomy schema plane과 identity axis 규칙 | draft |
| [operational-ontology-relation-category-schema.spec.md](operational-ontology/operational-ontology-relation-category-schema.spec.md) | relation type category schema와 외부 catalog 연동 규칙 | draft |
| [operational-ontology-schema-validation.spec.md](operational-ontology/operational-ontology-schema-validation.spec.md) | taxonomy를 만들기 전에 검증하는 validation plane | draft |
| [operational-ontology-persistence.spec.md](operational-ontology/operational-ontology-persistence.spec.md) | facet bundle, append-only observation, rebuildable projection 저장 모델 | draft |
| [operational-ontology-data-facets.spec.md](operational-ontology/operational-ontology-data-facets.spec.md) | 정보를 definition/management/production/consumption/storage facet bundle로 다루는 원칙 | draft |
| [operational-ontology-flow-corridor.spec.md](operational-ontology/operational-ontology-flow-corridor.spec.md) | 데이터가 지나가는 통로를 `FlowCorridor`로 정의하는 원칙 | draft |
| [operational-ontology-junction.spec.md](operational-ontology/operational-ontology-junction.spec.md) | branch/join/retry를 junction 관점으로 읽는 원칙 | draft |
| [operational-ontology-checkpoint.spec.md](operational-ontology/operational-ontology-checkpoint.spec.md) | corridor 위 관측 지점을 checkpoint로 읽는 원칙 | draft |
| [operational-ontology-observation-topology.spec.md](operational-ontology/operational-ontology-observation-topology.spec.md) | corridor/junction/checkpoint를 함께 검증하는 상위 topology contract | draft |
| [operational-ontology-information-transmission.spec.md](operational-ontology/operational-ontology-information-transmission.spec.md) | edge를 정보 전달 semantics로 읽는 원칙 | draft |
| [operational-ontology-lineage.spec.md](operational-ontology/operational-ontology-lineage.spec.md) | 정보 facet 사이의 데이터 계보 추적 원칙 | draft |
| [operational-ontology-branch-handling.spec.md](operational-ontology/operational-ontology-branch-handling.spec.md) | 분기 처리의 최소 해석 모델 | draft |
| [operational-ontology-control-flow.spec.md](operational-ontology/operational-ontology-control-flow.spec.md) | 제어 흐름 관리의 최소 orchestration vocabulary | draft |
| [operational-ontology-simulation.spec.md](operational-ontology/operational-ontology-simulation.spec.md) | 정보 패싯과 전달을 시뮬레이션하는 해석층 | draft |
| [operational-ontology-runtime-interface.spec.md](operational-ontology/operational-ontology-runtime-interface.spec.md) | EventRecord/PipeGraph/DataSchema/PathObservation 기반 운영 포트 | draft |
| [operational-ontology-event-projector.spec.md](operational-ontology/operational-ontology-event-projector.spec.md) | EventRecord를 corridor/checkpoint lattice로 투영하는 표면 | draft |
| [operational-ontology-pipe-projector.spec.md](operational-ontology/operational-ontology-pipe-projector.spec.md) | PipeGraph를 control flow/corridor/junction으로 투영하는 표면 | draft |
| [operational-ontology-path-projector.spec.md](operational-ontology/operational-ontology-path-projector.spec.md) | PathObservation을 traversal/route decision으로 투영하는 표면 | draft |
| [operational-ontology-snapshot-projector.spec.md](operational-ontology/operational-ontology-snapshot-projector.spec.md) | projector 결과를 하나의 topology snapshot으로 합성하는 표면 | draft |
| [operational-ontology-package-architecture.spec.md](operational-ontology/operational-ontology-package-architecture.spec.md) | schema/corridor/junction/checkpoint/topology facade 기준 패키지 공개 구조 | draft |
| [operational-ontology-core-model.spec.md](operational-ontology/operational-ontology-core-model.spec.md) | anchor, taxonomy intersection, canonical identity, derived coordinate 구분 | draft |
| [operational-ontology-relation-taxonomy.spec.md](operational-ontology/operational-ontology-relation-taxonomy.spec.md) | relation type 자체를 taxonomy 교차점으로 다루는 규칙 | draft |
| [operational-ontology-edge-assertion.spec.md](operational-ontology/operational-ontology-edge-assertion.spec.md) | relation type이 특정 node 사이에서 성립한 assertion 모델 | draft |
| [operational-ontology-category-constraint.spec.md](operational-ontology/operational-ontology-category-constraint.spec.md) | relation type category별 축 허용/금지 규칙과 폭발 방지 grammar | draft |
| [operational-ontology-traversal-coordinate.spec.md](operational-ontology/operational-ontology-traversal-coordinate.spec.md) | start/end/edge chain과 purpose를 route identity로 다루는 방식 | draft |
| [operational-ontology-rdf-bridge.spec.md](operational-ontology/operational-ontology-rdf-bridge.spec.md) | RDF URI/triple/path를 operational coordinate와 연결하는 대응 규칙 | draft |

### authorization-ontology/ — Cerbos 중심 권한 온톨로지 초안

Cerbos를 단일 권한 선언/판정 중심으로 두고 identity/enforcement/deployment/data lineage를 operational ontology 좌표로 연결한다.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [authorization-ontology-system.spec.md](authorization-ontology/authorization-ontology-system.spec.md) | Cerbos 중심 authorization ontology 전체 구조 | draft |
| [authorization-ontology-realm-model.spec.md](authorization-ontology/authorization-ontology-realm-model.spec.md) | identity/policy/enforcement/infra/data realm 구분 규칙 | draft |
| [authorization-ontology-cerbos-mapping.spec.md](authorization-ontology/authorization-ontology-cerbos-mapping.spec.md) | Cerbos resource policy를 policy/resource/action graph로 투영하는 규칙 | draft |
| [authorization-ontology-auth-chain.spec.md](authorization-ontology/authorization-ontology-auth-chain.spec.md) | Pulumi/ArgoCD/LB/Caddy/Authentik/ZITADEL/Cerbos 역할 체인 | draft |
| [authorization-ontology-column-lineage-policy.spec.md](authorization-ontology/authorization-ontology-column-lineage-policy.spec.md) | 컬럼 리니지 transform 기반 권한 정책 전파 규칙 | draft |
| [authorization-ontology-decision-observation.spec.md](authorization-ontology/authorization-ontology-decision-observation.spec.md) | Cerbos check 결과를 decision graph로 관측하는 모델 | draft |
| [authorization-ontology-package-architecture.spec.md](authorization-ontology/authorization-ontology-package-architecture.spec.md) | authorization-ontology 패키지 공개 표면 | draft |

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

### simulations/ — 시뮬레이션 커버리지

qa-sdk 5축(권한·이벤트·관측·로직·로깅)을 실제 도메인에서 end-to-end 검증하는 시뮬레이션 결과 매트릭스.

| 스펙 | 설명 | 원본 경로 | 상태 |
|---|---|---|---|
| [sim-erp-pm-coverage.spec.md](sim-erp-pm-coverage.spec.md) | Enterprise PM 시뮬 — 5축 × 8 시나리오 매트릭스 + 회귀 게이트 | simulations/enterprise-pm/ | draft |

### operations/ — 운영 시나리오

런타임 흐름 정의와 심볼 체계. 모듈 스펙에서 `[S2]`, `[A5]` 등으로 cross-reference한다.

| 스펙 | 설명 | 상태 |
|---|---|---|
| [runtime-flow-paths.spec.md](apm-system/apm-runtime-system/runtime-flow-paths.spec.md) | 동기(S)/비동기(A)/디버깅(D) 3경로 흐름 정의, 심볼 체계, 모듈 참여 맵 | planned |

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
| [unit-2-pipeline.md](pipeline-system/unit-2-pipeline.md) | A1, A5, A6 | I-1 ~ I-6 |
| [unit-3-monitoring.md](tasks/unit-3-monitoring.md) | A6 조회 | 신규 |

### infra-engine/ — 하이브리드 배포 엔진

5단계 파이프라인 기반 멀티 프로바이더 배포 엔진. 서비스 레지스트리 자동 등록, 품질 게이트, ArgoCD 스타일 모니터링.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [infra-engine-pipeline.spec.md](infra-engine/infra-engine-pipeline.spec.md) | **중심 인덱스** — 5단계 파이프라인 + 패키지 구조 | infra-engine | implemented |
| [infra-config-stage.spec.md](infra-engine/infra-config-stage.spec.md) | ConfigStage — SOPS 복호화 + zod 검증 | infra-engine | implemented |
| [infra-provision-stage.spec.md](infra-engine/infra-provision-stage.spec.md) | ProvisionStage — Pulumi 실행 + DIY state backend | infra-engine | implemented |
| [infra-register-stage.spec.md](infra-engine/infra-register-stage.spec.md) | RegisterStage — registry-service 등록 + service-profile | infra-engine | implemented |
| [infra-verify-stage.spec.md](infra-engine/infra-verify-stage.spec.md) | VerifyStage — 헬스체크 + 품질 게이트 | infra-engine | implemented |
| [infra-observe-stage.spec.md](infra-engine/infra-observe-stage.spec.md) | ObserveStage — 배포 이벤트 emit + 모니터링 등록 | infra-engine | implemented |
| [infra-providers.spec.md](infra-engine/infra-providers.spec.md) | 프로바이더 추상화 — 6개 멀티 클라우드 | infra-engine | implemented |
| [infra-adapters.spec.md](infra-engine/infra-adapters.spec.md) | qa-sdk 연동 어댑터 — 6개 포트 인터페이스 | infra-engine | implemented |
| [infra-discovery.spec.md](infra-engine/infra-discovery.spec.md) | 서비스 디스커버리 + Fleet 관리 + export 도구 | infra-engine | implemented |
| [infra-monitoring.spec.md](infra-engine/infra-monitoring.spec.md) | ArgoCD 스타일 모니터링 — sync-loop + 대시보드 + 자동 복구 + SLA | infra-engine | implemented |

### infra-env-kit/ — 환경 공급 유틸리티

`infra-engine`에서 분리된 공급 패키지. `.env` 생성, 서비스 연결 코드 생성, export orchestration을 담당한다.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [infra-env-kit-system.spec.md](infra-env-kit/infra-env-kit-system.spec.md) | 중심 인덱스 — env bridge, export surface, post-deploy codegen | infra-env-kit | implemented |
| [infra-env-kit-env-bridge.spec.md](infra-env-kit/infra-env-kit-env-bridge.spec.md) | service config/dependency connection → env var 변환 | infra-env-kit | implemented |
| [infra-env-kit-export-surface.spec.md](infra-env-kit/infra-env-kit-export-surface.spec.md) | `infra-env env\|ts\|compose` CLI와 file writer surface | infra-env-kit | implemented |
| [infra-env-kit-codegen.spec.md](infra-env-kit/infra-env-kit-codegen.spec.md) | post-deploy service connection/env artifact 생성 | infra-env-kit | implemented |
| [infra-env-kit-validation.spec.md](infra-env-kit/infra-env-kit-validation.spec.md) | bridge/export/codegen/discovery 검증 경계 | infra-env-kit | implemented |

권장 surface:

```bash
pnpm --filter infra-env-kit build
pnpm --filter infra-env-kit cli --help
pnpm --filter infra-env-kit cli env ingest-server dev
pnpm --filter infra-env-kit cli ts dev
pnpm --filter infra-env-kit cli compose dev
```

운영/배포는 `infra`, 환경 공급은 `infra-env`로 분리해서 사용한다.

### resource-policy-store/ — 권한 리소스 lifecycle 저장소

`permission-engine`의 `ResourcePolicyRegistry` 포트를 SQLite/PG로 구현하고, PostgreSQL RLS enforcement 경계를 제공한다.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [resource-policy-store-system.spec.md](resource-policy-store/resource-policy-store-system.spec.md) | 중심 인덱스 — port, adapters, RLS, validation | resource-policy-store | implemented |
| [resource-policy-store-port.spec.md](resource-policy-store/resource-policy-store-port.spec.md) | permission-engine port/error re-export 경계 | resource-policy-store | implemented |
| [resource-policy-store-adapters.spec.md](resource-policy-store/resource-policy-store-adapters.spec.md) | SQLite/PG adapter와 dialect factory | resource-policy-store | implemented |
| [resource-policy-store-rls.spec.md](resource-policy-store/resource-policy-store-rls.spec.md) | RLS bit catalog와 RLS-aware PG adapter | resource-policy-store | implemented |
| [resource-policy-store-validation.spec.md](resource-policy-store/resource-policy-store-validation.spec.md) | adapter parity, lifecycle, RLS, E2E 검증 | resource-policy-store | implemented |

### audit-recorder-store/ — 권한 audit tree 저장소

`permission-engine`의 `AuditRecorder` 포트를 SQLite/PG로 구현하고, nested audit tree와 RLS shadow evidence를 영속화한다.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [audit-recorder-store-system.spec.md](audit-recorder-store/audit-recorder-store-system.spec.md) | 중심 인덱스 — port, adapters, RLS shadow, validation | audit-recorder-store | implemented |
| [audit-recorder-store-port.spec.md](audit-recorder-store/audit-recorder-store-port.spec.md) | dialect factory와 public package surface | audit-recorder-store | implemented |
| [audit-recorder-store-adapters.spec.md](audit-recorder-store/audit-recorder-store-adapters.spec.md) | SQLite/PG audit entry adapter와 schema | audit-recorder-store | implemented |
| [audit-recorder-store-rls-shadow.spec.md](audit-recorder-store/audit-recorder-store-rls-shadow.spec.md) | application decision vs RLS prediction shadow evidence | audit-recorder-store | implemented |
| [audit-recorder-store-validation.spec.md](audit-recorder-store/audit-recorder-store-validation.spec.md) | tree invariant, adapter parity, RLS, shadow 검증 | audit-recorder-store | implemented |

### infra/ — 인프라 도구

로깅 등 횡단 인프라 유틸리티.

### scaffold/ — 아키텍처 스캐폴딩 도구

Domain Slice Architecture를 빠르게 코드와 템플릿으로 물질화하는 `@qa-sdk/scaffold` 패키지. 이 구조는 도메인 계층, CQRS read/write 분리, adapter boundary, Nest module assembly, OpenMetadata 거버넌스 메타데이터 표준을 하나의 생성 단위로 묶는다.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [scaffold-system.spec.md](scaffold/scaffold-system.spec.md) | 중심 인덱스 — domain schematic, template catalog, validator, governance metadata | @qa-sdk/scaffold | implemented |
| [scaffold-domain-schematic.spec.md](scaffold/scaffold-domain-schematic.spec.md) | `nest g @qa-sdk/scaffold:domain` 생성 flow와 Nest module wiring | @qa-sdk/scaffold | implemented |
| [scaffold-domain-development-convention.rule.md](scaffold/scaffold-domain-development-convention.rule.md) | Domain Slice Architecture 코드 레이어와 책임 토폴로지 매핑 컨벤션 | @qa-sdk/scaffold | implemented |
| [scaffold-template-catalog.spec.md](scaffold/scaffold-template-catalog.spec.md) | 템플릿 artifact/rule을 학습 가능한 아키텍처 문법으로 노출 | @qa-sdk/scaffold | implemented |
| [scaffold-architecture-validator.spec.md](scaffold/scaffold-architecture-validator.spec.md) | domain/application/presentation import 경계 검증 | @qa-sdk/scaffold | implemented |
| [scaffold-governance-metadata.spec.md](scaffold/scaffold-governance-metadata.spec.md) | OpenMetadata domain/lineage/quality/cache key metadata scaffold 기준 | @qa-sdk/scaffold | implemented |
| [scaffold-openmetadata-storage.spec.md](scaffold/scaffold-openmetadata-storage.spec.md) | OpenMetadata seed manifest 저장 방식과 SSOT 경계 | @qa-sdk/scaffold | implemented |
| [scaffold-cache-key-dsl.spec.md](scaffold/scaffold-cache-key-dsl.spec.md) | cache key prefix DSL과 `prefix:version:id...` 생성/검증 규칙 | @qa-sdk/scaffold | implemented |

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [logger.spec.md](apm-system/logger.spec.md) | pino 호환 구조화 JSON 로거 | @qa-sdk/pino + @qa-sdk/core (createLogger) + @qa-sdk/logger | implemented |

## 패키지 → 스펙 위치 매핑

코드 변경 시 관련 스펙을 찾기 위한 참조표.

| 패키지 | 스펙 위치 |
|---|---|
| @qa-sdk/core | `ingest/record.spec.md`, `ingest/trace.spec.md`, `ingest/session-spec.md`, `ingest/transmission.spec.md`, `storage-system/graph.spec.md`, `storage-system/verdict.spec.md` |
| @qa-sdk/event-catalog | `event-vocabulary/` |
| @qa-sdk/sdk | `collection/` |
| @qa-sdk/engine | `spec-engine-system/spec-phases-runtime.spec.md`, `system/system-data-flow.spec.md` |
| @qa-sdk/store | `storage-system/` |
| @qa-sdk/ingest-server | `ingest/ingest-interface-pipeline.spec.md` + `server/ingest/` |
| @qa-sdk/registry-server | `registry-system/registry-api.spec.md`, `server/registry/services.spec.md`, `server/registry/events.spec.md` |
| @qa-sdk/registry-client | `server/registry/client.spec.md` |
| weighted-index | `weighted-index-system/wi-system.md`, `weighted-index-system/wi-api.spec.md`, `indexing/weighted-index/partial-binder.spec.md`, `weighted-index-system/wi-pack-format-system.md`, `indexing/weighted-index/range-query.spec.md` |
| demo-snapshot | `indexing/README.md` (데이터 카탈로그 섹션) |
| @qa-sdk/demo-tests | `indexing/README.md` (통합 테스트 섹션) |
| platform-demo | `indexing/README.md` (플랫폼 데모 섹션) |
| permission-engine | `permission/permission-system.md`, `permission/perm-codec-system.md`, `permission/perm-external-system.md`, `permission/perm-migration-system.md` |
| resource-policy-store | `resource-policy-store/` |
| audit-recorder-store | `audit-recorder-store/` |
| index-meta | `indexing/index-meta/README.md` + `indexing/index-meta/` |
| @qa-sdk/pino | `apm-system/logger.spec.md` (zero-dependency pino 호환 래퍼) |
| @qa-sdk/core (createLogger) | `apm-system/logger.spec.md` |
| @qa-sdk/logger | `apm-system/logger.spec.md`, `apm-system/transport.spec.md` |
| @qa-sdk/browser | `browser/monitor.spec.md` |
| @qa-sdk/viz-web | `visualization/`, `web/` |
| @qa-sdk/roleplay-web | `roleplay/`, `web/iframe-protocol.spec.md` |
| viz-3d | `indexing/signal-model.md`, `indexing/dimension-operations.md` |
| spec-core | `spec-engine/`, `dkg-system/` |
| @qa-sdk/cli | `spec-engine/` (codegen), `dkg-system/` (dkg 명령), `skill-catalog/` (skill 메타) |
| meta-semantic | `meta-semantic/` |
| infra-engine | `infra-engine/` |
| infra-env-kit | `infra-env-kit/` |
| shop-web | `browser-system/shop-web.spec.md` |
| platform-demo | — (3D 모니터 + 레이아웃 데모) |
| e2e | — (Playwright E2E 테스트) |
