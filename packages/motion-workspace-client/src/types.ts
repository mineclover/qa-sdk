import type { MotionEditorCommand } from "motion-content";
import type {
  MotionWorkspaceDescriptor,
  MotionWorkspaceSnapshotV1,
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

export interface MotionWorkspaceListResponse {
  readonly workspaces: readonly MotionWorkspaceDescriptor[];
}

export interface MotionWorkspaceGetResponse {
  readonly workspace: MotionWorkspaceSnapshotV1;
}
