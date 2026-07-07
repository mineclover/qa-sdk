---
def:
  id: ingest-coordinate-storage-audit
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: ingest-system
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: coordinate-storage
      type: refs
status: implemented
date: 2026-04-22
part_of: auth-model-implementation-backlog
role: audit
sources:
  - docs/specs/system/coordinate-storage.rule.md
  - docs/proposals/auth-model-implementation-backlog/plans/02-ingest-audit-versioning.md
  - packages/core/src/coordinates/address-context-schema.ts
  - packages/core/src/coordinates/address-context-schema.test.ts
  - packages/core/src/schema/record.schema.ts
  - packages/core/src/schema/envelope.schema.ts
  - packages/core/src/schema/schema.test.ts
  - packages/ingest-server/src/db/schema.ts
  - packages/ingest-server/src/db/json-types.ts
  - packages/ingest-server/src/stores/d1-schema.sql.ts
  - packages/ingest-server/src/stores/d1-key-observation-store.ts
  - packages/ingest-server/src/stores/d1-key-observation-store.versioned.test.ts
  - packages/ingest-server/src/stores/migrations/0001_key_observations_versioned.sql.ts
  - packages/ingest-server/src/stores/migrations/0002_key_observation_prefixes_versioned.sql.ts
  - packages/ingest-server/src/stores/pg/schema.ts
  - packages/ingest-server/src/stores/pg/key-observation.adapter.ts
  - packages/ingest-server/src/stores/pg/key-observation.adapter.test.ts
  - packages/ingest-server/src/stores/clickhouse-schema.sql.ts
---

# ingest-server 좌표 저장 감사

## 목적 ^purpose

ingest-server의 저장 스키마를 `coordinate-storage.rule.md` 기준으로 감사하고, 이행 필요성을 평가한다.

> **현재 이행 상태 (2026-04-22 이후)**: P1·P2·P3는 D1과 PG key-observation 저장 경로에 적용 완료. `event_records.address_context`는 core `AddressContextV1Schema`와 record/envelope schema가 packed address 형식을 검증한다. ClickHouse key-observation analytics schema는 운영 도입 시점 동기 대상으로 명시 보류.

**현재 결론**: active D1/PG ingest 저장 경로는 `coordinate-storage.rule`을 준수한다. ClickHouse는 아직 active 준수 근거로 세지 않고, `clickhouse-schema.sql.ts`의 TODO에 따라 운영 도입 전 동일 패턴으로 동기해야 한다.

감사 대상: D1 DDL/Drizzle schema, D1/PG key-observation adapters, core address-context schema, ClickHouse deferred analytics schema.

## 현재 증거 표면 ^evidence

- D1 DDL과 Drizzle schema는 `key_observations`를 `(prefix_id, version, address)` PK로, `key_observation_prefixes`를 `(prefix_id, version)` PK로 선언한다.
- `D1KeyObservationStore`와 `PgKeyObservationStore`는 `parsePackedAddress()`로 packed key에서 `version`/`address`를 분리하고 version별 prefix summary를 유지한다.
- `AddressContextV1Schema`는 `prefix:version:address` 또는 `catalogId:prefix:version:address` 형식을 검증하며, record/envelope schema가 `address_context`와 `infra_context`에 이를 적용한다.
- `clickhouse-schema.sql.ts`는 ClickHouse key-observation schema 동기를 운영 도입 전 TODO로 보존한다. 따라서 이 문서의 "준수" 판정은 active D1/PG ingest path에 한정된다.

---

## 1. 분류 체계

`coordinate-storage.rule`의 §1 기준으로 세 범주:

| 범주 | 정의 | rule 적용 |
|---|---|---|
| **A** | 정수 address 저장 (Hybrid 패턴 후보) | §1.1 적용 |
| **B** | JSON/문자열로 좌표 저장 | §1.2 적용 |
| **C** | 좌표 저장 아님 (세션·트레이스·감사 메타데이터 등) | 예외 |

---

## 2. 테이블별 감사

### 2.1 `event_records` — 범주 B (준수)

| 컬럼 | 역할 | rule 평가 |
|---|---|---|
| `event_key` TEXT | 문자열 이벤트 키 | 좌표 아닌 식별자 — B의 핵심 |
| `event_version` TEXT | 이벤트 스키마 버전 | ✅ version 동봉 |
| `address_context` TEXT/JSONB | 좌표 맥락 JSON blob | ✅ `AddressContextV1Schema` packed key 값에 version 포함 |

**판정**: event_key + event_version은 규칙 2.1(version 격리) 충족. `address_context`는 `Record<prefix, packedAddress>` 형태이며 packed address 값이 version을 포함한다.

**근거**: `packages/core/src/coordinates/address-context-schema.ts`, `packages/core/src/schema/record.schema.ts`, `packages/core/src/schema/envelope.schema.ts`.

### 2.2 `key_observations` — 범주 A (준수)

| 컬럼 | 역할 | rule 평가 |
|---|---|---|
| `prefix_id` TEXT | prefix 네임스페이스 | ✅ §1.1의 prefix_id 요건 충족 |
| `version` TEXT | prefix shape version | ✅ version 격리 컬럼 |
| `address` INTEGER | 1D 좌표 | ✅ address 정수 컬럼 |
| `packed_key` TEXT | 역호환/이력용 문자열 | ✅ secondary index |
| `(prefix_id, version, address)` PK | versioned coordinate identity | ✅ §1.1 복합 키 충족 |

**판정**: D1/PG 모두 `packed_key` 단일 PK를 폐기하고 `(prefix_id, version, address)` 복합 PK를 사용한다.

**근거**: `packages/ingest-server/src/db/schema.ts`, `packages/ingest-server/src/stores/d1-key-observation-store.ts`, `packages/ingest-server/src/stores/pg/schema.ts`.

### 2.3 `key_observation_prefixes` — 집계 테이블 (준수)

| 컬럼 | 역할 | rule 평가 |
|---|---|---|
| `prefix_id` TEXT | prefix 네임스페이스 | ✅ §1.1의 prefix_id 요건 충족 |
| `version` TEXT | prefix shape version | ✅ version별 집계 분리 |
| `(prefix_id, version)` PK | versioned aggregate identity | ✅ 집계 테이블 예외 패턴 충족 |

**판정**: prefix aggregate도 version별로 분리되어 다중 version 통계 혼합을 방지한다.

**근거**: `packages/ingest-server/src/stores/d1-key-observation-store.versioned.test.ts`, `packages/ingest-server/src/stores/pg/key-observation.adapter.test.ts`.

### 2.4 `verdict_reports` — 범주 C

`scenario_id` + `trace_id` 복합. 좌표 아님. 예외.

### 2.5 `scenario_specs` — 범주 C (version 있음)

`scenario_id` PK + `version` 컬럼. scenario 정의 자체의 version으로 좌표 저장 아님. 예외.

### 2.6 기타 테이블 — 범주 C

`qa_sessions`, `traces`, `transmissions`, `dead_letter_queue`, `insight_labels`, `runtime_graphs` — 모두 좌표 저장 아님. 예외.

---

## 3. 이행 항목

### P1 — `key_observations` version 컬럼 추가 (완료)

- `version`, `address` 컬럼 추가.
- D1/PG store가 `parsePackedAddress()`를 통해 packed key에서 구조화 값을 분리.
- PK를 `(prefix_id, version, address)`로 전환.

### P2 — `address_context` JSON 스키마 계약화 (완료)

- `AddressContextV1Schema`가 packed address 값을 검증.
- `eventRecordSchema`와 `transmissionEnvelopeSchema`가 `address_context`/`infra_context`에 schema를 적용.

### P3 — `key_observation_prefixes` version 차원 (완료)

- prefix aggregate에 `version` 컬럼 추가.
- PK를 `(prefix_id, version)`으로 전환.
- `prefixSummary()`가 version별 row를 반환.

---

## 4. 보류/범위 결정

- D1/PG ingest path는 이행 완료.
- ClickHouse key-observation analytics schema는 아직 `packed_key` 중심이다. 파일 상단 TODO에 따라 운영 도입 시 `version LowCardinality(String)`과 `(prefix_id, version, packed_key)` order key로 동기한다.
- 이 보류는 active ingest compliance 예외가 아니라 deferred analytics backend 범위다.

---

## 5. 감사 재실행 조건

다음 시점에 본 감사를 재수행:

- prefix 또는 shape 스키마 변경 계획 수립 시
- 저장소 마이그레이션(D1 → PG, ClickHouse 이관 등) 시
- `coordinate-storage.rule` 자체 개정 시
- 신규 좌표 저장 테이블 추가 시
- ClickHouse key-observation analytics path를 운영 활성화할 때

---

## 6. 링크

- 규칙: `docs/specs/system/coordinate-storage.rule.md`
- 전략: `packages/weighted-index/docs/rdbms-equivalence/strategy-hybrid.md`
- 이행 계획: `docs/proposals/auth-model-implementation-backlog/plans/02-ingest-audit-versioning.md`
- 작성자 체크리스트: `docs/proposals/auth-model-implementation-backlog/coordinate-storage-pr-checklist.md`

---

## 이행 완료 (2026-04-22)

| 항목 | 상태 | 위치 |
|---|---|---|
| P1 — `key_observations` version 컬럼 | ✅ 완료 | `packages/ingest-server/src/db/schema.ts`, `packages/ingest-server/src/stores/d1-key-observation-store.ts`, `packages/ingest-server/src/stores/pg/schema.ts`, 마이그레이션 `packages/ingest-server/src/stores/migrations/0001_key_observations_versioned.sql.ts` |
| P2 — `address_context` JSON 스키마 계약 | ✅ 완료 | `AddressContextV1Schema` in `@qa-sdk/core/coordinates/address-context-schema`, `record.schema.ts`, `envelope.schema.ts` |
| P3 — `key_observation_prefixes` version 차원 | ✅ 완료 | D1/PG schema/store, 마이그레이션 `0002_key_observation_prefixes_versioned.sql.ts` |

ClickHouse key-observation schema는 운영 도입 시점에 동기 (보류). `packages/ingest-server/src/stores/clickhouse-schema.sql.ts` 상단 TODO 참조.

**본 감사 결론 변경**: "부분 준수" → **"D1/PG active ingest path 준수"**.

다음 재감사 트리거: 신규 좌표 저장 테이블 추가, ClickHouse 운영 도입, `coordinate-storage.rule` 개정.
