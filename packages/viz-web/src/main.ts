import "./styles/main.css";
import "./styles/graph.css";

import type { ScenarioSpec, SpecGraph, StoredRecord, VerdictReport } from "@qa-sdk/core";
import { compileSpec } from "@qa-sdk/engine";
import { computeLayout } from "./graph/layout";
import { createGraphSvg, type GraphRenderer } from "./graph/renderer";
import { createUpdater, type GraphUpdater } from "./graph/updater";
import { createScenarioSelector } from "./panels/scenario-selector";
import { createSessionList, type SessionList } from "./panels/session-list";
import { createEventLog, type EventLog } from "./panels/event-log";
import { createVerdictPanel, type VerdictPanel } from "./panels/verdict-panel";
import { createRoleplayHost, type RoleplayHost } from "./iframe/roleplay-host";
import { createWsClient, type WsClient } from "./api/ws-client";
import { createSession, listSessions, getSessionRecords, getSessionVerdicts, recomputeVerdicts } from "./api/ingest-client";
import { mergeAndSortRecords } from "./lib/record-utils";

// ── DOM refs ─────────────────────────────────────────────────
const sidebarEl = document.getElementById("sidebar")!;
const graphContainerEl = document.getElementById("graph-container")!;
const eventLogContainerEl = document.getElementById("event-log-container")!;
const footerEl = document.getElementById("footer")!;
const sessionInfoEl = document.getElementById("session-info")!;
const sessionIdValueEl = document.getElementById("session-id-value")!;
const wsStatusEl = document.getElementById("ws-status")!;
const recomputeBtn = document.getElementById("recompute-btn") as HTMLButtonElement;
const mainLeftEl = document.getElementById("main-left")!;
const mainRightEl = document.getElementById("main-right")!;
const errorBannerEl = document.getElementById("error-banner")!;
const errorBannerMsgEl = document.getElementById("error-banner-msg")!;
const errorBannerCloseBtn = document.getElementById("error-banner-close")!;

// ── Error Banner ──────────────────────────────────────────────
errorBannerCloseBtn.addEventListener("click", () => { errorBannerEl.hidden = true; });

function showError(msg: string): void {
  errorBannerMsgEl.textContent = msg;
  errorBannerEl.hidden = false;
}

function clearError(): void {
  errorBannerEl.hidden = true;
}

// ── Split-pane focus ──────────────────────────────────────────
let focusedPane: "left" | "right" | null = null;

function focusPane(pane: "left" | "right"): void {
  if (focusedPane === pane) {
    // second click on same pane → reset to equal
    mainLeftEl.classList.remove("focused", "unfocused");
    mainRightEl.classList.remove("focused", "unfocused");
    focusedPane = null;
  } else {
    focusedPane = pane;
    mainLeftEl.classList.toggle("focused", pane === "left");
    mainLeftEl.classList.toggle("unfocused", pane === "right");
    mainRightEl.classList.toggle("focused", pane === "right");
    mainRightEl.classList.toggle("unfocused", pane === "left");
  }
}

// Only focus on clicks that hit the pane background (not interactive children)
const INTERACTIVE = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

function isPaneBackground(e: MouseEvent): boolean {
  let el = e.target as HTMLElement | null;
  while (el && el !== (e.currentTarget as HTMLElement)) {
    if (INTERACTIVE.has(el.tagName)) return false;
    el = el.parentElement;
  }
  return true;
}

mainLeftEl.addEventListener("click", (e) => { if (isPaneBackground(e)) focusPane("left"); });
mainRightEl.addEventListener("click", (e) => { if (isPaneBackground(e)) focusPane("right"); });

// ── State ─────────────────────────────────────────────────────
let currentSpec: ScenarioSpec | null = null;
let currentGraph: SpecGraph | null = null;
let currentRenderer: GraphRenderer | null = null;
let currentUpdater: GraphUpdater | null = null;
let currentSessionId: string | null = null;   // session being visualized
let mySessionId: string | null = null;        // session created for this visit
let wsClient: WsClient | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsReconnectDelay = 1_000; // exponential backoff: 1s → 2s → 4s → max 30s

// per-session record buffer so switching sessions replays correctly
const sessionRecords = new Map<string, StoredRecord[]>();
const MAX_BUFFERED_SESSIONS = 50;
const MAX_RECORDS_PER_SESSION = 1_000;

// ── Panels ────────────────────────────────────────────────────
const eventLog: EventLog = createEventLog(eventLogContainerEl);
const verdictPanel: VerdictPanel = createVerdictPanel(sidebarEl);
const sessionList: SessionList = createSessionList(sidebarEl);
const roleplayHost: RoleplayHost = createRoleplayHost(footerEl);

// ── Graph ─────────────────────────────────────────────────────
function renderGraph(spec: ScenarioSpec): void {
  if (currentRenderer) {
    currentRenderer.destroy();
    currentRenderer = null;
    currentUpdater = null;
  }
  const graph = compileSpec(spec);
  currentGraph = graph;
  const layout = computeLayout(graph);
  const renderer = createGraphSvg(graphContainerEl, layout);
  renderer.render();
  currentRenderer = renderer;
  if (graph.nodes.length > 0) {
    renderer.updateNodeState(graph.nodes[0].step_id, "active");
  }

  // event log sequence strip용 step 번호 맵 (event_key → 1-based index, 첫 등장 기준)
  const stepMap = new Map<string, number>();
  graph.nodes.forEach((node, i) => {
    if (!stepMap.has(node.event_key)) stepMap.set(node.event_key, i + 1);
  });
  eventLog.setStepMap(stepMap);
}

// ── Session selection ─────────────────────────────────────────
function replayRecords(records: StoredRecord[]): void {
  if (!currentGraph || !currentRenderer) return;
  currentRenderer.resetState();
  currentUpdater = createUpdater(currentGraph, currentRenderer);
  // Always start with first node active — processRecord will advance it as records replay
  if (currentGraph.nodes.length > 0) {
    currentRenderer.updateNodeState(currentGraph.nodes[0].step_id, "active");
  }
  eventLog.clear();
  verdictPanel.clear();
  for (const record of records) {
    eventLog.addEvent(record);
    currentUpdater.processRecord(record);
  }
}

async function selectSession(sessionId: string): Promise<void> {
  currentSessionId = sessionId;
  sessionList.setSelected(sessionId);
  sessionIdValueEl.textContent = sessionId;

  // Fetch historical records from server (WS subscription stays active during fetch — no gap)
  let historical: StoredRecord[] = [];
  try {
    historical = await getSessionRecords(sessionId);
  } catch (err) {
    console.error("[viz-web:selectSession] failed to fetch historical records", err);
  }

  // Merge server history with any WS-buffered records, dedup by logId, sort by timestamp
  const wsBuffered = sessionRecords.get(sessionId) ?? [];
  const merged = mergeAndSortRecords(historical, wsBuffered);

  // Update buffer so future WS records append correctly
  sessionRecords.set(sessionId, merged);
  sessionList.setRecordCount(sessionId, merged.length);

  replayRecords(merged);

  void loadVerdicts(sessionId);

  roleplayHost.sendContext({
    traceId: "",
    sessionId,
    scenarioId: currentSpec?.scenario_id ?? "",
  });
}

sessionList.onSelect((sessionId) => {
  void selectSession(sessionId);
});

// ── Scenario select ───────────────────────────────────────────
async function handleScenarioSelect(spec: ScenarioSpec): Promise<void> {
  currentSpec = spec;
  verdictPanel.clear();
  eventLog.clear();
  sessionList.clear();
  sessionRecords.clear();
  currentSessionId = null;
  mySessionId = null;
  renderGraph(spec);

  sessionInfoEl.hidden = false;
  sessionIdValueEl.textContent = "Creating session…";
  setWsStatus("connecting");

  clearError();

  // 1. Load existing sessions for this scenario
  try {
    const { items } = await listSessions(spec.scenario_id);
    for (const s of items) {
      sessionList.addOrUpdate({
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        closedAt: s.closedAt,
      });
    }
  } catch (err) {
    console.error("[viz-web:listSessions]", err);
    showError(`Failed to load sessions: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Create a new session for this visit
  try {
    const session = await createSession(spec.scenario_id);
    mySessionId = session.sessionId;

    sessionList.addOrUpdate({
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      closedAt: null,
    });

    // auto-select the new session
    void selectSession(session.sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sessionIdValueEl.textContent = `Error: ${msg}`;
    setWsStatus("error");
    showError(`Failed to create session: ${msg}`);
    return;
  }

  wsReconnectDelay = 1_000; // reset backoff for new scenario

  // 3. Open WebSocket and subscribe to scenario
  connectWs(spec.scenario_id);
}

createScenarioSelector(sidebarEl, (spec) => void handleScenarioSelect(spec));

// ── WebSocket ─────────────────────────────────────────────────
function scheduleWsReconnect(scenarioId: string): void {
  if (wsReconnectTimer) return; // already scheduled
  setWsStatus("connecting");
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    // Only reconnect if this scenario is still the active one
    if (currentSpec?.scenario_id === scenarioId) {
      connectWs(scenarioId);
    }
  }, wsReconnectDelay);
  wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30_000);
}

function connectWs(scenarioId: string): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }

  wsClient = createWsClient({
    onRecord(record: StoredRecord) {
      // buffer by sessionId
      const sid = record.qaSessionId;
      if (!sid) return;

      if (!sessionRecords.has(sid)) {
        // Evict oldest session if at cap
        if (sessionRecords.size >= MAX_BUFFERED_SESSIONS) {
          const oldest = sessionRecords.keys().next().value;
          if (oldest !== undefined) {
            sessionRecords.delete(oldest);
            console.warn("[viz-web:sessionRecords] evicted oldest session from buffer", oldest);
          }
        }
        sessionRecords.set(sid, []);
      }

      const records = sessionRecords.get(sid)!;
      if (records.length >= MAX_RECORDS_PER_SESSION) {
        records.shift(); // drop oldest record for this session
      }
      records.push(record);
      sessionList.incrementRecordCount(sid);

      // only update graph for the selected session
      if (sid === currentSessionId && currentUpdater) {
        eventLog.addEvent(record);
        currentUpdater.processRecord(record);
      }
    },
    onSessionActive(sessionId: string) {
      // new session discovered via live stream
      if (!sessionRecords.has(sessionId)) {
        sessionList.addOrUpdate({
          sessionId,
          startedAt: new Date().toISOString(),
          closedAt: null,
        });
        sessionRecords.set(sessionId, []);
      }
    },
    onSubscribed(_scenarioId: string) {
      wsReconnectDelay = 1_000; // reset backoff on successful connect
      clearError();
      setWsStatus("connected");
    },
    onDisconnected() {
      setWsStatus("disconnected");
      if (currentSessionId) void loadVerdicts(currentSessionId);
      scheduleWsReconnect(scenarioId);
    },
    onError(evt) {
      console.error("[viz-web:ws] connection error", evt);
      setWsStatus("error");
      showError("WebSocket connection error — reconnecting…");
    },
  });

  wsClient.subscribe(scenarioId);
}

// ── Verdicts ──────────────────────────────────────────────────
async function loadVerdicts(sessionId: string): Promise<void> {
  try {
    const result = await getSessionVerdicts(sessionId);
    if (result.verdicts.length > 0) {
      verdictPanel.showVerdict(result.verdicts[0]);
      applyVerdictToGraph(result.verdicts[0]);
    }
  } catch (err) {
    console.error("[viz-web:loadVerdicts]", err);
  }
}

async function recomputeAndLoadVerdicts(sessionId: string): Promise<void> {
  // Collect distinct traceIds for this session from buffered records
  const records = sessionRecords.get(sessionId) ?? [];
  const traceIds = [...new Set(records.map((r) => r.traceId))];

  recomputeBtn.disabled = true;
  recomputeBtn.textContent = "Computing…";
  try {
    if (traceIds.length > 0) {
      await Promise.all(
        traceIds.map((tid) =>
          recomputeVerdicts(tid).catch((err: unknown) => {
            console.error(`[viz-web:recompute] traceId=${tid}`, err);
          }),
        ),
      );
    }
    await loadVerdicts(sessionId);
  } finally {
    recomputeBtn.disabled = false;
    recomputeBtn.textContent = "Refresh Verdict";
  }
}

function applyVerdictToGraph(report: VerdictReport): void {
  if (!currentRenderer) return;
  for (const match of report.step_matches) {
    switch (match.verdict) {
      case "pass": currentRenderer.updateNodeState(match.step_id, "matched"); break;
      case "fail": currentRenderer.updateNodeState(match.step_id, "failed"); break;
      default: currentRenderer.updateNodeState(match.step_id, "pending"); break;
    }
  }
  for (const stepId of report.missing_steps) {
    currentRenderer.updateNodeState(stepId, "failed");
  }
}

// ── WS Status ─────────────────────────────────────────────────
function setWsStatus(status: "connecting" | "connected" | "disconnected" | "error"): void {
  wsStatusEl.dataset["status"] = status;
  wsStatusEl.title = status;
}

// ── Recompute button ──────────────────────────────────────────
recomputeBtn.addEventListener("click", () => {
  if (currentSessionId) void recomputeAndLoadVerdicts(currentSessionId);
});

// ── Roleplay iframe ───────────────────────────────────────────
roleplayHost.onEvent((msg) => {
  if (msg.type === "event:emitted" && currentRenderer && currentGraph) {
    const node = currentGraph.nodes.find((n) => n.event_key === msg.eventKey);
    if (node) currentRenderer.updateNodeState(node.step_id, "active");
  }
});
