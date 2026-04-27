// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import {
  pgSchema,
  primaryKey,
  index,
  text,
  integer,
  bigint,
  doublePrecision,
} from "drizzle-orm/pg-core";

const sim = pgSchema("sim");

/**
 * Phase 2 — approval-api 의 모든 슬라이스 (budget/expense/resource/timeoff) 가
 * 공유하는 outbox 테이블 (Postgres / sim namespace).
 *
 * Slice 별 outbox factory 가 본 테이블을 참조. event_name 으로 슬라이스 구분.
 * 컬럼명은 sim-domain-slice-kit/createDrizzleOutboxPort 컨벤션과 일치.
 * event_version / occurred_at 은 Postgres BIGINT (drizzle bigint mode "number").
 */
export const approvalOutboxEvents = sim.table(
  "approval_outbox_events",
  {
    id: text("id").primaryKey(),
    aggregate_id: text("aggregate_id").notNull(),
    event_name: text("event_name").notNull(),
    event_version: bigint("event_version", { mode: "number" }).notNull(),
    payload: text("payload").notNull(),
    occurred_at: bigint("occurred_at", { mode: "number" }).notNull(),
    scope_id: text("scope_id").notNull(),
    status: text("status", { enum: ["pending", "published", "failed"] })
      .notNull()
      .default("pending"),
  },
  (t) => [index("idx_sim_approval_outbox_status").on(t.status, t.occurred_at)],
);

export const budgetRequests = sim.table("approval_budget_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  projectDepartmentId: text("project_department_id").notNull().default(""),
  amount: doublePrecision("amount").notNull(),
  requesterId: text("requester_id").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  currentStage: integer("current_stage").notNull(),
  totalStages: integer("total_stages").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_sim_br_proj").on(t.projectId),
  index("idx_sim_br_req").on(t.requesterId),
]);

export const approvalSteps = sim.table("approval_steps", {
  requestId: text("request_id").notNull(),
  stageNumber: integer("stage_number").notNull(),
  approverId: text("approver_id"),
  decision: text("decision", { enum: ["approved", "rejected", "pending"] }).notNull(),
  comment: text("comment"),
  decidedAt: text("decided_at"),
}, (t) => [primaryKey({ columns: [t.requestId, t.stageNumber] })]);

export const resourceRequests = sim.table("approval_resource_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  requesterId: text("requester_id").notNull(),
  resourceType: text("resource_type").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const timeOffRequests = sim.table("approval_time_off_requests", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const expenseReports = sim.table("approval_expense_reports", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const SIM_APPROVAL_PG_DDL = `
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

CREATE TABLE IF NOT EXISTS sim.approval_steps (
  request_id TEXT NOT NULL, stage_number INTEGER NOT NULL,
  approver_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','pending')),
  comment TEXT, decided_at TEXT,
  PRIMARY KEY (request_id, stage_number)
);

CREATE TABLE IF NOT EXISTS sim.approval_resource_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requester_id TEXT NOT NULL,
  resource_type TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim.approval_time_off_requests (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim.approval_expense_reports (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

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

export const SIM_APPROVAL_PG_RESET_DDL = `
DROP TABLE IF EXISTS sim.approval_steps CASCADE;
DROP TABLE IF EXISTS sim.approval_budget_requests CASCADE;
DROP TABLE IF EXISTS sim.approval_resource_requests CASCADE;
DROP TABLE IF EXISTS sim.approval_time_off_requests CASCADE;
DROP TABLE IF EXISTS sim.approval_expense_reports CASCADE;
DROP TABLE IF EXISTS sim.approval_outbox_events CASCADE;

CREATE TABLE sim.approval_budget_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  project_department_id TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL,
  requester_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  current_stage INTEGER NOT NULL, total_stages INTEGER NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_sim_br_proj ON sim.approval_budget_requests(project_id);
CREATE INDEX idx_sim_br_req ON sim.approval_budget_requests(requester_id);

CREATE TABLE sim.approval_steps (
  request_id TEXT NOT NULL, stage_number INTEGER NOT NULL,
  approver_id TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','pending')),
  comment TEXT, decided_at TEXT,
  PRIMARY KEY (request_id, stage_number)
);

CREATE TABLE sim.approval_resource_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requester_id TEXT NOT NULL,
  resource_type TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE sim.approval_time_off_requests (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE sim.approval_expense_reports (
  id TEXT PRIMARY KEY, requester_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE sim.approval_outbox_events (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_version BIGINT NOT NULL,
  payload TEXT NOT NULL,
  occurred_at BIGINT NOT NULL,
  scope_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);
CREATE INDEX idx_sim_approval_outbox_status ON sim.approval_outbox_events(status, occurred_at);
`;
