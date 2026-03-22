/** Registry Service DDL */
export const REGISTRY_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS prefix (
  prefix       TEXT PRIMARY KEY,
  owner        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('leaf', 'composite')),
  number_type  TEXT NOT NULL DEFAULT 'number' CHECK (number_type IN ('number', 'bigint')),
  created_at   TEXT NOT NULL,
  meta_json    TEXT,
  labels_json  TEXT
);

CREATE INDEX IF NOT EXISTS idx_prefix_owner ON prefix(owner);

CREATE TABLE IF NOT EXISTS draft_lock (
  prefix       TEXT NOT NULL,
  version_id   TEXT NOT NULL,
  locked_at    TEXT NOT NULL,
  PRIMARY KEY (prefix, version_id)
);

CREATE TABLE IF NOT EXISTS axis_profile (
  id             TEXT NOT NULL,
  catalog_id     TEXT NOT NULL DEFAULT 'demo',
  name           TEXT NOT NULL,
  current_version TEXT NOT NULL DEFAULT 'v1',
  capacity       INTEGER NOT NULL DEFAULT 32,
  entry_count    INTEGER NOT NULL DEFAULT 0,
  meta_json      TEXT,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (id, catalog_id)
);

CREATE TABLE IF NOT EXISTS catalogs (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  data         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_endpoint (
  catalog_id   TEXT NOT NULL DEFAULT 'demo',
  namespace    TEXT NOT NULL,
  svc_name     TEXT NOT NULL,
  env          TEXT NOT NULL,
  region       TEXT NOT NULL,
  url          TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (catalog_id, namespace, svc_name, env, region)
);

CREATE TABLE IF NOT EXISTS config (
  catalog_id   TEXT NOT NULL,
  config_type  TEXT NOT NULL,
  data         TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (catalog_id, config_type)
);

CREATE TABLE IF NOT EXISTS event_schema (
  catalog_id     TEXT NOT NULL DEFAULT 'demo',
  service_id     TEXT NOT NULL,
  event_key      TEXT NOT NULL,
  event_version  TEXT NOT NULL DEFAULT '1.0.0',
  display_name   TEXT NOT NULL,
  description    TEXT,
  record_kind    TEXT NOT NULL DEFAULT 'log' CHECK (record_kind IN ('log', 'span', 'both')),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'retired')),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (catalog_id, service_id, event_key, event_version)
);

CREATE INDEX IF NOT EXISTS idx_event_schema_service ON event_schema(catalog_id, service_id);
`;
