// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * index-meta Drizzle 스키마 정의
 *
 * 10개 테이블: prefix_registry, prefix_ref, prefix_route, schema_version,
 * version_lifecycle, entry, entry_flag, migration_mapping,
 * address_state_cache, address_range_cache
 *
 * 원본 DDL: sql/schema.sql
 */
import {
  sqliteTable,
  text,
  integer,
  index,
  foreignKey,
  primaryKey,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── prefix_registry ──────────────────────────────────────────────────────────
// 주소 공간 DAG의 중앙 관리 테이블
export const prefixRegistry = sqliteTable(
  "prefix_registry",
  {
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    capacity: integer("capacity").notNull(),
    registeredAt: text("registered_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefix, t.versionId] }),
  ],
);

// ── prefix_ref ───────────────────────────────────────────────────────────────
// composite prefix의 dim 참조 목록 (parent → child DAG)
export const prefixRef = sqliteTable(
  "prefix_ref",
  {
    parentPrefix: text("parent_prefix").notNull(),
    parentVersionId: text("parent_version_id").notNull(),
    dimOrder: integer("dim_order").notNull(),
    refPrefix: text("ref_prefix").notNull(),
    refVersionId: text("ref_version_id").notNull(),
    refCapacity: integer("ref_capacity").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.parentPrefix, t.parentVersionId, t.dimOrder] }),
    foreignKey({
      columns: [t.parentPrefix, t.parentVersionId],
      foreignColumns: [prefixRegistry.prefix, prefixRegistry.versionId],
    }),
  ],
);

// ── prefix_route ─────────────────────────────────────────────────────────────
// PrefixRouter의 prefix → D1 database 라우팅 테이블
export const prefixRoute = sqliteTable(
  "prefix_route",
  {
    prefix: text("prefix").notNull().primaryKey(),
    d1DatabaseId: text("d1_database_id").notNull(),
    routedAt: text("routed_at").notNull(),
  },
  (t) => [
    index("idx_prefix_route_database").on(t.d1DatabaseId, t.routedAt, t.prefix),
  ],
);

// ── schema_version ────────────────────────────────────────────────────────────
// prefix의 버전 메타. capacity는 prefix_registry와 동기화
export const schemaVersion = sqliteTable(
  "schema_version",
  {
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    capacity: integer("capacity").notNull(),
    changelog: text("changelog"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefix, t.versionId] }),
  ],
);

// ── version_lifecycle ────────────────────────────────────────────────────────
// 버전 상태 머신 (draft → released → active → deprecated)
export const versionLifecycle = sqliteTable(
  "version_lifecycle",
  {
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    status: text("status").notNull(),
    baseVersionId: text("base_version_id"),
    capacity: integer("capacity").notNull(),
    deactivationMode: text("deactivation_mode").notNull(),
    createdAt: text("created_at").notNull(),
    releasedAt: text("released_at"),
  },
  (t) => [
    primaryKey({ columns: [t.prefix, t.versionId] }),
    check(
      "version_lifecycle_status_check",
      sql`${t.status} IN ('draft', 'released', 'active', 'deprecated')`,
    ),
    check(
      "version_lifecycle_deactivation_mode_check",
      sql`${t.deactivationMode} IN ('strict', 'flexible')`,
    ),
    index("idx_version_lifecycle_prefix_created").on(t.prefix, t.createdAt),
    index("idx_version_lifecycle_prefix_status").on(t.prefix, t.status, t.createdAt),
  ],
);

// ── entry ─────────────────────────────────────────────────────────────────────
// position(1-based) → value 매핑. append-only
export const entry = sqliteTable(
  "entry",
  {
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    position: integer("position").notNull(),
    value: text("value").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefix, t.versionId, t.position] }),
    foreignKey({
      columns: [t.prefix, t.versionId],
      foreignColumns: [schemaVersion.prefix, schemaVersion.versionId],
    }),
    index("idx_entry_range").on(t.prefix, t.versionId, t.position),
    index("idx_entry_value").on(t.prefix, t.versionId, t.value),
  ],
);

// ── entry_flag ────────────────────────────────────────────────────────────────
// entry 수준 활성화 상태 이력. append-only (PK 없음, 최신 row = 현재 상태)
export const entryFlag = sqliteTable(
  "entry_flag",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    position: integer("position").notNull(),
    status: text("status").notNull(),
    reason: text("reason"),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    check(
      "entry_flag_status_check",
      sql`${t.status} IN ('active', 'inactive')`,
    ),
    foreignKey({
      columns: [t.prefix, t.versionId, t.position],
      foreignColumns: [entry.prefix, entry.versionId, entry.position],
    }),
    index("idx_entry_flag_lookup").on(t.prefix, t.versionId, t.position, t.updatedAt),
  ],
);

// ── migration_mapping ───────────────────────────────────────────────────────
// 버전 간 position별 변경 이력
export const migrationMapping = sqliteTable(
  "migration_mapping",
  {
    prefix: text("prefix").notNull(),
    fromVersionId: text("from_version_id").notNull(),
    toVersionId: text("to_version_id").notNull(),
    position: integer("position").notNull(),
    changeType: text("change_type").notNull(),
    oldEntityId: text("old_entity_id"),
    newEntityId: text("new_entity_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefix, t.fromVersionId, t.toVersionId, t.position] }),
    check(
      "migration_mapping_change_type_check",
      sql`${t.changeType} IN ('modified', 'deactivated')`,
    ),
    index("idx_migration_mapping_history").on(
      t.prefix, t.position, t.createdAt, t.fromVersionId, t.toVersionId,
    ),
    index("idx_migration_mapping_edge").on(
      t.prefix, t.fromVersionId, t.toVersionId, t.position,
    ),
  ],
);

// ── address_state_cache ───────────────────────────────────────────────────────
// composite 주소 공간의 활성화 상태 캐시
export const addressStateCache = sqliteTable(
  "address_state_cache",
  {
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    specsJson: text("specs_json").notNull(),
    reservedJson: text("reserved_json").notNull(),
    inactiveJson: text("inactive_json").notNull(),
    openJson: text("open_json").notNull(),
    computedAt: text("computed_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefix, t.versionId] }),
  ],
);

// ── address_range_cache ─────────────────────────────────────────────────────
// calcAddressRanges 결과의 범용 사전 계산 캐시
export const addressRangeCache = sqliteTable(
  "address_range_cache",
  {
    prefix: text("prefix").notNull(),
    versionId: text("version_id").notNull(),
    label: text("label").notNull(),
    rangesJson: text("ranges_json").notNull(),
    constraintsJson: text("constraints_json"),
    computedAt: text("computed_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.prefix, t.versionId, t.label] }),
    index("idx_range_cache_version").on(t.prefix, t.versionId),
  ],
);
