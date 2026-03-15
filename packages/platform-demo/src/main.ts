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
import { renderOverviewPage } from "./pages/overview.js";
import { renderRangePage } from "./pages/range.js";
import { renderAccessPage } from "./pages/access.js";
import { renderLoggingPage } from "./pages/logging.js";
import { renderLayoutPage } from "./pages/layout.js";

// ═══════════════════════════════════════════════════════════════════════════
//  App state
// ═══════════════════════════════════════════════════════════════════════════

type SheetId = "overview" | "service" | "permission" | "event" | "scenario" | "grant" | "range" | "access" | "logging" | "layout" | "version";
type Ver = "v1" | "v2";

const SHEET_IDS: readonly SheetId[] = ["overview", "range", "access", "service", "permission", "event", "scenario", "grant", "logging", "layout", "version"] as const;

// Sheets that depend on the active version
const VERSION_SENSITIVE_SHEETS: readonly SheetId[] = ["permission", "event", "scenario", "grant", "access", "logging"];

function sheetFromPath(pathname: string): SheetId {
  const seg = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
  return (SHEET_IDS as readonly string[]).includes(seg) ? (seg as SheetId) : "overview";
}

function pathForSheet(id: SheetId): string {
  return id === "overview" ? "/" : `/${id}`;
}

interface AppState {
  sheet: SheetId;
  ver: Ver;
  svc: ServiceState;
  perm: PermState;
  evt: EventState;
}

const state: AppState = {
  sheet: "overview",
  ver: "v2",
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

// Overview sheet refs
const overviewContainer = document.getElementById("overview-container")!;

// Scenario sheet refs
const scenarioContainer = document.getElementById("scenario-container")!;

// Grant sheet refs
const grantContainer = document.getElementById("grant-container")!;

// Range sheet refs
const rangeContainer = document.getElementById("range-container")!;

// Access (permission range) sheet refs
const accessContainer = document.getElementById("access-container")!;

// Logging sheet refs
const loggingContainer = document.getElementById("logging-container")!;

// Layout sheet refs
const layoutContainer = document.getElementById("layout-container")!;

// Version sheet refs
const versionContainer = document.getElementById("version-container")!;

// ═══════════════════════════════════════════════════════════════════════════
//  Status bar (version-aware)
// ═══════════════════════════════════════════════════════════════════════════

function getSheetInfo(sheet: SheetId, ver: Ver): { shape: string; slots: string } {
  switch (sheet) {
    case "overview":   return { shape: "n차원 참조 주소 체계", slots: "프로젝트 개요" };
    case "service":    return { shape: "service:v1 · shape [5, 2, 5, 2]", slots: "100개 슬롯" };
    case "permission": return ver === "v1"
      ? { shape: "permission:v1 · shape [10, 5]",    slots: "50개 슬롯" }
      : { shape: "permission:v2 · shape [10, 6]",    slots: "60개 슬롯" };
    case "event":      return ver === "v1"
      ? { shape: "event:v1 · shape [10, 7, 2]",      slots: "140개 슬롯" }
      : { shape: "event:v2 · shape [10, 9, 2]",      slots: "180개 슬롯" };
    case "scenario":   return ver === "v1"
      ? { shape: "시나리오 — v1 역할별 접근 제어",      slots: "결제 취소 워크플로우" }
      : { shape: "시나리오 — 역할별 접근 제어 시뮬레이션", slots: "결제 취소 요청/승인 워크플로우" };
    case "grant":      return ver === "v1"
      ? { shape: "기능 6 × 역할 5 = 30 조합",          slots: "권한 부여 관리 (v1 읽기전용)" }
      : { shape: "기능 7 × 역할 6 = 42 조합",          slots: "권한 부여 관리" };
    case "range":      return { shape: "service:v1 · shape [5, 2, 5, 2]", slots: "범위 탐색" };
    case "access":     return ver === "v1"
      ? { shape: "perm_svc(10) × role(5) + event(7×2)", slots: "접근 제어" }
      : { shape: "perm_svc(10) × role(6) + event(9×2)", slots: "접근 제어" };
    case "logging":    return ver === "v1"
      ? { shape: "구조화 로그 · svc+perm+evt 주소 태깅", slots: "로깅 통합 (v1)" }
      : { shape: "구조화 로그 · svc+perm+evt 주소 태깅", slots: "로깅 통합 (v2)" };
    case "layout":     return { shape: "UUID 레이아웃 시뮬레이터", slots: "N차원 인덱스 → UUID PK 매핑" };
    case "version":    return { shape: "MetaRegistry 스냅샷 v1 / v2", slots: "버전 비교" };
  }
}

function updateStatusBar(): void {
  const info = getSheetInfo(state.sheet, state.ver);
  statusShape.textContent = info.shape;
  statusSlots.textContent = info.slots;
}

function updateStatusSel(value: number | null): void {
  statusSel.textContent = value !== null ? `value = ${value}` : "선택 없음";
}

// ═══════════════════════════════════════════════════════════════════════════
//  Formula bar (version-aware)
// ═══════════════════════════════════════════════════════════════════════════

function updateFormulaBar(): void {
  const sheet = state.sheet;
  const ver = state.ver;

  if (sheet === "overview") {
    nameBox.textContent = "—";
    fbFormula.textContent = "encode([dim₁, dim₂, …, dimₙ]) → 단일 정수 주소  |  protobuf varint 전송";
  } else if (sheet === "service") {
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
    const stride = ver === "v1" ? 5 : 6;
    const shape = ver === "v1" ? "[10, 5]" : "[10, 6]";
    if (selectedValue !== null) {
      nameBox.textContent = String(selectedValue);
      fbFormula.textContent = `permission:${ver}:${selectedValue}  =  (perm_svc−1)×${stride} + (role−1)`;
    } else {
      nameBox.textContent = "—";
      fbFormula.textContent = `encode([perm_svc, role]) = (perm_svc−1)×${stride} + (role−1)  |  shape ${shape}`;
    }
  } else if (sheet === "scenario") {
    nameBox.textContent = "—";
    fbFormula.textContent = `hasAccess = grantedRoles.includes(role)  |  permission:${ver}:X → event:${ver}:Y`;
  } else if (sheet === "grant") {
    nameBox.textContent = "—";
    fbFormula.textContent = ver === "v1"
      ? "grantedRoles[featureId] = Set<role>  |  v1 기본 부여 (읽기전용)"
      : "grantedRoles[featureId] = Set<role>  |  PATCH /api/grants → grantState 즉시 반영";
  } else if (sheet === "range") {
    nameBox.textContent = "—";
    fbFormula.textContent = "range([fixed₁, n, fixed₃, fixed₄]) → 매칭 주소 집합  |  와일드카드 차원 탐색";
  } else if (sheet === "access") {
    nameBox.textContent = "—";
    const rStride = ver === "v1" ? 5 : 6;
    const eStride = ver === "v1" ? 14 : 18;
    fbFormula.textContent = `permAddr = (perm_svc−1)×${rStride} + (role−1)  |  evtAddr = (svc−1)×${eStride} + (event−1)×2 + (init−1)`;
  } else if (sheet === "logging") {
    nameBox.textContent = "—";
    fbFormula.textContent = `log.svc = service:v1:N  |  log.perm = permission:${ver}:N  |  log.evt = event:${ver}:N  →  구조화 로그`;
  } else if (sheet === "layout") {
    nameBox.textContent = "—";
    fbFormula.textContent = `simPackUUID(prefix, version, shard, encode(coords)) → UUID PK  |  N차원 커버리지 시뮬레이터`;
  } else if (sheet === "version") {
    nameBox.textContent = "—";
    fbFormula.textContent = `활성 버전: ${ver}  |  role ${ver === "v1" ? "5" : "6"}개 · event ${ver === "v1" ? "7" : "9"}개 · feature ${ver === "v1" ? "6" : "7"}개`;
  } else {
    const { selectedValue, fixedInitiator } = state.evt;
    const initLabel = fixedInitiator === 1 ? "web" : "mobile";
    const svcStride = ver === "v1" ? 14 : 18;
    if (selectedValue !== null) {
      nameBox.textContent = String(selectedValue);
      fbFormula.textContent = `event:${ver}:${selectedValue}  =  (svc−1)×${svcStride} + (event−1)×2 + (initiator−1)`;
    } else {
      nameBox.textContent = "—";
      fbFormula.textContent =
        `encode([svc, event, initiator]) = (svc−1)×${svcStride} + (event−1)×2 + (initiator−1)  |  initiator: ${initLabel}`;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Version change handler
// ═══════════════════════════════════════════════════════════════════════════

function handleVersionChange(ver: Ver): void {
  if (state.ver === ver) return;
  state.ver = ver;

  // Clear selected values for version-sensitive sheets
  state.perm.selectedValue = null;
  state.evt.selectedValue  = null;

  // Reset rendered flags so lazy render fires again with new version
  for (const sheetId of VERSION_SENSITIVE_SHEETS) {
    const sheetEl = document.getElementById(`sheet-${sheetId}`);
    if (sheetEl) delete sheetEl.dataset["rendered"];
  }

  // Update bars
  updateStatusBar();
  updateFormulaBar();
  updateStatusSel(null);
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
    const isActive = (el as HTMLElement).dataset.sheet === id;
    (el as HTMLElement).classList.toggle("active", isActive);
    el.setAttribute("aria-selected", String(isActive));
  });

  axisBar.style.display = id === "service" ? "" : "none";

  // Lazy render — only on first visit (or after version change resets the flag)
  if (sheetEl && !sheetEl.dataset["rendered"]) {
    sheetEl.dataset["rendered"] = "1";
    if (id === "overview")   renderOverviewPage(overviewContainer);
    if (id === "service")    repaintService();
    if (id === "permission") repaintPermission();
    if (id === "event")      repaintEvent();
    if (id === "scenario")   renderScenarioPage(scenarioContainer, state.ver);
    if (id === "grant")      renderGrantPage(grantContainer, state.ver);
    if (id === "range")      renderRangePage(rangeContainer);
    if (id === "access")     renderAccessPage(accessContainer, state.ver);
    if (id === "logging")    renderLoggingPage(loggingContainer, state.ver);
    if (id === "layout")     renderLayoutPage(layoutContainer);
    if (id === "version")    renderVersionPage(versionContainer, handleVersionChange, state.ver);
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
      refreshPermDetail(permSpPlaceholder, permSpContent, v, state.ver).catch(console.error);
    },
    state.ver,
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
      refreshEventDetail(evtSpPlaceholder, evtSpContent, v, initiator, state.ver);
    },
    (init) => {
      state.evt.fixedInitiator = init;
      state.evt.selectedValue  = null;
      repaintEvent();
      updateFormulaBar();
      updateStatusSel(null);
    },
    state.ver,
  ).catch(console.error);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Cross-tab navigation via custom events
// ═══════════════════════════════════════════════════════════════════════════

interface NavDetail {
  sheet: SheetId;
  svcAddr?: number;
  permAddr?: number;
  evtAddr?: number;
}

document.addEventListener("navigate-to", ((e: CustomEvent<NavDetail>) => {
  const { sheet, svcAddr, permAddr } = e.detail;

  // Force re-render of target sheet with current version
  const sheetEl = document.getElementById(`sheet-${sheet}`);
  if (sheetEl) delete sheetEl.dataset["rendered"];

  switchSheet(sheet);

  // Post-navigation selection
  if (sheet === "service" && svcAddr !== undefined) {
    state.svc.selectedValue = svcAddr;
    updateStatusSel(svcAddr);
    updateFormulaBar();
    // Highlight cell after render
    requestAnimationFrame(() => {
      const cell = svcGridContainer.querySelector(`[data-value="${svcAddr}"]`);
      if (cell) {
        cell.classList.add("cell-selected");
        cell.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
  if (sheet === "permission" && permAddr !== undefined) {
    state.perm.selectedValue = permAddr;
    updateStatusSel(permAddr);
    updateFormulaBar();
  }
}) as EventListener);

// ═══════════════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════════════

const initialSheet = sheetFromPath(location.pathname);
if (initialSheet !== "overview") {
  switchSheet(initialSheet, false);
} else {
  history.replaceState({ sheet: "overview" }, "", location.pathname);
  switchSheet("overview", false);
}
