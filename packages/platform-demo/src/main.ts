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
import { renderCasbinPage } from "./pages/casbin.js";
import { renderPermEnginePage } from "./pages/perm-engine.js";
import { renderPrefixMetaPage } from "./pages/prefix-meta.js";
import { renderAuthzMonitorPage } from "./pages/authz-monitor.js";
import {
  DEMO_ROLE_CAP, DEMO_EVENT_CAP, DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES,
  DEMO_INITIATORS, demoRolesFor, demoEventsFor, demoFeatures,
  demoRoleStride, demoEvtStride,
} from "demo-snapshot";
import { resetGrants } from "./registry.js";

// ═══════════════════════════════════════════════════════════════════════════
//  App state
// ═══════════════════════════════════════════════════════════════════════════

type SheetId = "overview" | "service" | "permission" | "event" | "scenario" | "grant" | "casbin" | "range" | "access" | "logging" | "layout" | "version" | "perm-engine" | "prefix-meta" | "authz-monitor";
type Ver = "v1" | "v2" | "v3" | "v4";

const SHEET_IDS: readonly SheetId[] = ["overview", "range", "access", "service", "permission", "event", "scenario", "grant", "casbin", "logging", "layout", "version", "perm-engine", "prefix-meta", "authz-monitor"] as const;

// Sheets that depend on the active version
const VERSION_SENSITIVE_SHEETS: readonly SheetId[] = ["permission", "event", "scenario", "grant", "casbin", "access", "logging", "version", "perm-engine"];

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

// eslint-disable-next-line typescript/no-non-null-assertion -- HTML 템플릿에 정의된 요소
const nameBox       = document.getElementById("name-box")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const fbFormula     = document.getElementById("fb-formula")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const axisBar       = document.getElementById("axis-bar")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const xAxisBtns     = document.getElementById("x-axis-btns")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const yAxisBtns     = document.getElementById("y-axis-btns")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const statusShape   = document.getElementById("status-shape")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const statusSlots   = document.getElementById("status-slots")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const statusSel     = document.getElementById("status-sel")!;

// Service sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const svcGridContainer  = document.getElementById("svc-grid-container")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const svcDimSidebar     = document.getElementById("svc-dim-sidebar")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const svcSpPlaceholder  = document.getElementById("svc-sp-placeholder")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const svcSpContent      = document.getElementById("svc-sp-content")!;

// Permission sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const permGridContainer = document.getElementById("perm-grid-container")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const permSpPlaceholder = document.getElementById("perm-sp-placeholder")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const permSpContent     = document.getElementById("perm-sp-content")!;

// Event sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const evtGridContainer  = document.getElementById("evt-grid-container")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const evtInitiatorBar   = document.getElementById("evt-initiator-bar")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const evtSpPlaceholder  = document.getElementById("evt-sp-placeholder")!;
// eslint-disable-next-line typescript/no-non-null-assertion
const evtSpContent      = document.getElementById("evt-sp-content")!;

// Overview sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const overviewContainer = document.getElementById("overview-container")!;

// Scenario sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const scenarioContainer = document.getElementById("scenario-container")!;

// Grant sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const grantContainer = document.getElementById("grant-container")!;

// Casbin sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const casbinContainer = document.getElementById("casbin-container")!;

// Range sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const rangeContainer = document.getElementById("range-container")!;

// Access (permission range) sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const accessContainer = document.getElementById("access-container")!;

// Logging sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const loggingContainer = document.getElementById("logging-container")!;

// Layout sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const layoutContainer = document.getElementById("layout-container")!;

// Version sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const versionContainer = document.getElementById("version-container")!;

// Permission Engine sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const permEngineContainer = document.getElementById("perm-engine-container")!;

// Prefix Meta sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const prefixMetaContainer = document.getElementById("prefix-meta-container")!;

// Authorization Monitor sheet refs
// eslint-disable-next-line typescript/no-non-null-assertion
const authzMonitorContainer = document.getElementById("authz-monitor-container")!;


// ═══════════════════════════════════════════════════════════════════════════
//  Status bar (version-aware)
// ═══════════════════════════════════════════════════════════════════════════

function getSheetInfo(sheet: SheetId, ver: Ver): { shape: string; slots: string } {
  const rc = DEMO_ROLE_CAP[ver];
  const ec = DEMO_EVENT_CAP[ver];
  const ic = DEMO_INITIATORS.length;
  const psc = DEMO_PERM_SVC_VALUES.length;
  const esc = DEMO_EVT_SVC_VALUES.length;
  const fc = demoFeatures(ver).length;
  const rn = demoRolesFor(ver).length;

  switch (sheet) {
    case "overview":   return { shape: "n차원 참조 주소 체계", slots: "프로젝트 개요" };
    case "service":    return { shape: "service:v1 · shape [5, 2, 5, 2]", slots: "100개 슬롯" };
    case "permission": return { shape: `permission:${ver} · shape [${psc}, ${rc}]`, slots: `${psc * rc}개 슬롯` };
    case "event":      return { shape: `event:${ver} · shape [${esc}, ${ec}, ${ic}]`, slots: `${esc * ec * ic}개 슬롯` };
    case "scenario":   return { shape: `시나리오 — ${ver} 역할별 접근 제어`, slots: "워크플로우 시뮬레이션" };
    case "grant":      return { shape: `기능 ${fc} × 역할 ${rn} = ${fc * rn} 조합`, slots: "권한 부여 관리" };
    case "casbin":     return { shape: "Casbin RBAC/ABAC 권한 모델 해설", slots: "qa-sdk ↔ Casbin 대비" };
    case "range":      return { shape: "service:v1 · shape [5, 2, 5, 2]", slots: "범위 탐색" };
    case "access":     return { shape: `perm_svc(${psc}) × role(${rc}) + event(${ec}×${ic})`, slots: "접근 제어" };
    case "logging":    return { shape: "구조화 로그 · svc+perm+evt 주소 태깅", slots: `로깅 통합 (${ver})` };
    case "layout":     return { shape: "UUID 레이아웃 시뮬레이터", slots: "N차원 인덱스 → UUID PK 매핑" };
    case "version":    return { shape: "MetaRegistry 스냅샷 v1 / v2", slots: "버전 비교" };
    case "perm-engine": return { shape: "PermissionSet · bitmask [feature × role]", slots: "마이그레이션 비교" };
    case "prefix-meta": return { shape: "Prefix 메타 · dim/index capacity", slots: "축 + 합성 prefix 조회" };
    case "authz-monitor": return { shape: "authorization graph · proxy + app enforcement", slots: "권한 관측 모니터" };
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
    const stride = demoRoleStride(ver);
    const shape = `[${DEMO_PERM_SVC_VALUES.length}, ${DEMO_ROLE_CAP[ver]}]`;
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
  } else if (sheet === "casbin") {
    nameBox.textContent = "—";
    fbFormula.textContent = "Casbin enforce(sub, obj, act)  ↔  qa-sdk permAddr = encode([svc, role])  |  RBAC → ABAC 확장";
  } else if (sheet === "range") {
    nameBox.textContent = "—";
    fbFormula.textContent = "range([fixed₁, n, fixed₃, fixed₄]) → 매칭 주소 집합  |  와일드카드 차원 탐색";
  } else if (sheet === "access") {
    nameBox.textContent = "—";
    const rStride = demoRoleStride(ver);
    const eStride = demoEvtStride(ver);
    fbFormula.textContent = `permAddr = (perm_svc−1)×${rStride} + (role−1)  |  evtAddr = (svc−1)×${eStride} + (event−1)×2 + (init−1)`;
  } else if (sheet === "logging") {
    nameBox.textContent = "—";
    fbFormula.textContent = `log.svc = service:v1:N  |  log.perm = permission:${ver}:N  |  log.evt = event:${ver}:N  →  구조화 로그`;
  } else if (sheet === "layout") {
    nameBox.textContent = "—";
    fbFormula.textContent = `simPackUUID(prefix, version, shard, encode(coords)) → UUID PK  |  N차원 커버리지 시뮬레이터`;
  } else if (sheet === "version") {
    nameBox.textContent = "—";
    fbFormula.textContent = `활성 버전: ${ver}  |  role ${demoRolesFor(ver).length}개 (cap ${DEMO_ROLE_CAP[ver]}) · event ${demoEventsFor(ver).length}개 (cap ${DEMO_EVENT_CAP[ver]}) · feature ${demoFeatures(ver).length}개`;
  } else if (sheet === "perm-engine") {
    nameBox.textContent = "—";
    fbFormula.textContent = `PermissionSet([feature, role]) → bitmask  |  O(1) grant/check  |  migratePermissions(v1 → v2)`;
  } else if (sheet === "authz-monitor") {
    nameBox.textContent = "—";
    fbFormula.textContent = "policy -> protects -> proxy_route/domain_resource  |  decision -> principal/resource/action/policy/enforcement";
  } else {
    const { selectedValue, fixedInitiator } = state.evt;
    const initLabel = fixedInitiator === 1 ? "web" : "mobile";
    const svcStride = demoEvtStride(ver);
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

  // Update ribbon version buttons
  for (const btn of document.querySelectorAll<HTMLButtonElement>(".ribbon-ver-btn")) {
    btn.classList.toggle("active", btn.dataset["ver"] === ver);
  }

  // Update bars
  updateStatusBar();
  updateFormulaBar();
  updateStatusSel(null);

  // Re-render current sheet if version-sensitive
  if (VERSION_SENSITIVE_SHEETS.includes(state.sheet)) {
    const sheetEl = document.getElementById(`sheet-${state.sheet}`);
    if (sheetEl) delete sheetEl.dataset["rendered"];
    switchSheet(state.sheet, false);
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
    if (id === "casbin")     renderCasbinPage(casbinContainer, state.ver);
    if (id === "range")      renderRangePage(rangeContainer);
    if (id === "access")     renderAccessPage(accessContainer, state.ver);
    if (id === "logging")    renderLoggingPage(loggingContainer, state.ver);
    if (id === "layout")     renderLayoutPage(layoutContainer);
    if (id === "version")    renderVersionPage(versionContainer, handleVersionChange, state.ver);
    if (id === "perm-engine") renderPermEnginePage(permEngineContainer, state.ver);
    if (id === "prefix-meta") renderPrefixMetaPage(prefixMetaContainer);
    if (id === "authz-monitor") renderAuthzMonitorPage(authzMonitorContainer);
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

// ── Ribbon version buttons ──
document.querySelectorAll<HTMLButtonElement>(".ribbon-ver-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ver = btn.dataset["ver"] as Ver;
    if (ver) handleVersionChange(ver);
  });
});

// ── Reset button ──
const resetBtn = document.getElementById("ribbon-reset-btn");
resetBtn?.addEventListener("click", async () => {
  resetBtn.textContent = "초기화 중...";
  (resetBtn as HTMLButtonElement).disabled = true;
  try {
    await resetGrants();
    // 현재 시트가 DB 의존 시트면 re-render
    const dbSheets: SheetId[] = ["scenario", "grant", "version", "perm-engine"];
    for (const id of dbSheets) {
      const el = document.getElementById(`sheet-${id}`);
      if (el) delete el.dataset["rendered"];
    }
    if (dbSheets.includes(state.sheet)) {
      switchSheet(state.sheet, false);
    }
    resetBtn.textContent = "완료!";
    setTimeout(() => { resetBtn.textContent = "초기화"; }, 1500);
  } catch (e) {
    resetBtn.textContent = "실패";
    console.error("Reset grants failed:", e);
    setTimeout(() => { resetBtn.textContent = "초기화"; }, 2000);
  } finally {
    (resetBtn as HTMLButtonElement).disabled = false;
  }
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
