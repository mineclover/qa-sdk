// @def.boundary registry-system
// @def.doc registry-system

/**
 * registry-service Drizzle ORM 스키마 정의
 *
 * 13개 테이블: prefix, draft_lock, axis_profile, catalogs,
 *             ontology_namespace, ontology_axis, ontology_taxonomy,
 *             ontology_address_allocation, ontology_address_segment,
 *             service_endpoint, config, event_schema, service_component_version
 *
 * NOTE: schema_version 테이블은 앱 레벨 마이그레이션 트래커로
 * Drizzle 관리 대상에서 제외한다 (__drizzle_migrations와 별개).
 */
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── prefix ─────────────────────────────────────────────
export const prefix = sqliteTable(
  'prefix',
  {
    prefix: text('prefix').primaryKey(),
    owner: text('owner').notNull(),
    kind: text('kind').notNull(),
    numberType: text('number_type').notNull().default('number'),
    createdAt: text('created_at').notNull(),
    metaJson: text('meta_json'),
    labelsJson: text('labels_json'),
  },
  (t) => [
    index('idx_prefix_owner').on(t.owner),
    check('chk_prefix_kind', sql`kind IN ('leaf', 'composite')`),
    check('chk_prefix_number_type', sql`number_type IN ('number', 'bigint')`),
  ],
);

// ─── draft_lock ─────────────────────────────────────────
export const draftLock = sqliteTable(
  'draft_lock',
  {
    prefix: text('prefix').notNull(),
    versionId: text('version_id').notNull(),
    lockedAt: text('locked_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.prefix, t.versionId] })],
);

// ─── axis_profile ───────────────────────────────────────
export const axisProfile = sqliteTable(
  'axis_profile',
  {
    id: text('id').notNull(),
    catalogId: text('catalog_id').notNull().default('demo'),
    name: text('name').notNull(),
    currentVersion: text('current_version').notNull().default('v1'),
    capacity: integer('capacity').notNull().default(32),
    entryCount: integer('entry_count').notNull().default(0),
    metaJson: text('meta_json'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.catalogId] })],
);

// ─── catalogs ───────────────────────────────────────────
// hash 컬럼은 migration v2에서 추가됨 — 현재 스키마 상태 반영
export const catalogs = sqliteTable('catalogs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  data: text('data').notNull(),
  hash: text('hash'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ─── ontology_namespace ───────────────────────────────
export const ontologyNamespace = sqliteTable(
  'ontology_namespace',
  {
    ontologyId: text('ontology_id').primaryKey(),
    namespace: text('namespace').notNull(),
    owner: text('owner'),
    lifecycle: text('lifecycle').notNull().default('draft'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('uq_ontology_namespace_namespace').on(t.namespace),
    check('chk_ontology_namespace_lifecycle', sql`lifecycle IN ('draft', 'active', 'deprecated')`),
  ],
);

// ─── ontology_axis ────────────────────────────────────
export const ontologyAxis = sqliteTable(
  'ontology_axis',
  {
    ontologyId: text('ontology_id').notNull(),
    axisId: text('axis_id').notNull(),
    versionId: text('version_id').notNull(),
    valuesJson: text('values_json').notNull(),
    valuesHash: text('values_hash').notNull(),
    capacity: integer('capacity').notNull(),
    lifecycle: text('lifecycle').notNull().default('draft'),
  },
  (t) => [
    primaryKey({
      columns: [t.ontologyId, t.axisId, t.versionId],
    }),
    check('chk_ontology_axis_lifecycle', sql`lifecycle IN ('draft', 'active', 'deprecated')`),
  ],
);

// ─── ontology_taxonomy ────────────────────────────────
// axis_ids_json/identity_axis_ids_json 참조 무결성은 JSON 배열이라
// DB FK 대신 registry store/service boundary에서 ontology_axis와 대조한다.
export const ontologyTaxonomy = sqliteTable(
  'ontology_taxonomy',
  {
    ontologyId: text('ontology_id').notNull(),
    taxonomyId: text('taxonomy_id').notNull(),
    versionId: text('version_id').notNull(),
    appliesToJson: text('applies_to_json').notNull(),
    axisIdsJson: text('axis_ids_json').notNull(),
    identityAxisIdsJson: text('identity_axis_ids_json').notNull(),
    space: text('space'),
    lifecycle: text('lifecycle').notNull().default('draft'),
  },
  (t) => [
    primaryKey({
      columns: [t.ontologyId, t.taxonomyId, t.versionId],
    }),
    check('chk_ontology_taxonomy_lifecycle', sql`lifecycle IN ('draft', 'active', 'deprecated')`),
  ],
);

// ─── ontology_address_allocation ─────────────────────
export const ontologyAddressAllocation = sqliteTable(
  'ontology_address_allocation',
  {
    allocationId: text('allocation_id').primaryKey(),
    ontologyId: text('ontology_id').notNull(),
    taxonomyId: text('taxonomy_id').notNull(),
    prefix: text('prefix').notNull(),
    versionId: text('version_id').notNull(),
    addressModel: text('address_model').notNull().default('product'),
    capacity: integer('capacity').notNull(),
    addressOffset: integer('address_offset').notNull(),
    addressSize: integer('address_size').notNull(),
    status: text('status').notNull().default('reserved'),
  },
  (t) => [
    uniqueIndex('uq_ontology_address_allocation_prefix_version').on(t.prefix, t.versionId),
    uniqueIndex('uq_ontology_address_allocation_ontology_taxonomy_version').on(
      t.ontologyId,
      t.taxonomyId,
      t.versionId,
    ),
    check(
      'chk_ontology_address_allocation_address_model',
      sql`address_model IN ('product', 'sum')`,
    ),
    check(
      'chk_ontology_address_allocation_status',
      sql`status IN ('reserved', 'active', 'deprecated')`,
    ),
  ],
);

// ─── ontology_address_segment ────────────────────────
export const ontologyAddressSegment = sqliteTable(
  'ontology_address_segment',
  {
    allocationId: text('allocation_id').notNull(),
    segmentId: text('segment_id').notNull(),
    consumesJson: text('consumes_json').notNull(),
    addressOffset: integer('address_offset').notNull(),
    addressSize: integer('address_size').notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.allocationId, t.segmentId],
    }),
  ],
);

// ─── service_endpoint ───────────────────────────────────
export const serviceEndpoint = sqliteTable(
  'service_endpoint',
  {
    catalogId: text('catalog_id').notNull().default('demo'),
    namespace: text('namespace').notNull(),
    svcName: text('svc_name').notNull(),
    env: text('env').notNull(),
    region: text('region').notNull(),
    url: text('url').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.catalogId, t.namespace, t.svcName, t.env, t.region],
    }),
  ],
);

// ─── config ─────────────────────────────────────────────
export const config = sqliteTable(
  'config',
  {
    catalogId: text('catalog_id').notNull(),
    configType: text('config_type').notNull(),
    data: text('data').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.catalogId, t.configType] })],
);

// ─── event_schema ───────────────────────────────────────
export const eventSchema = sqliteTable(
  'event_schema',
  {
    catalogId: text('catalog_id').notNull().default('demo'),
    serviceId: text('service_id').notNull(),
    eventKey: text('event_key').notNull(),
    eventVersion: text('event_version').notNull().default('1.0.0'),
    displayName: text('display_name').notNull(),
    description: text('description'),
    recordKind: text('record_kind').notNull().default('log'),
    status: text('status').notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.catalogId, t.serviceId, t.eventKey, t.eventVersion],
    }),
    index('idx_event_schema_service').on(t.catalogId, t.serviceId),
    check('chk_event_schema_record_kind', sql`record_kind IN ('log', 'span', 'both')`),
    check('chk_event_schema_status', sql`status IN ('active', 'deprecated', 'retired')`),
  ],
);

// ─── service_component_version ─────────────────────────
export const serviceComponentVersion = sqliteTable(
  'service_component_version',
  {
    catalogId: text('catalog_id').notNull().default('demo'),
    kind: text('kind').notNull(),
    serviceId: text('service_id').notNull(),
    version: text('version').notNull(),
    state: text('state').notNull().default('draft'),
    valueJson: text('value_json').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    publishedAt: text('published_at'),
    deprecatedAt: text('deprecated_at'),
    archivedAt: text('archived_at'),
  },
  (t) => [
    primaryKey({
      columns: [t.catalogId, t.kind, t.serviceId, t.version],
    }),
    index('idx_service_component_lookup').on(t.catalogId, t.serviceId, t.kind),
    check(
      'chk_service_component_kind',
      sql`kind IN ('service-unit', 'ownership', 'exposure', 'runtime-address', 'deployment-binding')`,
    ),
    check(
      'chk_service_component_state',
      sql`state IN ('draft', 'published', 'deprecated', 'archived')`,
    ),
  ],
);
