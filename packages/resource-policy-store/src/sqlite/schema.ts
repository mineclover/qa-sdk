// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { index } from 'drizzle-orm/sqlite-core';

export const resourcePolicies = sqliteTable(
  'resource_policies',
  {
    resourceId: text('resource_id').primaryKey(),
    resourceType: text('resource_type').notNull(),
    state: text('state', { enum: ['UNREGISTERED', 'REGISTERED', 'DELEGATED'] }).notNull(),
    ownerId: text('owner_id').notNull(),
    cerbosPolicyRef: text('cerbos_policy_ref'),
    graphRootId: text('graph_root_id'),
    registeredAt: text('registered_at'),
    delegatedAt: text('delegated_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('idx_rp_owner').on(t.ownerId),
    index('idx_rp_state').on(t.state),
    index('idx_rp_type').on(t.resourceType),
  ],
);

export const RESOURCE_POLICIES_DDL = `
CREATE TABLE IF NOT EXISTS resource_policies (
  resource_id       TEXT PRIMARY KEY,
  resource_type     TEXT NOT NULL,
  state             TEXT NOT NULL CHECK (state IN ('UNREGISTERED','REGISTERED','DELEGATED')),
  owner_id          TEXT NOT NULL,
  cerbos_policy_ref TEXT,
  graph_root_id     TEXT,
  registered_at     TEXT,
  delegated_at      TEXT,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rp_owner ON resource_policies(owner_id);
CREATE INDEX IF NOT EXISTS idx_rp_state ON resource_policies(state);
CREATE INDEX IF NOT EXISTS idx_rp_type ON resource_policies(resource_type);
`;
