// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { pgSchema, text, integer, doublePrecision, index } from 'drizzle-orm/pg-core';

/**
 * Postgres schema (budget slice).
 *
 * 기존 pg/schema.ts 와 동일한 sim namespace + 테이블 이름.
 */
const sim = pgSchema('sim');

export const budgetRequests = sim.table(
  'approval_budget_requests',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    projectDepartmentId: text('project_department_id').notNull().default(''),
    amount: doublePrecision('amount').notNull(),
    requesterId: text('requester_id').notNull(),
    status: text('status', {
      enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested'],
    }).notNull(),
    currentStage: integer('current_stage').notNull(),
    totalStages: integer('total_stages').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_sim_br_proj').on(t.projectId), index('idx_sim_br_req').on(t.requesterId)],
);

export const SIM_APPROVAL_BUDGET_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;

CREATE TABLE IF NOT EXISTS sim.approval_budget_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  project_department_id TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL,
  requester_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  current_stage INTEGER NOT NULL, total_stages INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sim_br_proj ON sim.approval_budget_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_sim_br_req ON sim.approval_budget_requests(requester_id);

CREATE TABLE IF NOT EXISTS sim.approval_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_sim_approval_outbox_status ON sim.approval_outbox_events(status, occurred_at);
`;
