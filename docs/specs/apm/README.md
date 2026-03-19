# APM 인프라 — 텔레메트리 파이프라인 고도화

> n차원 인덱싱 주소 체계 위에서 동작하는 APM 시스템 설계. Git DSL + K8s DSL을 prefix 스키마로 정의하고, CLI codegen으로 protobuf 스펙/타입을 공급하며, 기존 텔레메트리 파이프라인을 확장한다.

## 레이어 다이어그램

```
┌─────────────────────────────────────────────────────┐
│  CLI Codegen       protobuf .proto + .d.ts 생성     │
│                    GENERATION + PREFIXES(stride) 포함│
├─────────────────────────────────────────────────────┤
│  SDK Layer         PartialBinder로 boot-time 차원    │
│                    고정 (schema_version 포함)        │
│                    → 런타임 resolve → 전송           │
├─────────────────────────────────────────────────────┤
│  Ingest Pipeline   infra_context 머지 → 저장         │
│                    Phase 2: metric aggregation       │
├─────────────────────────────────────────────────────┤
│  Query Layer       calcAddressRanges → SQL BETWEEN   │
│                    schema_version 포함 축별 필터     │
├─────────────────────────────────────────────────────┤
│  DSL Schemas       Git DSL / K8s DSL / APM Signal    │
│  (registry-service prefix schemas)                   │
│  schema_version 공통 축 + 2-level 버전 체계         │
└─────────────────────────────────────────────────────┘
```

## Snapshot Supply 전략

> 상세: [`indexing/conventions.md §5`](../indexing/conventions.md)

배포 시점의 entry set(snapshot)을 어떻게 추적하는지를 composite별로 선택한다:

| 전략 | snapshot 위치 | Range Query | 주요 용도 |
|---|---|---|---|
| `axis` | index 안 (schema_version 차원) | 네이티브 constraint | 크로스-버전 분석 |
| `envelope` | TransmissionEnvelope 필드 | 별도 WHERE | 수집/감사 |
| `context` | address_context 키 | JSONB WHERE | 혼합 워크로드 |
| `implicit` | 없음 | 불가 | 내부 도구 |

주소 형식 `prefix:v:index`에서 **v = stride를 확정한 version** (기존 version ID 그대로). prefix는 **capacity/stride 배열을 동반 저장** → v만 알면 디코드 가능.

## 기존 시스템 연결점

| 기존 모듈 | APM 연결점 | 역할 |
|---|---|---|
| `@qa-sdk/core` (EventRecord, TransmissionEnvelope) | `address_context`, metric 필드 확장 | 데이터 모델 기반 |
| `@qa-sdk/ingest-server` (Phase 1/2) | `enrichAddressContext` 미들웨어, metric aggregation | 파이프라인 확장 |
| `registry-service` (SchemaSnapshot, prefix DAG) | Git/K8s DSL 축 정의 + `POST /schema/import` | 스키마 소스 |
| `weighted-index` (PartialBinder, calcAddressRanges) | SDK boot-time 차원 고정, Range Query 엔진 | 주소 연산 |
| `index-meta` (MetaCodec, EntryFlagStore) | 1D address 저장, 상태 관리 | 영속 계층 |

## 문서 인덱스

| 스펙 | 설명 | 상태 |
|---|---|---|
| [dsl-schemas.spec.md](dsl-schemas.spec.md) | Git/K8s DSL 축 + composite + SchemaSnapshot 정의 | planned |
| [address-context.spec.md](address-context.spec.md) | EventRecord/Envelope 주소 태깅 계약 | planned |
| [metrics.spec.md](metrics.spec.md) | Metric RecordKind + 집계 모델 | planned |
| [codegen.spec.md](codegen.spec.md) | Protobuf + CLI 타입 공급 파이프라인 | planned |
| [pipeline.spec.md](pipeline.spec.md) | 파이프라인 고도화 — 미들웨어, Phase 2 metric, Range Query | planned |

## Unit 2/3 관계

| 태스크 | APM 관계 | 방향 |
|---|---|---|
| Unit 2 Aggregator (`tasks/unit-2-pipeline.md`) | metric aggregation의 입력 소스. APM metric RecordKind → Aggregator 인터페이스 재사용 | APM → Unit 2 |
| Unit 3 Monitoring API (`tasks/unit-3-monitoring.md`) | 축별 필터 쿼리 패턴 공유. `matchRanges` → `calcAddressRanges` 동일 엔진 | APM ↔ Unit 3 |

### 데이터 흐름

```
SDK (PartialBinder)
  │
  ▼
TransmissionEnvelope + address_context
  │
  ▼
POST /v1/ingest ─── Phase 1: enrichAddressContext → 저장
  │
  ▼
Phase 2 Worker ─── metric aggregation (Unit 2 Aggregator 재사용)
  │
  ▼
Query Layer ─── calcAddressRanges → SQL BETWEEN (Unit 3 패턴 공유)
  │
  ▼
SSE / REST ─── 축별 구독 + 시간 범위 필터
```

## 비고

- **인증 레이어는 후순위** — 현 단계에서는 주소 체계 + 파이프라인 확장에 집중
- 모든 축 capacity는 53비트 `Number.MAX_SAFE_INTEGER` 범위 내 설계
- 고카디널리티 값(pod_name, commit_hash)은 축이 아닌 payload로 처리
