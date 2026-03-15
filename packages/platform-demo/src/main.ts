// ═══════════════════════════════════════════════════════════════════════════
//  플랫폼 인덱스 데모 — Main entry point
// ═══════════════════════════════════════════════════════════════════════════

import {
  renderServicePage,
  renderServiceDetailPanel,
  updateServiceSelection,
  type ServiceState,
  type SvcDimKey,
} from "./pages/service.js";
import {
  renderPermissionPage,
  updatePermSelection,
  refreshPermDetail,
  type PermState,
} from "./pages/permission.js";
import {
  renderEventPage,
  updateEventSelection,
  refreshEventDetail,
  type EventState,
} from "./pages/event.js";
import { renderScenarioPage } from "./pages/scenario.js";
import { renderGrantPage } from "./pages/grant.js";
import { renderVersionPage } from "./pages/version.js";

// ═══════════════════════════════════════════════════════════════════════════
//  App state
// ═══════════════════════════════════════════════════════════════════════════

type SheetId = "service" | "permission" | "event" | "scenario" | "grant" | "version";

const SHEET_IDS: readonly SheetId[] = ["service", "permission", "event", "scenario", "grant", "version"] as const;

function sheetFromPath(pathname: string): SheetId {
  const seg = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  return (SHEET_IDS as readonly string[]).includes(seg) ? (seg as SheetId) : "service";
}

function pathForSheet(id: SheetId): string {
  return id === "service" ? "/" : `/${id}`;
}

interface AppState {
  sheet: SheetId;
  svc: ServiceState;
  perm: PermState;
  evt: EventState;
}

const state: AppState = {
  sheet: "service",
  svc: {
    xDim:          "env",
    yDim:          "svc_name",
    fixed:         { env: 1, region: 1, svc_name: 1, namespace: 1 },
    selectedValue: null,
  },
  perm: {
    selectedValue: null,
  },
  evt: {
    fixedInitiator: 1, // web
    selectedValue:  null,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
//  DOM refs
// ═══════════════════════════════════════════════════════════════════════════

const nameBox       = document.getElementById("name-box")!;
const fbFormula     = document.getElementById("fb-formula")!;
const axisBar       = document.getElementById("axis-bar")!;
const xAxisBtns     = document.getElementById("x-axis-btns")!;
const yAxisBtns     = document.getElementById("y-axis-btns")!;
const statusShape   = document.getElementById("status-shape")!;
const statusSlots   = document.getElementById("status-slots")!;
const statusSel     = document.getElementById("status-sel")!;

// Service sheet refs
const svcGridContainer  = document.getElementById("svc-grid-container")!;
const svcDimSidebar     = document.getElementById("svc-dim-sidebar")!;
const svcSpPlaceholder  = document.getElementById("svc-sp-placeholder")!;
const svcSpContent      = document.getElementById("svc-sp-content")!;

// Permission sheet refs
const permGridContainer = document.getElementById("perm-grid-container")!;
const permSpPlaceholder = document.getElementById("perm-sp-placeholder")!;
const permSpContent     = document.getElementById("perm-sp-content")!;

// Event sheet refs
const evtGridContainer  = document.getElementById("evt-grid-container")!;
const evtInitiatorBar   = document.getElementById("evt-initiator-bar")!;
const evtSpPlaceholder  = document.getElementById("evt-sp-placeholder")!;
const evtSpContent      = document.getElementById("evt-sp-content")!;

// Scenario sheet refs
const scenarioContainer = document.getElementById("scenario-container")!;

// Grant sheet refs
const grantContainer = document.getElementById("grant-container")!;

// Version sheet refs
const versionContainer = document.getElementById("version-container")!;

// ═══════════════════════════════════════════════════════════════════════════
//  Status bar
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_INFO: Record<SheetId, { shape: string; slots: string }> = {
  service:    { shape: "service:v1 · shape [5, 2, 5, 2]",   slots: "100개 슬롯" },
  permission: { shape: "permission:v2 · shape [10, 6]",     slots: "60개 슬롯"  },
  event:      { shape: "event:v2 · shape [10, 9, 2]",       slots: "180개 슬롯" },
  scenario:   { shape: "시나리오 — 역할별 접근 제어 시뮬레이션", slots: "결제 취소 요청/승인 워크플로우" },
  grant:      { shape: "기능 7 × 역할 6 = 42 조합",           slots: "부여관리" },
  version:    { shape: "MetaRegistry 스냅샷 v1 / v2",         slots: "버전 비교" },
};

function updateStatusBar(): void {
  const info = SHEET_INFO[state.sheet];
  statusShape.textContent = info.shape;
  statusSlots.textContent = info.slots;
}

function updateStatusSel(value: number | null): void {
  statusSel.textContent = value !== null ? `value = ${value}` : "선택 없음";
}

// ═══════════════════════════════════════════════════════════════════════════
//  Formula bar
// ═══════════════════════════════════════════════════════════════════════════

function updateFormulaBar(): void {
  const sheet = state.sheet;
  if (sheet === "service") {
    const { xDim, yDim, selectedValue } = state.svc;
    if (selectedValue !== null) {
      nameBox.textContent = String(selectedValue);
      fbFormula.textContent = `service:v1:${selectedValue}`;
    } else {
      nameBox.textContent = "—";
      fbFormula.textContent =
        `encode([env, region, svc_name, ns]) = (env−1)×20 + (region−1)×10 + (svc_name−1)×2 + (ns−1)  |  X: ${xDim}  Y: ${yDim}`;
    }
  } else if (sheet === "permission") {
    const { selectedValue } = state.perm;
    if (selectedValue !== null) {
      nameBox.textContent = String(selectedValue);
      fbFormula.textContent = `permission:v2:${selectedValue}  =  (perm_svc−1)×6 + (role−1)`;
    } else {
      nameBox.textContent = "—";
      fbFormula.textContent = `encode([perm_svc, role]) = (perm_svc−1)×6 + (role−1)  |  shape [10, 6]`;
    }
  } else if (sheet === "scenario") {
    nameBox.textContent = "—";
    fbFormula.textContent = "hasAccess = grantedRoles.includes(role)  |  permission:vN:X → event:vN:Y";
  } else if (sheet === "grant") {
    nameBox.textContent = "—";
    fbFormula.textContent = "grantedRoles[featureId] = Set<role>  |  PATCH /api/grants → grantState 즉시 반영";
  } else if (sheet === "version") {
    nameBox.textContent = "—";
    fbFormula.textContent = "permission:v2 · event:v2  |  role +1 (customer) · event +2 · payment_cancel → req / approve";
  } else {
    const { selectedValue, fixedInitiator } = state.evt;
    const initLabel = fixedInitiator === 1 ? "web" : "mobile";
    if (selectedValue !== null) {
      nameBox.textContent = String(selectedValue);
      fbFormula.textContent = `event:v2:${selectedValue}  =  (svc−1)×18 + (event−1)×2 + (initiator−1)`;
    } else {
      nameBox.textContent = "—";
      fbFormula.textContent =
        `encode([svc, event, initiator]) = (svc−1)×18 + (event−1)×2 + (initiator−1)  |  initiator: ${initLabel}`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Sheet navigation
// ═══════════════════════════════════════════════════════════════════════════

function switchSheet(id: SheetId, pushState = true): void {
  state.sheet = id;

  if (pushState) {
    const target = pathForSheet(id);
    if (location.pathname !== target) history.pushState({ sheet: id }, "", target);
  }

  document.querySelectorAll(".sheet").forEach((el) => el.classList.add("hidden"));
  const sheetEl = document.getElementById(`sheet-${id}`);
  sheetEl?.classList.remove("hidden");

  document.querySelectorAll(".rtab, .stab").forEach((el) => {
    (el as HTMLElement).classList.toggle("active", (el as HTMLElement).dataset.sheet === id);
  });

  axisBar.style.display = id === "service" ? "" : "none";

  // Lazy render — only on first visit
  if (sheetEl && !sheetEl.dataset["rendered"]) {
    sheetEl.dataset["rendered"] = "1";
    if (id === "service")    repaintService();
    if (id === "permission") repaintPermission();
    if (id === "event")      repaintEvent();
    if (id === "scenario")   renderScenarioPage(scenarioContainer);
    if (id === "grant")      renderGrantPage(grantContainer);
    if (id === "version")    renderVersionPage(versionContainer);
  }

  updateStatusBar();
  updateFormulaBar();
}

document.querySelectorAll(".rtab, .stab").forEach((el) => {
  el.addEventListener("click", () => {
    const id = (el as HTMLElement).dataset.sheet as SheetId;
    if (id) switchSheet(id);
  });
});

window.addEventListener("popstate", () => {
  switchSheet(sheetFromPath(location.pathname), false);
});

// ═══════════════════════════════════════════════════════════════════════════
//  Service sheet
// ═══════════════════════════════════════════════════════════════════════════

function repaintService(): void {
  renderServicePage(
    svcGridContainer,
    svcDimSidebar,
    xAxisBtns,
    yAxisBtns,
    svcSpPlaceholder,
    svcSpContent,
    state.svc,
    {
      onSelect: (v) => {
        const prev = state.svc.selectedValue;
        state.svc.selectedValue = v;
        updateServiceSelection(svcGridContainer, prev, v);
        updateFormulaBar();
        updateStatusSel(v);
        if (v !== null) {
          svcSpPlaceholder.classList.add("hidden");
          svcSpContent.classList.remove("hidden");
          renderServiceDetailPanel(svcSpContent, v).catch(console.error);
        } else {
          svcSpContent.classList.add("hidden");
          svcSpPlaceholder.classList.remove("hidden");
        }
      },
      onAxisChange: (axis, dim) => {
        if (axis === "x") state.svc.xDim = dim as SvcDimKey;
        else              state.svc.yDim = dim as SvcDimKey;
        state.svc.selectedValue = null;
        repaintService();
        updateFormulaBar();
        updateStatusSel(null);
      },
      onFixedChange: (dim, idx1) => {
        state.svc.fixed[dim] = idx1;
        state.svc.selectedValue = null;
        repaintService();
        updateFormulaBar();
        updateStatusSel(null);
      },
    }
  ).catch(console.error);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Permission sheet
// ═══════════════════════════════════════════════════════════════════════════

function repaintPermission(): void {
  renderPermissionPage(
    permGridContainer,
    permSpPlaceholder,
    permSpContent,
    state.perm,
    (v) => {
      const prev = state.perm.selectedValue;
      state.perm.selectedValue = v;
      updatePermSelection(permGridContainer, prev, v);
      updateFormulaBar();
      updateStatusSel(v);
      refreshPermDetail(permSpPlaceholder, permSpContent, v).catch(console.error);
    }
  ).catch(console.error);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Event sheet
// ═══════════════════════════════════════════════════════════════════════════

function repaintEvent(): void {
  renderEventPage(
    evtGridContainer,
    evtInitiatorBar,
    evtSpPlaceholder,
    evtSpContent,
    state.evt,
    (v) => {
      const prev = state.evt.selectedValue;
      state.evt.selectedValue = v;
      updateEventSelection(evtGridContainer, prev, v);
      updateFormulaBar();
      updateStatusSel(v);
      const initiator = state.evt.fixedInitiator === 1 ? "web" : "mobile";
      refreshEventDetail(evtSpPlaceholder, evtSpContent, v, initiator);
    },
    (init) => {
      state.evt.fixedInitiator = init;
      state.evt.selectedValue  = null;
      repaintEvent();
      updateFormulaBar();
      updateStatusSel(null);
    }
  ).catch(console.error);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════════════

const initialSheet = sheetFromPath(location.pathname);
if (initialSheet !== "service") {
  switchSheet(initialSheet, false);
} else {
  history.replaceState({ sheet: "service" }, "", location.pathname);
  switchSheet("service", false);
}
