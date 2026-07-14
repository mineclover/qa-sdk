import { toBillingId } from './billing.ids.js';
import type { BillingProps, BillingSnapshot } from './billing.types.js';

export class BillingEntity {
  private constructor(private readonly props: BillingProps) {}

  static create(input: {
    readonly id: string;
    readonly assignmentId: string;
    readonly assignmentVersion: number;
    readonly now?: Date;
  }): BillingEntity {
    return new BillingEntity({
      id: toBillingId(input.id),
      assignmentId: input.assignmentId,
      assignmentVersion: input.assignmentVersion,
      status: 'created',
      createdAt: input.now ?? new Date(),
    });
  }

  toSnapshot(): BillingSnapshot {
    return {
      id: this.props.id,
      assignmentId: this.props.assignmentId,
      assignmentVersion: this.props.assignmentVersion,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
    };
  }
}
