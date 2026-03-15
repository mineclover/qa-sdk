// ═══════════════════════════════════════════════════════════════════════════
//  로깅 통합 — 인덱스 주소를 활용한 구조화 로그 시뮬레이터
// ═══════════════════════════════════════════════════════════════════════════

import { serializeAddress } from "weighted-index";
import { API_BASE } from "../registry.js";

type Ver = "v1" | "v2";

// ── Dimension metadata ────────────────────────────────────────────────────

interface DimMeta {
  key: string;
  label: string;
  values: { idx1: number; id: string; ko: string }[];
}

const SVC_DIMS: DimMeta[] = [
  {
    key: "env", label: "환경",
    values: [
      { idx1: 1, id: "dev",   ko: "개발" },
      { idx1: 2, id: "stage", ko: "스테이지" },
      { idx1: 3, id: "prod",  ko: "운영" },
      { idx1: 4, id: "test",  ko: "테스트" },
      { idx1: 5, id: "local", ko: "로컬" },
    ],
  },
  {
    key: "region", label: "리전",
    values: [
      { idx1: 1, id: "asia", ko: "아시아" },
      { idx1: 2, id: "usa",  ko: "미국" },
    ],
  },
  {
    key: "svc_name", label: "서비스",
    values: [
      { idx1: 1, id: "shopping-web",     ko: "쇼핑웹" },
      { idx1: 2, id: "shopping-backend", ko: "쇼핑BE" },
      { idx1: 3, id: "auth",             ko: "인증" },
      { idx1: 4, id: "payment",          ko: "결제" },
      { idx1: 5, id: "gateway",          ko: "GW" },
    ],
  },
  {
    key: "namespace", label: "네임스페이스",
    values: [
      { idx1: 1, id: "shop", ko: "쇼핑몰" },
      { idx1: 2, id: "cms",  ko: "CMS" },
    ],
  },
];

const SVC_STRIDES = [20, 10, 2, 1];

function encodeSvc(coords: number[]): number {
  let v = 0;
  for (let i = 0; i < coords.length; i++) v += (coords[i] - 1) * SVC_STRIDES[i];
  return v;
}

function decodeSvc(v: number): number[] {
  const coords: number[] = [];
  let remainder = v;
  for (const s of SVC_STRIDES) {
    coords.push(Math.floor(remainder / s) + 1);
    remainder %= s;
  }
  return coords;
}

// ── Permission dimension metadata ────────────────────────────────────────

const SVC_NAMES = [
  { id: "shopping-web", ko: "쇼핑웹" }, { id: "shopping-backend", ko: "쇼핑BE" },
  { id: "auth", ko: "인증" }, { id: "payment", ko: "결제" }, { id: "gateway", ko: "GW" },
];
const NS = [{ id: "shop", ko: "쇼핑몰" }, { id: "cms", ko: "CMS" }];

interface PermSvcMeta { pos: number; svcId: string; svcKo: string; nsId: string; nsKo: string }
const PERM_SVCS: PermSvcMeta[] = [];
{ let p = 1; for (const s of SVC_NAMES) for (const n of NS) PERM_SVCS.push({ pos: p++, svcId: s.id, svcKo: s.ko, nsId: n.id, nsKo: n.ko }); }

interface RoleMeta { idx1: number; id: string; ko: string }
const ROLES_V1: RoleMeta[] = [
  { idx1: 1, id: "admin", ko: "관리자" }, { idx1: 2, id: "developer", ko: "개발자" },
  { idx1: 3, id: "operator", ko: "운영자" }, { idx1: 4, id: "viewer", ko: "뷰어" },
  { idx1: 5, id: "readonly", ko: "읽기전용" },
];
const ROLES_V2: RoleMeta[] = [
  { idx1: 1, id: "admin", ko: "관리자" }, { idx1: 2, id: "developer", ko: "개발자" },
  { idx1: 3, id: "operator", ko: "운영자" }, { idx1: 4, id: "customer", ko: "고객" },
  { idx1: 5, id: "viewer", ko: "뷰어" }, { idx1: 6, id: "readonly", ko: "읽기전용" },
];

function rolesFor(v: Ver) { return v === "v1" ? ROLES_V1 : ROLES_V2; }
function roleStride(v: Ver) { return v === "v1" ? 5 : 6; }

function decodePerm(addr: number, v: Ver): { svc: PermSvcMeta; role: RoleMeta } | null {
  const rs = roleStride(v);
  const svc = PERM_SVCS.find((s) => s.pos === Math.floor(addr / rs) + 1);
  const role = rolesFor(v).find((r) => r.idx1 === (addr % rs) + 1);
  return svc && role ? { svc, role } : null;
}

// ── Event dimension metadata ─────────────────────────────────────────────

interface EvtMeta { idx1: number; id: string; ko: string }
const EVENTS_V1: EvtMeta[] = [
  { idx1: 1, id: "user.login", ko: "로그인" }, { idx1: 2, id: "user.logout", ko: "로그아웃" },
  { idx1: 3, id: "order.created", ko: "주문생성" }, { idx1: 4, id: "order.paid", ko: "주문결제" },
  { idx1: 5, id: "payment.failed", ko: "결제실패" }, { idx1: 6, id: "session.expired", ko: "세션만료" },
  { idx1: 7, id: "config.changed", ko: "설정변경" },
];
const EVENTS_V2: EvtMeta[] = [
  ...EVENTS_V1,
  { idx1: 8, id: "payment.cancel_requested", ko: "취소요청" },
  { idx1: 9, id: "payment.cancel_approved", ko: "취소승인" },
];
const INITIATORS = [{ idx1: 1, id: "web", ko: "웹" }, { idx1: 2, id: "mobile", ko: "모바일" }];

function eventsFor(v: Ver) { return v === "v1" ? EVENTS_V1 : EVENTS_V2; }
function evtStrideFor(v: Ver) { return v === "v1" ? 14 : 18; }

function decodeEvt(addr: number, v: Ver) {
  const es = evtStrideFor(v);
  const svc = PERM_SVCS.find((s) => s.pos === Math.floor(addr / es) + 1);
  const rem = addr % es;
  const event = eventsFor(v).find((e) => e.idx1 === Math.floor(rem / 2) + 1);
  const initiator = INITIATORS.find((i) => i.idx1 === (rem % 2) + 1);
  return svc && event && initiator ? { svc, event, initiator } : null;
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

const RANDOM_ACTIONS: { level: LogLevel; action: string; message: string }[] = [
  { level: "INFO",  action: "page.view",         message: "상품 상세 페이지 조회" },
  { level: "INFO",  action: "cart.add",           message: "장바구니 추가 — SKU-8823" },
  { level: "INFO",  action: "order.submit",       message: "주문 접수 완료 — KRW 32,000" },
  { level: "DEBUG", action: "cache.hit",          message: "Redis 캐시 히트 — key=product:42" },
  { level: "DEBUG", action: "db.query",           message: "SELECT COUNT(*) FROM orders WHERE status = 'pending'" },
  { level: "WARN",  action: "latency.spike",      message: "P99 레이턴시 200ms 초과 — 현재 312ms" },
  { level: "WARN",  action: "disk.usage",         message: "디스크 사용량 85% 도달 — /data 파티션" },
  { level: "ERROR", action: "payment.timeout",    message: "PG 응답 타임아웃 — 30s 초과" },
  { level: "ERROR", action: "db.connection.fail", message: "DB 커넥션 풀 소진 — max_connections=100" },
  { level: "INFO",  action: "user.signup",        message: "신규 회원 가입 — OAuth(Google)" },
  { level: "INFO",  action: "deploy.complete",    message: "배포 완료 — v2.5.0-rc1 (canary 100%)" },
  { level: "WARN",  action: "auth.suspicious",    message: "비정상 접근 패턴 — 다중 IP 로그인 시도" },
];

function generateRandomLog(ver: Ver): LogEntry {
  const rs = roleStride(ver);
  const es = evtStrideFor(ver);
  const pick = RANDOM_ACTIONS[Math.floor(Math.random() * RANDOM_ACTIONS.length)];
  const envIdx = Math.floor(Math.random() * 5) + 1;
  const regIdx = Math.floor(Math.random() * 2) + 1;
  const svcIdx = Math.floor(Math.random() * 5) + 1;
  const nsIdx  = Math.floor(Math.random() * 2) + 1;
  const svcAddr = encodeSvc([envIdx, regIdx, svcIdx, nsIdx]);

  const hasPerm = Math.random() > 0.4;
  const permAddr = hasPerm ? Math.floor(Math.random() * 10) * rs + Math.floor(Math.random() * rs) : null;

  const hasEvt = Math.random() > 0.5;
  const evtCount = ver === "v1" ? 7 : 9;
  const evtAddr = hasEvt ? Math.floor(Math.random() * 10) * es + Math.floor(Math.random() * evtCount) * 2 + Math.floor(Math.random() * 2) : null;

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
      activeFilters.has(lv) ? activeFilters.delete(lv) : activeFilters.add(lv);
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
    { id: "prod", label: "prod", idx1: 3 },
    { id: "stage", label: "stage", idx1: 2 },
    { id: "dev", label: "dev", idx1: 1 },
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
  const svcOpts: { id: string; label: string; range: [number, number] | null }[] = [
    { id: "all", label: "전체", range: null },
    { id: "shopping-web",     label: "쇼핑웹",  range: [0, 19] },
    { id: "shopping-backend", label: "쇼핑BE",  range: [20, 39] },
    { id: "auth",             label: "인증",    range: [40, 59] },
    { id: "payment",          label: "결제",    range: [60, 79] },
    { id: "gateway",          label: "GW",      range: [80, 99] },
  ];

  const svcLbl = document.createElement("span");
  svcLbl.className = "log-addr-label";
  svcLbl.textContent = "서비스";
  addrBar.appendChild(svcLbl);

  for (const opt of svcOpts) {
    const btn = document.createElement("button");
    btn.className = "log-addr-btn" + (opt.id === "all" ? " log-addr-btn-active" : "");
    btn.innerHTML = opt.range ? `${opt.label} <span class="log-addr-range">${opt.range[0]}–${opt.range[1]}</span>` : opt.label;
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
  comparison.innerHTML = `
    <h3 class="log-comp-title">주소 기반 로그 vs 문자열 로그</h3>
    <div class="log-comp-grid">
      <div class="log-comp-card log-comp-before">
        <div class="log-comp-card-label">기존 — 문자열 기반</div>
        <pre class="log-comp-code">{
  "service": "shopping-web",
  "env": "prod", "region": "asia", "ns": "shop",
  "permission": "shopping-web:developer",
  "event": "payment:purchase:web",
  "action": "payment.initiate"
}</pre>
        <div class="log-comp-stat"><span class="log-comp-stat-label">페이로드</span><span class="log-comp-stat-val log-comp-stat-bad">~210 bytes</span></div>
      </div>
      <div class="log-comp-arrow">&#x2192;</div>
      <div class="log-comp-card log-comp-after">
        <div class="log-comp-card-label">인덱스 — 주소 기반</div>
        <pre class="log-comp-code">{
  "svc": ${encodeSvc([3,1,1,1])},
  "perm": ${(1-1)*roleStride(ver)+1},
  "evt": ${(4-1)*evtStrideFor(ver)+(3-1)*2},
  "action": "payment.initiate"
}</pre>
        <div class="log-comp-stat"><span class="log-comp-stat-label">페이로드</span><span class="log-comp-stat-val log-comp-stat-good">~65 bytes</span></div>
      </div>
    </div>
    <div class="log-comp-benefits">
      <div class="log-comp-benefit"><span class="log-comp-benefit-num">~69%</span><span class="log-comp-benefit-label">페이로드 절감</span></div>
      <div class="log-comp-benefit"><span class="log-comp-benefit-num">O(1)</span><span class="log-comp-benefit-label">주소 비교 연산</span></div>
      <div class="log-comp-benefit"><span class="log-comp-benefit-num">범위 쿼리</span><span class="log-comp-benefit-label">svc 40~59 = payment 전체</span></div>
    </div>
  `;
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
  const exPermD = decodePerm(exPerm, ver)!;

  const exEvt = ver === "v1" ? 46 : 58;
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
          <span class="log-anat-shape">shape [10, ${ver === "v1" ? 7 : 9}, 2]</span>
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
      const opt = svcOpts.find(o => o.id === activeSvc);
      if (opt?.range && (entry.svcAddr < opt.range[0] || entry.svcAddr > opt.range[1])) return false;
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
        const addr = +(el as HTMLElement).dataset.addr!;
        if (nav === "service") navigateTo("service", { svcAddr: addr });
        else if (nav === "permission") navigateTo("permission", { permAddr: addr });
      });
    });
  }

  // Try API first, fall back to in-memory sample data
  loadFromApi().catch(() => {
    showOffline();
    logs = generateSampleLogs(ver);
    renderLogList();
  });
}
