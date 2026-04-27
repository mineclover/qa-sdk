// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - ValidationError → 400 / VALIDATION_ERROR
 *   - ConflictError   → 409 / CONFLICT
 *   - NotFoundError   → 404 / NOT_FOUND
 */
export class TaskDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TaskDomainException";
  }
}

export class InvalidTaskIdException extends TaskDomainException {
  constructor() {
    super("INVALID_TASK_ID", "TaskId must not be empty.");
    this.name = "ValidationError";
  }
}

export class InvalidTaskTitleException extends TaskDomainException {
  constructor() {
    super("INVALID_TASK_TITLE", "Task title must not be empty.");
    this.name = "ValidationError";
  }
}

export class TaskTransitionDoneException extends TaskDomainException {
  constructor() {
    super("TASK_DONE_TRANSITION", "Done task cannot transition further.");
    this.name = "ConflictError";
  }
}

export class TaskNotFoundException extends TaskDomainException {
  constructor(id: string) {
    super("TASK_NOT_FOUND", `Task not found: ${id}`);
    this.name = "NotFoundError";
  }
}
