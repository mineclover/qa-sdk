import { WeightedIndex, calcWeights } from "weighted-index";

// ═══════════════════════════════════════════════════════════════════════════
//  4D 권한 모델  —  resource × action × role × env
// ═══════════════════════════════════════════════════════════════════════════

// ── Dimension value lists (per version) ───────────────────────────────────

export const RESOURCES = [
  "document", "api", "database", "file_storage",
  "report", "admin_panel", "config", "audit_log",
] as const;                                             // v1: 8

export const RESOURCES_V2 = [
  ...RESOURCES, "webhook", "queue",
] as const;                                             // v2+: 10

export const ACTIONS = ["read", "write", "delete", "manage"] as const; // all versions: 4

export const ROLES = [
  "guest", "viewer", "editor", "admin", "super_admin",
] as const;                                             // v1/v2: 5

export const ROLES_V3 = [
  ...ROLES, "owner",
] as const;                                             // v3: 6

export const ENVS = [
  "production", "staging", "development", "testing",
] as const;                                             // all versions: 4

export type Resource   = (typeof RESOURCES)[number];
export type ResourceV2 = (typeof RESOURCES_V2)[number];
export type Action     = (typeof ACTIONS)[number];
export type Role       = (typeof ROLES)[number];
export type RoleV3     = (typeof ROLES_V3)[number];
export type Env        = (typeof ENVS)[number];

// ── Korean labels ─────────────────────────────────────────────────────────

export const RESOURCE_KO: Record<ResourceV2, string> = {
  document:    "문서",
  api:         "API",
  database:    "데이터베이스",
  file_storage:"파일 저장소",
  report:      "보고서",
  admin_panel: "관리자 패널",
  config:      "설정",
  audit_log:   "감사 로그",
  webhook:     "웹훅",
  queue:       "큐",
};

export const ACTION_KO: Record<Action, string> = {
  read:   "읽기",
  write:  "쓰기",
  delete: "삭제",
  manage: "관리",
};

export const ROLE_KO: Record<RoleV3, string> = {
  guest:       "게스트",
  viewer:      "뷰어",
  editor:      "편집자",
  admin:       "관리자",
  super_admin: "슈퍼 관리자",
  owner:       "소유자",
};

export const ENV_KO: Record<Env, string> = {
  production:  "운영",
  staging:     "스테이징",
  development: "개발",
  testing:     "테스트",
};

// ── Dimension definition ──────────────────────────────────────────────────

export interface DimDef {
  key:    string;
  label:  string;
  values: readonly string[];
  size:   number;
  koLabel(v: string): string;
}

export type DimKey = "resource" | "action" | "role" | "env";
export const ALL_DIMS: DimKey[] = ["resource", "action", "role", "env"];

// Default DIMS (v1 — backward compat for concept/list/address pages)
export const DIMS: Record<DimKey, DimDef> = {
  resource: {
    key: "resource", label: "리소스",
    values: RESOURCES, size: RESOURCES.length,
    koLabel: (v) => RESOURCE_KO[v as ResourceV2] ?? v,
  },
  action: {
    key: "action", label: "액션",
    values: ACTIONS, size: ACTIONS.length,
    koLabel: (v) => ACTION_KO[v as Action] ?? v,
  },
  role: {
    key: "role", label: "역할",
    values: ROLES, size: ROLES.length,
    koLabel: (v) => ROLE_KO[v as RoleV3] ?? v,
  },
  env: {
    key: "env", label: "환경",
    values: ENVS, size: ENVS.length,
    koLabel: (v) => ENV_KO[v as Env] ?? v,
  },
};

// ── Schema versions ───────────────────────────────────────────────────────

export interface VersionDef {
  v:            string;
  shape:        readonly number[];
  wi:           WeightedIndex;
  weights:      readonly number[];
  size:         number;
  changelog:    string;
  dims:         Record<DimKey, DimDef>;
  /** Values added in THIS version (empty set = nothing new) */
  newDimValues: Partial<Record<DimKey, ReadonlySet<string>>>;
}

function makeDims(
  resources: readonly string[],
  roles:     readonly string[],
): Record<DimKey, DimDef> {
  return {
    resource: {
      key: "resource", label: "리소스",
      values: resources, size: resources.length,
      koLabel: (v) => RESOURCE_KO[v as ResourceV2] ?? v,
    },
    action: {
      key: "action", label: "액션",
      values: ACTIONS, size: ACTIONS.length,
      koLabel: (v) => ACTION_KO[v as Action] ?? v,
    },
    role: {
      key: "role", label: "역할",
      values: roles, size: roles.length,
      koLabel: (v) => ROLE_KO[v as RoleV3] ?? v,
    },
    env: {
      key: "env", label: "환경",
      values: ENVS, size: ENVS.length,
      koLabel: (v) => ENV_KO[v as Env] ?? v,
    },
  };
}

function makeVersion(
  v: string,
  resources: readonly string[],
  roles: readonly string[],
  changelog: string,
  newDimValues: Partial<Record<DimKey, ReadonlySet<string>>>,
): VersionDef {
  const shape   = [resources.length, ACTIONS.length, roles.length, ENVS.length];
  const wi      = new WeightedIndex(shape, ["resource", "action", "role", "env"]);
  const weights = calcWeights(shape);
  return {
    v, shape, wi, weights,
    size: shape.reduce((p, n) => p * n, 1),
    changelog,
    dims: makeDims(resources, roles),
    newDimValues,
  };
}

export const SCHEMA_VERSIONS: VersionDef[] = [
  makeVersion(
    "v1", RESOURCES, ROLES,
    "초기 스키마 — resource×8, role×5",
    {},
  ),
  makeVersion(
    "v2", RESOURCES_V2, ROLES,
    "resource +2 (webhook, queue) — 가중치 불변, 기존 ID 보존",
    { resource: new Set(["webhook", "queue"]) },
  ),
  makeVersion(
    "v3", RESOURCES_V2, ROLES_V3,
    "role +1 (owner) — 가중치 변경, 좌표→ID 재계산으로 동등",
    { role: new Set(["owner"]) },
  ),
];

/** 버전 문자열로 VersionDef 조회 */
export function getVersion(v: string): VersionDef {
  return SCHEMA_VERSIONS.find((vd) => vd.v === v) ?? SCHEMA_VERSIONS[0];
}

// ── Backward-compat exports (v1) ──────────────────────────────────────────

export const WI4      = SCHEMA_VERSIONS[0].wi;
export const WEIGHTS4 = SCHEMA_VERSIONS[0].weights;

// ── Cell data ─────────────────────────────────────────────────────────────

export interface CellData {
  id4:     number;
  xIdx:    number;
  yIdx:    number;
  xVal:    string;
  yVal:    string;
  coords4: [number, number, number, number];
  isNew:   boolean;  // true if this cell's x or y value is new in the current version
}

export interface SliceSpec {
  xDim:  DimKey;
  yDim:  DimKey;
  fixed: Partial<Record<DimKey, number>>;
}

export function buildSliceGrid(spec: SliceSpec, vDef: VersionDef): CellData[][] {
  const { xDim, yDim, fixed } = spec;
  const dims  = vDef.dims;
  const xDef  = dims[xDim];
  const yDef  = dims[yDim];
  const newX  = vDef.newDimValues[xDim] ?? new Set();
  const newY  = vDef.newDimValues[yDim] ?? new Set();

  const fixedCoords: Record<DimKey, number> = {
    resource: fixed.resource ?? 1,
    action:   fixed.action   ?? 1,
    role:     fixed.role     ?? 1,
    env:      fixed.env      ?? 1,
  };

  return Array.from({ length: yDef.size }, (_y, yi) =>
    Array.from({ length: xDef.size }, (_x, xi) => {
      const xVal = String(xDef.values[xi]);
      const yVal = String(yDef.values[yi]);
      const coords = { ...fixedCoords, [xDim]: xi + 1, [yDim]: yi + 1 };
      const id4 = vDef.wi.encode([
        coords.resource, coords.action, coords.role, coords.env,
      ]);
      return {
        id4,
        xIdx: xi + 1,
        yIdx: yi + 1,
        xVal,
        yVal,
        coords4: [coords.resource, coords.action, coords.role, coords.env],
        isNew: newX.has(xVal) || newY.has(yVal),
      };
    })
  );
}
