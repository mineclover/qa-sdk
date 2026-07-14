// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { RequesterId, TimeOffRequestId } from './timeoff.ids.js';

export type TimeOffStatus =
  | 'draft'
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'revision_requested';

export interface TimeOffProps {
  readonly id: TimeOffRequestId;
  readonly requesterId: RequesterId;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string;
  readonly status: TimeOffStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TimeOffSnapshot {
  readonly id: string;
  readonly requesterId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string;
  readonly status: TimeOffStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
