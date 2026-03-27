import type {
  MotionWorkspaceConflictErrorShape,
  MotionWorkspaceDescriptor,
  MotionWorkspaceSnapshotV1,
} from "motion-workspace";

export interface MotionWorkspaceRepositoryCreateInput {
  readonly id: string;
  readonly workspace: MotionWorkspaceSnapshotV1;
}

/**
 * `expectedRevision`은 현재 DB에 저장된 revision이고, `workspace.revision`은
 * 이번 save 이후에 저장될 revision이다. 저장소가 revision을 암묵적으로 증가시키지
 * 않도록 계약을 분리해서 optimistic concurrency를 명시적으로 유지한다.
 */
export interface MotionWorkspaceRepositorySaveInput {
  readonly id: string;
  readonly workspace: MotionWorkspaceSnapshotV1;
  readonly expectedRevision: number;
}

export interface MotionWorkspaceRepositoryOptions {
  readonly path?: string;
}

export interface MotionWorkspaceRepository {
  get(id: string): Promise<MotionWorkspaceSnapshotV1 | null>;
  list(): Promise<readonly MotionWorkspaceDescriptor[]>;
  create(input: MotionWorkspaceRepositoryCreateInput): Promise<MotionWorkspaceSnapshotV1>;
  save(input: MotionWorkspaceRepositorySaveInput): Promise<MotionWorkspaceSnapshotV1>;
  delete(id: string): Promise<boolean>;
  close(): Promise<void> | void;
}

export interface MotionWorkspaceAlreadyExistsErrorShape {
  readonly code: "workspace_exists";
  readonly message: string;
  readonly id: string;
}

export interface MotionWorkspaceNotFoundErrorShape {
  readonly code: "workspace_not_found";
  readonly message: string;
  readonly id: string;
}

export type MotionWorkspaceRepositoryErrorShape =
  | MotionWorkspaceConflictErrorShape
  | MotionWorkspaceAlreadyExistsErrorShape
  | MotionWorkspaceNotFoundErrorShape;

export class MotionWorkspaceRepositoryError extends Error {
  readonly shape: MotionWorkspaceRepositoryErrorShape;

  constructor(shape: MotionWorkspaceRepositoryErrorShape) {
    super(shape.message);
    this.name = "MotionWorkspaceRepositoryError";
    this.shape = shape;
  }
}

export function createMotionWorkspaceAlreadyExistsError(
  id: string,
): MotionWorkspaceRepositoryError {
  return new MotionWorkspaceRepositoryError({
    code: "workspace_exists",
    message: `workspace가 이미 존재합니다: ${id}.`,
    id,
  });
}

export function createMotionWorkspaceNotFoundError(
  id: string,
): MotionWorkspaceRepositoryError {
  return new MotionWorkspaceRepositoryError({
    code: "workspace_not_found",
    message: `workspace를 찾을 수 없습니다: ${id}.`,
    id,
  });
}

export function createMotionWorkspaceRevisionConflictError(
  expectedRevision: number,
  actualRevision: number,
): MotionWorkspaceRepositoryError {
  return new MotionWorkspaceRepositoryError({
    code: "revision_conflict",
    message: `workspace revision이 충돌했습니다. expectedRevision=${expectedRevision}, actualRevision=${actualRevision}.`,
    expectedRevision,
    actualRevision,
  });
}
