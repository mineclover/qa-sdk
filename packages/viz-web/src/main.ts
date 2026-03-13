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
import { createSession, listSessions, getSessionVerdicts } from "./api/ingest-client";

// ── DOM refs ─────────────────────────────────────────────────
const sidebarEl = document.getElementById("sidebar")!;
const graphContainerEl = document.getElementById("graph-container")!;
const eventLogContainerEl = document.getElementById("event-log-container")!;
const footerEl = document.getElementById("footer")!;
const sessionInfoEl = document.getElementById("session-info")!;
const sessionIdValueEl = document.getElementById("session-id-value")!;
const wsStatusEl = document.getElementById("ws-status")!;
const recomputeBtn = document.getElementById("recompute-btn")!;
const mainLeftEl = document.getElementById("main-left")!;
const mainRightEl = document.getElementById("main-right")!;

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

// per-session record buffer so switching sessions replays correctly
const sessionRecords = new Map<string, StoredRecord[]>();

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
}

function resetGraphForSession(sessionId: string): void {
  if (!currentGraph || !currentRenderer) return;

  currentUpdater = createUpdater(currentGraph, currentRenderer);
  eventLog.clear();
  verdictPanel.clear();

  const buffered = sessionRecords.get(sessionId) ?? [];
  for (const record of buffered) {
    eventLog.addEvent(record);
    currentUpdater.processRecord(record);
  }
}

// ── Session selection ─────────────────────────────────────────
function selectSession(sessionId: string): void {
  currentSessionId = sessionId;
  sessionList.setSelected(sessionId);

  // Update header to show selected session
  sessionIdValueEl.textContent = sessionId;

  resetGraphForSession(sessionId);

  void loadVerdicts(sessionId);

  roleplayHost.sendContext({
    traceId: "",
    sessionId,
    scenarioId: currentSpec?.scenario_id ?? "",
  });
}

sessionList.onSelect((sessionId) => {
  selectSession(sessionId);
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
  } catch {
    // non-critical
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
    selectSession(session.sessionId);
  } catch (err) {
    sessionIdValueEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    setWsStatus("error");
    return;
  }

  // 3. Open WebSocket and subscribe to scenario
  connectWs(spec.scenario_id);
}

createScenarioSelector(sidebarEl, (spec) => void handleScenarioSelect(spec));

// ── WebSocket ─────────────────────────────────────────────────
function connectWs(scenarioId: string): void {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }

  wsClient = createWsClient({
    onRecord(record: StoredRecord) {
      // buffer by sessionId
      const sid = record.qaSessionId;
      if (!sid) return;

      if (!sessionRecords.has(sid)) sessionRecords.set(sid, []);
      sessionRecords.get(sid)!.push(record);
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
      setWsStatus("connected");
    },
    onDisconnected() {
      setWsStatus("disconnected");
      if (currentSessionId) void loadVerdicts(currentSessionId);
    },
    onError() {
      setWsStatus("error");
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
  } catch {
    // not available yet
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
  if (currentSessionId) void loadVerdicts(currentSessionId);
});

// ── Roleplay iframe ───────────────────────────────────────────
roleplayHost.onEvent((msg) => {
  if (msg.type === "event:emitted" && currentRenderer && currentGraph) {
    const node = currentGraph.nodes.find((n) => n.event_key === msg.eventKey);
    if (node) currentRenderer.updateNodeState(node.step_id, "active");
  }
});
