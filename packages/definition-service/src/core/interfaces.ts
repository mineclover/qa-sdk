/**
 * 저장소 인터페이스 — core가 의존하는 포트 (영속화 어댑터가 구현)
 */

import type {
  DocRecord,
  DocHistoryRecord,
  SliceIntentRecord,
  ConsumptionSnapshot,
} from "./types.js";

/** 문서 저장소 */
export interface DocStore {
  upsert(
    doc: DocRecord,
    body: string,
  ): { action: "created" | "updated" | "unchanged"; version: number };
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
