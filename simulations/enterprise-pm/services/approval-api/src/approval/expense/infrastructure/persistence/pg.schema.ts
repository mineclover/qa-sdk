// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { pgSchema, text, doublePrecision } from 'drizzle-orm/pg-core';

const sim = pgSchema('sim');

export const expenseReports = sim.table('approval_expense_reports', {
  id: text('id').primaryKey(),
  requesterId: text('requester_id').notNull(),
  amount: doublePrecision('amount').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  status: text('status', {
    enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested'],
  }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const SIM_APPROVAL_EXPENSE_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;
CREATE TABLE IF NOT EXISTS sim.approval_expense_reports (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
`;
