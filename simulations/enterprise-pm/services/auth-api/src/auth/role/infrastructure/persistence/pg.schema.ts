// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { pgSchema, text } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const roles = sim.table('auth_roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  scopeType: text('scope_type', { enum: ['global', 'department', 'project'] }).notNull(),
  defaultMaskHex: text('default_mask_hex').notNull(),
  createdAt: text('created_at').notNull(),
});

export const SIM_AUTH_ROLE_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.auth_roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','department','project')),
  default_mask_hex TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;
