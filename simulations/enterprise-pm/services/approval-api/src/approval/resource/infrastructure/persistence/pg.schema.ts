// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { pgSchema, text } from "drizzle-orm/pg-core";

export { approvalOutboxEvents as approvalOutbox } from "../../../pg/schema.js";

const sim = pgSchema("sim");

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

export const SIM_APPROVAL_RESOURCE_PG_DDL = `
CREATE SCHEMA IF NOT EXISTS sim;
CREATE TABLE IF NOT EXISTS sim.approval_resource_requests (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requester_id TEXT NOT NULL,
  resource_type TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','submitted','in_review','approved','rejected','revision_requested')),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
`;
