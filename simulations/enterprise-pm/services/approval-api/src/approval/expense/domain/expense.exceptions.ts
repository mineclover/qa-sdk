// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export class ExpenseDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ExpenseDomainException';
  }
}

export class InvalidExpenseIdException extends ExpenseDomainException {
  constructor() {
    super('INVALID_EXPENSE_ID', 'ExpenseReportId must not be empty.');
    this.name = 'ValidationError';
  }
}

export class InvalidExpenseAmountException extends ExpenseDomainException {
  constructor(amount: number) {
    super('INVALID_EXPENSE_AMOUNT', `Expense amount must be non-negative: ${amount}.`);
    this.name = 'ValidationError';
  }
}

export class ExpenseStatusConflictException extends ExpenseDomainException {
  constructor(from: string, to: string) {
    super('EXPENSE_STATUS_CONFLICT', `Invalid expense status transition: ${from} → ${to}.`);
    this.name = 'ConflictError';
  }
}

export class ExpenseNotFoundException extends ExpenseDomainException {
  constructor(id: string) {
    super('EXPENSE_NOT_FOUND', `Expense report not found: ${id}.`);
    this.name = 'NotFoundError';
  }
}
