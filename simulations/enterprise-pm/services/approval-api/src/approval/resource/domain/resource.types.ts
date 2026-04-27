// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type {
  ProjectId,
  RequesterId,
  ResourceRequestId,
  ResourceTypeId,
} from "./resource.ids.js";

export type ResourceStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "revision_requested";

export interface ResourceProps {
  readonly id: ResourceRequestId;
  readonly projectId: ProjectId;
  readonly requesterId: RequesterId;
  readonly resourceType: ResourceTypeId;
  readonly description: string;
  readonly status: ResourceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ResourceSnapshot {
  readonly id: string;
  readonly projectId: string;
  readonly requesterId: string;
  readonly resourceType: string;
  readonly description: string;
  readonly status: ResourceStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}
