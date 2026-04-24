// @def.boundary sim-scenarios
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * gateway 경유 audit-browser-api 조회 헬퍼.
 *
 * 3 endpoint:
 *   - GET /audit/trace/:rootSpanId       — nested tree
 *   - GET /audit/firstFailure/:rootSpanId — 첫 deny/error entry
 *   - GET /audit/entry/:spanId            — 단일 entry
 */

import type { AuditEntry } from "permission-engine";

export interface AuditTraceResponse {
  rootSpanId: string;
  count: number;
  entries: AuditEntry[];
}

export interface AuditFirstFailureResponse {
  rootSpanId: string;
  firstFailure: AuditEntry | null;
}

export interface AuditContextResponse {
  rootSpanId: string;
  graphId: string;
  trace: AuditTraceResponse;
  firstFailure: AuditEntry | null;
  graphSnapshot: {
    graphId: string;
    snapshotId: string;
    graph: {
      nodes: Array<{ coord: { anchor: string } }>;
      relations: Array<{ relationId: string }>;
      realms: Array<{ realmId: string }>;
    };
  };
}

export interface GraphSnapshotListResponse {
  graphId: string;
  count: number;
  snapshots: Array<{
    snapshotId: string;
    createdAt: string;
    graphId: string;
  }>;
}

export interface GraphSnapshotDiffResponse {
  fromSnapshotId?: string;
  toSnapshotId?: string;
  summary: {
    addedNodeCount: number;
    removedNodeCount: number;
    addedRelationCount: number;
    removedRelationCount: number;
  };
}

export interface GraphSnapshotPruneResponse {
  graphId: string;
  beforeCount: number;
  afterCount: number;
  deletedSnapshotIds: string[];
  keptSnapshotIds: string[];
}

export async function fetchAuditTrace(
  gatewayFetch: (req: Request) => Promise<Response>,
  rootSpanId: string,
  authToken: string,
): Promise<AuditTraceResponse> {
  const res = await gatewayFetch(
    new Request(`http://sim/audit/trace/${rootSpanId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }),
  );
  if (!res.ok) {
    throw new Error(
      `fetchAuditTrace ${rootSpanId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as AuditTraceResponse;
}

export async function fetchFirstFailure(
  gatewayFetch: (req: Request) => Promise<Response>,
  rootSpanId: string,
  authToken: string,
): Promise<AuditFirstFailureResponse> {
  const res = await gatewayFetch(
    new Request(`http://sim/audit/firstFailure/${rootSpanId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }),
  );
  if (!res.ok) {
    throw new Error(
      `fetchFirstFailure ${rootSpanId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as AuditFirstFailureResponse;
}

export async function fetchAuditEntry(
  gatewayFetch: (req: Request) => Promise<Response>,
  spanId: string,
  authToken: string,
): Promise<AuditEntry> {
  const res = await gatewayFetch(
    new Request(`http://sim/audit/entry/${spanId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }),
  );
  if (!res.ok) {
    throw new Error(
      `fetchAuditEntry ${spanId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as AuditEntry;
}

export async function fetchAuditContext(
  gatewayFetch: (req: Request) => Promise<Response>,
  rootSpanId: string,
  graphId: string,
  authToken: string,
): Promise<AuditContextResponse> {
  const res = await gatewayFetch(
    new Request(`http://sim/audit/context/${rootSpanId}/${graphId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }),
  );
  if (!res.ok) {
    throw new Error(
      `fetchAuditContext ${rootSpanId}/${graphId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as AuditContextResponse;
}

export async function fetchGraphSnapshotList(
  gatewayFetch: (req: Request) => Promise<Response>,
  graphId: string,
  authToken: string,
): Promise<GraphSnapshotListResponse> {
  const res = await gatewayFetch(
    new Request(`http://sim/audit/graphs/${graphId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }),
  );
  if (!res.ok) {
    throw new Error(
      `fetchGraphSnapshotList ${graphId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as GraphSnapshotListResponse;
}

export async function fetchGraphSnapshotDiff(
  gatewayFetch: (req: Request) => Promise<Response>,
  fromSnapshotId: string,
  toSnapshotId: string,
  authToken: string,
): Promise<GraphSnapshotDiffResponse> {
  const res = await gatewayFetch(
    new Request(`http://sim/audit/graphs/diff/${fromSnapshotId}/${toSnapshotId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }),
  );
  if (!res.ok) {
    throw new Error(
      `fetchGraphSnapshotDiff ${fromSnapshotId}/${toSnapshotId}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as GraphSnapshotDiffResponse;
}

export async function fetchGraphSnapshotPrune(
  gatewayFetch: (req: Request) => Promise<Response>,
  graphId: string,
  keepLatest: number,
  authToken: string,
): Promise<GraphSnapshotPruneResponse> {
  const res = await gatewayFetch(
    new Request(`http://sim/audit/graphs/${graphId}/prune/${keepLatest}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    }),
  );
  if (!res.ok) {
    throw new Error(
      `fetchGraphSnapshotPrune ${graphId}/${keepLatest}: status=${res.status} body=${await res.text()}`,
    );
  }
  return (await res.json()) as GraphSnapshotPruneResponse;
}
