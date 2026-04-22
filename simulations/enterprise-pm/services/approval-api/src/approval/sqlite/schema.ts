// @def.boundary sim-approval-api
// @def.doc sim-erp-pm-design

import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export const budgetRequests = sqliteTable("budget_requests", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  projectDepartmentId: text("project_department_id").notNull().default(""),
  amount: real("amount").notNull(),
  requesterId: text("requester_id").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  currentStage: integer("current_stage").notNull(),
  totalStages: integer("total_stages").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [
  index("idx_br_proj").on(t.projectId),
  index("idx_br_req").on(t.requesterId),
]);

export const approvalSteps = sqliteTable("approval_steps", {
  requestId: text("request_id").notNull(),
  stageNumber: integer("stage_number").notNull(),
  approverId: text("approver_id"),
  decision: text("decision", { enum: ["approved", "rejected", "pending"] }).notNull(),
  comment: text("comment"),
  decidedAt: text("decided_at"),
}, (t) => [primaryKey({ columns: [t.requestId, t.stageNumber] })]);

export const resourceRequests = sqliteTable("resource_requests", {
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

export const timeOffRequests = sqliteTable("time_off_requests", {
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

export const expenseReports = sqliteTable("expense_reports", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["draft", "submitted", "in_review", "approved", "rejected", "revision_requested"],
  }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
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
`;
