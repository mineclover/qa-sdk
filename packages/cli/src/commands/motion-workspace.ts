import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  MOTION_COMPOSITION_SCHEMA_V2,
  assembleComposition,
  createPromoGridComposition,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
  type MotionEditorCommand,
  type MotionSceneDef,
  parseMotionComposition,
  serializeMotionComposition,
} from "motion-content";
import {
  createMotionWorkspaceSnapshot,
  type MotionWorkspaceDescriptor,
  type MotionWorkspaceSnapshot,
  type MotionWorkspaceSnapshotV2,
} from "motion-workspace";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  type MotionWorkspaceDeleteSceneResponse,
  type MotionWorkspaceGetResponse,
  type MotionWorkspaceListResponse,
  type MotionWorkspaceSceneGetResponse,
  type MotionWorkspaceSceneListResponse,
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
const DEFAULT_NEW_SCENE_DURATION_MS = 1200;

export const MOTION_WORKSPACE_LIST_USAGE = "Usage: qa-sdk motion workspace list [--base-url <url>]";
export const MOTION_WORKSPACE_SHOW_USAGE = "Usage: qa-sdk motion workspace show <id> [--base-url <url>]";
export const MOTION_WORKSPACE_CREATE_USAGE = "Usage: qa-sdk motion workspace create <id> [--base-url <url>]";
export const MOTION_WORKSPACE_DELETE_USAGE = "Usage: qa-sdk motion workspace delete <id> [--base-url <url>]";
export const MOTION_SCENE_LIST_USAGE = "Usage: qa-sdk motion scene list --workspace <id> [--base-url <url>]";
export const MOTION_SCENE_SHOW_USAGE = "Usage: qa-sdk motion scene show --workspace <id> --scene <id> [--base-url <url>]";
export const MOTION_SCENE_CREATE_USAGE = "Usage: qa-sdk motion scene create --workspace <id> [--base-url <url>]";
export const MOTION_SCENE_DELETE_USAGE = "Usage: qa-sdk motion scene delete --workspace <id> --scene <id> [--base-url <url>]";
export const MOTION_EXPORT_USAGE = "Usage: qa-sdk motion export --workspace <id> --out <file> [--base-url <url>]";
export const MOTION_IMPORT_USAGE = "Usage: qa-sdk motion import <file> --workspace <id> [--base-url <url>]";
export const MOTION_APPLY_USAGE = "Usage: qa-sdk motion apply --workspace <id> --command <json> [--base-url <url>]";
export const MOTION_PREVIEW_USAGE = "Usage: qa-sdk motion preview [--workspace <id>] [--base-url <url>] [--preview-url <url>]";

export interface MotionWorkspaceClientLike {
  list(): Promise<MotionWorkspaceListResponse>;
  get(id: string): Promise<MotionWorkspaceGetResponse>;
  create(id: string, workspace: MotionWorkspaceSnapshot): Promise<MotionWorkspaceGetResponse>;
  update(id: string, workspace: MotionWorkspaceSnapshot): Promise<MotionWorkspaceGetResponse>;
  delete(id: string): Promise<void>;
  applyCommand(
    id: string,
    command: MotionEditorCommand,
    revision: number,
  ): Promise<MotionWorkspaceGetResponse>;
  listScenes(workspaceId: string): Promise<MotionWorkspaceSceneListResponse>;
  getScene(workspaceId: string, sceneId: string): Promise<MotionWorkspaceSceneGetResponse>;
  createScene(
    workspaceId: string,
    scene: MotionSceneDef,
    revision: number,
  ): Promise<MotionWorkspaceSceneGetResponse>;
  deleteScene(
    workspaceId: string,
    sceneId: string,
    revision: number,
  ): Promise<MotionWorkspaceDeleteSceneResponse>;
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

function isSceneComposition(
  composition: MotionCompositionDef | MotionCompositionDefV2,
): composition is MotionCompositionDefV2 {
  return "targets" in composition && "scenes" in composition;
}

function formatSelection(
  selection: MotionWorkspaceSnapshotV2["editor"]["selection"],
): string {
  if (!selection) {
    return "(none)";
  }
  if (selection.kind === "scene-layer") {
    return `${selection.kind}:${selection.sceneId}/${selection.targetId}`;
  }
  return `${selection.kind}:${selection.id}`;
}

function summarizeComposition(
  composition: MotionCompositionDef | MotionCompositionDefV2,
): MotionCompositionSummary {
  if (isSceneComposition(composition)) {
    return {
      id: composition.id,
      title: composition.title,
      durationMs: composition.durationMs,
      parameters: composition.parameters.length,
      assets: composition.assets.length,
      targets: composition.targets.length,
      scenes: composition.scenes.length,
      layers: composition.scenes.reduce((count, scene) => count + scene.layers.length, 0),
      sequences: composition.scenes.reduce((count, scene) => count + scene.sequences.length, 0),
      captions: composition.scenes.reduce((count, scene) => count + scene.captions.length, 0),
      transitions: 0,
    };
  }

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

function toLegacyExportComposition(
  composition: MotionCompositionDef | MotionCompositionDefV2,
): MotionCompositionDef {
  return isSceneComposition(composition)
    ? assembleComposition(composition)
    : composition;
}

function printWorkspaceDescriptor(descriptor: MotionWorkspaceDescriptor): void {
  const id = descriptor.id.padEnd(24);
  const revision = `r${descriptor.revision}`.padEnd(6);
  console.log(`  ${id} ${revision} ${descriptor.savedAt}  ${descriptor.title}`);
}

function printSceneDescriptor(
  descriptor: MotionWorkspaceSceneListResponse["scenes"][number],
): void {
  const id = descriptor.scene.id.padEnd(20);
  const revision = `r${descriptor.revision}`.padEnd(6);
  const timing = `${descriptor.scene.startMs}ms +${descriptor.scene.durationMs}ms`.padEnd(18);
  console.log(`  ${id} ${revision} ${timing} ${descriptor.scene.title}`);
}

function printWorkspaceSummary(
  workspaceId: string,
  snapshot: MotionWorkspaceSnapshotV2,
): void {
  const summary = summarizeComposition(snapshot.document.composition);

  console.log("\n══ Remote Motion Workspace ══");
  console.log(`  workspace: ${workspaceId}`);
  console.log(`  schemaVersion: ${snapshot.schemaVersion}`);
  console.log(`  revision: ${snapshot.globalRevision}`);
  console.log(`  savedAt: ${snapshot.savedAt}`);
  console.log(`  source: ${formatWorkspaceSource(snapshot)}`);
  console.log(`  editor.values: ${Object.keys(snapshot.editor.values).length}`);
  console.log(`  editor.selection: ${formatSelection(snapshot.editor.selection)}`);
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
  if (summary.targets !== undefined) {
    console.log(`  composition.targets: ${summary.targets}`);
  }
  if (summary.scenes !== undefined) {
    console.log(`  composition.scenes: ${summary.scenes}`);
  }
  console.log(`  composition.layers: ${summary.layers}`);
  console.log(`  composition.sequences: ${summary.sequences}`);
  console.log(`  composition.captions: ${summary.captions}`);
  console.log(`  composition.transitions: ${summary.transitions}`);
}

function printSceneSummary(
  workspaceId: string,
  response: MotionWorkspaceSceneGetResponse,
): void {
  console.log("\n══ Remote Motion Scene ══");
  console.log(`  workspace: ${workspaceId}`);
  console.log(`  scene: ${response.scene.id}`);
  console.log(`  title: ${response.scene.title}`);
  console.log(`  revision: ${response.revision}`);
  console.log(`  globalRevision: ${response.globalRevision}`);
  console.log(`  startMs: ${response.scene.startMs}`);
  console.log(`  durationMs: ${response.scene.durationMs}`);
  console.log(`  layers: ${response.scene.layers.length}`);
  console.log(`  sequences: ${response.scene.sequences.length}`);
  console.log(`  captions: ${response.scene.captions.length}`);
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

function rejectPositionals(
  parsed: ReturnType<typeof parseArgs>,
  usage: string,
): boolean {
  if (parsed.positionals.length === 0) {
    return false;
  }

  console.error(usage);
  process.exitCode = 1;
  return true;
}

function parseMotionEditorCommandJson(
  rawCommand: string,
): MotionEditorCommand {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawCommand) as unknown;
  } catch (error) {
    throw new Error(`command JSON 파싱 실패: ${describeError(error)}`, { cause: error });
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
): MotionWorkspaceSnapshotV2 {
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
    readonly globalRevision?: number;
    readonly savedAt?: string;
  } = {},
): MotionWorkspaceSnapshotV2 {
  const snapshot = createMotionWorkspaceSnapshot({
    composition,
    source: {
      path: filePath,
    },
    savedAt: options.savedAt,
  });

  return options.globalRevision === undefined
    ? snapshot
    : {
      ...snapshot,
      globalRevision: options.globalRevision,
      savedAt: options.savedAt ?? snapshot.savedAt,
    };
}

async function getWorkspaceOrNull(
  client: MotionWorkspaceClientLike,
  workspaceId: string,
): Promise<MotionWorkspaceSnapshotV2 | null> {
  try {
    return (await client.get(workspaceId)).workspace;
  } catch (error) {
    if (error instanceof MotionWorkspaceClientError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function requireSceneComposition(
  workspace: MotionWorkspaceSnapshotV2,
): MotionCompositionDefV2 {
  if (
    workspace.document.schemaVersion !== MOTION_COMPOSITION_SCHEMA_V2
    || !isSceneComposition(workspace.document.composition)
  ) {
    throw new Error("scene endpoint는 qa-sdk.motion-composition/v2 workspace에서만 지원합니다.");
  }

  return workspace.document.composition;
}

function createNextIndexedId(
  prefix: string,
  existingIds: readonly string[],
): { readonly id: string; readonly index: number } {
  const existing = new Set(existingIds);
  let index = existingIds.length + 1;
  let id = `${prefix}-${index}`;

  while (existing.has(id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }

  return { id, index };
}

function createNextSceneDraft(
  composition: MotionCompositionDefV2,
): MotionSceneDef {
  const { id, index } = createNextIndexedId(
    "scene",
    composition.scenes.map((scene) => scene.id),
  );
  const durationMs = Math.min(DEFAULT_NEW_SCENE_DURATION_MS, composition.durationMs);
  const maxStartMs = Math.max(0, composition.durationMs - durationMs);
  const lastSceneEndMs = composition.scenes.reduce(
    (max, scene) => Math.max(max, scene.startMs + scene.durationMs),
    0,
  );

  return {
    id,
    title: `Scene ${index}`,
    startMs: Math.min(lastSceneEndMs, maxStartMs),
    durationMs,
    layers: [],
    sequences: [],
    captions: [],
  };
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

export async function motionSceneList(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_SCENE_LIST_USAGE, {
    workspace: { type: "string" },
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredOption(parsed.values.workspace, MOTION_SCENE_LIST_USAGE);
  if (!workspaceId || rejectPositionals(parsed, MOTION_SCENE_LIST_USAGE)) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const response = await client.listScenes(workspaceId);

    if (response.scenes.length === 0) {
      console.log(`등록된 remote motion scene가 없습니다: ${workspaceId}.`);
      return;
    }

    console.log(`\n══ Remote Motion Scenes (${response.scenes.length}) ══`);
    console.log(`  workspace: ${workspaceId}`);
    console.log(`  globalRevision: ${response.globalRevision}`);
    for (const descriptor of response.scenes) {
      printSceneDescriptor(descriptor);
    }
  } catch (error) {
    console.error(`motion scene list 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionSceneShow(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_SCENE_SHOW_USAGE, {
    workspace: { type: "string" },
    scene: { type: "string" },
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredOption(parsed.values.workspace, MOTION_SCENE_SHOW_USAGE);
  const sceneId = readRequiredOption(parsed.values.scene, MOTION_SCENE_SHOW_USAGE);
  if (!workspaceId || !sceneId || rejectPositionals(parsed, MOTION_SCENE_SHOW_USAGE)) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const response = await client.getScene(workspaceId, sceneId);
    printSceneSummary(workspaceId, response);
  } catch (error) {
    console.error(`motion scene show 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionSceneCreate(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_SCENE_CREATE_USAGE, {
    workspace: { type: "string" },
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredOption(parsed.values.workspace, MOTION_SCENE_CREATE_USAGE);
  if (!workspaceId || rejectPositionals(parsed, MOTION_SCENE_CREATE_USAGE)) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const current = await client.get(workspaceId);
    const composition = requireSceneComposition(current.workspace);
    const draft = createNextSceneDraft(composition);
    const response = await client.createScene(
      workspaceId,
      draft,
      current.workspace.globalRevision,
    );

    console.log(`scene 생성 완료: ${workspaceId}/${response.scene.id}`);
    printSceneSummary(workspaceId, response);
  } catch (error) {
    console.error(`motion scene create 실패: ${describeError(error)}`);
    process.exitCode = 1;
  }
}

export async function motionSceneDelete(
  args: string[],
  deps?: MotionWorkspaceCommandDeps,
): Promise<void> {
  const parsed = parseOptions(args, MOTION_SCENE_DELETE_USAGE, {
    workspace: { type: "string" },
    scene: { type: "string" },
    "base-url": { type: "string" },
  });
  if (!parsed) {
    return;
  }

  const workspaceId = readRequiredOption(parsed.values.workspace, MOTION_SCENE_DELETE_USAGE);
  const sceneId = readRequiredOption(parsed.values.scene, MOTION_SCENE_DELETE_USAGE);
  if (!workspaceId || !sceneId || rejectPositionals(parsed, MOTION_SCENE_DELETE_USAGE)) {
    return;
  }

  try {
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const current = await client.get(workspaceId);
    const response = await client.deleteScene(
      workspaceId,
      sceneId,
      current.workspace.globalRevision,
    );
    console.log(`scene 삭제 완료: ${workspaceId}/${response.deletedSceneId}`);
    console.log(`  globalRevision: ${response.globalRevision}`);
  } catch (error) {
    console.error(`motion scene delete 실패: ${describeError(error)}`);
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
  if (!workspaceId || !outPath || rejectPositionals(parsed, MOTION_EXPORT_USAGE)) {
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
      serializeMotionComposition(
        toLegacyExportComposition(response.workspace.document.composition),
      ),
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
        globalRevision: existing.globalRevision + 1,
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
  if (!workspaceId || !rawCommand || rejectPositionals(parsed, MOTION_APPLY_USAGE)) {
    return;
  }

  try {
    const command = parseMotionEditorCommandJson(rawCommand);
    const client = getClient(
      typeof parsed.values["base-url"] === "string" ? parsed.values["base-url"] : undefined,
      deps,
    );
    const current = await client.get(workspaceId);
    const response = await client.applyCommand(
      workspaceId,
      command,
      current.workspace.globalRevision,
    );

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

  if (rejectPositionals(parsed, MOTION_PREVIEW_USAGE)) {
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
