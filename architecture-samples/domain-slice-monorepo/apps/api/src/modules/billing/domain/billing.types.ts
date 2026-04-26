import type { BillingId } from "./billing.ids.js";

export type BillingStatus = "created";

export interface BillingProps {
  readonly id: BillingId;
  readonly assignmentId: string;
  readonly assignmentVersion: number;
  readonly status: BillingStatus;
  readonly createdAt: Date;
}

export interface BillingSnapshot {
  readonly id: string;
  readonly assignmentId: string;
  readonly assignmentVersion: number;
  readonly status: BillingStatus;
  readonly createdAt: string;
}
