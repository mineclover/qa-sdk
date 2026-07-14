// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  toProjectId,
  toRequesterId,
  toResourceRequestId,
  toResourceTypeId,
} from './resource.ids.js';
import { ResourceStatusConflictException } from './resource.exceptions.js';
import type { ResourceProps, ResourceSnapshot, ResourceStatus } from './resource.types.js';

const TERMINAL: ResourceStatus[] = ['approved', 'rejected'];

export class ResourceEntity {
  private constructor(private readonly props: ResourceProps) {}

  static create(input: {
    readonly id: string;
    readonly projectId: string;
    readonly requesterId: string;
    readonly resourceType: string;
    readonly description: string;
    readonly now?: Date;
  }): ResourceEntity {
    const now = input.now ?? new Date();
    return new ResourceEntity({
      id: toResourceRequestId(input.id),
      projectId: toProjectId(input.projectId),
      requesterId: toRequesterId(input.requesterId),
      resourceType: toResourceTypeId(input.resourceType),
      description: input.description,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: ResourceSnapshot): ResourceEntity {
    return new ResourceEntity({
      id: toResourceRequestId(snapshot.id),
      projectId: toProjectId(snapshot.projectId),
      requesterId: toRequesterId(snapshot.requesterId),
      resourceType: toResourceTypeId(snapshot.resourceType),
      description: snapshot.description,
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  changeStatus(next: ResourceStatus, now = new Date()): ResourceEntity {
    if (TERMINAL.includes(this.props.status) && this.props.status !== next) {
      throw new ResourceStatusConflictException(this.props.status, next);
    }
    return new ResourceEntity({ ...this.props, status: next, updatedAt: now });
  }

  toSnapshot(): ResourceSnapshot {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      requesterId: this.props.requesterId,
      resourceType: this.props.resourceType,
      description: this.props.description,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }
  get status(): ResourceStatus {
    return this.props.status;
  }
}
