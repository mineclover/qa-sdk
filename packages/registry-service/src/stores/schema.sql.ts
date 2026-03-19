/** Registry Service DDL */
export const REGISTRY_SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS prefix (
  prefix       TEXT PRIMARY KEY,
  owner        TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('leaf', 'composite')),
  number_type  TEXT NOT NULL DEFAULT 'number' CHECK (number_type IN ('number', 'bigint')),
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prefix_owner ON prefix(owner);

CREATE TABLE IF NOT EXISTS draft_lock (
  prefix       TEXT NOT NULL,
  version_id   TEXT NOT NULL,
  locked_at    TEXT NOT NULL,
  PRIMARY KEY (prefix, version_id)
);
`;
