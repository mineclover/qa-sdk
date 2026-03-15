// API response types used by the frontend

export interface ServiceCell { xPos: number; yPos: number; value: number }
export interface ServiceLabel { id: string; ko: string; pos: number }
export interface ServiceFixed { id: string; ko: string; pos: number }
export interface ServiceCellsResponse {
  xDim: string; yDim: string;
  xLabels: ServiceLabel[]; yLabels: ServiceLabel[];
  fixed: Record<string, ServiceFixed>;
  cells: ServiceCell[];
}
export interface ServiceDecodeResponse {
  env: string; region: string; svc_name: string; namespace: string;
  envKo: string; regionKo: string; svcNameKo: string; namespaceKo: string;
}

export interface PermSvcLabel { pos: number; svcValue: number; svcName: string; env: string; region: string; namespace: string }
export interface RoleLabel { pos: number; id: string; ko: string }
export interface PermCell { svcPos: number; rolePos: number; value: number }
export interface PermCellsResponse {
  ver: string; roleStride: number; prefix: string; maxValue: number;
  svcLabels: PermSvcLabel[]; roleLabels: RoleLabel[]; cells: PermCell[];
}
export interface PermDecodeResponse {
  permValue: number; perm_svc: number; role: string;
  svc: { env: string; region: string; svc_name: string; namespace: string };
  address: string;
}

export interface EvtSvcLabel { pos: number; svcValue: number; svcName: string; env: string }
export interface EvtLabel { pos: number; id: string; ko: string }
export interface EvtCell { svcPos: number; evtPos: number; value: number }
export interface EvtCellsResponse {
  ver: string; svcStride: number; prefix: string; maxValue: number;
  initiator: string; svcLabels: EvtSvcLabel[]; eventLabels: EvtLabel[]; cells: EvtCell[];
}
export interface EvtDecodeResponse {
  evtValue: number; event_svc: number; event_name: string; initiator: string;
  svc: { env: string; region: string; svc_name: string; namespace: string };
  address: string;
}

// API base URL — empty in dev (Vite proxy), Worker URL in production
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function ensureOk(r: Response): Promise<Response> {
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${body || r.statusText}`);
  }
  return r;
}

export async function fetchServiceCells(params: {
  xDim: string; yDim: string; fixed: Record<string, number>;
}): Promise<ServiceCellsResponse> {
  const q = new URLSearchParams({ xDim: params.xDim, yDim: params.yDim });
  for (const [k, v] of Object.entries(params.fixed)) q.set(`fix_${k}`, String(v));
  const r = await fetch(`${API_BASE}/api/service/cells?${q}`).then(ensureOk);
  return r.json();
}

export async function fetchServiceDecode(value: number): Promise<ServiceDecodeResponse> {
  const r = await fetch(`${API_BASE}/api/service/decode/${value}`).then(ensureOk);
  return r.json();
}

export async function fetchPermCells(ver = "v2"): Promise<PermCellsResponse> {
  const r = await fetch(`${API_BASE}/api/permission/cells?ver=${ver}`).then(ensureOk);
  return r.json();
}

export async function fetchPermDecode(value: number, ver = "v2"): Promise<PermDecodeResponse> {
  const r = await fetch(`${API_BASE}/api/permission/decode/${value}?ver=${ver}`).then(ensureOk);
  return r.json();
}

export async function fetchEvtCells(initiator: string, ver = "v2"): Promise<EvtCellsResponse> {
  const r = await fetch(`${API_BASE}/api/event/cells?initiator=${initiator}&ver=${ver}`).then(ensureOk);
  return r.json();
}

export async function fetchEvtDecode(value: number, ver = "v2"): Promise<EvtDecodeResponse> {
  const r = await fetch(`${API_BASE}/api/event/decode/${value}?ver=${ver}`).then(ensureOk);
  return r.json();
}

// ─── Scenario types ────────────────────────────────────────────────────────

export interface FeatureInfo {
  id: string; name: string; svcName: string; svcAddr: string;
  hasAccess: boolean; permAddr: string; permValue: number;
  grantedRoles: string[]; grantedRolesKo: string[];
}

export interface SimStep {
  featureNum: number; featureId: string; featureName: string; hasAccess: boolean;
  perm: {
    addr: string; value: number; status: "ok" | "denied";
    svcName: string; svcNameKo: string; roleName: string; roleNameKo: string;
    grantedAddrs: string[]; deniedReason: string;
  };
  event: {
    addr: string; value: number; status: "ok" | "denied";
    svcName: string; svcNameKo: string; eventName: string; eventNameKo: string; initiator: string;
  } | null;
}

export interface ScenarioResponse {
  role: string; roleKo: string;
  user: { name: string; role: string; roleKo: string; mainPermAddr: string; mainPermValue: number };
  features: FeatureInfo[];
  simulation: SimStep[];
}

export interface FeaturesResponse {
  features: Array<{ id: string; name: string; grantedRoles: string[]; grantedRolesKo: string[] }>;
  roles: Array<{ id: string; ko: string }>;
  matrix: boolean[][];
}

export async function fetchScenario(role: string, ver = "v2"): Promise<ScenarioResponse> {
  const r = await fetch(`${API_BASE}/api/scenario?role=${role}&ver=${ver}`).then(ensureOk);
  return r.json();
}

export async function fetchFeatures(ver = "v2"): Promise<FeaturesResponse> {
  const r = await fetch(`${API_BASE}/api/features?ver=${ver}`).then(ensureOk);
  return r.json();
}

export interface GrantRow {
  featureId: string; featureName: string;
  permAddr: string; permValue: number;
  svcValue: number; svcNameKo: string;
  env: string; envKo: string;
  region: string; regionKo: string;
  namespace: string; namespaceKo: string;
  role: string; roleKo: string;
  granted: boolean; grantedRoles: string[]; grantedRolesKo: string[];
  eventAddr: string | null; eventValue: number | null;
  eventNameKo: string | null; eventType: "success" | "fail" | "none";
}
export interface GrantTableResponse { rows: GrantRow[]; }

export async function fetchGrantTable(ver = "v2"): Promise<GrantTableResponse> {
  const r = await fetch(`${API_BASE}/api/grant-table?ver=${ver}`).then(ensureOk);
  return r.json();
}

export interface GrantPatchResponse {
  featureId: string;
  grantedRoles: string[];
  grantedRolesKo: string[];
}

export async function patchGrant(featureId: string, role: string, granted: boolean): Promise<GrantPatchResponse> {
  const r = await fetch(`${API_BASE}/api/grants`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ featureId, role, granted }),
  }).then(ensureOk);
  return r.json();
}

export async function patchGrantBatch(
  changes: Array<{ featureId: string; role: string; granted: boolean }>
): Promise<{ grants: Record<string, string[]> }> {
  const r = await fetch(`${API_BASE}/api/grants/batch`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ changes }),
  }).then(ensureOk);
  return r.json();
}

export async function resetGrants(): Promise<void> {
  await fetch(`${API_BASE}/api/grants/reset`, { method: "POST" }).then(ensureOk);
}
