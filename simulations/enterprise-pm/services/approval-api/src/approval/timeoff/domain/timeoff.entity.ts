// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { toRequesterId, toTimeOffRequestId } from "./timeoff.ids.js";
import {
  InvalidTimeOffRangeException,
  TimeOffStatusConflictException,
} from "./timeoff.exceptions.js";
import type { TimeOffProps, TimeOffSnapshot, TimeOffStatus } from "./timeoff.types.js";

const TERMINAL: TimeOffStatus[] = ["approved", "rejected"];

export class TimeOffEntity {
  private constructor(private readonly props: TimeOffProps) {}

  static create(input: {
    readonly id: string;
    readonly requesterId: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly reason: string;
    readonly now?: Date;
  }): TimeOffEntity {
    if (input.startDate > input.endDate) {
      throw new InvalidTimeOffRangeException(input.startDate, input.endDate);
    }
    const now = input.now ?? new Date();
    return new TimeOffEntity({
      id: toTimeOffRequestId(input.id),
      requesterId: toRequesterId(input.requesterId),
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: TimeOffSnapshot): TimeOffEntity {
    return new TimeOffEntity({
      id: toTimeOffRequestId(snapshot.id),
      requesterId: toRequesterId(snapshot.requesterId),
      startDate: snapshot.startDate,
      endDate: snapshot.endDate,
      reason: snapshot.reason,
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  changeStatus(next: TimeOffStatus, now = new Date()): TimeOffEntity {
    if (TERMINAL.includes(this.props.status) && this.props.status !== next) {
      throw new TimeOffStatusConflictException(this.props.status, next);
    }
    return new TimeOffEntity({ ...this.props, status: next, updatedAt: now });
  }

  toSnapshot(): TimeOffSnapshot {
    return {
      id: this.props.id,
      requesterId: this.props.requesterId,
      startDate: this.props.startDate,
      endDate: this.props.endDate,
      reason: this.props.reason,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }
  get status(): TimeOffStatus {
    return this.props.status;
  }
}
