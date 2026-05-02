// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export class ResourceDomainException extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ResourceDomainException";
  }
}

export class InvalidResourceIdException extends ResourceDomainException {
  constructor() {
    super("INVALID_RESOURCE_ID", "ResourceRequestId must not be empty.");
    this.name = "ValidationError";
  }
}

export class InvalidResourceTypeException extends ResourceDomainException {
  constructor() {
    super("INVALID_RESOURCE_TYPE", "ResourceType must not be empty.");
    this.name = "ValidationError";
  }
}

export class ResourceStatusConflictException extends ResourceDomainException {
  constructor(from: string, to: string) {
    super("RESOURCE_STATUS_CONFLICT", `Invalid resource status transition: ${from} → ${to}.`);
    this.name = "ConflictError";
  }
}

export class ResourceNotFoundException extends ResourceDomainException {
  constructor(id: string) {
    super("RESOURCE_NOT_FOUND", `Resource request not found: ${id}.`);
    this.name = "NotFoundError";
  }
}
