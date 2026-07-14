// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { toExpenseReportId, toRequesterId } from './expense.ids.js';
import {
  ExpenseStatusConflictException,
  InvalidExpenseAmountException,
} from './expense.exceptions.js';
import type { ExpenseProps, ExpenseSnapshot, ExpenseStatus } from './expense.types.js';

const TERMINAL: ExpenseStatus[] = ['approved', 'rejected'];

export class ExpenseEntity {
  private constructor(private readonly props: ExpenseProps) {}

  static create(input: {
    readonly id: string;
    readonly requesterId: string;
    readonly amount: number;
    readonly category: string;
    readonly description: string;
    readonly now?: Date;
  }): ExpenseEntity {
    if (!(input.amount >= 0)) {
      throw new InvalidExpenseAmountException(input.amount);
    }
    const now = input.now ?? new Date();
    return new ExpenseEntity({
      id: toExpenseReportId(input.id),
      requesterId: toRequesterId(input.requesterId),
      amount: input.amount,
      category: input.category,
      description: input.description,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(snapshot: ExpenseSnapshot): ExpenseEntity {
    return new ExpenseEntity({
      id: toExpenseReportId(snapshot.id),
      requesterId: toRequesterId(snapshot.requesterId),
      amount: snapshot.amount,
      category: snapshot.category,
      description: snapshot.description,
      status: snapshot.status,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });
  }

  /** 임의의 status 전이 (legacy ExpenseService.updateStatus 호환). terminal 에서 변경 금지. */
  changeStatus(next: ExpenseStatus, now = new Date()): ExpenseEntity {
    if (TERMINAL.includes(this.props.status) && this.props.status !== next) {
      throw new ExpenseStatusConflictException(this.props.status, next);
    }
    return new ExpenseEntity({ ...this.props, status: next, updatedAt: now });
  }

  toSnapshot(): ExpenseSnapshot {
    return {
      id: this.props.id,
      requesterId: this.props.requesterId,
      amount: this.props.amount,
      category: this.props.category,
      description: this.props.description,
      status: this.props.status,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }
  get status(): ExpenseStatus {
    return this.props.status;
  }
}
