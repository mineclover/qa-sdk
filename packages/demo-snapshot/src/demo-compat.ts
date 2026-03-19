/**
 * demo-compat.ts — DEMO_CATALOG에서 기존 상수/함수를 파생하는 하위 호환 레이어.
 *
 * 의존 방향: demo-catalog → demo-compat → demo-snapshot/demo-domains
 */

import { DEMO_CATALOG, type Axis, type Domain, type AxisVersionSnapshot, type VersionedAxis } from "./demo-catalog.js";

// ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

const C = DEMO_CATALOG;

/** 축의 특정 버전 스냅샷을 가져온다. as const satisfies 타입을 우회. */
function getAxisSnap(axisId: string, ver: string): AxisVersionSnapshot {
  const axis = (C.axes as Record<string, VersionedAxis>)[axisId];
  return axis.versions[ver];
}

function axisCap(axisId: string, ver: string): number {
  const snap = getAxisSnap(axisId, ver);
  return snap.capacity ?? snap.entries.length;
}

function computeStrides(shape: readonly number[]): readonly number[] {
  const strides: number[] = new Array(shape.length);
  strides[shape.length - 1] = 1;
  for (let i = shape.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }
  return strides;
}

function catalogAxisToLegacy(axisId: string, ver: string, overrideId?: string): Axis {
  const axis = (C.axes as Record<string, VersionedAxis>)[axisId];
  const snap = axis.versions[ver];
  return {
    id: overrideId ?? axis.id,
    name: axis.name,
    entries: snap.entries,
    ...(snap.capacity !== undefined ? { capacity: snap.capacity } : {}),
    ko: { ...(snap.ko ?? {}) },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  demo-snapshot.ts 파생 상수
// ══════════════════════════════════════════════════════════════════════════════

export const DEMO_ENVS = C.axes.env.versions.v1.entries;
export const DEMO_REGIONS = C.axes.region.versions.v1.entries;
export const DEMO_SVCS = C.axes.svc_name.versions.v1.entries;
export const DEMO_NSS = C.axes.namespace.versions.v1.entries;

export const DEMO_ROLES_V1 = C.axes.role.versions.v1.entries;
export const DEMO_ROLES_V2 = C.axes.role.versions.v2.entries;
export const DEMO_ROLES_V3 = C.axes.role.versions.v3.entries;
export const DEMO_ROLES_V4 = C.axes.role.versions.v4.entries;

export const DEMO_EVENTS_V1 = C.axes.event_name.versions.v1.entries;
export const DEMO_EVENTS_V2 = C.axes.event_name.versions.v2.entries;
export const DEMO_EVENTS_V3 = C.axes.event_name.versions.v3.entries;
export const DEMO_EVENTS_V4 = C.axes.event_name.versions.v4.entries;

export const DEMO_ROLE_CAP = {
  v1: axisCap("role", "v1"),
  v2: axisCap("role", "v2"),
  v3: axisCap("role", "v3"),
  v4: axisCap("role", "v4"),
} as const;

export const DEMO_EVENT_CAP = {
  v1: axisCap("event_name", "v1"),
  v2: axisCap("event_name", "v2"),
  v3: axisCap("event_name", "v3"),
  v4: axisCap("event_name", "v4"),
} as const;

export const DEMO_INITIATORS = C.axes.initiator.versions.v1.entries;

/** 한국어 라벨 (모든 axis의 ko 합산). legacy key 매핑: svc→svc_name, ns→namespace */
export const DEMO_KO = {
  env: { ...C.axes.env.versions.v1.ko } as Record<string, string>,
  region: { ...C.axes.region.versions.v1.ko } as Record<string, string>,
  svc: { ...C.axes.svc_name.versions.v1.ko } as Record<string, string>,
  ns: { ...C.axes.namespace.versions.v1.ko } as Record<string, string>,
  role: (() => {
    const merged: Record<string, string> = {};
    for (const ver of Object.values(C.axes.role.versions)) {
      if (ver.ko) Object.assign(merged, ver.ko);
    }
    return merged;
  })() as Record<string, string>,
  event: (() => {
    const merged: Record<string, string> = {};
    for (const ver of Object.values(C.axes.event_name.versions)) {
      if (ver.ko) Object.assign(merged, ver.ko);
    }
    return merged;
  })() as Record<string, string>,
  initiator: { ...C.axes.initiator.versions.v1.ko } as Record<string, string>,
} as const;

// ── Service encoding ────────────────────────────────────────────────────────

const _svcPrefix = C.prefixes.service;
const _svcV1 = _svcPrefix.versions[0];

/** SVC shape — service prefix v1의 각 축 capacity */
export const DEMO_SVC_SHAPE = _svcPrefix.labels.map(label => {
  const dim = _svcPrefix.dims[label];
  if (dim.kind !== "axis") throw new Error("service prefix should only have axis dims");
  return axisCap(dim.axisId as keyof typeof C.axes, _svcV1.axisVersions[label]);
}) as unknown as readonly [number, number, number, number];

export const DEMO_SVC_STRIDES = computeStrides(DEMO_SVC_SHAPE) as readonly [number, number, number, number];

export function demoEncodeSvc(coords: readonly number[]): number {
  let v = 0;
  for (let i = 0; i < coords.length; i++) v += (coords[i] - 1) * DEMO_SVC_STRIDES[i];
  return v;
}

export function demoDecodeSvc(v: number): number[] {
  const coords: number[] = [];
  let rest = v;
  for (const s of DEMO_SVC_STRIDES) {
    coords.push(Math.floor(rest / s) + 1);
    rest %= s;
  }
  return coords;
}

// ── Cross-index address constants ───────────────────────────────────────────

const _permV1 = C.prefixes.permission.versions[0];
const _evtV1 = C.prefixes.event.versions[0];

export const DEMO_PERM_SVC_VALUES = _permV1.refEntries!.perm_svc.values;
export const DEMO_EVT_SVC_VALUES = _evtV1.refEntries!.evt_svc.values;

// ── Permission / Event helpers ──────────────────────────────────────────────

export type DemoVer = "v1" | "v2" | "v3" | "v4";

const ROLES_BY_VER = { v1: DEMO_ROLES_V1, v2: DEMO_ROLES_V2, v3: DEMO_ROLES_V3, v4: DEMO_ROLES_V4 } as const;
const EVENTS_BY_VER = { v1: DEMO_EVENTS_V1, v2: DEMO_EVENTS_V2, v3: DEMO_EVENTS_V3, v4: DEMO_EVENTS_V4 } as const;

export function demoRolesFor(v: DemoVer) { return ROLES_BY_VER[v]; }
export function demoRoleStride(v: DemoVer) { return DEMO_ROLE_CAP[v]; }
export function demoEventsFor(v: DemoVer) { return EVENTS_BY_VER[v]; }
export function demoEvtStride(v: DemoVer) { return DEMO_EVENT_CAP[v] * DEMO_INITIATORS.length; }

export function demoCalcPermAddr(svcPos: number, rolePos: number, ver: DemoVer): number {
  return (svcPos - 1) * demoRoleStride(ver) + (rolePos - 1);
}
export function demoCalcEvtAddr(svcPos: number, evtPos: number, initPos: number, ver: DemoVer): number {
  return (svcPos - 1) * demoEvtStride(ver) + (evtPos - 1) * 2 + (initPos - 1);
}

export interface DemoPermDecoded {
  svcIdx: number; svcId: string; svcKo: string;
  nsId: string; nsKo: string;
  roleId: string; roleKo: string;
}

export function demoDecodePerm(addr: number, v: DemoVer): DemoPermDecoded | null {
  const rs = demoRoleStride(v);
  const svcPos = Math.floor(addr / rs);
  const roleIdx = addr % rs;
  const roles = demoRolesFor(v);
  if (svcPos >= 10 || roleIdx >= rs) return null;
  const svcI = Math.floor(svcPos / 2);
  const nsI = svcPos % 2;
  const isHeadroom = roleIdx >= roles.length;
  return {
    svcIdx: svcPos, svcId: DEMO_SVCS[svcI], svcKo: DEMO_KO.svc[DEMO_SVCS[svcI]],
    nsId: DEMO_NSS[nsI], nsKo: DEMO_KO.ns[DEMO_NSS[nsI]],
    roleId: isHeadroom ? `(reserved:${roleIdx})` : roles[roleIdx],
    roleKo: isHeadroom ? "(예약)" : (DEMO_KO.role[roles[roleIdx]] ?? roles[roleIdx]),
  };
}

export interface DemoEvtDecoded {
  svcIdx: number; svcId: string; svcKo: string;
  nsId: string; nsKo: string;
  eventId: string; eventKo: string;
  initiatorId: string; initiatorKo: string;
}

export function demoDecodeEvt(addr: number, v: DemoVer): DemoEvtDecoded | null {
  const es = demoEvtStride(v);
  const svcPos = Math.floor(addr / es);
  const rem = addr % es;
  const events = demoEventsFor(v);
  const evtIdx = Math.floor(rem / 2);
  const initIdx = rem % 2;
  const evtCap = DEMO_EVENT_CAP[v];
  if (svcPos >= 10 || evtIdx >= evtCap || initIdx >= 2) return null;
  const svcI = Math.floor(svcPos / 2);
  const nsI = svcPos % 2;
  const isHeadroom = evtIdx >= events.length;
  return {
    svcIdx: svcPos, svcId: DEMO_SVCS[svcI], svcKo: DEMO_KO.svc[DEMO_SVCS[svcI]],
    nsId: DEMO_NSS[nsI], nsKo: DEMO_KO.ns[DEMO_NSS[nsI]],
    eventId: isHeadroom ? `(reserved:${evtIdx})` : events[evtIdx],
    eventKo: isHeadroom ? "(예약)" : (DEMO_KO.event[events[evtIdx]] ?? events[evtIdx]),
    initiatorId: DEMO_INITIATORS[initIdx], initiatorKo: DEMO_KO.initiator[DEMO_INITIATORS[initIdx]],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
//  demo-domains.ts 파생 상수
// ══════════════════════════════════════════════════════════════════════════════

// ── AXIS 카탈로그 (rbac_role → role 매핑 포함) ──────────────────────────────

export const AXIS = {
  // RBAC — rbac_role을 role로 매핑 (하위 호환)
  role: catalogAxisToLegacy("rbac_role", "v1", "role"),
  action: catalogAxisToLegacy("action", "v1"),
  resource: catalogAxisToLegacy("resource", "v1"),
  // Content
  tag: catalogAxisToLegacy("tag", "v1"),
  category: catalogAxisToLegacy("category", "v1"),
  status: catalogAxisToLegacy("status", "v1"),
  locale: catalogAxisToLegacy("locale", "v1"),
  channel: catalogAxisToLegacy("channel", "v1"),
  // Tracking
  trackAction: catalogAxisToLegacy("trackAction", "v1"),
  page: catalogAxisToLegacy("page", "v1"),
  userType: catalogAxisToLegacy("userType", "v1"),
  // Relational
  subjectKind: catalogAxisToLegacy("subjectKind", "v1"),
  predicate: catalogAxisToLegacy("predicate", "v1"),
  objectKind: catalogAxisToLegacy("objectKind", "v1"),
} as const;

export type AxisId = keyof typeof AXIS;

// ── 도메인 ──────────────────────────────────────────────────────────────────

export const DEMO_RBAC: Domain<{ role: Axis; action: Axis; resource: Axis }> = {
  id: "rbac",
  name: "역할 기반 접근 제어",
  description: "role × action × resource 3차원 권한 모델.",
  axes: { role: AXIS.role, action: AXIS.action, resource: AXIS.resource },
};

export const DEMO_CONTENT: Domain<{ tag: Axis; category: Axis; status: Axis; locale: Axis; channel: Axis }> = {
  id: "content",
  name: "콘텐츠 플랫폼",
  description: "tag(1D) + article(category × status × locale) + feed(article_ref × channel).",
  axes: { tag: AXIS.tag, category: AXIS.category, status: AXIS.status, locale: AXIS.locale, channel: AXIS.channel },
};

export const DEMO_TRACKING: Domain<{ trackAction: Axis; page: Axis; userType: Axis }> = {
  id: "tracking",
  name: "사용자 행동 추적",
  description: "action × page × userType 3차원 이벤트 추적.",
  axes: { trackAction: AXIS.trackAction, page: AXIS.page, userType: AXIS.userType },
};

export const DEMO_RELATIONAL: Domain<{ subjectKind: Axis; predicate: Axis; objectKind: Axis }> = {
  id: "relational",
  name: "관계 모델",
  description: "subject_kind × predicate × object_kind 관계 인덱스.",
  axes: { subjectKind: AXIS.subjectKind, predicate: AXIS.predicate, objectKind: AXIS.objectKind },
};

export const DEMO_DOMAINS = {
  rbac: DEMO_RBAC,
  content: DEMO_CONTENT,
  tracking: DEMO_TRACKING,
  relational: DEMO_RELATIONAL,
} as const;

export type DemoDomainId = keyof typeof DEMO_DOMAINS;

// ── SchemaSnapshot ──────────────────────────────────────────────────────────

export interface AxisSnapshot {
  readonly id: string;
  readonly name: string;
  readonly entries: readonly string[];
  readonly capacity: number;
  readonly ko: Record<string, string>;
}

export interface DomainSnapshot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly shape: readonly number[];
  readonly axes: Record<string, AxisSnapshot>;
}

export interface SchemaSnapshot {
  readonly version: string;
  readonly generatedAt: string;
  readonly axes: Record<string, AxisSnapshot>;
  readonly domains: Record<string, DomainSnapshot>;
}

function axisToSnapshot(axis: Axis): AxisSnapshot {
  return {
    id: axis.id,
    name: axis.name,
    entries: axis.entries,
    capacity: axis.capacity ?? axis.entries.length,
    ko: { ...axis.ko },
  };
}

export function buildDemoSchemaSnapshot(version = "v1"): SchemaSnapshot {
  const axes: Record<string, AxisSnapshot> = {};
  for (const [key, axis] of Object.entries(AXIS)) {
    axes[key] = axisToSnapshot(axis);
  }

  const domains: Record<string, DomainSnapshot> = {};
  for (const [key, domain] of Object.entries(DEMO_DOMAINS)) {
    const domainAxes: Record<string, AxisSnapshot> = {};
    const labels: string[] = [];
    const shape: number[] = [];

    for (const [axisKey, axis] of Object.entries(domain.axes)) {
      const snap = axisToSnapshot(axis as Axis);
      domainAxes[axisKey] = snap;
      labels.push(axisKey);
      shape.push(snap.capacity);
    }

    domains[key] = {
      id: domain.id,
      name: domain.name,
      description: domain.description,
      labels,
      shape,
      axes: domainAxes,
    };
  }

  return {
    version,
    generatedAt: new Date().toISOString(),
    axes,
    domains,
  };
}
