// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * 도메인 예외 — framework-free.
 *
 * sim-domain-slice-kit/mapDomainErrorToHttp 가 name 기반으로 HTTP status 결정.
 *   - ValidationError → 400
 *   - ConflictError   → 409
 *   - NotFoundError   → 404
 *   - ForbiddenError  → 403
 */
export class ProjectDomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectDomainException";
  }
}

export class InvalidProjectIdException extends ProjectDomainException {
  constructor() {
    super("INVALID_PROJECT_ID", "ProjectId must not be empty.");
    this.name = "ValidationError";
  }
}

export class InvalidProjectNameException extends ProjectDomainException {
  constructor() {
    super("INVALID_PROJECT_NAME", "Project name must not be empty.");
    this.name = "ValidationError";
  }
}

export class ProjectArchivedException extends ProjectDomainException {
  constructor() {
    super("PROJECT_ARCHIVED", "Archived project cannot be modified.");
    this.name = "ConflictError";
  }
}

export class ProjectStatusTransitionException extends ProjectDomainException {
  constructor(from: string, to: string) {
    super(
      "PROJECT_STATUS_TRANSITION",
      `Invalid project status transition: ${from} -> ${to}.`,
    );
    this.name = "ConflictError";
  }
}

export class ProjectNotFoundException extends ProjectDomainException {
  constructor(id: string) {
    super("PROJECT_NOT_FOUND", `Project not found: ${id}`);
    this.name = "NotFoundError";
  }
}
