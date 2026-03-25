import {
  createMotionDomStageAdapter,
  createMotionEventLog,
  MOTION_COMPOSITION_PRESET_DOCUMENTS,
  parseMotionComposition,
  serializeMotionComposition,
  type MotionCompositionDef,
} from "motion-content";
import {
  createMotionEditorShell,
  type MotionEditorShell,
} from "motion-content-editor";

const STORAGE_KEY = "qa-sdk.motion-content-editor-demo/v1";
const CUSTOM_PRESET_ID = "custom";

type DemoPresetId = (typeof MOTION_COMPOSITION_PRESET_DOCUMENTS)[number]["id"];

interface DemoStoredState {
  readonly presetId: DemoPresetId | null;
  readonly document: string;
  readonly savedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDocumentForPresetMatch(documentSource: string): string | null {
  try {
    const composition = parseMotionComposition(documentSource) as MotionCompositionDef & {
      readonly values?: unknown;
    };
    const { values: _values, ...definition } = composition;
    return serializeMotionComposition(definition);
  } catch {
    return null;
  }
}

const presetDocuments = MOTION_COMPOSITION_PRESET_DOCUMENTS.map((preset) => ({
  ...preset,
  normalized: normalizeDocumentForPresetMatch(preset.document),
}));

function findMatchingPresetId(documentSource: string): DemoPresetId | null {
  const normalized = normalizeDocumentForPresetMatch(documentSource);
  if (!normalized) return null;
  const matched = presetDocuments.find((preset) => preset.normalized === normalized);
  return matched?.id ?? null;
}

function readStoredState(): DemoStoredState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed["document"] !== "string" || typeof parsed["savedAt"] !== "string") {
      return null;
    }
    const presetId = typeof parsed["presetId"] === "string"
      ? (parsed["presetId"] as DemoPresetId)
      : null;
    return {
      presetId,
      document: parsed["document"],
      savedAt: parsed["savedAt"],
    };
  } catch {
    return null;
  }
}

function writeStoredState(state: DemoStoredState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function clearStoredState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
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

const app = document.getElementById("app");

if (!app) {
  throw new Error("#app not found");
}

app.innerHTML = `
  <section class="demo-workflow">
    <div class="demo-workflow__main">
      <label class="demo-field">
        <span>Preset</span>
        <select data-demo="preset">
          ${presetDocuments
            .map(
              (preset) =>
                `<option value="${preset.id}">${preset.label}</option>`,
            )
            .join("")}
          <option value="${CUSTOM_PRESET_ID}" disabled>Custom / Imported</option>
        </select>
      </label>
      <button class="demo-button" data-demo="reapply-preset">Preset 다시 적용</button>
      <button class="demo-button demo-button--ghost" data-demo="clear-storage">로컬 저장 지우기</button>
    </div>
    <div class="demo-workflow__meta">
      <div class="demo-status" data-demo="status"></div>
      <div class="demo-status demo-status--muted" data-demo="saved-at"></div>
    </div>
    <p class="demo-note">
      파일 저장/불러오기는 아래 editor toolbar의 <strong>Download</strong> / <strong>Upload</strong> / <strong>Apply</strong> 버튼으로 검증한다.
    </p>
  </section>
  <div data-demo="editor"></div>
`;

const presetSelect = app.querySelector<HTMLSelectElement>('[data-demo="preset"]');
const statusNode = app.querySelector<HTMLElement>('[data-demo="status"]');
const savedAtNode = app.querySelector<HTMLElement>('[data-demo="saved-at"]');
const editorHost = app.querySelector<HTMLElement>('[data-demo="editor"]');
const reapplyPresetButton = app.querySelector<HTMLButtonElement>('[data-demo="reapply-preset"]');
const clearStorageButton = app.querySelector<HTMLButtonElement>('[data-demo="clear-storage"]');

if (
  !presetSelect
  || !statusNode
  || !savedAtNode
  || !editorHost
  || !reapplyPresetButton
  || !clearStorageButton
) {
  throw new Error("demo controls failed to mount");
}

const presetSelectEl = presetSelect;
const statusNodeEl = statusNode;
const savedAtNodeEl = savedAtNode;

function setStatus(message: string, tone: "neutral" | "warning" = "neutral"): void {
  statusNodeEl.textContent = message;
  statusNodeEl.dataset["tone"] = tone;
}

function setSavedAt(savedAt: string | null): void {
  savedAtNodeEl.textContent = `로컬 저장 시각: ${formatSavedAt(savedAt)}`;
}

const defaultPreset = presetDocuments[0];
const storedState = readStoredState();
const initialPresetId = storedState?.presetId ?? defaultPreset.id;
const initialPreset = presetDocuments.find((preset) => preset.id === initialPresetId) ?? defaultPreset;

let activePresetId: DemoPresetId | typeof CUSTOM_PRESET_ID = initialPreset.id;
let lastSerializedDocument = initialPreset.document;
let lastSavedAt: string | null = null;
let shell: MotionEditorShell | null = null;

const initialDocument = (() => {
  if (!storedState) {
    setStatus(`${initialPreset.label} preset으로 시작합니다.`);
    return initialPreset.document;
  }
  try {
    parseMotionComposition(storedState.document);
    const matchedPresetId = findMatchingPresetId(storedState.document);
    activePresetId = matchedPresetId ?? CUSTOM_PRESET_ID;
    lastSavedAt = storedState.savedAt;
    setStatus(
      matchedPresetId
        ? `마지막 작업을 복원했습니다. 현재 preset은 ${presetDocuments.find((preset) => preset.id === matchedPresetId)?.label ?? matchedPresetId}입니다.`
        : "마지막 custom composition을 복원했습니다.",
    );
    return storedState.document;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(`저장된 composition을 복원하지 못해 기본 preset으로 시작합니다. ${message}`, "warning");
    return initialPreset.document;
  }
})();

const syncDemoState = (documentSource: string) => {
  const matchedPresetId = findMatchingPresetId(documentSource);
  activePresetId = matchedPresetId ?? CUSTOM_PRESET_ID;
  presetSelectEl.value = activePresetId;
};

const persistDemoState = (documentSource: string) => {
  if (documentSource === lastSerializedDocument) {
    return;
  }
  lastSerializedDocument = documentSource;
  const matchedPresetId = findMatchingPresetId(documentSource);
  const savedAt = new Date().toISOString();
  const didPersist = writeStoredState({
    presetId: matchedPresetId,
    document: documentSource,
    savedAt,
  });
  syncDemoState(documentSource);
  if (!didPersist) {
    setStatus("localStorage에 저장하지 못했습니다. 현재 세션에서만 동작합니다.", "warning");
    return;
  }
  lastSavedAt = savedAt;
  setSavedAt(lastSavedAt);
  setStatus(
    matchedPresetId
      ? `${presetDocuments.find((preset) => preset.id === matchedPresetId)?.label ?? matchedPresetId} preset 상태를 로컬에 저장했습니다.`
      : "custom composition 상태를 로컬에 저장했습니다.",
  );
};

shell = createMotionEditorShell({
  container: editorHost,
  composition: parseMotionComposition(initialDocument),
  eventLog: (() => {
    const log = createMotionEventLog();
    log.onEntry = (entry) => console.log("[mc-log]", entry.category, entry.action, entry.detail ?? "");
    return log;
  })(),
  onStateChange(state) {
    persistDemoState(serializeMotionComposition(state.composition));
  },
  renderStage(host) {
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
  },
});

syncDemoState(initialDocument);
lastSerializedDocument = "";
persistDemoState(serializeMotionComposition(shell.getState().composition));
setSavedAt(lastSavedAt);

function applyPreset(presetId: DemoPresetId): void {
  const preset = presetDocuments.find((entry) => entry.id === presetId);
  if (!preset || !shell) {
    return;
  }
  activePresetId = presetId;
  presetSelectEl.value = presetId;
  lastSerializedDocument = "";
  shell.dispatch({
    type: "set-composition",
    composition: parseMotionComposition(preset.document),
    values: {},
  });
  setStatus(`${preset.label} preset을 적용했습니다.`);
}

presetSelectEl.addEventListener("change", () => {
  if (presetSelectEl.value === CUSTOM_PRESET_ID) {
    presetSelectEl.value = activePresetId === CUSTOM_PRESET_ID ? defaultPreset.id : activePresetId;
    return;
  }
  applyPreset(presetSelectEl.value as DemoPresetId);
});

reapplyPresetButton.addEventListener("click", () => {
  const presetId = activePresetId === CUSTOM_PRESET_ID ? defaultPreset.id : activePresetId;
  applyPreset(presetId);
});

clearStorageButton.addEventListener("click", () => {
  clearStoredState();
  lastSavedAt = null;
  setSavedAt(lastSavedAt);
  const presetId = activePresetId === CUSTOM_PRESET_ID ? defaultPreset.id : activePresetId;
  applyPreset(presetId);
  setStatus("로컬 저장본을 지우고 현재 preset 기준으로 다시 시작했습니다.");
});
