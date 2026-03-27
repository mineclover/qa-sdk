/**
 * 도메인 타입 — HTTP/DB 무관한 순수 데이터 구조
 */

/** 문서 메타데이터 레코드 (최신 버전) */
export interface DocRecord {
  docId: string;
  scope: string;
  aspect: string;
  depth: string;
  lifecycle: string;
  layer?: string;
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

/** 문서 이력 레코드 (body 포함) */
export interface DocHistoryRecord extends DocRecord {
  body: string;
  changeType: "created" | "updated" | "marker_edit" | "metadata_edit";
}

/** 주소 슬라이스 의도 레코드 */
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

/** 주소 소비율 스냅샷 */
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
