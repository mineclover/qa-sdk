/**
 * 전역 상태 — Prefix 제작에서 만든 축/composite를 DSL 빌더에서 참조
 *
 * CompositeDef.dims는 leaf axis ID 또는 다른 composite ID를 참조할 수 있다.
 * resolve 시 재귀적으로 capacity를 계산한다.
 */

import { calcWeights } from "weighted-index";

export interface EnumAxis {
  id: string;
  entries: string[];
  capacity: number;
}

export interface CompositeDef {
  id: string;
  dims: string[];   // leaf axis id 또는 composite id (순서 = 축 배치)
  owner: string;
}

export interface ResolvedDef {
  id: string;
  kind: "leaf" | "composite";
  capacity: number;
  shape: number[];
  strides: number[];
  bits: number;
  dims: string[];
  owner: string;
}

export interface AppStore {
  axes: EnumAxis[];
  composites: CompositeDef[];
  listeners: Set<() => void>;
}

export const store: AppStore = {
  axes: [],
  composites: [],
  listeners: new Set(),
};

export function notify() {
  for (const fn of store.listeners) fn();
}

export function subscribe(fn: () => void) {
  store.listeners.add(fn);
  return () => store.listeners.delete(fn);
}

/**
 * 모든 prefix(leaf + composite)를 재귀 resolve.
 * composite의 dim이 다른 composite를 참조할 수 있으므로 재귀 처리.
 */
export function resolveAll(): Map<string, ResolvedDef> {
  const result = new Map<string, ResolvedDef>();

  // leaf axes 먼저
  for (const a of store.axes) {
    result.set(a.id, {
      id: a.id,
      kind: "leaf",
      capacity: a.capacity,
      shape: [a.capacity],
      strides: [1],
      bits: Math.ceil(Math.log2(a.capacity || 1)),
      dims: [],
      owner: "",
    });
  }

  // composite 재귀 resolve
  const resolving = new Set<string>(); // 순환 참조 감지

  const resolve = (id: string): ResolvedDef | null => {
    if (result.has(id)) return result.get(id)!;
    if (resolving.has(id)) return null; // 순환 참조
    resolving.add(id);

    const comp = store.composites.find((c) => c.id === id);
    if (!comp) return null;

    const dimCaps: number[] = [];
    for (const dimId of comp.dims) {
      const dimR = resolve(dimId);
      if (!dimR) { resolving.delete(id); return null; }
      dimCaps.push(dimR.capacity);
    }

    const shape = dimCaps;
    const strides = calcWeights(shape);
    const capacity = shape.reduce((a, b) => a * b, 1);
    const bits = Math.ceil(Math.log2(capacity || 1));

    const r: ResolvedDef = {
      id: comp.id, kind: "composite", capacity, shape, strides, bits,
      dims: comp.dims, owner: comp.owner,
    };
    result.set(id, r);
    resolving.delete(id);
    return r;
  };

  for (const c of store.composites) resolve(c.id);
  return result;
}

/**
 * dim picker에서 선택 가능한 항목 목록.
 * leaf axis + 이미 존재하는 composite (자기 자신 제외).
 */
export function availableDims(excludeId?: string): { id: string; kind: "leaf" | "composite"; label: string }[] {
  const items: { id: string; kind: "leaf" | "composite"; label: string }[] = [];
  const allResolved = resolveAll();
  for (const a of store.axes) {
    const bits = Math.ceil(Math.log2(a.capacity || 1));
    items.push({ id: a.id, kind: "leaf", label: `${a.id} (leaf, ${a.entries.length}ent, ${bits}b)` });
  }
  for (const c of store.composites) {
    if (c.id === excludeId) continue;
    const bits = allResolved.get(c.id)?.bits ?? 0;
    items.push({ id: c.id, kind: "composite", label: `${c.id} (comp, [${c.dims.join(",")}], ${bits}b)` });
  }
  return items;
}

// ── 프리셋 ──────────────────────────────────────────────────

export const PRESETS: Record<string, { axes: EnumAxis[]; composites: CompositeDef[] }> = {
  "qa-sdk-git": {
    axes: [
      { id: "pkg", entries: [
        "weighted-index", "bit-index", "index-meta", "permission-engine",
        "core", "engine", "sdk", "store", "registry-client", "event-catalog", "pino",
        "ingest-server", "registry-service", "decode-service", "gate-service", "query-service",
        "platform-demo", "browser-sdk", "viz-web", "demo-snapshot",
      ], capacity: 67108864 },
      { id: "semver", entries: ["0.1.0", "0.2.0"], capacity: 32768 },
      { id: "cc_type", entries: ["feat", "fix", "refactor", "docs", "test", "chore"], capacity: 1024 },
      { id: "tier", entries: ["foundation", "platform", "service", "app", "data"], capacity: 8192 },
      { id: "runtime", entries: ["library", "server", "browser"], capacity: 64 },
    ],
    composites: [
      { id: "change_map", dims: ["pkg", "semver", "cc_type"], owner: "registry" },
      { id: "pkg_class", dims: ["pkg", "tier", "runtime"], owner: "registry" },
    ],
  },
  "shopping-platform": {
    axes: [
      { id: "env", entries: ["dev", "stage", "prod", "test", "local"], capacity: 8 },
      { id: "region", entries: ["asia", "usa"], capacity: 4 },
      { id: "svc_name", entries: ["shopping-web", "shopping-backend", "auth", "payment", "gateway"], capacity: 8 },
      { id: "namespace", entries: ["shop", "cms"], capacity: 4 },
      { id: "perm_svc", entries: ["40","41","42","43","44","45","46","47","48","49"], capacity: 16 },
      { id: "role", entries: ["admin", "developer", "operator", "viewer", "readonly"], capacity: 8 },
    ],
    composites: [
      { id: "service", dims: ["env", "region", "svc_name", "namespace"], owner: "infra" },
      // permission은 composite(service) 대신 leaf(perm_svc)를 참조하는 예시
      { id: "permission", dims: ["perm_svc", "role"], owner: "auth" },
    ],
  },
};

export function loadPreset(key: string) {
  const p = PRESETS[key];
  if (!p) return;
  store.axes = p.axes.map((a) => ({ ...a, entries: [...a.entries] }));
  store.composites = p.composites.map((c) => ({ ...c, dims: [...c.dims] }));
  notify();
}

// ── Snapshot 교환 ──────────────────────────────────────────

export interface SchemaSnapshot {
  id: string;
  axes: { id: string; entries: string[]; capacity: number }[];
  composites: { id: string; dims: string[]; owner: string }[];
}

export function toSnapshot(id: string): SchemaSnapshot {
  return {
    id,
    axes: store.axes.map((a) => ({ id: a.id, entries: [...a.entries], capacity: a.capacity })),
    composites: store.composites.map((c) => ({ id: c.id, dims: [...c.dims], owner: c.owner })),
  };
}

export function fromSnapshot(snapshot: SchemaSnapshot) {
  store.axes = snapshot.axes.map((a) => ({
    id: a.id,
    entries: [...a.entries],
    capacity: a.capacity,
  }));
  store.composites = snapshot.composites.map((c) => ({
    id: c.id,
    dims: [...c.dims],
    owner: c.owner,
  }));
  notify();
}
