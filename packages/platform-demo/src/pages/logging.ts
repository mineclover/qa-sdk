// ═══════════════════════════════════════════════════════════════════════════
//  로깅 통합 — 인덱스 주소를 활용한 구조화 로그 시뮬레이터
// ═══════════════════════════════════════════════════════════════════════════

import { serializeAddress, varintByteSize } from "weighted-index";
import {
  DEMO_ENVS, DEMO_REGIONS, DEMO_SVCS, DEMO_NSS, DEMO_KO,
  DEMO_PERM_SVC_VALUES, DEMO_EVT_SVC_VALUES, DEMO_EVENT_CAP,
  demoEncodeSvc, demoDecodeSvc, demoEventsFor,
  demoRoleStride, demoEvtStride,
  demoDecodePerm, demoDecodeEvt,
  DEMO_LOG_TEMPLATES,
  type DemoVer,
} from "demo-snapshot";
import { API_BASE } from "../registry.js";

type Ver = DemoVer;

// ── Dimension metadata (demo-snapshot 기반) ──────────────────────────────

interface DimMeta {
  key: string;
  label: string;
  values: { idx1: number; id: string; ko: string }[];
}

const SVC_DIMS: DimMeta[] = [
  { key: "env", label: "환경", values: DEMO_ENVS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.env[id] })) },
  { key: "region", label: "리전", values: DEMO_REGIONS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.region[id] })) },
  { key: "svc_name", label: "서비스", values: DEMO_SVCS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.svc[id] })) },
  { key: "namespace", label: "네임스페이스", values: DEMO_NSS.map((id, i) => ({ idx1: i + 1, id, ko: DEMO_KO.ns[id] })) },
];

const encodeSvc = demoEncodeSvc;
const decodeSvc = demoDecodeSvc;
const roleStride = demoRoleStride;
const evtStrideFor = demoEvtStride;

// UI용 래퍼: demo-snapshot flat → 기존 UI가 기대하는 nested 형태
function decodePerm(addr: number, v: Ver) {
  const d = demoDecodePerm(addr, v);
  if (!d) return null;
  return {
    svc: { pos: d.svcIdx + 1, svcId: d.svcId, svcKo: d.svcKo, nsId: d.nsId, nsKo: d.nsKo },
    role: { idx1: (addr % demoRoleStride(v)) + 1, id: d.roleId, ko: d.roleKo },
  };
}

function decodeEvt(addr: number, v: Ver) {
  const d = demoDecodeEvt(addr, v);
  if (!d) return null;
  return {
    svc: { pos: d.svcIdx + 1, svcId: d.svcId, svcKo: d.svcKo, nsId: d.nsId, nsKo: d.nsKo },
    event: { idx1: Math.floor((addr % demoEvtStride(v)) / 2) + 1, id: d.eventId, ko: d.eventKo },
    initiator: { idx1: (addr % 2) + 1, id: d.initiatorId, ko: d.initiatorKo },
  };
}

// ── Types ─────────────────────────────────────────────────────────────────

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogEntry {
  ts: string; level: LogLevel; svcAddr: number;
  permAddr: number | null; evtAddr: number | null;
  action: string; message: string; latencyMs: number; userId: string;
}

const LEVEL_CLASSES: Record<LogLevel, string> = {
  DEBUG: "log-level-debug", INFO: "log-level-info",
  WARN: "log-level-warn", ERROR: "log-level-error",
};

// ── Cross-tab navigation ─────────────────────────────────────────────────

function navigateTo(sheet: string, detail: Record<string, unknown> = {}): void {
  document.dispatchEvent(new CustomEvent("navigate-to", { detail: { sheet, ...detail } }));
}

// ── Sample logs (fallback when API offline) ──────────────────────────────

function generateSampleLogs(ver: Ver): LogEntry[] {
  const rs = roleStride(ver);
  const es = evtStrideFor(ver);
  const t = Date.now() - 30_000;
  return [
    { ts: new Date(t).toISOString(), level: "INFO", svcAddr: encodeSvc([3,1,1,1]), permAddr: (1-1)*rs+(2-1), evtAddr: null, action: "page.view", message: "메인 페이지 조회", latencyMs: 42, userId: "u-1001" },
    { ts: new Date(t+1200).toISOString(), level: "INFO", svcAddr: encodeSvc([3,1,4,1]), permAddr: (4-1)*rs+(1-1), evtAddr: (4-1)*es+(3-1)*2, action: "payment.initiate", message: "결제 요청 시작 — KRW 45,000", latencyMs: 187, userId: "u-1001" },
    { ts: new Date(t+2800).toISOString(), level: "DEBUG", svcAddr: encodeSvc([3,1,3,1]), permAddr: null, evtAddr: null, action: "token.validate", message: "JWT 토큰 검증 완료", latencyMs: 3, userId: "u-1001" },
    { ts: new Date(t+4500).toISOString(), level: "WARN", svcAddr: encodeSvc([3,1,5,1]), permAddr: null, evtAddr: (5-1)*es, action: "rate.limit", message: "Rate limit 임계값 80% 도달 — IP 203.0.113.42", latencyMs: 1, userId: "system" },
    { ts: new Date(t+5100).toISOString(), level: "ERROR", svcAddr: encodeSvc([3,1,4,1]), permAddr: (4-1)*rs+(2-1), evtAddr: (4-1)*es+(4-1)*2, action: "payment.refund.fail", message: "환불 처리 실패 — PG 응답 타임아웃 (30s)", latencyMs: 30012, userId: "u-2045" },
    { ts: new Date(t+7200).toISOString(), level: "INFO", svcAddr: encodeSvc([3,2,2,2]), permAddr: (2-1)*rs+(3-1), evtAddr: null, action: "catalog.sync", message: "상품 카탈로그 동기화 완료 — 2,340건", latencyMs: 892, userId: "u-batch" },
    { ts: new Date(t+9800).toISOString(), level: "INFO", svcAddr: encodeSvc([2,1,1,1]), permAddr: (1-1)*rs+(2-1), evtAddr: (1-1)*es+(2-1)*2+1, action: "deploy.canary", message: "카나리 배포 진행 중 — v2.4.1-rc3", latencyMs: 0, userId: "u-3001" },
    { ts: new Date(t+11500).toISOString(), level: "WARN", svcAddr: encodeSvc([3,1,3,2]), permAddr: (3-1)*rs, evtAddr: null, action: "auth.brute", message: "로그인 실패 연속 5회 — 계정 잠금 경고", latencyMs: 8, userId: "u-unknown" },
    { ts: new Date(t+13000).toISOString(), level: "DEBUG", svcAddr: encodeSvc([1,1,2,1]), permAddr: null, evtAddr: null, action: "db.query", message: "SELECT * FROM products WHERE category_id = 42 — 127rows", latencyMs: 23, userId: "u-dev" },
    { ts: new Date(t+14200).toISOString(), level: "ERROR", svcAddr: encodeSvc([3,1,3,1]), permAddr: (3-1)*rs, evtAddr: (3-1)*es+(6-1)*2, action: "session.expire", message: "세션 만료 — 비정상 토큰 재사용 감지", latencyMs: 2, userId: "u-4099" },
  ];
}

// ── Random log generator (for "샘플 추가" button) ────────────────────────

const RANDOM_ACTIONS = DEMO_LOG_TEMPLATES;

function generateRandomLog(ver: Ver): LogEntry {
  const rs = roleStride(ver);
  const es = evtStrideFor(ver);
  const pick = RANDOM_ACTIONS[Math.floor(Math.random() * RANDOM_ACTIONS.length)];
  const envIdx = Math.floor(Math.random() * DEMO_ENVS.length) + 1;
  const regIdx = Math.floor(Math.random() * DEMO_REGIONS.length) + 1;
  const svcIdx = Math.floor(Math.random() * DEMO_SVCS.length) + 1;
  const nsIdx  = Math.floor(Math.random() * DEMO_NSS.length) + 1;
  const svcAddr = encodeSvc([envIdx, regIdx, svcIdx, nsIdx]);

  const hasPerm = Math.random() > 0.4;
  const permSvcCount = DEMO_PERM_SVC_VALUES.length;
  const permAddr = hasPerm ? Math.floor(Math.random() * permSvcCount) * rs + Math.floor(Math.random() * rs) : null;

  const hasEvt = Math.random() > 0.5;
  const evtSvcCount = DEMO_EVT_SVC_VALUES.length;
  const evtCount = demoEventsFor(ver).length;
  const evtAddr = hasEvt ? Math.floor(Math.random() * evtSvcCount) * es + Math.floor(Math.random() * evtCount) * 2 + Math.floor(Math.random() * 2) : null;

  const latencyMs = pick.level === "ERROR" ? 1000 + Math.floor(Math.random() * 30000)
    : pick.level === "WARN" ? 50 + Math.floor(Math.random() * 500)
    : Math.floor(Math.random() * 200);

  const userIds = ["u-1001", "u-2045", "u-3001", "u-batch", "u-dev", "system", "u-4099", "u-5500"];

  return {
    ts: new Date().toISOString(),
    level: pick.level,
    svcAddr,
    permAddr,
    evtAddr,
    action: pick.action,
    message: pick.message,
    latencyMs,
    userId: userIds[Math.floor(Math.random() * userIds.length)],
  };
}

// ── API helpers ──────────────────────────────────────────────────────────

async function apiFetchLogs(params: { level?: string; limit?: number } = {}): Promise<{ results: LogEntry[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.level) qs.set("level", params.level);
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/api/logs?${qs}`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiSeedLogs(ver: Ver): Promise<void> {
  const res = await fetch(`${API_BASE}/api/logs/seed?ver=${ver}&clear=true`, { method: "POST" });
  if (!res.ok) throw new Error(`${res.status}`);
}

async function apiPostLog(entry: LogEntry): Promise<void> {
  const res = await fetch(`${API_BASE}/api/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`${res.status}`);
}

async function apiClearLogs(ver: Ver): Promise<void> {
  // clear=true deletes all existing rows, then re-inserts 8 sample entries
  await fetch(`${API_BASE}/api/logs/seed?ver=${ver}&clear=true`, { method: "POST" });
}

// ── Render ─────────────────────────────────────────────────────────────────

export function renderLoggingPage(container: HTMLElement, ver: Ver): void {
  container.innerHTML = "";
  let logs: LogEntry[] = generateSampleLogs(ver);
  let apiOnline = false;

  const wrap = document.createElement("div");
  wrap.className = "log-wrap";

  // ── Header ──────────────────────────────────────────────────────────
  const header = document.createElement("header");
  header.className = "log-header";
  header.innerHTML = `
    <h2 class="log-title">로깅 통합 시뮬레이터</h2>
    <p class="log-desc">
      인덱스 주소를 활용한 <strong>구조화 로그</strong> 시스템.
      모든 로그에 서비스·권한·이벤트 주소가 태깅되어,
      <strong>주소 기반 필터링과 상관관계 추적</strong>이 가능합니다.
      주소를 클릭하면 해당 탭으로 이동합니다.
    </p>
  `;
  wrap.appendChild(header);

  // ── Two-column layout ───────────────────────────────────────────────
  const columns = document.createElement("div");
  columns.className = "log-columns";

  const left = document.createElement("div");
  left.className = "log-left";

  // ── Toolbar (D1 actions) ──────────────────────────────────────────
  const toolbar = document.createElement("div");
  toolbar.className = "log-toolbar";

  const dbStatus = document.createElement("span");
  dbStatus.className = "log-toolbar-status";
  dbStatus.textContent = "연결 확인 중…";
  toolbar.appendChild(dbStatus);

  function makeToolbarBtn(label: string, handler: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "log-toolbar-btn";
    btn.textContent = label;
    btn.addEventListener("click", handler);
    return btn;
  }

  const btnSeed = makeToolbarBtn("Seed Data", async () => {
    btnSeed.disabled = true; btnSeed.textContent = "Seeding…";
    try { await apiSeedLogs(ver); await loadFromApi(); }
    catch { showOffline(); }
    btnSeed.disabled = false; btnSeed.textContent = "Seed Data";
  });

  const btnClear = makeToolbarBtn("초기화", async () => {
    btnClear.disabled = true; btnClear.textContent = "초기화 중…";
    try { await apiClearLogs(ver); await loadFromApi(); }
    catch { showOffline(); }
    btnClear.disabled = false; btnClear.textContent = "초기화";
  });

  const btnAddRandom = makeToolbarBtn("+ 샘플 추가", async () => {
    const entry = generateRandomLog(ver);
    btnAddRandom.disabled = true;
    try { await apiPostLog(entry); await loadFromApi(); }
    catch {
      // Offline: just add to local array
      logs.unshift(entry);
      renderLogList();
    }
    btnAddRandom.disabled = false;
  });

  const btnRefresh = makeToolbarBtn("Refresh", async () => {
    try { await loadFromApi(); }
    catch { showOffline(); }
  });

  toolbar.append(btnSeed, btnClear, btnAddRandom, btnRefresh);
  left.appendChild(toolbar);

  function showOffline(): void {
    apiOnline = false;
    dbStatus.textContent = "D1 offline — wrangler dev 필요";
    dbStatus.className = "log-toolbar-status log-toolbar-status-err";
  }

  function showOnline(total: number): void {
    apiOnline = true;
    dbStatus.textContent = `D1 · ${total} rows`;
    dbStatus.className = "log-toolbar-status log-toolbar-status-ok";
  }

  async function loadFromApi(): Promise<void> {
    const levelFilter = activeFilters.size < 4 ? [...activeFilters].join(",") : undefined;
    const data = await apiFetchLogs({ level: levelFilter, limit: 200 });
    logs = data.results;
    showOnline(data.total);
    renderLogList();
  }

  // ── Level filter ────────────────────────────────────────────────────
  const filterBar = document.createElement("div");
  filterBar.className = "log-filter-bar";

  const levelList: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR"];
  const activeFilters = new Set<LogLevel>(levelList);

  for (const lv of levelList) {
    const btn = document.createElement("button");
    btn.className = `log-filter-btn ${LEVEL_CLASSES[lv]} log-filter-active`;
    btn.textContent = lv;
    btn.addEventListener("click", () => {
      if (activeFilters.has(lv)) activeFilters.delete(lv); else activeFilters.add(lv);
      btn.classList.toggle("log-filter-active");
      if (apiOnline) loadFromApi().catch(() => { showOffline(); renderLogList(); });
      else renderLogList();
    });
    filterBar.appendChild(btn);
  }
  const countBadge = document.createElement("span");
  countBadge.className = "log-filter-count";
  filterBar.appendChild(countBadge);
  left.appendChild(filterBar);

  // ── Address-range filter bar ────────────────────────────────────────
  const addrBar = document.createElement("div");
  addrBar.className = "log-addr-bar";

  // Env filter
  let activeEnv = "all";
  const envBtns: HTMLButtonElement[] = [];
  const envOpts = [
    { id: "all", label: "전체", idx1: 0 },
    ...DEMO_ENVS
      .filter(e => ["prod", "stage", "dev"].includes(e))
      .map(e => ({ id: e, label: e, idx1: DEMO_ENVS.indexOf(e) + 1 })),
  ];

  addrBar.innerHTML = `<span class="log-addr-label">환경</span>`;
  for (const opt of envOpts) {
    const btn = document.createElement("button");
    btn.className = "log-addr-btn" + (opt.id === "all" ? " log-addr-btn-active" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      activeEnv = opt.id;
      envBtns.forEach(b => b.classList.remove("log-addr-btn-active"));
      btn.classList.add("log-addr-btn-active");
      renderLogList();
    });
    addrBar.appendChild(btn);
    envBtns.push(btn);
  }

  addrBar.appendChild(Object.assign(document.createElement("span"), { className: "log-addr-sep" }));

  // Service filter with address ranges
  let activeSvc = "all";
  const svcBtns: HTMLButtonElement[] = [];
  // 서비스 필터: svc_name 좌표 기반 (mixed-radix에서 연속 범위가 아니므로 range 대신 좌표 비교)
  const svcOpts: { id: string; label: string; svcNameIdx: number | null }[] = [
    { id: "all", label: "전체", svcNameIdx: null },
    ...DEMO_SVCS.map((svc, i) => ({
      id: svc,
      label: DEMO_KO.svc[svc] ?? svc,
      svcNameIdx: i,  // 0-based DEMO_SVCS 인덱스
    })),
  ];

  const svcLbl = document.createElement("span");
  svcLbl.className = "log-addr-label";
  svcLbl.textContent = "서비스";
  addrBar.appendChild(svcLbl);

  for (const opt of svcOpts) {
    const btn = document.createElement("button");
    btn.className = "log-addr-btn" + (opt.id === "all" ? " log-addr-btn-active" : "");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      activeSvc = opt.id;
      svcBtns.forEach(b => b.classList.remove("log-addr-btn-active"));
      btn.classList.add("log-addr-btn-active");
      customRange = null;
      elRangeMin.value = ""; elRangeMax.value = "";
      renderLogList();
    });
    addrBar.appendChild(btn);
    svcBtns.push(btn);
  }

  addrBar.appendChild(Object.assign(document.createElement("span"), { className: "log-addr-sep" }));

  // Custom address range
  const rngLbl = document.createElement("span");
  rngLbl.className = "log-addr-label";
  rngLbl.textContent = "범위";
  addrBar.appendChild(rngLbl);

  const elRangeMin = Object.assign(document.createElement("input"), { type: "number", className: "log-addr-input", placeholder: "min", min: "0", max: "99" });
  const elRangeMax = Object.assign(document.createElement("input"), { type: "number", className: "log-addr-input", placeholder: "max", min: "0", max: "99" });
  let customRange: [number, number] | null = null;

  function onCustomRange(): void {
    const lo = elRangeMin.value !== "" ? +elRangeMin.value : null;
    const hi = elRangeMax.value !== "" ? +elRangeMax.value : null;
    if (lo !== null && hi !== null && lo <= hi) {
      customRange = [lo, hi];
      activeSvc = "__custom__";
      svcBtns.forEach(b => b.classList.remove("log-addr-btn-active"));
    } else if (activeSvc === "__custom__") {
      customRange = null;
      activeSvc = "all";
      svcBtns[0].classList.add("log-addr-btn-active");
    }
    renderLogList();
  }
  elRangeMin.addEventListener("input", onCustomRange);
  elRangeMax.addEventListener("input", onCustomRange);

  addrBar.append(elRangeMin, Object.assign(document.createElement("span"), { className: "log-addr-dash", textContent: "–" }), elRangeMax);
  left.appendChild(addrBar);

  // Log list
  const logList = document.createElement("div");
  logList.className = "log-list";
  left.appendChild(logList);

  // ── RIGHT: detail panel ─────────────────────────────────────────────
  const right = document.createElement("div");
  right.className = "log-right";
  const detailPanel = document.createElement("div");
  detailPanel.className = "log-detail";
  detailPanel.innerHTML = `<div class="log-detail-empty"><div class="log-detail-empty-icon">&#x25C8;</div><p>로그 항목을 클릭하면<br/>상세 정보를 확인합니다</p></div>`;
  right.appendChild(detailPanel);

  columns.appendChild(left);
  columns.appendChild(right);
  wrap.appendChild(columns);

  // ── Comparison section ──────────────────────────────────────────────
  const comparison = document.createElement("div");
  comparison.className = "log-comparison";

  // action → 인덱스 매핑 (등장 순서 기반)
  const ACTION_INDEX = new Map<string, number>();
  function actionIdx(action: string): number {
    if (!ACTION_INDEX.has(action)) ACTION_INDEX.set(action, ACTION_INDEX.size + 1);
    // eslint-disable-next-line typescript/no-non-null-assertion -- .has() 직후 .get()
    return ACTION_INDEX.get(action)!;
  }
  // 초기 action 등록
  ["page.view","payment.initiate","token.validate","rate.limit","payment.refund.fail",
   "catalog.sync","deploy.canary","auth.brute","db.query","session.expire",
   "cart.add","order.submit","cache.hit","latency.spike","disk.usage",
   "payment.timeout","db.connection.fail","user.signup","deploy.complete","auth.suspicious"
  ].forEach(a => actionIdx(a));

  function renderComparison(entry?: LogEntry): void {
    // 기본값 또는 선택된 엔트리
    const svcAddr = entry?.svcAddr ?? encodeSvc([3,1,1,1]);
    const permAddr = entry?.permAddr ?? (1-1)*roleStride(ver)+1;
    const evtAddr = entry?.evtAddr ?? (4-1)*evtStrideFor(ver)+(3-1)*2;
    const action = entry?.action ?? "payment.initiate";
    const actIdx = actionIdx(action);

    // 문자열 기반 복원
    const svcCoords = decodeSvc(svcAddr);
    const svcLabels = svcCoords.map((c, i) => {
      const v = SVC_DIMS[i].values.find(vv => vv.idx1 === c);
      return v?.id ?? "?";
    });
    const permD = permAddr !== null ? decodePerm(permAddr, ver) : null;
    const evtD = evtAddr !== null ? decodeEvt(evtAddr, ver) : null;

    const strSvc = `"service": "${svcLabels[2]}"`;
    const strEnv = `"env": "${svcLabels[0]}", "region": "${svcLabels[1]}", "ns": "${svcLabels[3]}"`;
    const strPerm = permD ? `"permission": "${permD.svc.svcId}:${permD.role.id}"` : `"permission": null`;
    const strEvt = evtD ? `"event": "${evtD.svc.svcId}:${evtD.event.id}:${evtD.initiator.id}"` : `"event": null`;

    // JSON 크기 추정
    const strJson = `{${strSvc},${strEnv},${strPerm},${strEvt},"action":"${action}"}`;
    const strSize = new TextEncoder().encode(strJson).length;
    const addrJson = `{"svc":${svcAddr},"perm":${permAddr ?? "null"},"evt":${evtAddr ?? "null"},"action":"${action}"}`;
    const addrSize = new TextEncoder().encode(addrJson).length;
    const fullJson = `{"svc":${svcAddr},"perm":${permAddr ?? "null"},"evt":${evtAddr ?? "null"},"act":${actIdx}}`;
    const fullSize = new TextEncoder().encode(fullJson).length;

    // protobuf varint 크기 추정
    const protoSize = [svcAddr, permAddr ?? 0, evtAddr ?? 0, actIdx].reduce((s, v) => s + 1 + varintByteSize(v), 0);

    const pct1 = Math.round((1 - addrSize / strSize) * 100);
    const pct2 = Math.round((1 - fullSize / strSize) * 100);
    const pct3 = Math.round((1 - protoSize / strSize) * 100);

    const selectedHint = entry ? `<span class="log-comp-selected">선택된 로그: ${action}</span>` : "";

    comparison.innerHTML = `
      <h3 class="log-comp-title">주소 기반 로그 vs 문자열 로그 ${selectedHint}</h3>
      <div class="log-comp-grid">
        <div class="log-comp-card log-comp-before">
          <div class="log-comp-card-label">기존 — 문자열 기반</div>
          <pre class="log-comp-code">{
  ${strSvc},
  ${strEnv},
  ${strPerm},
  ${strEvt},
  "action": "${action}"
}</pre>
          <div class="log-comp-stat"><span class="log-comp-stat-label">페이로드</span><span class="log-comp-stat-val log-comp-stat-bad">~${strSize} bytes</span></div>
        </div>
        <div class="log-comp-arrow">→</div>
        <div class="log-comp-card log-comp-after">
          <div class="log-comp-card-label">인덱스 — 주소 기반 (action 문자열 유지)</div>
          <pre class="log-comp-code">{
  "svc": ${svcAddr},
  "perm": ${permAddr ?? "null"},
  "evt": ${evtAddr ?? "null"},
  "action": "${action}"
}</pre>
          <div class="log-comp-stat"><span class="log-comp-stat-label">페이로드</span><span class="log-comp-stat-val log-comp-stat-good">~${addrSize} bytes (${pct1}%↓)</span></div>
        </div>
        <div class="log-comp-arrow">→</div>
        <div class="log-comp-card log-comp-after">
          <div class="log-comp-card-label">완전 주소화 — action도 인덱스</div>
          <pre class="log-comp-code">{
  "svc": ${svcAddr},
  "perm": ${permAddr ?? "null"},
  "evt": ${evtAddr ?? "null"},
  "act": ${actIdx}
}
<span class="log-comp-note">// act ${actIdx} = ${action}
// shape [${ACTION_INDEX.size}] — ${ACTION_INDEX.size}개 action 엔트리</span></pre>
          <div class="log-comp-stat"><span class="log-comp-stat-label">페이로드</span><span class="log-comp-stat-val log-comp-stat-good">~${fullSize} bytes (${pct2}%↓)</span></div>
        </div>
        <div class="log-comp-arrow">→</div>
        <div class="log-comp-card log-comp-after log-comp-proto">
          <div class="log-comp-card-label">Protobuf — 바이너리 전송</div>
          <pre class="log-comp-code">message LogEntry {
  uint32 svc  = 1; // ${svcAddr}
  uint32 perm = 2; // ${permAddr ?? 0}
  uint32 evt  = 3; // ${evtAddr ?? 0}
  uint32 act  = 4; // ${actIdx}
}
<span class="log-comp-note">// varint 인코딩: 총 ${protoSize} bytes</span></pre>
          <div class="log-comp-stat"><span class="log-comp-stat-label">페이로드</span><span class="log-comp-stat-val log-comp-stat-best">~${protoSize} bytes (${pct3}%↓)</span></div>
        </div>
      </div>
      <div class="log-comp-benefits">
        <div class="log-comp-benefit"><span class="log-comp-benefit-num">~${pct1}%</span><span class="log-comp-benefit-label">JSON 주소화 절감</span></div>
        <div class="log-comp-benefit"><span class="log-comp-benefit-num">~${pct2}%</span><span class="log-comp-benefit-label">완전 주소화 절감</span></div>
        <div class="log-comp-benefit"><span class="log-comp-benefit-num">~${pct3}%</span><span class="log-comp-benefit-label">Protobuf 절감</span></div>
        <div class="log-comp-benefit"><span class="log-comp-benefit-num">O(1)</span><span class="log-comp-benefit-label">주소 비교 연산</span></div>
        <div class="log-comp-benefit"><span class="log-comp-benefit-num">범위 쿼리</span><span class="log-comp-benefit-label">svc ${Math.floor(svcAddr/20)*20}~${Math.floor(svcAddr/20)*20+19}</span></div>
      </div>
    `;
  }

  renderComparison(); // 초기 기본값
  wrap.appendChild(comparison);

  // ── Address anatomy — what's inside each integer ───────────────────────
  const _rs = roleStride(ver);
  const _es = evtStrideFor(ver);

  const exSvc = 40;
  const exSvcCoords = decodeSvc(exSvc);
  const exSvcDims = exSvcCoords.map((c, i) => {
    const dim = SVC_DIMS[i];
    const v = dim.values.find(vv => vv.idx1 === c);
    return { key: dim.key, val: v?.id ?? "?", ko: v?.ko ?? "?", coord: c };
  });

  const exPerm = 1;
  // eslint-disable-next-line typescript/no-non-null-assertion -- 알려진 유효 주소
  const exPermD = decodePerm(exPerm, ver)!;

  const exEvt = ver === "v1" ? 46 : 58;
  // eslint-disable-next-line typescript/no-non-null-assertion -- 알려진 유효 주소
  const exEvtD = decodeEvt(exEvt, ver)!;

  const anatomy = document.createElement("div");
  anatomy.className = "log-anatomy";
  anatomy.innerHTML = `
    <h3 class="log-anatomy-title">주소 해부도 — 정수 하나에 담긴 차원들</h3>
    <div class="log-anatomy-cards">
      <div class="log-anat-card">
        <div class="log-anat-head">
          <span class="log-anat-schema">svc</span>
          <span class="log-anat-idx">= ${exSvc}</span>
          <span class="log-anat-shape">shape [5, 2, 5, 2]</span>
        </div>
        <div class="log-anat-body">
          ${exSvcDims.map(d => `
            <div class="log-anat-dim">
              <span class="log-anat-dim-key">${d.key}</span>
              <span class="log-anat-dim-val">${d.val}</span>
              <span class="log-anat-dim-ko">${d.ko}</span>
              <span class="log-anat-dim-coord">${d.coord}</span>
            </div>`).join("")}
          <div class="log-anat-formula">
            (${exSvcCoords[0]}-1)×20 + (${exSvcCoords[1]}-1)×10 + (${exSvcCoords[2]}-1)×2 + (${exSvcCoords[3]}-1) = <strong>${exSvc}</strong>
          </div>
        </div>
      </div>
      <div class="log-anat-card">
        <div class="log-anat-head">
          <span class="log-anat-schema">perm</span>
          <span class="log-anat-idx">= ${exPerm}</span>
          <span class="log-anat-shape">shape [10, ${_rs}]</span>
        </div>
        <div class="log-anat-body">
          <div class="log-anat-dim">
            <span class="log-anat-dim-key">perm_svc</span>
            <span class="log-anat-dim-val">${exPermD.svc.svcId}</span>
            <span class="log-anat-dim-ko">${exPermD.svc.svcKo}/${exPermD.svc.nsKo}</span>
            <span class="log-anat-dim-coord">${exPermD.svc.pos}</span>
          </div>
          <div class="log-anat-dim">
            <span class="log-anat-dim-key">role</span>
            <span class="log-anat-dim-val">${exPermD.role.id}</span>
            <span class="log-anat-dim-ko">${exPermD.role.ko}</span>
            <span class="log-anat-dim-coord">${exPermD.role.idx1}</span>
          </div>
          <div class="log-anat-formula">
            (${exPermD.svc.pos}-1)×${_rs} + (${exPermD.role.idx1}-1) = <strong>${exPerm}</strong>
          </div>
        </div>
      </div>
      <div class="log-anat-card">
        <div class="log-anat-head">
          <span class="log-anat-schema">evt</span>
          <span class="log-anat-idx">= ${exEvt}</span>
          <span class="log-anat-shape">shape [10, ${DEMO_EVENT_CAP[ver]}, 2]</span>
        </div>
        <div class="log-anat-body">
          <div class="log-anat-dim">
            <span class="log-anat-dim-key">event_svc</span>
            <span class="log-anat-dim-val">${exEvtD.svc.svcId}</span>
            <span class="log-anat-dim-ko">${exEvtD.svc.svcKo}/${exEvtD.svc.nsKo}</span>
            <span class="log-anat-dim-coord">${exEvtD.svc.pos}</span>
          </div>
          <div class="log-anat-dim">
            <span class="log-anat-dim-key">event</span>
            <span class="log-anat-dim-val">${exEvtD.event.id}</span>
            <span class="log-anat-dim-ko">${exEvtD.event.ko}</span>
            <span class="log-anat-dim-coord">${exEvtD.event.idx1}</span>
          </div>
          <div class="log-anat-dim">
            <span class="log-anat-dim-key">initiator</span>
            <span class="log-anat-dim-val">${exEvtD.initiator.id}</span>
            <span class="log-anat-dim-ko">${exEvtD.initiator.ko}</span>
            <span class="log-anat-dim-coord">${exEvtD.initiator.idx1}</span>
          </div>
          <div class="log-anat-formula">
            (${exEvtD.svc.pos}-1)×${_es} + (${exEvtD.event.idx1}-1)×2 + (${exEvtD.initiator.idx1}-1) = <strong>${exEvt}</strong>
          </div>
        </div>
      </div>
    </div>
  `;
  wrap.appendChild(anatomy);

  container.appendChild(wrap);

  // ── Filter logic ───────────────────────────────────────────────────
  function matchesAddr(entry: LogEntry): boolean {
    if (activeEnv !== "all") {
      const envIdx1 = decodeSvc(entry.svcAddr)[0];
      const opt = envOpts.find(o => o.id === activeEnv);
      if (opt && opt.idx1 > 0 && opt.idx1 !== envIdx1) return false;
    }
    if (activeSvc === "__custom__" && customRange) {
      if (entry.svcAddr < customRange[0] || entry.svcAddr > customRange[1]) return false;
    } else if (activeSvc !== "all") {
      // svc_name 좌표 기반 필터: 주소를 decode하여 svc_name 확인
      const opt = svcOpts.find(o => o.id === activeSvc);
      if (opt?.svcNameIdx != null) {
        const decoded = demoDecodeSvc(entry.svcAddr);
        if (decoded[2] !== opt.svcNameIdx + 1) return false; // 1-based coord
      }
    }
    return true;
  }

  // ── Render functions ───────────────────────────────────────────────
  let selectedIdx: number | null = null;

  function renderLogList(): void {
    logList.innerHTML = "";
    const filtered = logs.filter(l => activeFilters.has(l.level) && matchesAddr(l));
    countBadge.textContent = `${filtered.length} / ${logs.length}${apiOnline ? "" : " (local)"}`;

    for (const entry of filtered) {
      const origIdx = logs.indexOf(entry);
      const row = document.createElement("div");
      row.className = `log-row ${LEVEL_CLASSES[entry.level]}${selectedIdx === origIdx ? " log-row-selected" : ""}`;

      const ts = entry.ts.split("T")[1].split(".")[0];
      const svcStr = serializeAddress({ schema: "service", version: "v1", index: entry.svcAddr }, "colon");

      row.innerHTML = `
        <span class="log-row-ts">${ts}</span>
        <span class="log-row-level">${entry.level}</span>
        <span class="log-row-addr log-row-addr-link" title="서비스 탭으로 이동">${svcStr}</span>
        <span class="log-row-action">${entry.action}</span>
        <span class="log-row-msg">${entry.message}</span>
        <span class="log-row-latency">${entry.latencyMs}ms</span>
      `;

      row.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).classList.contains("log-row-addr-link")) return;
        selectedIdx = origIdx;
        renderLogList();
        renderDetail(entry);
      });

      row.querySelector(".log-row-addr-link")?.addEventListener("click", (e) => {
        e.stopPropagation();
        navigateTo("service", { svcAddr: entry.svcAddr });
      });

      logList.appendChild(row);
    }
  }

  function chips(pairs: { key: string; val: string; ko?: string }[]): string {
    return pairs.map(p =>
      `<span class="log-dtl-decoded-chip"><span class="log-dtl-decoded-key">${p.key}</span><span class="log-dtl-decoded-val">${p.val}</span>${p.ko ? `<span class="log-dtl-decoded-ko">${p.ko}</span>` : ""}</span>`
    ).join("");
  }

  function renderDetail(entry: LogEntry): void {
    const svcCoords = decodeSvc(entry.svcAddr);
    const svcLabels = svcCoords.map((c, i) => {
      const dim = SVC_DIMS[i];
      const v = dim.values.find(vv => vv.idx1 === c);
      return { key: dim.key, val: v?.id ?? "?", ko: v?.ko ?? "?" };
    });

    const svcStr = serializeAddress({ schema: "service", version: "v1", index: entry.svcAddr }, "colon");
    const permStr = entry.permAddr !== null ? serializeAddress({ schema: "permission", version: ver, index: entry.permAddr }, "colon") : "—";
    const evtStr = entry.evtAddr !== null ? serializeAddress({ schema: "event", version: ver, index: entry.evtAddr }, "colon") : "—";

    const permD = entry.permAddr !== null ? decodePerm(entry.permAddr, ver) : null;
    const permHtml = permD ? `<div class="log-dtl-addr-decoded">${chips([
      { key: "svc", val: permD.svc.svcId, ko: permD.svc.svcKo },
      { key: "ns", val: permD.svc.nsId, ko: permD.svc.nsKo },
      { key: "role", val: permD.role.id, ko: permD.role.ko },
    ])}</div>` : "";

    const evtD = entry.evtAddr !== null ? decodeEvt(entry.evtAddr, ver) : null;
    const evtHtml = evtD ? `<div class="log-dtl-addr-decoded">${chips([
      { key: "svc", val: evtD.svc.svcId, ko: evtD.svc.svcKo },
      { key: "evt", val: evtD.event.id, ko: evtD.event.ko },
      { key: "init", val: evtD.initiator.id, ko: evtD.initiator.ko },
    ])}</div>` : "";

    detailPanel.innerHTML = `
      <div class="log-detail-content">
        <div class="log-dtl-header ${LEVEL_CLASSES[entry.level]}">
          <span class="log-dtl-level">${entry.level}</span>
          <span class="log-dtl-action">${entry.action}</span>
          <span class="log-dtl-user">${entry.userId}</span>
        </div>
        <div class="log-dtl-message">${entry.message}</div>
        <div class="log-dtl-section">
          <div class="log-dtl-section-title">주소 매핑 + 디코딩 (클릭하여 탭 이동)</div>
          <div class="log-dtl-addr-grid">
            <div class="log-dtl-addr-row">
              <span class="log-dtl-addr-label">service</span>
              <code class="log-dtl-addr-val log-dtl-addr-link" data-nav="service" data-addr="${entry.svcAddr}">${svcStr}</code>
              <span class="log-dtl-addr-raw">index=${entry.svcAddr}</span>
            </div>
            <div class="log-dtl-addr-decoded">${chips(svcLabels)}</div>
            <div class="log-dtl-addr-row" style="margin-top:6px">
              <span class="log-dtl-addr-label">permission</span>
              <code class="log-dtl-addr-val${entry.permAddr !== null ? " log-dtl-addr-link" : ""}" ${entry.permAddr !== null ? `data-nav="permission" data-addr="${entry.permAddr}"` : ""}>${permStr}</code>
              <span class="log-dtl-addr-raw">${entry.permAddr !== null ? `index=${entry.permAddr}` : ""}</span>
            </div>
            ${permHtml}
            <div class="log-dtl-addr-row" style="margin-top:6px">
              <span class="log-dtl-addr-label">event</span>
              <code class="log-dtl-addr-val">${evtStr}</code>
              <span class="log-dtl-addr-raw">${entry.evtAddr !== null ? `index=${entry.evtAddr}` : ""}</span>
            </div>
            ${evtHtml}
          </div>
        </div>
        <div class="log-dtl-section">
          <div class="log-dtl-section-title">메타데이터</div>
          <div class="log-dtl-meta-grid">
            <div class="log-dtl-meta-row"><span class="log-dtl-meta-key">timestamp</span><span class="log-dtl-meta-val">${entry.ts}</span></div>
            <div class="log-dtl-meta-row"><span class="log-dtl-meta-key">latency</span><span class="log-dtl-meta-val ${entry.latencyMs > 1000 ? "log-dtl-meta-warn" : ""}">${entry.latencyMs}ms</span></div>
            <div class="log-dtl-meta-row"><span class="log-dtl-meta-key">userId</span><span class="log-dtl-meta-val">${entry.userId}</span></div>
          </div>
        </div>
      </div>
    `;

    // Bind address link clicks in detail
    detailPanel.querySelectorAll(".log-dtl-addr-link").forEach(el => {
      el.addEventListener("click", () => {
        const nav = (el as HTMLElement).dataset.nav;
        const addr = Number((el as HTMLElement).dataset["addr"] ?? "0");
        if (nav === "service") navigateTo("service", { svcAddr: addr });
        else if (nav === "permission") navigateTo("permission", { permAddr: addr });
      });
    });

    // 비교 섹션을 선택된 로그 값으로 갱신
    renderComparison(entry);
  }

  // Try API first, fall back to in-memory sample data
  loadFromApi().catch(() => {
    showOffline();
    logs = generateSampleLogs(ver);
    renderLogList();
  });
}
