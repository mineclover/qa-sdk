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
| [graph.spec.md](data-model/graph.spec.md) | RuntimeGraph / SpecGraph + GraphStore 포트 | @qa-sdk/core | implemented |
| [verdict.spec.md](data-model/verdict.spec.md) | VerdictReport + VerdictStore 포트 | @qa-sdk/core | implemented |
| [utils.spec.md](data-model/utils.spec.md) | ID 생성 (ULID), Clock 유틸리티 | @qa-sdk/core | implemented |

### event-vocabulary/ — 이벤트 어휘

Core Event 정의, payload 가이드, 그래프 의미론 힌트.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [core-pattern.spec.md](event-vocabulary/core-pattern.spec.md) | Core Pattern v1 — 8개 카테고리 60개 이벤트 | @qa-sdk/event-catalog | implemented |
| [payload-guide.spec.md](event-vocabulary/payload-guide.spec.md) | v1 핵심 20개 이벤트 payload 필드 가이드 | @qa-sdk/event-catalog | implemented |
| [graph-hint.spec.md](event-vocabulary/graph-hint.spec.md) | 이벤트 그래프 의미론 (role, goal_eligible, loopable) | @qa-sdk/event-catalog | draft |

### collection/ — SDK 수집 계층

클라이언트 사이드 이벤트 수집, 컨텍스트 관리, 마스킹, 전송.

| 스펙 | 설명 | 원본 패키지 | 상태 |
|---|---|---|---|
| [logger.spec.md](collection/logger.spec.md) | QaLogger — 이벤트 수집 진입점 | @qa-sdk/sdk | implemented |
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
| @qa-sdk/pino | `infra/logger.spec.md` |
