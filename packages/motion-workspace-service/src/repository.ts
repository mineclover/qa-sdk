// @def.boundary motion-workspace-service-spec
import type { MotionSceneDef } from "motion-content";
import type {
  MotionWorkspaceConflictErrorShape,
  MotionWorkspaceDescriptor,
  MotionWorkspaceSnapshotV2,
} from "motion-workspace";

export interface MotionWorkspaceRepositoryCreateInput {
  readonly id: string;
  readonly workspace: MotionWorkspaceSnapshotV2;
}

/**
 * `expectedRevision`은 현재 DB에 저장된 globalRevision이다. 전체 workspace save는
 * scene 구조/메타데이터 lane용으로 유지하고, scene 내용 저장은 `saveScene()`이
 * 담당한다.
 */
export interface MotionWorkspaceRepositorySaveInput {
  readonly id: string;
  readonly workspace: MotionWorkspaceSnapshotV2;
  readonly expectedRevision: number;
}

export interface MotionWorkspaceRepositoryOptions {
  readonly path?: string;
}

export interface MotionWorkspaceRepository {
  get(id: string): Promise<MotionWorkspaceSnapshotV2 | null>;
  list(): Promise<readonly MotionWorkspaceDescriptor[]>;
  create(input: MotionWorkspaceRepositoryCreateInput): Promise<MotionWorkspaceSnapshotV2>;
  save(input: MotionWorkspaceRepositorySaveInput): Promise<MotionWorkspaceSnapshotV2>;
  saveScene(
    workspaceId: string,
    sceneId: string,
    sceneData: MotionSceneDef,
    expectedRevision: number,
  ): Promise<MotionWorkspaceSnapshotV2>;
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

export interface MotionWorkspaceSceneNotFoundErrorShape {
  readonly code: "scene_not_found";
  readonly message: string;
  readonly id: string;
  readonly sceneId: string;
}

export interface MotionWorkspaceSceneConflictErrorShape
  extends MotionWorkspaceConflictErrorShape {
  readonly sceneId: string;
}

export type MotionWorkspaceRepositoryErrorShape =
  | MotionWorkspaceConflictErrorShape
  | MotionWorkspaceSceneConflictErrorShape
  | MotionWorkspaceAlreadyExistsErrorShape
  | MotionWorkspaceNotFoundErrorShape
  | MotionWorkspaceSceneNotFoundErrorShape;

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

export function createMotionWorkspaceSceneNotFoundError(
  id: string,
  sceneId: string,
): MotionWorkspaceRepositoryError {
  return new MotionWorkspaceRepositoryError({
    code: "scene_not_found",
    message: `scene를 찾을 수 없습니다: ${id}/${sceneId}.`,
    id,
    sceneId,
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

export function createMotionWorkspaceSceneRevisionConflictError(
  sceneId: string,
  expectedRevision: number,
  actualRevision: number,
): MotionWorkspaceRepositoryError {
  return new MotionWorkspaceRepositoryError({
    code: "revision_conflict",
    message: `scene revision이 충돌했습니다. sceneId=${sceneId}, expectedRevision=${expectedRevision}, actualRevision=${actualRevision}.`,
    sceneId,
    expectedRevision,
    actualRevision,
  });
}
