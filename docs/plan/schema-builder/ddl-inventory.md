# DDL 인벤토리 — 현재 상태

> 2026-03-24 기준. DEMO_CATALOG.tables 19개 + 서비스 DDL 정의 + 실제 D1 테이블 매핑.

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
