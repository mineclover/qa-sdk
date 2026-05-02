/**
 * definition-service API 응답 타입
 *
 * definition-service의 core/types.ts와 동일한 구조이지만,
 * 클라이언트는 서버 내부 타입에 의존하지 않는다.
 */

// ─── 문서 ───────────────────────────────────────────────

export interface DocRecord {
  docId: string;
  scope: string;
  aspect: string;
  depth: string;
  lifecycle: string;
  tags: string[];
  links: { target: string; type: string }[];
  svc?: string;
  version: number;
  bodyHash: string;
  purpose?: string;
  intent?: string;
  context?: string;
  caveat?: string;
  syncedAt: string;
  sourcePath?: string;
}

export interface DocHistoryRecord extends DocRecord {
  body: string;
  changeType: "created" | "updated" | "marker_edit";
}

export interface DocListResponse {
  docs: DocRecord[];
  total: number;
}

export interface DocHistoryResponse {
  docId: string;
  history: DocHistoryRecord[];
  total: number;
}

// ─── 의도 ───────────────────────────────────────────────

export interface SliceIntentRecord {
  id: number;
  prefixId: string;
  sliceJson: string;
  sliceDepth: number;
  intent: string;
  observationGoal?: string;
  owner?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntentListResponse {
  prefixId: string;
  intents: SliceIntentRecord[];
  total: number;
}

export interface IntentResolveResponse {
  prefixId: string;
  address: Record<string, string>;
  matched: SliceIntentRecord[];
  total: number;
}

export interface IntentCreateInput {
  slice: Record<string, string>;
  intent: string;
  observationGoal?: string;
  owner?: string;
}

// ─── 소비율 ─────────────────────────────────────────────

export interface ConsumptionSnapshot {
  id?: number;
  prefixId: string;
  prefixVersion: string;
  collectedAt: string;
  totalSpace: number;
  observedAddresses: number;
  consumptionRate: number;
  dimStatsJson: string;
  severity?: string;
}

export interface ConsumptionRecordInput {
  prefixVersion: string;
  totalSpace: number;
  observedAddresses: number;
  dimStats: Record<string, {
    axisId: string;
    totalEntries: number;
    observedEntries: number;
    rate: number;
  }>;
}

// ─── 그래프 ─────────────────────────────────────────────

export interface ImpactResult {
  sourceId: string;
  blastRadius: number;
  impacted: {
    id: string;
    via: string;
    path: string[];
    direction: string;
    depth: number;
  }[];
  affectedGroups: string[];
}

// ─── 동기화 ─────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  unchanged: number;
  created: number;
  errors: string[];
  timestamp: string;
}
