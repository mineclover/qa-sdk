// @def.boundary motion-workspace-system
import type { MotionEditorCommand, MotionSceneDef } from "motion-content";
import type {
  MotionWorkspaceDescriptor,
  MotionWorkspaceSnapshot,
  MotionWorkspaceSnapshotV2,
} from "motion-workspace";
export type { MotionWorkspaceConflictErrorShape } from "motion-workspace";

export interface MotionWorkspaceClientOptions {
  readonly baseUrl: string;
  readonly fetch?: MotionWorkspaceClientFetch;
}

export interface MotionWorkspaceClientRequestInit {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

export interface MotionWorkspaceClientFetch {
  (
    input: string,
    init?: MotionWorkspaceClientRequestInit,
  ): Promise<MotionWorkspaceClientResponse>;
}

export interface MotionWorkspaceClientResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface MotionWorkspaceApplyRequest {
  readonly revision: number;
  readonly command: MotionEditorCommand;
}

export interface MotionWorkspaceSceneMutationRequest {
  readonly revision: number;
  readonly scene: MotionSceneDef;
}

export interface MotionWorkspaceSceneStructureRequest {
  readonly revision: number;
}

export interface MotionWorkspaceListResponse {
  readonly workspaces: readonly MotionWorkspaceDescriptor[];
}

export interface MotionWorkspaceGetResponse {
  readonly workspace: MotionWorkspaceSnapshotV2;
}

export interface MotionWorkspaceCreateRequest {
  readonly workspace: MotionWorkspaceSnapshot;
}

export interface MotionWorkspaceSceneDescriptor {
  readonly scene: MotionSceneDef;
  readonly revision: number;
}

export interface MotionWorkspaceSceneListResponse {
  readonly scenes: readonly MotionWorkspaceSceneDescriptor[];
  readonly globalRevision: number;
}

export interface MotionWorkspaceSceneGetResponse {
  readonly scene: MotionSceneDef;
  readonly revision: number;
  readonly globalRevision: number;
}

export interface MotionWorkspaceDeleteSceneResponse {
  readonly deletedSceneId: string;
  readonly globalRevision: number;
}

export interface MotionWorkspaceSceneConflictErrorShape {
  readonly code: "revision_conflict";
  readonly message: string;
  readonly sceneId: string;
  readonly expectedRevision?: number;
  readonly actualRevision?: number;
}
