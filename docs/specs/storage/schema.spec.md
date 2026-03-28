---
def:
  id: storage-schema-spec
  address: def_document:v1:2681
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: ingest-server
  tags: [tier-infra]
  links:
    - target: graph-spec
      type: depends_on
    - target: verdict-spec
      type: depends_on
---

# DB Schema

## 목적 ^purpose

PostgreSQL 테이블 정의. Drizzle ORM `pgTable` 기반.

## 구성 ^overview

- **qa_sessions**: 세션 단위 관리 (session_id PK, scenario 연결, labels, 시작/종료 시각)
- **traces**: 트레이스 저장 (session FK, service_name, record_count, 재구성 여부 추적)
- **event_records**: 이벤트 레코드 본체 (trace FK, span 계층, payload 마스킹, registry_warning)
- **transmissions**: SDK 전송 메타데이터 (owner, service, sdk 버전, 플랫폼, 환경 정보)
- **runtime_graphs**: 트레이스별 런타임 그래프 (jsonb 저장, 노드/엣지 수 집계)
- **verdict_reports**: 시나리오 판정 결과 (scenario_id + trace_id UNIQUE, overall_verdict, jsonb report)
- **scenario_specs**: 시나리오 스펙 정의 (버전, 도메인, ScenarioSpec JSON 전체 저장)
- **dead_letter_queue**: 실패 레코드 재처리 큐 (reconstruction/verdict 단계, 시도 횟수 추적)

## 상태

implemented

## 테이블

### qa_sessions
| 컬럼 | 타입 | 제약 |
|---|---|---|
| session_id | text | PK |
| scenario_id | text | nullable |
| labels | jsonb | nullable, `Record<string, string>` |
| started_at | timestamptz | NOT NULL, default now() |
| closed_at | timestamptz | nullable |

### traces
| 컬럼 | 타입 | 제약 |
|---|---|---|
| trace_id | text | PK |
| session_id | text | FK → qa_sessions, nullable |
| service_name | text | nullable |
| record_count | integer | NOT NULL, default 0 |
| first_timestamp | timestamptz | nullable |
| last_timestamp | timestamptz | nullable |
| reconstructed | boolean | NOT NULL, default false |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

인덱스: `idx_traces_session_id`, `idx_traces_reconstructed`

### event_records
| 컬럼 | 타입 | 제약 |
|---|---|---|
| log_id | text | PK |
| trace_id | text | FK → traces, NOT NULL |
| span_id | text | NOT NULL |
| parent_span_id | text | nullable |
| timestamp | timestamptz | NOT NULL |
| record_kind | text | NOT NULL |
| event_key | text | NOT NULL |
| event_version | text | NOT NULL |
| span_name | text | nullable |
| start_time | timestamptz | nullable |
| end_time | timestamptz | nullable |
| status_code | text | nullable |
| payload_format | text | NOT NULL |
| payload_encoding | text | NOT NULL |
| payload_masking_applied | boolean | NOT NULL |
| payload_masked_fields | jsonb | NOT NULL, `string[]` |
| payload | jsonb | nullable |
| qa_session_id | text | nullable |
| created_at | timestamptz | NOT NULL, default now() |

| registry_warning | text | nullable |

인덱스: `idx_event_records_trace_id`, `idx_event_records_trace_timestamp` (trace_id + timestamp 복합), `idx_event_records_event_key`, `idx_event_records_session_id`

### transmissions
| 컬럼 | 타입 | 제약 |
|---|---|---|
| transmission_id | text | PK |
| sent_at | timestamptz | NOT NULL |
| owner_type | text | NOT NULL |
| owner_id | text | NOT NULL |
| service_name | text | NOT NULL |
| sdk_name | text | NOT NULL |
| sdk_version | text | NOT NULL |
| platform | text | NOT NULL |
| env | text | NOT NULL |
| record_count | integer | NOT NULL |
| received_at | timestamptz | NOT NULL, default now() |

### runtime_graphs
| 컬럼 | 타입 | 제약 |
|---|---|---|
| trace_id | text | PK, FK → traces |
| graph | jsonb | NOT NULL |
| node_count | integer | NOT NULL |
| edge_count | integer | NOT NULL |
| built_at | timestamptz | NOT NULL, default now() |

### verdict_reports
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | text | PK |
| scenario_id | text | NOT NULL |
| trace_id | text | FK → traces, NOT NULL |
| qa_session_id | text | nullable |
| overall_verdict | text | NOT NULL |
| report | jsonb | NOT NULL |
| computed_at | timestamptz | NOT NULL, default now() |

인덱스: `idx_verdict_reports_scenario_id`, `idx_verdict_reports_trace_id`, `idx_verdict_reports_session_id`, `idx_verdict_reports_verdict`
UNIQUE: (scenario_id, trace_id)

### scenario_specs
| 컬럼 | 타입 | 제약 |
|---|---|---|
| scenario_id | text | PK |
| version | text | NOT NULL |
| domain | text | NOT NULL |
| description | text | nullable |
| spec | jsonb | NOT NULL, ScenarioSpec JSON 전체 |
| created_at | timestamptz | NOT NULL, default now() |
| updated_at | timestamptz | NOT NULL, default now() |

인덱스: `idx_scenario_specs_domain`

### dead_letter_queue
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | text | PK |
| trace_id | text | FK → traces, NOT NULL |
| phase | text | NOT NULL (`"reconstruction"` \| `"verdict"`) |
| error_message | text | NOT NULL |
| attempt_count | integer | NOT NULL, default 0 |
| last_attempted_at | timestamptz | nullable |
| created_at | timestamptz | NOT NULL, default now() |
| resolved_at | timestamptz | nullable |

인덱스: `idx_dead_letter_queue_pending` (resolved_at, created_at 복합), `idx_dead_letter_queue_trace_phase` (trace_id, phase 복합)
