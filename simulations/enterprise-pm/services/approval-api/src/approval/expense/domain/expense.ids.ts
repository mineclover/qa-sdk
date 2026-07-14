// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { InvalidExpenseIdException } from './expense.exceptions.js';

export type ExpenseReportId = string & { readonly __brand: 'ExpenseReportId' };
export type RequesterId = string & { readonly __brand: 'RequesterId' };

export function toExpenseReportId(value: string): ExpenseReportId {
  if (value.trim().length === 0) throw new InvalidExpenseIdException();
  return value as ExpenseReportId;
}

export function toRequesterId(value: string): RequesterId {
  return value as RequesterId;
}
