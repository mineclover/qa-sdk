import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  createPromoGridComposition,
  type MotionEditorCommand,
  parseMotionComposition,
  serializeMotionComposition,
  type MotionCompositionDef,
} from "motion-content";
import {
  createMotionWorkspaceSnapshot,
  type MotionWorkspaceDescriptor,
  type MotionWorkspaceSnapshotV1,
} from "motion-workspace";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  type MotionWorkspaceGetResponse,
  type MotionWorkspaceListResponse,
} from "motion-workspace-client";
import {
  launchMotionPreview,
  resolveMotionPreviewOrigin,
  type MotionPreviewLaunchResult,
} from "./motion-preview-orchestration.js";
import {
  describeError,
  formatWorkspaceSource,
  isRecord,
  type MotionCompositionSummary,
} from "./motion-shared.js";

const DEFAULT_MOTION_WORKSPACE_BASE_URL = "http://localhost:3710";

export const MOTION_WORKSPACE_LIST_USAGE = "Usage: qa-sdk motion workspace list [--base-url <url>]";
export const MOTION_WORKSPACE_SHOW_USAGE = "Usage: qa-sdk motion workspace show <id> [--base-url <url>]";
export const MOTION_WORKSPACE_CREATE_USAGE = "Usage: qa-sdk motion workspace create <id> [--base-url <url>]";
export const MOTION_WORKSPACE_DELETE_USAGE = "Usage: qa-sdk motion workspace delete <id> [--base-url <url>]";
export const MOTION_EXPORT_USAGE = "Usage: qa-sdk motion export --workspace <id> --out <file> [--base-url <url>]";
export const MOTION_IMPORT_USAGE = "Usage: qa-sdk motion import <file> --workspace <id> [--base-url <url>]";
export const MOTION_APPLY_USAGE = "Usage: qa-sdk motion apply --workspace <id> --command <json> [--base-url <url>]";
export const MOTION_PREVIEW_USAGE = "Usage: qa-sdk motion preview [--workspace <id>] [--base-url <url>] [--preview-url <url>]";

export interface MotionWorkspaceClientLike {
  list(): Promise<MotionWorkspaceListResponse>;
  get(id: string): Promise<MotionWorkspaceGetResponse>;
  create(id: string, workspace: MotionWorkspaceSnapshotV1): Promise<MotionWorkspaceGetResponse>;
  update(id: string, workspace: MotionWorkspaceSnapshotV1): Promise<MotionWorkspaceGetResponse>;
  delete(id: string): Promise<void>;
  applyCommand(
    id: string,
    command: MotionEditorCommand,
    revision: number,
  ): Promise<MotionWorkspaceGetResponse>;
}

export interface MotionWorkspaceCommandDeps {
  readonly clientFactory?: (baseUrl: string) => MotionWorkspaceClientLike;
  readonly now?: () => string;
  readonly previewLauncher?: (options: {
    readonly previewOrigin: string;
    readonly workspaceBaseUrl: string;
    readonly workspaceId?: string;
  }) => Promise<MotionPreviewLaunchResult>;
}

function getNow(deps?: MotionWorkspaceCommandDeps): string {
  return deps?.now?.() ?? new Date().toISOString();
}

function summarizeComposition(composition: MotionCompositionDef): MotionCompositionSummary {
  return {
    id: composition.id,
    title: composition.title,
    durationMs: composition.durationMs,
    parameters: composition.parameters.length,
    assets: composition.assets.length,
    layers: composition.layers.length,
    sequences: composition.sequences.length,
    captions: composition.captions.length,
    transitions: composition.transitions.length,
  };
}

function printWorkspaceDescriptor(descriptor: MotionWorkspaceDescriptor): void {
  const id = descriptor.id.padEnd(24);
  const revision = `r${descriptor.revision}`.padEnd(6);
  console.log(`  ${id} ${revision} ${descriptor.savedAt}  ${descriptor.title}`);
}

function printWorkspaceSummary(
  workspaceId: string,
  snapshot: MotionWorkspaceSnapshotV1,
): void {
  const summary = summarizeComposition(snapshot.document.composition);
  const selection = snapshot.editor.selection
    ? `${snapshot.editor.selection.kind}:${snapshot.editor.selection.id}`
    : "(none)";

  console.log("\n══ Remote Motion Workspace ══");
  console.log(`  workspace: ${workspaceId}`);
  console.log(`  schemaVersion: ${snapshot.schemaVersion}`);
  console.log(`  revision: ${snapshot.revision}`);
  console.log(`  savedAt: ${snapshot.savedAt}`);
  console.log(`  source: ${formatWorkspaceSource(snapshot)}`);
  console.log(`  editor.values: ${Object.keys(snapshot.editor.values).length}`);
  console.log(`  editor.selection: ${selection}`);
  console.log(
    `  editor.viewport: zoom=${snapshot.editor.viewport.zoom}, left=${snapshot.editor.viewport.scrollLeftMs}ms, window=${snapshot.editor.viewport.visibleDurationMs}ms`,
  );
  console.log(`  editor.loop: ${snapshot.editor.loop}`);
  console.log(`  editor.playbackRate: ${snapshot.editor.playbackRate}`);
  console.log(`  composition.id: ${summary.id}`);
  console.log(`  composition.title: ${summary.title}`);
  console.log(`  composition.durationMs: ${summary.durationMs}`);
  console.log(`  composition.parameters: ${summary.parameters}`);
  console.log(`  composition.assets: ${summary.assets}`);
  console.log(`  composition.layers: ${summary.layers}`);
  console.log(`  composition.sequences: ${summary.sequences}`);
  console.log(`  composition.captions: ${summary.captions}`);
  console.log(`  composition.transitions: ${summary.transitions}`);
}

function resolveBaseUrl(explicitBaseUrl?: string): string {
  const baseUrl = explicitBaseUrl?.trim()
    || process.env["MOTION_WORKSPACE_SERVICE_ORIGIN"]?.trim()
    || process.env["QA_MOTION_WORKSPACE_BASE_URL"]?.trim()
    || DEFAULT_MOTION_WORKSPACE_BASE_URL;

  return baseUrl.replace(/\/+$/, "");
}

function getClient(
  explicitBaseUrl: string | undefined,
  deps?: MotionWorkspaceCommandDeps,
): MotionWorkspaceClientLike {
  const baseUrl = resolveBaseUrl(explicitBaseUrl);
  return deps?.clientFactory?.(baseUrl) ?? new MotionWorkspaceClient({ baseUrl });
}

function parseOptions(
  args: string[],
  usage: string,
  options: Record<string, { type: "string" | "boolean" }>,
): ReturnType<typeof parseArgs> | null {
  try {
    return parseArgs({
      args,
      options,
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    console.error(usage);
    console.error(describeError(error));
    process.exitCode = 1;
    return null;
  }
}

function readRequiredPositional(
  parsed: ReturnType<typeof parseArgs>,
  usage: string,
): string | null {
  const [value, ...rest] = parsed.positionals;
  if (!value || rest.length > 0) {
    console.error(usage);
    process.exitCode = 1;
    return null;
  }
  return value;
}

function readRequiredOption(
  value: string | boolean | readonly (string | boolean)[] | undefined,
  usage: string,
): string | null {
  if (typeof value !== "string" || value.length === 0) {
    console.error(usage);
    process.exitCode = 1;
    return null;
  }
  return value;
}

function parseMotionEditorCommandJson(
  rawCommand: string,
): MotionEditorCommand {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawCommand) as unknown;
  } catch (error) {
    throw new Error(`command JSON 파싱 실패: ${describeError(error)}`);
  }

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    throw new Error("command JSON은 최소한 string type 필드를 가진 object여야 합니다.");
  }

  return parsed as MotionEditorCommand;
}

async function readCompositionDocument(
  filePath: string,
): Promise<{
  readonly filePath: string;
  readonly composition: MotionCompositionDef;
}> {
  const resolvedPath = resolve(filePath);
  const source = await readFile(resolvedPath, "utf-8");
  return {
    filePath: resolvedPath,
    composition: parseMotionComposition(source),
  };
}

function createSeedWorkspaceSnapshot(
  deps?: MotionWorkspaceCommandDeps,
): MotionWorkspaceSnapshotV1 {
  return createMotionWorkspaceSnapshot({
    composition: createPromoGridComposition(),
    source: {
      presetId: "promo-grid",
    },
    savedAt: getNow(deps),
  });
}

function createImportedWorkspaceSnapshot(
  composition: MotionCompositionDef,
  filePath: string,
  options: {
    readonly revision?: number;
    readonly savedAt?: string;
  } = {},
): MotionWorkspaceSnapshotV1 {
  const snapshot = createMotionWorkspaceSnapshot({
    composition,
    source: {
      path: filePath,
    },
    savedAt: options.savedAt,
  });

  return options.revision === undefined
    ? snapshot
    : {
      ...snapshot,
      revision: options.revision,
      savedAt: options.savedAt ?? snapshot.savedAt,
    };
}

async function getWorkspaceOrNull(
  client: MotionWorkspaceClientLike,
  workspaceId: string,
): Promise<MotionWorkspaceSnapshotV1 | null> {
  try {
    return (await client.get(workspaceId)).workspace;
  } catch (error) {
    if (error instanceof MotionWorkspaceClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function motionWorkspaceList(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_WORKSPACE_LIST_USAGE, {
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const response = await client.list();

    if (response.workspaces.length === 0) {
      console.log("등록된 remote motion workspace가 없습니다.");
      return;
    }

    console.log(`\n══ Remote Motion Workspaces (${response.workspaces.length}) ══`);
    for (const descriptor of response.workspaces) {
      printWorkspaceDescriptor(descriptor);
    }
  } catch (error) {
    console.error(`motion workspace list 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionWorkspaceShow(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_WORKSPACE_SHOW_USAGE, {
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredPositional(parsed, MOTION_WORKSPACE_SHOW_USAGE);
  if (!workspaceId) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const response = await client.get(workspaceId);
    printWorkspaceSummary(workspaceId, response.workspace);
  } catch (error) {
    console.error(`motion workspace show 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionWorkspaceCreate(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_WORKSPACE_CREATE_USAGE, {
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredPositional(parsed, MOTION_WORKSPACE_CREATE_USAGE);
  if (!workspaceId) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const response = await client.create(workspaceId, createSeedWorkspaceSnapshot(deps));
    console.log(`workspace 생성 완료: ${workspaceId}`);
    printWorkspaceSummary(workspaceId, response.workspace);
  } catch (error) {
    console.error(`motion workspace create 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionWorkspaceDelete(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_WORKSPACE_DELETE_USAGE, {
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredPositional(parsed, MOTION_WORKSPACE_DELETE_USAGE);
  if (!workspaceId) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    await client.delete(workspaceId);
    console.log(`workspace 삭제 완료: ${workspaceId}`);
  } catch (error) {
    console.error(`motion workspace delete 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionExport(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_EXPORT_USAGE, {
    workspace: { type: "string" },
    out: { type: "string" },
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredOption(parsed.values.workspace, MOTION_EXPORT_USAGE);
  const outPath = readRequiredOption(parsed.values.out, MOTION_EXPORT_USAGE);
  if (!workspaceId || !outPath || parsed.positionals.length > 0) {
    if (parsed.positionals.length > 0) {
      console.error(MOTION_EXPORT_USAGE);
    }
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const response = await client.get(workspaceId);
    const resolvedOutPath = resolve(outPath);

    await mkdir(dirname(resolvedOutPath), { recursive: true });
    await writeFile(
      resolvedOutPath,
      serializeMotionComposition(response.workspace.document.composition),
      "utf-8",
    );

    console.log(`motion export 완료: ${workspaceId} -> ${resolvedOutPath}`);
  } catch (error) {
    console.error(`motion export 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionImport(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_IMPORT_USAGE, {
    workspace: { type: "string" },
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const filePath = readRequiredPositional(parsed, MOTION_IMPORT_USAGE);
  const workspaceId = readRequiredOption(parsed.values.workspace, MOTION_IMPORT_USAGE);
  if (!filePath || !workspaceId) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const document = await readCompositionDocument(filePath);
    const existing = await getWorkspaceOrNull(client, workspaceId);

    if (!existing) {
      const created = await client.create(
        workspaceId,
        createImportedWorkspaceSnapshot(document.composition, document.filePath, {
          savedAt: getNow(deps),
        }),
      );
      console.log(`motion import 완료: ${document.filePath} -> ${workspaceId} (created)`);
      printWorkspaceSummary(workspaceId, created.workspace);
      return;
    }

    const nextSnapshot = createImportedWorkspaceSnapshot(
      document.composition,
      document.filePath,
      {
        revision: existing.revision + 1,
        savedAt: getNow(deps),
      },
    );
    const updated = await client.update(workspaceId, nextSnapshot);
    console.log(`motion import 완료: ${document.filePath} -> ${workspaceId} (updated)`);
    printWorkspaceSummary(workspaceId, updated.workspace);
  } catch (error) {
    console.error(`motion import 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionApply(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_APPLY_USAGE, {
    workspace: { type: "string" },
    command: { type: "string" },
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredOption(parsed.values.workspace, MOTION_APPLY_USAGE);
  const rawCommand = readRequiredOption(parsed.values.command, MOTION_APPLY_USAGE);
  if (!workspaceId || !rawCommand || parsed.positionals.length > 0) {
    if (parsed.positionals.length > 0) {
      console.error(MOTION_APPLY_USAGE);
    }
    return;
  }

  try {
    const command = parseMotionEditorCommandJson(rawCommand);
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const current = await client.get(workspaceId);
    const response = await client.applyCommand(workspaceId, command, current.workspace.revision);

    console.log(`motion apply 완료: ${workspaceId} (${command.type})`);
    printWorkspaceSummary(workspaceId, response.workspace);
  } catch (error) {
    console.error(`motion apply 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionPreview(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_PREVIEW_USAGE, {
    workspace: { type: "string" },
    "base-url": { type: "string" },
    "preview-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  if (parsed.positionals.length > 0) {
    console.error(MOTION_PREVIEW_USAGE);
    return;
  }

  const workspaceId = typeof parsed.values.workspace === "string" && parsed.values.workspace.length > 0
    ? parsed.values.workspace
    : undefined;

  try {
    const workspaceBaseUrl = resolveBaseUrl(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
    );
    const previewOrigin = resolveMotionPreviewOrigin(
      typeof parsed.values["preview-url"] === "string" ? parsed.values["preview-url"] : undefined,
    );
    const previewLauncher = deps?.previewLauncher ?? launchMotionPreview;
    const result = await previewLauncher({
      previewOrigin,
      workspaceBaseUrl,
      workspaceId,
    });

    console.log(`motion preview 준비 완료: ${result.url}`);
    console.log(`  workspace service: ${result.reusedWorkspaceService ? "reuse" : "started"}`);
    console.log(`  preview app: ${result.reusedPreviewServer ? "reuse" : "started"}`);
  } catch (error) {
    console.error(`motion preview 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}
