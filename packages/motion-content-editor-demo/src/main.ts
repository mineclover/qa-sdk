import {
  createMotionDomStageAdapter,
  createMotionEventLog,
  MOTION_COMPOSITION_PRESET_DOCUMENTS,
  parseMotionComposition,
  serializeMotionComposition,
  type MotionCompositionDef,
} from "motion-content";
import {
  applyMotionEditorTheme,
  createMotionEditorShell,
  createMotionEditorShellWorkspace,
  readStoredMotionEditorTheme,
  type MotionEditorShell,
  type MotionEditorShellWorkspace,
} from "motion-content-editor";
import {
  LEGACY_MOTION_EDITOR_DEMO_STORAGE_KEY,
  createMotionWorkspaceSnapshot,
  migrateLegacyMotionEditorDemoState,
  type MotionWorkspaceSnapshotV1,
} from "motion-workspace";
import {
  MotionWorkspaceClient,
  MotionWorkspaceClientError,
  isMotionWorkspaceConflictError,
  type MotionWorkspaceConflictErrorShape,
} from "motion-workspace-client";

const CUSTOM_PRESET_ID = "custom";
const WORKSPACE_QUERY_KEY = "workspace";
const PRESET_QUERY_KEY = "preset";
const WORKSPACE_CLIENT_BASE_URL = "/api/motion-workspace";
const IMPORT_SOURCE_PATH = {
  file: "import:file",
  textarea: "import:textarea",
} as const;

applyMotionEditorTheme(readStoredMotionEditorTheme());

type DemoPresetId = (typeof MOTION_COMPOSITION_PRESET_DOCUMENTS)[number]["id"];
type DemoPresetSelection = DemoPresetId | typeof CUSTOM_PRESET_ID;
type DemoStatusTone = "neutral" | "success" | "warning" | "danger";
type DemoAutosavePhase = "idle" | "saving" | "saved" | "error" | "conflict";

interface DemoPresetRecord {
  readonly id: DemoPresetId;
  readonly label: string;
  readonly document: string;
  readonly composition: MotionCompositionDef;
  readonly normalized: string;
}

interface PendingSaveFailureBase {
  readonly kind: "conflict" | "error";
  readonly workspaceId: string;
  readonly snapshot: MotionWorkspaceSnapshotV1;
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
  readonly snapshot: MotionWorkspaceSnapshotV1;
}

function isDemoPresetId(value: string | null | undefined): value is DemoPresetId {
  return typeof value === "string"
    && MOTION_COMPOSITION_PRESET_DOCUMENTS.some((preset) => preset.id === value);
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

function readUrlWorkspaceId(): string | null {
  const value = new URLSearchParams(window.location.search).get(WORKSPACE_QUERY_KEY)?.trim();
  return value && value.length > 0 ? value : null;
}

function readUrlPresetId(): DemoPresetId | null {
  const value = new URLSearchParams(window.location.search).get(PRESET_QUERY_KEY);
  return isDemoPresetId(value) ? value : null;
}

function writeUrlState(workspaceId: string, presetId: DemoPresetSelection): void {
  const url = new URL(window.location.href);
  url.searchParams.set(WORKSPACE_QUERY_KEY, workspaceId);
  if (presetId === CUSTOM_PRESET_ID) {
    url.searchParams.delete(PRESET_QUERY_KEY);
  } else {
    url.searchParams.set(PRESET_QUERY_KEY, presetId);
  }
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
  const composition = parseMotionComposition(preset.document);
  return {
    ...preset,
    composition,
    normalized: serializeMotionComposition(composition),
  };
});

const defaultPreset = presetDocuments[0];

function findPresetById(presetId: DemoPresetId): DemoPresetRecord {
  return presetDocuments.find((preset) => preset.id === presetId) ?? defaultPreset;
}

function findMatchingPresetId(documentSource: string): DemoPresetId | null {
  try {
    const normalized = serializeMotionComposition(parseMotionComposition(documentSource));
    const matched = presetDocuments.find((preset) => preset.normalized === normalized);
    return matched?.id ?? null;
  } catch {
    return null;
  }
}

function resolvePresetSelection(snapshot: MotionWorkspaceSnapshotV1): DemoPresetSelection {
  if (isDemoPresetId(snapshot.source?.presetId)) {
    return snapshot.source.presetId;
  }

  const matchedPresetId = findMatchingPresetId(
    serializeMotionComposition(snapshot.document.composition),
  );

  return matchedPresetId ?? CUSTOM_PRESET_ID;
}

function describeWorkspaceSource(snapshot: MotionWorkspaceSnapshotV1): string {
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
    readonly revision?: number;
    readonly savedAt?: string;
  } = {},
): MotionWorkspaceSnapshotV1 {
  const preset = findPresetById(presetId);
  const snapshot = createMotionWorkspaceSnapshot({
    composition: preset.composition,
    source: {
      presetId,
    },
    savedAt: options.savedAt,
  });

  return options.revision === undefined
    ? snapshot
    : {
      ...snapshot,
      revision: options.revision,
    };
}

function createImportedWorkspaceSnapshot(
  source: string,
  origin: "textarea" | "file",
  current: MotionWorkspaceSnapshotV1,
): MotionWorkspaceSnapshotV1 {
  const snapshot = createMotionWorkspaceSnapshot({
    composition: parseMotionComposition(source),
    source: {
      path: IMPORT_SOURCE_PATH[origin],
    },
    savedAt: current.savedAt,
  });

  return {
    ...snapshot,
    revision: current.revision,
    savedAt: current.savedAt,
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

const workspaceIdInput = app.querySelector<HTMLInputElement>('[data-demo="workspace-id"]');
const openWorkspaceButton = app.querySelector<HTMLButtonElement>('[data-demo="open-workspace"]');
const createWorkspaceButton = app.querySelector<HTMLButtonElement>('[data-demo="create-workspace"]');
const applyPresetButton = app.querySelector<HTMLButtonElement>('[data-demo="apply-preset"]');
const presetSelect = app.querySelector<HTMLSelectElement>('[data-demo="preset"]');
const autosaveStateNode = app.querySelector<HTMLElement>('[data-demo="autosave-state"]');
const statusNode = app.querySelector<HTMLElement>('[data-demo="status"]');
const workspaceMetaNode = app.querySelector<HTMLElement>('[data-demo="workspace-meta"]');
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
  !workspaceIdInput
  || !openWorkspaceButton
  || !createWorkspaceButton
  || !applyPresetButton
  || !presetSelect
  || !autosaveStateNode
  || !statusNode
  || !workspaceMetaNode
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

const presetSelectEl = presetSelect;
const autosaveStateNodeEl = autosaveStateNode;
const statusNodeEl = statusNode;
const workspaceMetaNodeEl = workspaceMetaNode;
const savedAtNodeEl = savedAtNode;
const saveDetailNodeEl = saveDetailNode;
const saveActionsNodeEl = saveActionsNode;
const retrySaveButtonEl = retrySaveButton;
const reloadRemoteButtonEl = reloadRemoteButton;
const migrationDetailNodeEl = migrationDetailNode;
const migrationActionsNodeEl = migrationActionsNode;
const importLegacyButtonEl = importLegacyButton;
const workspaceIdInputEl = workspaceIdInput;

const workspaceClient = new MotionWorkspaceClient({
  baseUrl: WORKSPACE_CLIENT_BASE_URL,
});

let activeWorkspaceId: string | null = null;
let activeShell: MotionEditorShell | null = null;
let activeShellWorkspace: MotionEditorShellWorkspace | null = null;
let activeRemoteSnapshot: MotionWorkspaceSnapshotV1 | null = null;
let persistQueue: Promise<void> = Promise.resolve();
let activeWorkspaceToken = 0;
let lastWrittenWorkspaceId: string | null = null;
let lastWrittenPresetId: DemoPresetSelection | null = null;
let pendingSaveFailure: PendingSaveFailure | null = null;
let pendingLegacyMigration: PendingLegacyMigration | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(message: string, tone: DemoStatusTone = "neutral"): void {
  statusNodeEl.textContent = message;
  statusNodeEl.dataset["tone"] = tone;
}

function setAutosavePhase(phase: DemoAutosavePhase): void {
  autosaveStateNodeEl.textContent = describeAutosavePhase(phase);
  autosaveStateNodeEl.dataset["phase"] = phase;
}

function writeUrlStateIfNeeded(
  workspaceId: string,
  presetId: DemoPresetSelection,
): void {
  if (lastWrittenWorkspaceId === workspaceId && lastWrittenPresetId === presetId) {
    return;
  }

  writeUrlState(workspaceId, presetId);
  lastWrittenWorkspaceId = workspaceId;
  lastWrittenPresetId = presetId;
}

function readLocalWorkspaceSnapshot(): MotionWorkspaceSnapshotV1 | null {
  return activeShellWorkspace?.controller.exportWorkspace() ?? null;
}

function renderWorkspaceMeta(): void {
  const localSnapshot = readLocalWorkspaceSnapshot() ?? activeRemoteSnapshot;
  if (!activeWorkspaceId || !localSnapshot) {
    workspaceMetaNodeEl.textContent = "workspace 연결 전";
    savedAtNodeEl.textContent = `마지막 원격 저장: ${formatSavedAt(null)}`;
    return;
  }

  const presetSelection = resolvePresetSelection(localSnapshot);
  const parts = [
    `workspace: ${activeWorkspaceId}`,
    `로컬 revision ${localSnapshot.revision}`,
  ];

  if (activeRemoteSnapshot) {
    parts.push(`원격 revision ${activeRemoteSnapshot.revision}`);
  }
  if (activeRemoteSnapshot && activeRemoteSnapshot.revision !== localSnapshot.revision) {
    parts.push("미동기화");
  }
  parts.push(`source ${describeWorkspaceSource(localSnapshot)}`);

  workspaceIdInputEl.value = activeWorkspaceId;
  presetSelectEl.value = presetSelection;
  workspaceMetaNodeEl.textContent = parts.join(" · ");
  savedAtNodeEl.textContent = `마지막 원격 저장: ${formatSavedAt(activeRemoteSnapshot?.savedAt ?? null)}`;
  writeUrlStateIfNeeded(activeWorkspaceId, presetSelection);
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
  remoteSnapshot: MotionWorkspaceSnapshotV1 | null,
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
  workspaceIdInputEl.disabled = isBusy;
  presetSelectEl.disabled = isBusy;
  openWorkspaceButton.disabled = isBusy;
  createWorkspaceButton.disabled = isBusy;
  applyPresetButton.disabled = isBusy;
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

function mountWorkspace(
  workspaceId: string,
  snapshot: MotionWorkspaceSnapshotV1,
): void {
  activeWorkspaceToken += 1;
  const workspaceToken = activeWorkspaceToken;

  activeShell?.destroy();
  editorHost.innerHTML = "";

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
    container: editorHost,
    workspace: shellWorkspace,
    eventLog: (() => {
      const log = createMotionEventLog();
      log.onEntry = (entry) => console.log("[mc-log]", entry.category, entry.action, entry.detail ?? "");
      return log;
    })(),
    onStateChange() {
      if (autosaveTimer !== null) clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        void persistActiveWorkspace(workspaceId, shellWorkspace, workspaceToken);
      }, 1800);
    },
    renderStage(host) {
      return buildStage(host);
    },
  });
}

async function fetchWorkspace(
  workspaceId: string,
): Promise<MotionWorkspaceSnapshotV1 | null> {
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
): Promise<MotionWorkspaceSnapshotV1> {
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
        revision: existing.revision + 1,
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
  localSnapshot: MotionWorkspaceSnapshotV1,
  remoteSnapshot: MotionWorkspaceSnapshotV1,
): MotionWorkspaceSnapshotV1 {
  return {
    ...localSnapshot,
    revision: remoteSnapshot.revision + 1,
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

  const beforeRevision = shellWorkspace.controller.getRevision();
  const nextSnapshot = shellWorkspace.controller.saveWorkspace().workspace;
  if (nextSnapshot.revision === beforeRevision) {
    return;
  }

  pendingSaveFailure = null;
  renderWorkspaceMeta();
  renderPendingSaveFailure();
  setAutosavePhase("saving");
  setStatus(`workspace ${workspaceId}를 원격 저장 중입니다.`);

  persistQueue = persistQueue
    .then(async () => {
      const response = await workspaceClient.update(workspaceId, nextSnapshot);
      if (workspaceToken !== activeWorkspaceToken || activeWorkspaceId !== workspaceId) {
        return;
      }
      clearPendingSaveFailure();
      updateWorkspaceUi(workspaceId, response.workspace);
      setAutosavePhase("saved");
      setStatus(`workspace ${workspaceId}를 원격 저장했습니다.`, "success");
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
    revision: current.revision + 1,
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

openWorkspaceButton.addEventListener("click", () => {
  void openWorkspace(workspaceIdInputEl.value);
});

createWorkspaceButton.addEventListener("click", () => {
  void createWorkspaceFromSelection();
});

applyPresetButton.addEventListener("click", () => {
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

workspaceIdInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    void openWorkspace(workspaceIdInputEl.value);
  }
});

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
