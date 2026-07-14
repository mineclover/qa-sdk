// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

/**
 * Phase 2 — approval-api 의 모든 슬라이스 (budget/expense/resource/timeoff) 가
 * 공유하는 outbox 테이블.
 *
 * Slice 별 outbox factory 가 본 테이블을 참조한다. event_name 으로 슬라이스를 구분
 * (`budget.created`, `expense.created`, `resource.created`, `timeoff.created` 등).
 * 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치 (snake_case).
 */
export const approvalOutboxEvents = sqliteTable(
  'approval_outbox_events',
  {
    id: text('id').primaryKey(),
    aggregate_id: text('aggregate_id').notNull(),
    event_name: text('event_name').notNull(),
    event_version: integer('event_version').notNull(),
    payload: text('payload').notNull(),
    occurred_at: integer('occurred_at').notNull(),
    scope_id: text('scope_id').notNull(),
    status: text('status', { enum: ['pending', 'published', 'failed'] })
      .notNull()
      .default('pending'),
  },
  (t) => [index('approval_outbox_status_idx').on(t.status, t.occurred_at)],
);

export const budgetRequests = sqliteTable(
  'budget_requests',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    projectDepartmentId: text('project_department_id').notNull().default(''),
    amount: real('amount').notNull(),
    requesterId: text('requester_id').notNull(),
    status: text('status', {
      enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested'],
    }).notNull(),
    currentStage: integer('current_stage').notNull(),
    totalStages: integer('total_stages').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('idx_br_proj').on(t.projectId), index('idx_br_req').on(t.requesterId)],
);

export const approvalSteps = sqliteTable(
  'approval_steps',
  {
    requestId: text('request_id').notNull(),
    stageNumber: integer('stage_number').notNull(),
    approverId: text('approver_id'),
    decision: text('decision', { enum: ['approved', 'rejected', 'pending'] }).notNull(),
    comment: text('comment'),
    decidedAt: text('decided_at'),
  },
  (t) => [primaryKey({ columns: [t.requestId, t.stageNumber] })],
);

export const resourceRequests = sqliteTable('resource_requests', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  requesterId: text('requester_id').notNull(),
  resourceType: text('resource_type').notNull(),
  description: text('description').notNull(),
  status: text('status', {
    enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested'],
  }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const timeOffRequests = sqliteTable('time_off_requests', {
  id: text('id').primaryKey(),
  requesterId: text('requester_id').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  reason: text('reason').notNull(),
  status: text('status', {
    enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested'],
  }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const expenseReports = sqliteTable('expense_reports', {
  id: text('id').primaryKey(),
  requesterId: text('requester_id').notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  status: text('status', {
    enum: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested'],
  }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const SIM_APPROVAL_SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS budget_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  project_department_id TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL,
  requester_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  current_stage INTEGER NOT NULL, total_stages INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_br_proj ON budget_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_br_req ON budget_requests(requester_id);

CREATE TABLE IF NOT EXISTS approval_steps (
  request_id TEXT NOT NULL, stage_number INTEGER NOT NULL,
  approver_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','pending')),
  comment TEXT, decided_at TEXT,
  PRIMARY KEY (request_id, stage_number)
);

CREATE TABLE IF NOT EXISTS resource_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requester_id TEXT NOT NULL,
  resource_type TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_off_requests (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_reports (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  amount REAL NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS approval_outbox_status_idx ON approval_outbox_events(status, occurred_at);
`;
