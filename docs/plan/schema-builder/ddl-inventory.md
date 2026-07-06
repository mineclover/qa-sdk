---
status: draft
sources:
  - packages/demo-snapshot/src/demo-catalog.ts
  - packages/demo-snapshot/src/event-schema.test.ts
  - packages/ingest-server/src/stores/d1-schema.sql.ts
  - packages/ingest-server/src/db/schema.ts
  - packages/ingest-server/drizzle/20260328024155_initial/migration.sql
  - packages/registry-service/src/db/schema.ts
  - packages/registry-service/drizzle/20260328024153_initial/migration.sql
  - packages/index-meta/drizzle/20260328021248_initial/migration.sql
  - packages/store/src/db/schema.ts
---

# DDL 인벤토리 — 현재 상태

> 2026-03-24 기준으로 작성된 schema-builder 계획 인벤토리. 2026-07-07 현재는 위 source refs를 기준으로 재검증해야 한다.

## 0. 현행 판정

이 문서는 `@qa-sdk/schema-builder` 구현 산출물이 아니라, `DEMO_CATALOG.tables`와 실제 DDL 소유 표면을 대조하기 위한 계획 인벤토리다.

현재 코드 기준 소유권은 다음처럼 나뉜다.

- `DEMO_CATALOG.tables`: `packages/demo-snapshot/src/demo-catalog.ts`가 `scalar`, `prefix_ref`, `table_ref`, `axis_ref` column vocabulary를 소유한다.
- table/prefix 경로 검증: `packages/demo-snapshot/src/event-schema.test.ts`가 event -> table -> table -> prefix 연결을 검증한다.
- ingest DDL: `packages/ingest-server/src/stores/d1-schema.sql.ts`, `packages/ingest-server/src/db/schema.ts`, ingest migration SQL이 소유한다.
- registry DDL: `packages/registry-service/src/db/schema.ts`, registry migration SQL이 소유한다.
- index-meta DDL: `packages/index-meta/drizzle/20260328021248_initial/migration.sql`이 별도 SQLite schema를 소유한다.
- store PG schema: `packages/store/src/db/schema.ts`가 PostgreSQL 저장소 schema를 소유한다.

따라서 아래 표는 "현재 완전 동기화됨"의 증명이 아니라, schema-builder 또는 diff checker가 생길 때 비교해야 할 drift 후보 목록으로 읽는다.

---

## 1. 3-소스 매핑

| CATALOG.tables | ingest DDL | registry DDL | D1(ingest) | D1(registry) | 비고 |
|----------------|-----------|-------------|-----------|-------------|------|
| `event_records` | ✅ | - | ✅ | - | 10 cols (record_kind→axis_ref) |
| `traces` | ✅ | - | ✅ | - | 6 cols (service_name→axis_ref) |
| `qa_sessions` | ✅ | - | ✅ | - | 3 cols |
| `transmissions` | ✅ | - | ✅ | - | 6 cols (service_name,env→axis_ref) |
| `verdict_reports` | ✅ | - | ✅ | - | 7 cols (overall_verdict→axis_ref) |
| `dead_letter_queue` | ✅ | - | ✅ | - | DDL 전용 (CATALOG에 정의 안 됨) |
| `insight_labels` | ✅ | - | ✅ | - | DDL 전용 (CATALOG에 정의 안 됨) |
| `members` | - | - | - | - | CATALOG만 (DDL 미생성) |
| `orgs` | - | - | - | - | CATALOG만 |
| `items` | - | - | - | - | CATALOG만 |
| `orders` | - | - | - | - | CATALOG만 |
| `carts` | - | - | - | - | CATALOG만 |
| `cart_items` | - | - | - | - | CATALOG만 |
| `tbl_version_lifecycle` | - | ✅ `version_lifecycle` | - | ✅ | index-meta 자동 |
| `entry` | - | ✅ `prefix+entry` | - | ✅ | index-meta 자동 |
| `dkg_nodes` | - | - | - | - | CATALOG만 (DKG SQLite 별도) |
| `dkg_edges` | - | - | - | - | CATALOG만 (DKG SQLite 별도) |
| `usage_snapshots` | - | - | - | - | CATALOG만 |
| `version_usages` | - | - | - | - | CATALOG만 |
| `transition_state` | - | - | - | - | CATALOG만 |
| `policy_rule` | - | - | - | - | CATALOG만 |
| - | - | ✅ `prefix` | - | ✅ | registry 전용 |
| - | - | ✅ `draft_lock` | - | ✅ | registry 전용 |
| - | - | ✅ `axis_profile` | - | ✅ | registry 전용 |
| - | - | ✅ `catalogs` | - | ✅ | registry 전용 |
| - | - | ✅ `config` | - | ✅ | registry 전용 |
| - | - | ✅ `service_endpoint` | - | ✅ | registry 전용 |
| - | - | ✅ `event_schema` | - | ✅ | registry 전용 |
| - | - | ✅ `schema_version` | - | ✅ | registry 전용 |
| - | - | - | - | ✅ `prefix_ref` | index-meta 자동 |
| - | - | - | - | ✅ `prefix_registry` | index-meta 자동 |

---

## 2. 분류

### A. DDL + D1 일치 (7개 — ingest)

| 테이블 | DDL 위치 | D1 | 인덱스 |
|--------|----------|-----|--------|
| `qa_sessions` | `d1-schema.sql.ts` | qa-ingest | 0 |
| `traces` | `d1-schema.sql.ts` | qa-ingest | 2 (session_id, reconstructed) |
| `event_records` | `d1-schema.sql.ts` | qa-ingest | 4 (trace_id, trace_timestamp, event_key, session_id) |
| `verdict_reports` | `d1-schema.sql.ts` | qa-ingest | 4 (scenario_id, trace_id, session_id, uniq) |
| `transmissions` | `d1-schema.sql.ts` | qa-ingest | 0 |
| `dead_letter_queue` | `d1-schema.sql.ts` | qa-ingest | 1 (pending) |
| `insight_labels` | `d1-schema.sql.ts` | qa-ingest | 2 (kind, target) |

### B. DDL + D1 일치 (8개 — registry 자체 정의)

| 테이블 | DDL 위치 | D1 |
|--------|----------|-----|
| `prefix` | `schema.sql.ts` | qa-registry |
| `draft_lock` | `schema.sql.ts` | qa-registry |
| `axis_profile` | `schema.sql.ts` | qa-registry |
| `catalogs` | `schema.sql.ts` | qa-registry |
| `config` | `schema.sql.ts` | qa-registry |
| `service_endpoint` | `schema.sql.ts` | qa-registry |
| `event_schema` | `schema.sql.ts` | qa-registry |
| `schema_version` | `schema.sql.ts` | qa-registry |

### C. index-meta 자동 생성 (3개 — registry)

| 테이블 | 생성 주체 |
|--------|----------|
| `prefix_ref` | index-meta SqlPrefixRegistry |
| `prefix_registry` | index-meta SqlPrefixRegistry |
| `version_lifecycle` | index-meta SqlVersionLifecycleStore |

### D. CATALOG에만 정의, DDL 미생성 (12개)

| 테이블 | 용도 | DDL 필요 시점 |
|--------|------|-------------|
| `members` | 비즈니스 (회원) | 비즈니스 서비스 구현 시 |
| `orgs` | 비즈니스 (조직) | 비즈니스 서비스 구현 시 |
| `items` | 비즈니스 (상품) | 비즈니스 서비스 구현 시 |
| `orders` | 비즈니스 (주문) | 비즈니스 서비스 구현 시 |
| `carts` | 비즈니스 (장바구니) | 비즈니스 서비스 구현 시 |
| `cart_items` | 비즈니스 (장바구니 항목) | 비즈니스 서비스 구현 시 |
| `dkg_nodes` | DKG 그래프 노드 | DKG SQLite (별도 파일) |
| `dkg_edges` | DKG 그래프 엣지 | DKG SQLite (별도 파일) |
| `usage_snapshots` | DKG 사용 스냅샷 | DKG SQLite (별도 파일) |
| `version_usages` | 버전별 사용량 | DKG SQLite (별도 파일) |
| `transition_state` | 전이 상태 저장 | 전이 엔진 활성화 시 |
| `policy_rule` | 정책 규칙 | query-service (별도 DDL) |

### E. DDL만 존재, CATALOG에 미정의 (2개)

| 테이블 | DDL 위치 | 비고 |
|--------|----------|------|
| `dead_letter_queue` | `d1-schema.sql.ts` | 인프라 전용 → CATALOG에 추가 불필요 |
| `insight_labels` | `d1-schema.sql.ts` | 인프라 전용 → CATALOG에 추가 불필요 |

---

## 3. column 타입 분포

### axis_ref (축 참조) — 7곳

| 테이블.컬럼 | axis | entries |
|-------------|------|---------|
| `members.role` | role | 7 |
| `items.category` | category | 7 |
| `orders.status` | order_action | 5 |
| `event_records.record_kind` | record_type | 3 |
| `traces.service_name` | svc_name | 14 |
| `transmissions.service_name` | svc_name | 14 |
| `transmissions.env` | env | 5 |
| `verdict_reports.overall_verdict` | verdict_result | 5 |
| `tbl_version_lifecycle.status` | version_lifecycle | 5 |
| `dkg_nodes.kind` | dkg_target_kind | 17 |
| `dkg_nodes.source` | node_source | 4 |
| `dkg_edges.type` | edge_type | 18 |
| `dkg_edges.source` | node_source | 4 |

### prefix_ref (prefix 주소 참조) — 4곳

| 테이블.컬럼 | prefix |
|-------------|--------|
| `orgs.region_addr` | service |
| `items.warehouse_addr` | service |
| `orders.service_addr` | service |

### table_ref (다른 테이블 참조) — 7곳

| 테이블.컬럼 | 참조 테이블 |
|-------------|------------|
| `members.org_id` | orgs |
| `orders.member_id` | members |
| `carts.member_id` | members |
| `cart_items.cart_id` | carts |
| `cart_items.item_id` | items |
| `event_records.trace_id` | traces |
| `traces.session_id` | qa_sessions |
| `verdict_reports.trace_id` | traces |
| `version_usages.snapshot_id` | usage_snapshots |

---

## 4. 다음 단계

1. **schema-builder Tier 1**: 카테고리 D (CATALOG만 12개)에서 DDL 자동 생성 검증
2. **CATALOG.tables 보강**: `dead_letter_queue`, `insight_labels` 등 인프라 테이블도 CATALOG에 등록 (선택적)
3. **diff 체커**: 카테고리 A+B의 DDL과 실제 D1 스키마를 자동 비교
4. **사용 추적**: `table.query` 이벤트 수집 래퍼

## 5. 검증 경로

```bash
corepack pnpm --filter demo-snapshot test -- event-schema
node scripts/design-usefulness-audit.mjs --format json --all
corepack pnpm def:check
corepack pnpm arch:feedback
```

`schema-builder` 패키지가 없는 동안 이 인벤토리의 마감 기준은 "자동 생성기 구현"이 아니라 "source refs가 존재하고, 현재 DDL 소유권과 계획 API가 섞이지 않는 것"이다.
