// @def.boundary motion-content-editor-demo-system
import {
  createMotionDomStageAdapter,
  createMotionEventLog,
  migrateCompositionV1toV2,
  MOTION_COMPOSITION_PRESET_DOCUMENTS,
  parseMotionComposition,
  parseMotionCompositionV2,
  serializeMotionCompositionV2,
  type MotionCompositionDef,
  type MotionCompositionDefV2,
} from "motion-content";
import {
  applyMotionEditorTheme,
  createMotionEditorShell,
  createMotionEditorShellWorkspace,
  readStoredMotionEditorTheme,
  type MotionEditorScenePresenceEntry,
  type MotionEditorScenePresenceUser,
  type MotionEditorShell,
  type MotionEditorShellWorkspace,
} from "motion-content-editor";
import {
  LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
  createMotionWorkspaceSnapshot,
  migrateLegacyMotionEditorDemoState,
  type MotionWorkspaceSnapshotV2,
} from "motion-workspace";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  isMotionWorkspaceConflictError,
  type MotionWorkspaceConflictErrorShape,
  type MotionWorkspacePresenceInfo,
  type MotionWorkspaceWsConnection,
  type MotionWorkspaceWsSceneLockInfo,
} from "motion-workspace-client";

const CUSTOM_PRESET_ID = "custom";
const WORKSPACE_QUERY_KEY = "workspace";
const PRESET_QUERY_KEY = "preset";
const USER_QUERY_KEY = "user";
const USER_SESSION_KEY = "motion-content-editor-demo:user";
const WORKSPACE_CLIENT_BASE_URL = "/api/motion-workspace";
const IMPORT_SOURCE_PATH = {
  file: "import:file",
  textarea: "import:textarea",
} as const;
const USER_PRESENCE_COLORS = [
  "#ff8a5b",
  "#4db6ac",
  "#7c9cff",
  "#f6c453",
  "#f37ca0",
  "#7dd36f",
] as const;

applyMotionEditorTheme(readStoredMotionEditorTheme());

type DemoPresetId = (typeof MOTION_COMPOSITION_PRESET_DOCUMENTS)[number]["id"];
type DemoPresetSelection = DemoPresetId | typeof CUSTOM_PRESET_ID;
type DemoStatusTone = "neutral" | "success" | "warning" | "danger";
type DemoAutosavePhase = "idle" | "saving" | "saved" | "error" | "conflict";

interface DemoPresetRecord {
  readonly id: DemoPresetId;
  readonly label: string;
  readonly document: string;
  readonly composition: MotionCompositionDefV2;
  readonly normalized: string;
}

interface PendingSaveFailureBase {
  readonly kind: "conflict" | "error";
  readonly workspaceId: string;
  readonly snapshot: MotionWorkspaceSnapshotV2;
  readonly workspaceToken: number;
}

interface PendingSaveConflict extends PendingSaveFailureBase {
  readonly kind: "conflict";
  readonly conflict: MotionWorkspaceConflictErrorShape;
}

interface PendingSaveError extends PendingSaveFailureBase {
  readonly kind: "error";
  readonly message: string;
}

type PendingSaveFailure = PendingSaveConflict | PendingSaveError;

interface PendingLegacyMigration {
  readonly snapshot: MotionWorkspaceSnapshotV2;
}

interface SceneRealtimeState {
  readonly presences: Map<string, MotionWorkspacePresenceInfo>;
  readonly sceneLocks: Map<string, Set<string>>;
}

function isDemoPresetId(value: string | null | undefined): value is DemoPresetId {
  return typeof value === "string"
    && MOTION_COMPOSITION_PRESET_DOCUMENTS.some((preset) => preset.id === value);
}

function isSceneComposition(
  composition: MotionCompositionDef | MotionCompositionDefV2,
): composition is MotionCompositionDefV2 {
  return "targets" in composition && "scenes" in composition;
}

function toSceneComposition(
  composition: MotionCompositionDef | MotionCompositionDefV2,
): MotionCompositionDefV2 {
  return isSceneComposition(composition)
    ? composition
    : migrateCompositionV1toV2(composition);
}

function formatSavedAt(savedAt: string | null): string {
  if (!savedAt) return "아직 저장되지 않음";
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(savedAt));
  } catch {
    return savedAt;
  }
}

function createWorkspaceId(): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().split("-")[0] ?? "workspace"
    : Math.random().toString(36).slice(2, 10);
  return `demo/${suffix}`;
}

function createUserId(): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID().split("-")[0] ?? "editor"
    : Math.random().toString(36).slice(2, 8);
  return `editor-${suffix}`;
}

function normalizeUserId(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function readUrlWorkspaceId(): string | null {
  const value = new URLSearchParams(window.location.search).get(WORKSPACE_QUERY_KEY)?.trim();
  return value && value.length > 0 ? value : null;
}

function readUrlPresetId(): DemoPresetId | null {
  const value = new URLSearchParams(window.location.search).get(PRESET_QUERY_KEY);
  return isDemoPresetId(value) ? value : null;
}

function readUrlUserId(): string | null {
  return normalizeUserId(new URLSearchParams(window.location.search).get(USER_QUERY_KEY));
}

function readStoredUserId(): string | null {
  try {
    return normalizeUserId(window.sessionStorage.getItem(USER_SESSION_KEY));
  } catch {
    return null;
  }
}

function writeStoredUserId(userId: string): void {
  try {
    window.sessionStorage.setItem(USER_SESSION_KEY, userId);
  } catch {
    // noop
  }
}

function writeUrlState(
  workspaceId: string,
  presetId: DemoPresetSelection,
  userId: string,
): void {
  const url = new URL(window.location.href);
  url.searchParams.set(WORKSPACE_QUERY_KEY, workspaceId);
  url.searchParams.set(USER_QUERY_KEY, userId);
  if (presetId === CUSTOM_PRESET_ID) {
    url.searchParams.delete(PRESET_QUERY_KEY);
  } else {
    url.searchParams.set(PRESET_QUERY_KEY, presetId);
  }
  window.history.replaceState({}, "", url);
}

function writeUserUrlState(userId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(USER_QUERY_KEY, userId);
  window.history.replaceState({}, "", url);
}

function readLegacyDemoStateRaw(): string | null {
  try {
    return window.localStorage.getItem(LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readLegacyDemoStateSnapshot(raw: string): PendingLegacyMigration {
  return {
    snapshot: migrateLegacyMotionEditorDemoState(raw).workspace,
  };
}

function clearLegacyDemoStateSnapshot(): void {
  try {
    window.localStorage.removeItem(LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY);
  } catch {
    // noop
  }
}

function describeAutosavePhase(phase: DemoAutosavePhase): string {
  switch (phase) {
    case "idle":
      return "원격 미연결";
    case "saving":
      return "자동 저장 중";
    case "saved":
      return "자동 저장 완료";
    case "error":
      return "저장 오류";
    case "conflict":
      return "저장 충돌";
  }
}

const presetDocuments: readonly DemoPresetRecord[] = MOTION_COMPOSITION_PRESET_DOCUMENTS.map((preset) => {
  const composition = toSceneComposition(parseMotionComposition(preset.document));
  return Object.assign({}, preset, {
    composition,
    normalized: serializeMotionCompositionV2(composition),
  });
});

const defaultPreset = presetDocuments[0];

function findPresetById(presetId: DemoPresetId): DemoPresetRecord {
  return presetDocuments.find((preset) => preset.id === presetId) ?? defaultPreset;
}

function parseDemoComposition(source: string): MotionCompositionDefV2 {
  try {
    const isV2Document = /"schemaVersion"\s*:\s*"qa-sdk\.motion-composition\/v2"/.test(source);
    return isV2Document
      ? parseMotionCompositionV2(source)
      : migrateCompositionV1toV2(parseMotionComposition(source));
  } catch {
    return migrateCompositionV1toV2(parseMotionComposition(source));
  }
}

function findMatchingPresetId(
  composition: MotionCompositionDef | MotionCompositionDefV2,
): DemoPresetId | null {
  const normalized = serializeMotionCompositionV2(toSceneComposition(composition));
  return presetDocuments.find((preset) => preset.normalized === normalized)?.id ?? null;
}

function resolvePresetSelection(snapshot: MotionWorkspaceSnapshotV2): DemoPresetSelection {
  if (isDemoPresetId(snapshot.source?.presetId)) {
    return snapshot.source.presetId;
  }
  return findMatchingPresetId(snapshot.document.composition) ?? CUSTOM_PRESET_ID;
}

function describeWorkspaceSource(snapshot: MotionWorkspaceSnapshotV2): string {
  const presetId = snapshot.source?.presetId;
  if (isDemoPresetId(presetId)) {
    return `${findPresetById(presetId).label} preset seed`;
  }
  if (snapshot.source?.storageKey === LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY) {
    return "legacy local demo state";
  }
  if (snapshot.source?.storageKey) {
    return snapshot.source.storageKey;
  }
  if (snapshot.source?.path) {
    return snapshot.source.path;
  }
  return "custom composition";
}

function createSeedWorkspaceSnapshot(
  presetId: DemoPresetId,
  options: {
    readonly globalRevision?: number;
    readonly savedAt?: string;
  } = {},
): MotionWorkspaceSnapshotV2 {
  const preset = findPresetById(presetId);
  const snapshot = createMotionWorkspaceSnapshot({
    composition: preset.composition,
    source: {
      presetId,
    },
    savedAt: options.savedAt,
  });

  return options.globalRevision === undefined
    ? snapshot
    : {
      ...snapshot,
      globalRevision: options.globalRevision,
    };
}

function createImportedWorkspaceSnapshot(
  source: string,
  origin: "textarea" | "file",
  current: MotionWorkspaceSnapshotV2,
): MotionWorkspaceSnapshotV2 {
  const snapshot = createMotionWorkspaceSnapshot({
    composition: parseDemoComposition(source),
    values: current.editor.values,
    source: {
      path: IMPORT_SOURCE_PATH[origin],
    },
    savedAt: current.savedAt,
  });

  return {
    ...snapshot,
    globalRevision: current.globalRevision,
    savedAt: current.savedAt,
  };
}

function hashUserId(input: string): number {
  let hash = 0;
  for (const char of input) {
    hash = ((hash * 33) + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function pickUserColor(userId: string): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- modular arithmetic → 유효 인덱스 보장
  return USER_PRESENCE_COLORS[hashUserId(userId) % USER_PRESENCE_COLORS.length]!;
}

function deriveUserInitials(userId: string): string {
  const parts = userId.split(/[\s/_-]+/).filter((part) => part.length > 0);
  if (parts.length >= 2) {
    const first = parts[0] ?? "";
    const second = parts[1] ?? "";
    return `${first[0] ?? ""}${second[0] ?? ""}`.slice(0, 2).toUpperCase();
  }
  return userId.slice(0, 2).toUpperCase();
}

function createScenePresenceUser(
  userId: string,
  currentUserId: string,
): MotionEditorScenePresenceUser {
  return {
    userId,
    name: userId,
    color: pickUserColor(userId),
    initials: deriveUserInitials(userId),
    isCurrentUser: userId === currentUserId,
  };
}

function describeClientError(error: unknown): string {
  if (error instanceof MotionWorkspaceClientError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function isStatusError(error: unknown, status: number): error is MotionWorkspaceClientError {
  return error instanceof MotionWorkspaceClientError && error.status === status;
}

const app = document.getElementById("app");

if (!app) {
  throw new Error("#app not found");
}

app.innerHTML = `
  <section class="demo-workflow">
    <div class="demo-workflow__main">
      <label class="demo-field">
        <span>User</span>
        <input data-demo="user-id" placeholder="editor-a" />
      </label>
      <label class="demo-field">
        <span>Workspace ID</span>
        <input data-demo="workspace-id" placeholder="demo/abc12345" />
      </label>
      <button class="demo-button" data-demo="open-workspace">Workspace 열기</button>
      <button class="demo-button demo-button--ghost" data-demo="create-workspace">새 workspace 생성</button>
    </div>
    <div class="demo-workflow__main">
      <label class="demo-field">
        <span>Preset Seed</span>
        <select data-demo="preset">
          ${presetDocuments
            .map((preset) => `<option value="${preset.id}">${preset.label}</option>`)
            .join("")}
          <option value="${CUSTOM_PRESET_ID}" disabled>Custom / Imported</option>
        </select>
      </label>
      <button class="demo-button" data-demo="apply-preset">현재 workspace에 preset 적용</button>
    </div>
    <div class="demo-workflow__meta">
      <div class="demo-autosave-pill" data-demo="autosave-state"></div>
      <div class="demo-status" data-demo="status"></div>
      <div class="demo-status demo-status--muted" data-demo="workspace-meta"></div>
      <div class="demo-status demo-status--muted" data-demo="presence-meta"></div>
      <div class="demo-status demo-status--muted" data-demo="saved-at"></div>
      <div class="demo-status demo-status--detail" data-demo="save-detail" hidden></div>
      <div class="demo-actions" data-demo="save-actions" hidden>
        <button class="demo-button demo-button--ghost" data-demo="retry-save" type="button"></button>
        <button class="demo-button demo-button--ghost" data-demo="reload-remote" type="button">원격 다시 불러오기</button>
      </div>
      <div class="demo-status demo-status--detail" data-demo="migration-detail" hidden></div>
      <div class="demo-actions" data-demo="migration-actions" hidden>
        <button class="demo-button demo-button--ghost" data-demo="import-legacy" type="button">기존 local draft 가져오기</button>
      </div>
    </div>
    <p class="demo-note">
      문서와 persisted editor state는 workspace service로 저장되고, layout/theme만 로컬 preference로 남는다. Upload / Apply는 현재 workspace source를 import로 바꿔 같은 remote workspace에 다시 저장한다.
    </p>
  </section>
  <div data-demo="editor"></div>
`;

const userIdInput = app.querySelector<HTMLInputElement>('[data-demo="user-id"]');
const workspaceIdInput = app.querySelector<HTMLInputElement>('[data-demo="workspace-id"]');
const openWorkspaceButton = app.querySelector<HTMLButtonElement>('[data-demo="open-workspace"]');
const createWorkspaceButton = app.querySelector<HTMLButtonElement>('[data-demo="create-workspace"]');
const applyPresetButton = app.querySelector<HTMLButtonElement>('[data-demo="apply-preset"]');
const presetSelect = app.querySelector<HTMLSelectElement>('[data-demo="preset"]');
const autosaveStateNode = app.querySelector<HTMLElement>('[data-demo="autosave-state"]');
const statusNode = app.querySelector<HTMLElement>('[data-demo="status"]');
const workspaceMetaNode = app.querySelector<HTMLElement>('[data-demo="workspace-meta"]');
const presenceMetaNode = app.querySelector<HTMLElement>('[data-demo="presence-meta"]');
const savedAtNode = app.querySelector<HTMLElement>('[data-demo="saved-at"]');
const saveDetailNode = app.querySelector<HTMLElement>('[data-demo="save-detail"]');
const saveActionsNode = app.querySelector<HTMLElement>('[data-demo="save-actions"]');
const retrySaveButton = app.querySelector<HTMLButtonElement>('[data-demo="retry-save"]');
const reloadRemoteButton = app.querySelector<HTMLButtonElement>('[data-demo="reload-remote"]');
const migrationDetailNode = app.querySelector<HTMLElement>('[data-demo="migration-detail"]');
const migrationActionsNode = app.querySelector<HTMLElement>('[data-demo="migration-actions"]');
const importLegacyButton = app.querySelector<HTMLButtonElement>('[data-demo="import-legacy"]');
const editorHost = app.querySelector<HTMLElement>('[data-demo="editor"]');

if (
  !userIdInput
  || !workspaceIdInput
  || !openWorkspaceButton
  || !createWorkspaceButton
  || !applyPresetButton
  || !presetSelect
  || !autosaveStateNode
  || !statusNode
  || !workspaceMetaNode
  || !presenceMetaNode
  || !savedAtNode
  || !saveDetailNode
  || !saveActionsNode
  || !retrySaveButton
  || !reloadRemoteButton
  || !migrationDetailNode
  || !migrationActionsNode
  || !importLegacyButton
  || !editorHost
) {
  throw new Error("demo controls failed to mount");
}

const userIdInputEl = userIdInput;
const openWorkspaceButtonEl = openWorkspaceButton;
const createWorkspaceButtonEl = createWorkspaceButton;
const applyPresetButtonEl = applyPresetButton;
const presetSelectEl = presetSelect;
const autosaveStateNodeEl = autosaveStateNode;
const statusNodeEl = statusNode;
const workspaceMetaNodeEl = workspaceMetaNode;
const presenceMetaNodeEl = presenceMetaNode;
const savedAtNodeEl = savedAtNode;
const saveDetailNodeEl = saveDetailNode;
const saveActionsNodeEl = saveActionsNode;
const retrySaveButtonEl = retrySaveButton;
const reloadRemoteButtonEl = reloadRemoteButton;
const migrationDetailNodeEl = migrationDetailNode;
const migrationActionsNodeEl = migrationActionsNode;
const importLegacyButtonEl = importLegacyButton;
const workspaceIdInputEl = workspaceIdInput;
const editorHostEl = editorHost;

const workspaceClient = new MotionWorkspaceClient({
  baseUrl: WORKSPACE_CLIENT_BASE_URL,
});

let activeWorkspaceId: string | null = null;
let activeShell: MotionEditorShell | null = null;
let activeShellWorkspace: MotionEditorShellWorkspace | null = null;
let activeRemoteSnapshot: MotionWorkspaceSnapshotV2 | null = null;
let activeRealtimeConnection: MotionWorkspaceWsConnection | null = null;
let activeLockedSceneId: string | null = null;
let persistQueue: Promise<void> = Promise.resolve();
let activeWorkspaceToken = 0;
let lastWrittenWorkspaceId: string | null = null;
let lastWrittenPresetId: DemoPresetSelection | null = null;
let lastWrittenUserId: string | null = null;
let pendingSaveFailure: PendingSaveFailure | null = null;
let pendingLegacyMigration: PendingLegacyMigration | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let collaborationState: SceneRealtimeState = {
  presences: new Map(),
  sceneLocks: new Map(),
};
let collaborationMessage = "협업 WS 연결 전";

function setStatus(message: string, tone: DemoStatusTone = "neutral"): void {
  statusNodeEl.textContent = message;
  statusNodeEl.dataset["tone"] = tone;
}

function setAutosavePhase(phase: DemoAutosavePhase): void {
  autosaveStateNodeEl.textContent = describeAutosavePhase(phase);
  autosaveStateNodeEl.dataset["phase"] = phase;
}

function getCurrentUserId(): string {
  return normalizeUserId(userIdInputEl.value) ?? createUserId();
}

function writeUrlStateIfNeeded(
  workspaceId: string,
  presetId: DemoPresetSelection,
  userId: string,
): void {
  if (
    lastWrittenWorkspaceId === workspaceId
    && lastWrittenPresetId === presetId
    && lastWrittenUserId === userId
  ) {
    return;
  }

  writeUrlState(workspaceId, presetId, userId);
  lastWrittenWorkspaceId = workspaceId;
  lastWrittenPresetId = presetId;
  lastWrittenUserId = userId;
}

function writeUserState(userId: string): void {
  userIdInputEl.value = userId;
  writeStoredUserId(userId);
  if (activeWorkspaceId && activeRemoteSnapshot) {
    writeUrlStateIfNeeded(activeWorkspaceId, resolvePresetSelection(activeRemoteSnapshot), userId);
    return;
  }
  writeUserUrlState(userId);
  lastWrittenUserId = userId;
}

function readLocalWorkspaceSnapshot(): MotionWorkspaceSnapshotV2 | null {
  return activeShellWorkspace?.controller.exportWorkspace() ?? null;
}

function buildScenePresenceEntries(): readonly MotionEditorScenePresenceEntry[] {
  const composition = activeShell?.getState().composition;
  if (!composition || !("targets" in composition && "scenes" in composition)) {
    return [];
  }

  return composition.scenes.flatMap((scene) => {
    const userIds = new Set<string>();
    for (const presence of collaborationState.presences.values()) {
      if (presence.activeSceneId === scene.id) {
        userIds.add(presence.userId);
      }
    }
    for (const userId of collaborationState.sceneLocks.get(scene.id) ?? []) {
      userIds.add(userId);
    }

    const users = Array.from(userIds)
      .toSorted((left, right) => left.localeCompare(right))
      .map((userId) => createScenePresenceUser(userId, getCurrentUserId()));
    const locked = users.some((user) => user.userId !== getCurrentUserId())
      && (collaborationState.sceneLocks.get(scene.id)?.size ?? 0) > 0;

    if (users.length === 0 && !locked) {
      return [];
    }

    return [{
      sceneId: scene.id,
      users,
      locked,
      lockLabel: locked ? "다른 사용자가 lock한 scene" : undefined,
    }];
  });
}

function renderCollaborationMeta(): void {
  const activeScenePresence = Array.from(collaborationState.presences.values())
    .filter((presence) => presence.activeSceneId)
    .toSorted((left, right) =>
      (left.activeSceneId ?? "").localeCompare(right.activeSceneId ?? "")
      || left.userId.localeCompare(right.userId)
    );

  if (!activeWorkspaceId) {
    presenceMetaNodeEl.textContent = "협업 WS 연결 전";
    return;
  }

  if (activeScenePresence.length === 0) {
    presenceMetaNodeEl.textContent = `${collaborationMessage} · 활성 편집 scene 없음`;
    return;
  }

  const grouped = new Map<string, string[]>();
  for (const presence of activeScenePresence) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- .filter(p => p.activeSceneId) 직후 truthy 보장
    const sceneId = presence.activeSceneId!;
    const names = grouped.get(sceneId) ?? [];
    names.push(presence.userId);
    grouped.set(sceneId, names);
  }

  const summary = Array.from(grouped.entries())
    .map(([sceneId, userIds]) => `${sceneId}: ${userIds.join(", ")}`)
    .join(" · ");
  presenceMetaNodeEl.textContent = `${collaborationMessage} · ${summary}`;
}

function applyRealtimePresenceToShell(): void {
  activeShell?.setScenePresence(buildScenePresenceEntries());
  renderCollaborationMeta();
}

function renderWorkspaceMeta(): void {
  const localSnapshot = readLocalWorkspaceSnapshot() ?? activeRemoteSnapshot;
  if (!activeWorkspaceId || !localSnapshot) {
    workspaceMetaNodeEl.textContent = "workspace 연결 전";
    presenceMetaNodeEl.textContent = collaborationMessage;
    savedAtNodeEl.textContent = `마지막 원격 저장: ${formatSavedAt(null)}`;
    return;
  }

  const presetSelection = resolvePresetSelection(localSnapshot);
  const parts = [
    `workspace: ${activeWorkspaceId}`,
    `로컬 global ${localSnapshot.globalRevision}`,
  ];

  if (activeRemoteSnapshot) {
    parts.push(`원격 global ${activeRemoteSnapshot.globalRevision}`);
  }
  if (activeShellWorkspace?.controller.isDirty()) {
    parts.push("미동기화");
  }
  parts.push(`source ${describeWorkspaceSource(localSnapshot)}`);

  userIdInputEl.value = getCurrentUserId();
  workspaceIdInputEl.value = activeWorkspaceId;
  presetSelectEl.value = presetSelection;
  workspaceMetaNodeEl.textContent = parts.join(" · ");
  savedAtNodeEl.textContent = `마지막 원격 저장: ${formatSavedAt(activeRemoteSnapshot?.savedAt ?? null)}`;
  writeUrlStateIfNeeded(activeWorkspaceId, presetSelection, getCurrentUserId());
  renderCollaborationMeta();
}

function renderPendingSaveFailure(): void {
  if (!pendingSaveFailure) {
    saveDetailNodeEl.hidden = true;
    saveDetailNodeEl.textContent = "";
    saveActionsNodeEl.hidden = true;
    retrySaveButtonEl.textContent = "저장 재시도";
    reloadRemoteButtonEl.hidden = true;
    return;
  }

  saveDetailNodeEl.hidden = false;
  saveActionsNodeEl.hidden = false;
  if (pendingSaveFailure.kind === "conflict") {
    const actualRevision = pendingSaveFailure.conflict.actualRevision;
    const actualRevisionText = Number.isInteger(actualRevision)
      ? String(actualRevision)
      : "알 수 없음";
    saveDetailNodeEl.textContent = `원격 revision ${actualRevisionText}이 먼저 저장되었습니다. 최신 원격 상태를 다시 불러오거나 현재 로컬 변경으로 다시 저장할 수 있습니다.`;
    saveDetailNodeEl.dataset["tone"] = "warning";
    retrySaveButtonEl.textContent = "내 변경으로 재시도";
    reloadRemoteButtonEl.hidden = false;
    return;
  }

  saveDetailNodeEl.textContent = `마지막 자동 저장이 실패했습니다: ${pendingSaveFailure.message}`;
  saveDetailNodeEl.dataset["tone"] = "danger";
  retrySaveButtonEl.textContent = "저장 재시도";
  reloadRemoteButtonEl.hidden = true;
}

function renderLegacyMigration(): void {
  if (!pendingLegacyMigration) {
    migrationDetailNodeEl.hidden = true;
    migrationDetailNodeEl.textContent = "";
    migrationActionsNodeEl.hidden = true;
    importLegacyButtonEl.textContent = "기존 local draft 가져오기";
    return;
  }

  const presetSelection = resolvePresetSelection(pendingLegacyMigration.snapshot);
  const presetLabel = presetSelection === CUSTOM_PRESET_ID
    ? "custom composition"
    : findPresetById(presetSelection).label;

  migrationDetailNodeEl.hidden = false;
  migrationDetailNodeEl.dataset["tone"] = "warning";
  migrationDetailNodeEl.textContent = `기존 local demo 상태를 발견했습니다. 마지막 저장 ${formatSavedAt(pendingLegacyMigration.snapshot.savedAt)} · ${presetLabel}. layout/theme는 그대로 로컬에 남기고, document만 현재 workspace로 가져올 수 있습니다.`;
  migrationActionsNodeEl.hidden = false;
  importLegacyButtonEl.textContent = activeWorkspaceId
    ? "현재 workspace에 local draft 가져오기"
    : "기존 local draft 가져오기";
}

function clearLegacyMigration(clearStorage = false): void {
  pendingLegacyMigration = null;
  if (clearStorage) {
    clearLegacyDemoStateSnapshot();
  }
  renderLegacyMigration();
}

function updateWorkspaceUi(
  workspaceId: string | null,
  remoteSnapshot: MotionWorkspaceSnapshotV2 | null,
): void {
  activeWorkspaceId = workspaceId;
  activeRemoteSnapshot = remoteSnapshot;
  renderWorkspaceMeta();
  renderPendingSaveFailure();
  renderLegacyMigration();
}

function clearPendingSaveFailure(): void {
  pendingSaveFailure = null;
  renderPendingSaveFailure();
}

function setBusy(isBusy: boolean): void {
  userIdInputEl.disabled = isBusy;
  workspaceIdInputEl.disabled = isBusy;
  presetSelectEl.disabled = isBusy;
  openWorkspaceButtonEl.disabled = isBusy;
  createWorkspaceButtonEl.disabled = isBusy;
  applyPresetButtonEl.disabled = isBusy;
  retrySaveButtonEl.disabled = isBusy;
  reloadRemoteButtonEl.disabled = isBusy;
  importLegacyButtonEl.disabled = isBusy;
}

function getSelectedSeedPresetId(): DemoPresetId {
  return isDemoPresetId(presetSelectEl.value)
    ? presetSelectEl.value
    : defaultPreset.id;
}

function buildStage(host: HTMLElement) {
  host.innerHTML = `
    <section class="mce-stage">
      <div class="mce-hero" data-motion-id="hero">
        <div class="mce-chip" data-motion-id="chip">Adapter V1</div>
        <h1 data-motion-id="headline"></h1>
        <p data-motion-id="subline"></p>
      </div>
      <div class="mce-card-grid">
        <article class="mce-card" data-motion-id="card-a"><span>Intro</span><strong>asset target</strong><p>텍스트와 스타일은 nodeId로 주입된다.</p></article>
        <article class="mce-card" data-motion-id="card-b"><span>Timing</span><strong>layer target</strong><p>레이어도 같은 nodeId 계약으로 애니메이션된다.</p></article>
        <article class="mce-card" data-motion-id="card-c"><span>Stage</span><strong>adapter</strong><p>DOM은 adapter가 해석하고 composition은 selector를 모른다.</p></article>
      </div>
      <div class="mce-outro" data-motion-id="outro">Demo stage follows the MotionStageAdapter contract.</div>
      <div class="mce-caption" data-tone="neutral"></div>
    </section>
  `;

  const stageRoot = host.querySelector<HTMLElement>(".mce-stage");
  const captionElement = host.querySelector<HTMLElement>(".mce-caption");

  if (!stageRoot || !captionElement) {
    throw new Error("demo stage mount failed");
  }

  return {
    adapter: createMotionDomStageAdapter({
      stageRoot,
      captionElement,
    }),
  };
}

function replacePresenceSnapshot(
  presences: readonly MotionWorkspacePresenceInfo[],
): void {
  collaborationState = {
    ...collaborationState,
    presences: new Map(
      presences.map((presence) => [
        presence.userId,
        {
          userId: presence.userId,
          ...(presence.activeSceneId ? { activeSceneId: presence.activeSceneId } : {}),
        },
      ]),
    ),
  };
}

function replaceSceneLocksSnapshot(
  sceneLocks: readonly MotionWorkspaceWsSceneLockInfo[],
): void {
  const nextSceneLocks = new Map<string, Set<string>>();
  for (const lock of sceneLocks) {
    const holders = nextSceneLocks.get(lock.sceneId) ?? new Set<string>();
    holders.add(lock.userId);
    nextSceneLocks.set(lock.sceneId, holders);
  }
  collaborationState = {
    ...collaborationState,
    sceneLocks: nextSceneLocks,
  };
}

function setSceneLockHolders(
  sceneId: string,
  holders: readonly string[],
): void {
  const nextSceneLocks = new Map(collaborationState.sceneLocks);
  if (holders.length === 0) {
    nextSceneLocks.delete(sceneId);
  } else {
    nextSceneLocks.set(sceneId, new Set(holders));
  }
  collaborationState = {
    ...collaborationState,
    sceneLocks: nextSceneLocks,
  };
}

function setRealtimePresence(
  userId: string,
  activeSceneId?: string,
): void {
  const nextPresences = new Map(collaborationState.presences);
  nextPresences.set(
    userId,
    activeSceneId
      ? { userId, activeSceneId }
      : { userId },
  );
  collaborationState = {
    ...collaborationState,
    presences: nextPresences,
  };
}

function disconnectWorkspaceRealtime(): void {
  activeRealtimeConnection?.disconnect();
  activeRealtimeConnection = null;
  activeLockedSceneId = null;
  collaborationState = {
    presences: new Map(),
    sceneLocks: new Map(),
  };
  collaborationMessage = activeWorkspaceId ? "협업 WS 미연결" : "협업 WS 연결 전";
  applyRealtimePresenceToShell();
}

function syncActiveScenePresence(): void {
  const currentUserId = getCurrentUserId();
  const nextSceneId = activeShell?.getFocusedSceneId() ?? null;

  if (activeLockedSceneId !== nextSceneId) {
    if (activeLockedSceneId) {
      const previousHolders = new Set(collaborationState.sceneLocks.get(activeLockedSceneId) ?? []);
      previousHolders.delete(currentUserId);
      setSceneLockHolders(activeLockedSceneId, Array.from(previousHolders));
      activeRealtimeConnection?.unlockScene(activeLockedSceneId);
    }
    if (nextSceneId) {
      const nextHolders = new Set(collaborationState.sceneLocks.get(nextSceneId) ?? []);
      nextHolders.add(currentUserId);
      setSceneLockHolders(nextSceneId, Array.from(nextHolders));
      activeRealtimeConnection?.lockScene(nextSceneId);
    }
    activeLockedSceneId = nextSceneId;
  }

  setRealtimePresence(currentUserId, nextSceneId ?? undefined);
  activeRealtimeConnection?.sendPresence(nextSceneId ? { activeSceneId: nextSceneId } : {});
  applyRealtimePresenceToShell();
}

function connectWorkspaceRealtime(workspaceId: string): void {
  disconnectWorkspaceRealtime();
  const userId = getCurrentUserId();
  collaborationMessage = `협업 WS 연결 중 · user ${userId}`;
  renderCollaborationMeta();

  activeRealtimeConnection = workspaceClient.connectWorkspace(workspaceId, {
    userId,
    onConnected(message) {
      collaborationMessage = `협업 WS 연결됨 · user ${message.userId}`;
      replacePresenceSnapshot(message.presences);
      replaceSceneLocksSnapshot(message.sceneLocks);
      syncActiveScenePresence();
    },
    onPresence(message) {
      setRealtimePresence(message.userId, message.activeSceneId);
      applyRealtimePresenceToShell();
    },
    onSceneLock(message) {
      setSceneLockHolders(message.sceneId, message.holders);
      applyRealtimePresenceToShell();
    },
    onSceneUnlock(message) {
      setSceneLockHolders(message.sceneId, message.holders);
      applyRealtimePresenceToShell();
    },
    onReconnect(event) {
      collaborationMessage = `협업 WS 재연결 ${event.attempt}회차`;
      renderCollaborationMeta();
    },
    onDisconnected() {
      collaborationMessage = "협업 WS 재연결 대기";
      renderCollaborationMeta();
    },
    onTransportError(error) {
      collaborationMessage = "협업 WS 전송 오류";
      console.warn("[mce-demo] realtime transport error", error);
      renderCollaborationMeta();
    },
    onServerError(message) {
      collaborationMessage = `협업 WS 서버 오류: ${message.message}`;
      renderCollaborationMeta();
    },
  });

  syncActiveScenePresence();
}

function mountWorkspace(
  workspaceId: string,
  snapshot: MotionWorkspaceSnapshotV2,
): void {
  activeWorkspaceToken += 1;
  const workspaceToken = activeWorkspaceToken;

  disconnectWorkspaceRealtime();
  activeShell?.destroy();
  editorHostEl.innerHTML = "";

  const shellWorkspace = createMotionEditorShellWorkspace({
    composition: snapshot.document.composition,
    onImportDocument(source, context) {
      const current = context.controller.exportWorkspace();
      context.controller.replaceWorkspace(
        createImportedWorkspaceSnapshot(source, context.source, current),
      );
    },
  });
  shellWorkspace.controller.loadWorkspace(snapshot);

  activeShellWorkspace = shellWorkspace;
  clearPendingSaveFailure();
  updateWorkspaceUi(workspaceId, snapshot);

  activeShell = createMotionEditorShell({
    container: editorHostEl,
    workspace: shellWorkspace,
    eventLog: (() => {
      const log = createMotionEventLog();
      log.onEntry = (entry) => console.log("[mc-log]", entry.category, entry.action, entry.detail ?? "");
      return log;
    })(),
    onStateChange() {
      renderWorkspaceMeta();
      if (autosaveTimer !== null) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        void persistActiveWorkspace(workspaceId, shellWorkspace, workspaceToken);
      }, 1800);
    },
    onFocusedSceneChange() {
      syncActiveScenePresence();
    },
    renderStage(host) {
      return buildStage(host);
    },
  });

  applyRealtimePresenceToShell();
  connectWorkspaceRealtime(workspaceId);
}

async function fetchWorkspace(
  workspaceId: string,
): Promise<MotionWorkspaceSnapshotV2 | null> {
  try {
    const response = await workspaceClient.get(workspaceId);
    return response.workspace;
  } catch (error) {
    if (isStatusError(error, 404)) {
      return null;
    }
    throw error;
  }
}

async function createRemoteWorkspace(
  workspaceId: string,
  presetId: DemoPresetId,
  options: {
    readonly openOnConflict?: boolean;
  } = {},
): Promise<MotionWorkspaceSnapshotV2> {
  try {
    const response = await workspaceClient.create(
      workspaceId,
      createSeedWorkspaceSnapshot(presetId),
    );
    return response.workspace;
  } catch (error) {
    if (options.openOnConflict && isStatusError(error, 409)) {
      const existing = await fetchWorkspace(workspaceId);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}

async function importLegacyDemoState(): Promise<void> {
  if (!pendingLegacyMigration) {
    return;
  }

  const workspaceId = activeWorkspaceId?.trim()
    || workspaceIdInputEl.value.trim()
    || createWorkspaceId();
  const currentLegacySnapshot = pendingLegacyMigration.snapshot;

  setBusy(true);
  setStatus(`기존 local demo 상태를 workspace ${workspaceId}로 가져오는 중입니다.`);

  await awaitPendingPersistence();

  try {
    const existing = await fetchWorkspace(workspaceId);
    const nextSnapshot = existing
      ? {
        ...currentLegacySnapshot,
        globalRevision: existing.globalRevision + 1,
        savedAt: new Date().toISOString(),
      }
      : currentLegacySnapshot;
    const response = existing
      ? await workspaceClient.update(workspaceId, nextSnapshot)
      : await workspaceClient.create(workspaceId, nextSnapshot);

    clearLegacyMigration(true);
    mountWorkspace(workspaceId, response.workspace);
    setAutosavePhase("saved");
    setStatus(`기존 local demo 상태를 workspace ${workspaceId}로 가져왔습니다.`, "success");
  } catch (error) {
    setAutosavePhase("error");
    setStatus(
      `legacy local demo 상태 import 실패: ${describeClientError(error)}`,
      "danger",
    );
  } finally {
    setBusy(false);
  }
}

async function awaitPendingPersistence(): Promise<void> {
  try {
    await persistQueue;
  } catch {
    // explicit open/create should still proceed after surfacing the warning
  }
}

async function reloadRemoteWorkspaceFromFailure(): Promise<void> {
  if (!pendingSaveFailure) {
    return;
  }

  const failure = pendingSaveFailure;
  setBusy(true);
  setStatus(`workspace ${failure.workspaceId}의 최신 원격 상태를 다시 불러오는 중입니다.`);

  try {
    const remote = await fetchWorkspace(failure.workspaceId);
    if (!remote) {
      setAutosavePhase("error");
      setStatus(`workspace ${failure.workspaceId} 최신 상태를 찾지 못했습니다.`, "warning");
      return;
    }

    mountWorkspace(failure.workspaceId, remote);
    setAutosavePhase("saved");
    setStatus(`workspace ${failure.workspaceId} 최신 원격 상태를 다시 불러왔습니다.`, "success");
  } catch (error) {
    setAutosavePhase("error");
    setStatus(
      `workspace ${failure.workspaceId} 재불러오기 실패: ${describeClientError(error)}`,
      "danger",
    );
  } finally {
    setBusy(false);
  }
}

function createRetrySnapshot(
  localSnapshot: MotionWorkspaceSnapshotV2,
  remoteSnapshot: MotionWorkspaceSnapshotV2,
): MotionWorkspaceSnapshotV2 {
  return {
    ...localSnapshot,
    globalRevision: remoteSnapshot.globalRevision + 1,
    savedAt: new Date().toISOString(),
  };
}

async function retryPendingSaveFailure(): Promise<void> {
  if (!pendingSaveFailure) {
    return;
  }

  const failure = pendingSaveFailure;
  setBusy(true);
  setAutosavePhase("saving");
  setStatus(`workspace ${failure.workspaceId} 저장을 다시 시도하는 중입니다.`);

  try {
    let retrySnapshot = failure.snapshot;
    if (failure.kind === "conflict") {
      const remote = await fetchWorkspace(failure.workspaceId);
      if (!remote) {
        setAutosavePhase("error");
        setStatus(`workspace ${failure.workspaceId} 최신 상태를 찾지 못했습니다.`, "warning");
        return;
      }
      retrySnapshot = createRetrySnapshot(failure.snapshot, remote);
    }

    const response = await workspaceClient.update(failure.workspaceId, retrySnapshot);
    mountWorkspace(failure.workspaceId, response.workspace);
    setAutosavePhase("saved");
    setStatus(`workspace ${failure.workspaceId} 저장을 다시 완료했습니다.`, "success");
  } catch (error) {
    if (isMotionWorkspaceConflictError(error)) {
      pendingSaveFailure = {
        kind: "conflict",
        workspaceId: failure.workspaceId,
        snapshot: failure.snapshot,
        workspaceToken: failure.workspaceToken,
        conflict: error.payload,
      };
      renderPendingSaveFailure();
      setAutosavePhase("conflict");
      setStatus(
        `workspace ${failure.workspaceId} 저장 충돌: ${error.payload.message}`,
        "warning",
      );
    } else {
      pendingSaveFailure = {
        kind: "error",
        workspaceId: failure.workspaceId,
        snapshot: failure.snapshot,
        workspaceToken: failure.workspaceToken,
        message: describeClientError(error),
      };
      renderPendingSaveFailure();
      setAutosavePhase("error");
      setStatus(
        `workspace ${failure.workspaceId} 저장 재시도 실패: ${describeClientError(error)}`,
        "danger",
      );
    }
  } finally {
    setBusy(false);
  }
}

async function persistActiveWorkspace(
  workspaceId: string,
  shellWorkspace: MotionEditorShellWorkspace,
  workspaceToken: number,
): Promise<void> {
  if (workspaceToken !== activeWorkspaceToken || activeWorkspaceId !== workspaceId) {
    return;
  }

  if (!shellWorkspace.controller.isDirty()) {
    return;
  }
  const nextSnapshot = shellWorkspace.controller.saveWorkspace().workspace;

  pendingSaveFailure = null;
  renderWorkspaceMeta();
  renderPendingSaveFailure();
  setAutosavePhase("saving");
  setStatus(`workspace ${workspaceId}를 원격 저장 중입니다.`);

  persistQueue = persistQueue
    .then(async () => {
      const response = await workspaceClient.update(workspaceId, nextSnapshot);
      if (workspaceToken !== activeWorkspaceToken || activeWorkspaceId !== workspaceId) {
        return undefined;
      }
      clearPendingSaveFailure();
      updateWorkspaceUi(workspaceId, response.workspace);
      setAutosavePhase("saved");
      setStatus(`workspace ${workspaceId}를 원격 저장했습니다.`, "success");
      return undefined;
    })
    .catch((error: unknown) => {
      if (workspaceToken !== activeWorkspaceToken || activeWorkspaceId !== workspaceId) {
        return;
      }
      if (isMotionWorkspaceConflictError(error)) {
        pendingSaveFailure = {
          kind: "conflict",
          workspaceId,
          snapshot: nextSnapshot,
          workspaceToken,
          conflict: error.payload,
        };
        renderWorkspaceMeta();
        renderPendingSaveFailure();
        setAutosavePhase("conflict");
        setStatus(
          `workspace ${workspaceId} 저장 충돌: ${error.payload.message}`,
          "warning",
        );
        return;
      }

      pendingSaveFailure = {
        kind: "error",
        workspaceId,
        snapshot: nextSnapshot,
        workspaceToken,
        message: describeClientError(error),
      };
      renderWorkspaceMeta();
      renderPendingSaveFailure();
      setAutosavePhase("error");
      setStatus(
        `workspace ${workspaceId} 저장 실패: ${describeClientError(error)}`,
        "danger",
      );
    });
}

async function openWorkspace(
  workspaceId: string,
  options: {
    readonly createIfMissing?: boolean;
    readonly bootstrapPresetId?: DemoPresetId;
  } = {},
): Promise<void> {
  await awaitPendingPersistence();

  const normalizedId = workspaceId.trim();
  if (normalizedId.length === 0) {
    setStatus("열 workspace id를 입력해야 합니다.", "warning");
    return;
  }

  setBusy(true);
  setStatus(`workspace ${normalizedId}를 여는 중입니다.`);

  try {
    const workspace = await fetchWorkspace(normalizedId);
    if (workspace) {
      mountWorkspace(normalizedId, workspace);
      setAutosavePhase("saved");
      setStatus(`workspace ${normalizedId}를 열었습니다.`);
      return;
    }

    if (!options.createIfMissing) {
      setStatus(`workspace ${normalizedId}를 찾지 못했습니다. 새로 만들거나 다른 id를 입력하세요.`, "warning");
      return;
    }

    const presetId = options.bootstrapPresetId ?? getSelectedSeedPresetId();
    const created = await createRemoteWorkspace(normalizedId, presetId, {
      openOnConflict: true,
    });
    mountWorkspace(normalizedId, created);
    setAutosavePhase("saved");
    setStatus(`workspace ${normalizedId}가 없어 ${findPresetById(presetId).label} preset으로 새로 생성했습니다.`);
  } catch (error) {
    setAutosavePhase("error");
    setStatus(
      `workspace ${normalizedId} 열기 실패: ${describeClientError(error)}`,
      "danger",
    );
  } finally {
    setBusy(false);
  }
}

async function createWorkspaceFromSelection(
  requestedWorkspaceId?: string,
): Promise<void> {
  await awaitPendingPersistence();

  const workspaceId = requestedWorkspaceId?.trim() || workspaceIdInputEl.value.trim() || createWorkspaceId();
  const presetId = getSelectedSeedPresetId();

  setBusy(true);
  setStatus(`workspace ${workspaceId}를 ${findPresetById(presetId).label} preset으로 생성 중입니다.`);

  try {
    const workspace = await createRemoteWorkspace(workspaceId, presetId);
    mountWorkspace(workspaceId, workspace);
    setAutosavePhase("saved");
    setStatus(`workspace ${workspaceId}를 새로 생성했습니다.`);
  } catch (error) {
    setAutosavePhase("error");
    if (isStatusError(error, 409)) {
      setStatus(`workspace ${workspaceId}는 이미 존재합니다. 열기 버튼을 사용하세요.`, "warning");
    } else {
      setStatus(
        `workspace ${workspaceId} 생성 실패: ${describeClientError(error)}`,
        "danger",
      );
    }
  } finally {
    setBusy(false);
  }
}

async function applyPresetToActiveWorkspace(): Promise<void> {
  if (!activeWorkspaceId || !activeShellWorkspace) {
    await createWorkspaceFromSelection();
    return;
  }

  await awaitPendingPersistence();

  const presetId = getSelectedSeedPresetId();
  const current = activeShellWorkspace.controller.exportWorkspace();
  const nextSnapshot = createSeedWorkspaceSnapshot(presetId, {
    globalRevision: current.globalRevision + 1,
    savedAt: new Date().toISOString(),
  });

  setBusy(true);
  setStatus(`workspace ${activeWorkspaceId}에 ${findPresetById(presetId).label} preset을 적용 중입니다.`);

  try {
    const response = await workspaceClient.update(activeWorkspaceId, nextSnapshot);
    mountWorkspace(activeWorkspaceId, response.workspace);
    setAutosavePhase("saved");
    setStatus(`workspace ${activeWorkspaceId}에 ${findPresetById(presetId).label} preset을 적용했습니다.`, "success");
  } catch (error) {
    if (isMotionWorkspaceConflictError(error)) {
      pendingSaveFailure = {
        kind: "conflict",
        workspaceId: activeWorkspaceId,
        snapshot: nextSnapshot,
        workspaceToken: activeWorkspaceToken,
        conflict: error.payload,
      };
      renderPendingSaveFailure();
      setAutosavePhase("conflict");
      setStatus(`preset 적용 충돌: ${error.payload.message}`, "warning");
    } else {
      setAutosavePhase("error");
      setStatus(
        `preset 적용 실패: ${describeClientError(error)}`,
        "danger",
      );
    }
  } finally {
    setBusy(false);
  }
}

function commitUserIdentity(): void {
  const nextUserId = normalizeUserId(userIdInputEl.value) ?? createUserId();
  writeUserState(nextUserId);
  renderWorkspaceMeta();
  if (activeWorkspaceId) {
    connectWorkspaceRealtime(activeWorkspaceId);
  }
}

openWorkspaceButtonEl.addEventListener("click", () => {
  void openWorkspace(workspaceIdInputEl.value);
});

createWorkspaceButtonEl.addEventListener("click", () => {
  void createWorkspaceFromSelection();
});

applyPresetButtonEl.addEventListener("click", () => {
  void applyPresetToActiveWorkspace();
});

retrySaveButtonEl.addEventListener("click", () => {
  void retryPendingSaveFailure();
});

reloadRemoteButtonEl.addEventListener("click", () => {
  void reloadRemoteWorkspaceFromFailure();
});

importLegacyButtonEl.addEventListener("click", () => {
  void importLegacyDemoState();
});

userIdInputEl.addEventListener("change", () => {
  commitUserIdentity();
});

userIdInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    commitUserIdentity();
  }
});

workspaceIdInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void openWorkspace(workspaceIdInputEl.value);
  }
});

writeUserState(readUrlUserId() ?? readStoredUserId() ?? createUserId());
updateWorkspaceUi(null, null);
setAutosavePhase("idle");
setStatus("workspace bootstrap을 준비 중입니다.");
presetSelectEl.value = readUrlPresetId() ?? defaultPreset.id;

async function bootstrap(): Promise<void> {
  let legacyReadFailed = false;
  const legacyRaw = readLegacyDemoStateRaw();
  if (legacyRaw) {
    try {
      pendingLegacyMigration = readLegacyDemoStateSnapshot(legacyRaw);
    } catch (error) {
      legacyReadFailed = true;
      pendingLegacyMigration = null;
      setStatus(
        `기존 local demo 상태를 읽지 못했습니다. ${describeClientError(error)}`,
        "warning",
      );
    }
  }
  renderLegacyMigration();

  const workspaceId = readUrlWorkspaceId();
  if (workspaceId) {
    workspaceIdInputEl.value = workspaceId;
    await openWorkspace(workspaceId, {
      createIfMissing: true,
      bootstrapPresetId: readUrlPresetId() ?? getSelectedSeedPresetId(),
    });
    return;
  }

  const generatedWorkspaceId = createWorkspaceId();
  workspaceIdInputEl.value = generatedWorkspaceId;
  if (legacyReadFailed) {
    return;
  }
  if (pendingLegacyMigration) {
    presetSelectEl.value = resolvePresetSelection(pendingLegacyMigration.snapshot);
    setStatus("기존 local demo 상태를 발견했습니다. 가져오기 버튼으로 online workspace에 옮기거나 새 workspace를 생성하세요.", "warning");
    return;
  }
  await createWorkspaceFromSelection(generatedWorkspaceId);
}

void bootstrap();
