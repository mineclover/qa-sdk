import {
  MotionWorkspaceMigrationError,
  MotionWorkspaceParseError,
} from "motion-workspace";
import { MotionWorkspaceRepositoryError } from "./repository.js";

export type MotionWorkspaceServiceErrorShape = Readonly<Record<string, unknown>> & {
  readonly code: string;
  readonly message: string;
};

export interface MotionWorkspaceServiceHealthResponse {
  readonly status: "ok";
  readonly service: string;
  readonly default_persistence: "sqlite";
  readonly uptime_seconds?: number;
  readonly version?: string;
}

export class MotionWorkspaceServiceError extends Error {
  readonly statusCode: number;
  readonly shape: MotionWorkspaceServiceErrorShape;

  constructor(statusCode: number, shape: MotionWorkspaceServiceErrorShape) {
    super(shape.message);
    this.name = "MotionWorkspaceServiceError";
    this.statusCode = statusCode;
    this.shape = shape;
  }
}

function createError(
  statusCode: number,
  shape: MotionWorkspaceServiceErrorShape,
): MotionWorkspaceServiceError {
  return new MotionWorkspaceServiceError(statusCode, shape);
}

export function createInvalidJsonError(reason?: string): MotionWorkspaceServiceError {
  return createError(400, {
    code: "invalid_json",
    message: reason
      ? `JSON 파싱에 실패했습니다. ${reason}`
      : "JSON 파싱에 실패했습니다.",
  });
}

export function createInvalidRequestError(message: string): MotionWorkspaceServiceError {
  return createError(400, {
    code: "invalid_request",
    message,
  });
}

function fromRepositoryError(error: MotionWorkspaceRepositoryError): MotionWorkspaceServiceError {
  const statusCode = error.shape.code === "workspace_not_found"
    || error.shape.code === "scene_not_found"
    ? 404
    : 409;

  return createError(statusCode, error.shape as MotionWorkspaceServiceErrorShape);
}

function fromMigrationError(error: MotionWorkspaceMigrationError): MotionWorkspaceServiceError {
  const statusCode = error.shape.code === "revision_conflict"
    ? 409
    : 400;

  return createError(statusCode, error.shape as MotionWorkspaceServiceErrorShape);
}

function fromParseError(error: MotionWorkspaceParseError): MotionWorkspaceServiceError {
  return createError(400, {
    code: "invalid_workspace",
    message: error.message,
    issues: error.issues,
  });
}

export function toMotionWorkspaceServiceError(
  error: unknown,
): MotionWorkspaceServiceError {
  if (error instanceof MotionWorkspaceServiceError) {
    return error;
  }

  if (error instanceof MotionWorkspaceRepositoryError) {
    return fromRepositoryError(error);
  }

  if (error instanceof MotionWorkspaceMigrationError) {
    return fromMigrationError(error);
  }

  if (error instanceof MotionWorkspaceParseError) {
    return fromParseError(error);
  }

  return createError(500, {
    code: "internal_error",
    message: "internal server error",
  });
}
