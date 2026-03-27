/**
 * 저장소 인터페이스 — core가 의존하는 포트 (영속화 어댑터가 구현)
 */

import type {
  DocRecord,
  DocHistoryRecord,
  SliceIntentRecord,
  ConsumptionSnapshot,
} from "./types.js";

/** 메타데이터 업데이트 입력 (DB가 SSOT인 필드들) */
export interface DocMetadataUpdate {
  scope?: string;
  aspect?: string;
  depth?: string;
  lifecycle?: string;
  layer?: string | null;
  tags?: string[];
  links?: { target: string; type: string }[];
  svc?: string | null;
}

/** 문서 저장소 */
export interface DocStore {
  upsert(
    doc: DocRecord,
    body: string,
  ): { action: "created" | "updated" | "unchanged"; version: number };
  /** DB-owned 메타데이터만 업데이트 (body/markers 유지) */
  updateMetadata(
    docId: string,
    patch: DocMetadataUpdate,
  ): { action: "updated" | "unchanged"; version: number } | null;
  get(docId: string): DocRecord | null;
  list(filter?: {
    scope?: string;
    aspect?: string;
    lifecycle?: string;
  }): DocRecord[];
  getHistory(docId: string, limit?: number): DocHistoryRecord[];
  getVersion(docId: string, version: number): DocHistoryRecord | null;
}

/** 슬라이스 의도 저장소 */
export interface IntentStore {
  create(intent: {
    prefixId: string;
    sliceJson: string;
    sliceDepth: number;
    intent: string;
    observationGoal?: string;
    owner?: string;
  }): number;
  update(
    id: number,
    patch: { intent?: string; observationGoal?: string; owner?: string },
  ): void;
  remove(id: number): boolean;
  listByPrefix(prefixId: string): SliceIntentRecord[];
}

/** 소비율 스냅샷 저장소 */
export interface ConsumptionStore {
  record(snapshot: ConsumptionSnapshot): number;
  latest(prefixId: string): ConsumptionSnapshot | null;
  history(prefixId: string, limit?: number): ConsumptionSnapshot[];
}
