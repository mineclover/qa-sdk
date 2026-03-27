import {
  createMotionWorkspaceController as createRuntimeWorkspaceController,
  migrateMotionWorkspaceSnapshot,
  type MotionWorkspaceController as RuntimeMotionWorkspaceController,
  type MotionWorkspaceDescriptor,
  type MotionWorkspaceSnapshotV1,
} from "motion-workspace";
import {
  createInvalidRequestError,
  type MotionWorkspaceServiceHealthResponse,
} from "./errors.js";
import {
  createMotionWorkspaceNotFoundError,
  type MotionWorkspaceRepository,
} from "./repository.js";
import { createMotionWorkspaceServiceInfo } from "./service-info.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

const MOTION_EDITOR_COMMAND_TYPES = [
  "select",
  "set-composition",
  "set-parameter",
  "set-current-time",
  "set-loop",
  "set-playback-rate",
  "play",
  "pause",
  "restart",
  "add-layer",
  "remove-layer",
  "add-sequence",
  "remove-sequence",
  "add-caption",
  "remove-caption",
  "add-transition",
  "remove-transition",
  "update-item-string",
  "update-item-timing",
  "update-sequence-stagger",
  "update-sequence-layer-slot",
  "update-sequence-layer-role",
  "update-layer-cue-kind",
  "update-layer-cue-preset",
  "update-layer-content-type",
  "update-transition-style",
  "update-transition-duration",
  "update-transition-param",
] as const;

type MotionWorkspaceApplyCommand = Parameters<RuntimeMotionWorkspaceController["apply"]>[0];

function parseWorkspaceRequest(input: unknown): MotionWorkspaceSnapshotV1 {
  if (!isRecord(input)) {
    throw createInvalidRequestError("요청 본문은 { workspace } object여야 합니다.");
  }

  if (!hasOwn(input, "workspace")) {
    throw createInvalidRequestError("workspace 필드가 필요합니다.");
  }

  return migrateMotionWorkspaceSnapshot(
    input["workspace"] as string | MotionWorkspaceSnapshotV1 | Record<string, unknown>,
  );
}

function parseApplyCommandRequest(input: unknown): {
  readonly revision: number;
  readonly command: MotionWorkspaceApplyCommand;
} {
  if (!isRecord(input)) {
    throw createInvalidRequestError("요청 본문은 { revision, command } object여야 합니다.");
  }

  if (!hasOwn(input, "revision")) {
    throw createInvalidRequestError("revision 필드가 필요합니다.");
  }

  if (!Number.isInteger(input["revision"]) || Number(input["revision"]) < 0) {
    throw createInvalidRequestError("apply-command 요청은 revision이 0 이상인 정수여야 합니다.");
  }

  if (!hasOwn(input, "command")) {
    throw createInvalidRequestError("command 필드가 필요합니다.");
  }

  const command = input["command"];
  if (!isRecord(command)) {
    throw createInvalidRequestError("command 필드는 object여야 합니다.");
  }

  if (typeof command["type"] !== "string") {
    throw createInvalidRequestError("command.type 필드는 string이어야 합니다.");
  }

  if (!MOTION_EDITOR_COMMAND_TYPES.includes(command["type"] as (typeof MOTION_EDITOR_COMMAND_TYPES)[number])) {
    throw createInvalidRequestError(
      `지원되지 않는 command.type입니다: ${JSON.stringify(command["type"])}.`,
    );
  }

  return {
    revision: Number(input["revision"]),
    command: command as MotionWorkspaceApplyCommand,
  };
}

function deriveExpectedRevision(workspace: MotionWorkspaceSnapshotV1): number {
  if (!Number.isInteger(workspace.revision) || workspace.revision < 1) {
    throw createInvalidRequestError(
      "workspace update 요청은 revision이 1 이상인 snapshot이어야 합니다.",
    );
  }

  return workspace.revision - 1;
}

export interface MotionWorkspaceControllerDeps {
  readonly repository: MotionWorkspaceRepository;
  readonly getUptimeSeconds?: () => number;
  readonly getNow?: () => string;
  readonly version?: string;
}

export interface MotionWorkspaceController {
  health(): MotionWorkspaceServiceHealthResponse;
  listWorkspaces(): Promise<{
    readonly workspaces: readonly MotionWorkspaceDescriptor[];
  }>;
  getWorkspace(id: string): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV1;
  }>;
  createWorkspace(
    id: string,
    input: unknown,
  ): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV1;
  }>;
  updateWorkspace(
    id: string,
    input: unknown,
  ): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV1;
  }>;
  applyCommand(
    id: string,
    input: unknown,
  ): Promise<{
    readonly workspace: MotionWorkspaceSnapshotV1;
  }>;
  deleteWorkspace(id: string): Promise<void>;
}

function createCommandController(
  workspace: MotionWorkspaceSnapshotV1,
): RuntimeMotionWorkspaceController {
  const controller = createRuntimeWorkspaceController({
    composition: workspace.document.composition,
    values: workspace.editor.values,
    source: workspace.source,
    savedAt: workspace.savedAt,
  });

  controller.loadWorkspace(workspace);
  return controller;
}

export function createMotionWorkspaceController(
  deps: MotionWorkspaceControllerDeps,
): MotionWorkspaceController {
  return {
    health() {
      const info = createMotionWorkspaceServiceInfo();
      return {
        status: "ok",
        service: info.serviceId,
        default_persistence: info.defaultPersistence,
        uptime_seconds: deps.getUptimeSeconds?.(),
        version: deps.version,
      };
    },
    async listWorkspaces() {
      return {
        workspaces: await deps.repository.list(),
      };
    },
    async getWorkspace(id) {
      const workspace = await deps.repository.get(id);
      if (!workspace) {
        throw createMotionWorkspaceNotFoundError(id);
      }

      return { workspace };
    },
    async createWorkspace(id, input) {
      const workspace = parseWorkspaceRequest(input);
      return {
        workspace: await deps.repository.create({
          id,
          workspace,
        }),
      };
    },
    async updateWorkspace(id, input) {
      const workspace = parseWorkspaceRequest(input);
      return {
        workspace: await deps.repository.save({
          id,
          workspace,
          expectedRevision: deriveExpectedRevision(workspace),
        }),
      };
    },
    async applyCommand(id, input) {
      const request = parseApplyCommandRequest(input);
      const workspace = await deps.repository.get(id);
      if (!workspace) {
        throw createMotionWorkspaceNotFoundError(id);
      }

      const controller = createCommandController(workspace);
      controller.apply(request.command);

      return {
        workspace: await deps.repository.save({
          id,
          workspace: controller.saveWorkspace({
            savedAt: deps.getNow?.(),
          }).workspace,
          expectedRevision: request.revision,
        }),
      };
    },
    async deleteWorkspace(id) {
      const deleted = await deps.repository.delete(id);
      if (!deleted) {
        throw createMotionWorkspaceNotFoundError(id);
      }
    },
  };
}
