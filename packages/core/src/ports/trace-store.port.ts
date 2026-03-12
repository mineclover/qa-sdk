/** Trace 메타데이터 저장소 계약 */
export interface TraceStore {
  upsert(params: TraceUpsert): Promise<StoredTrace>;
  findById(traceId: string): Promise<StoredTrace | null>;
  findUnreconstructed(limit?: number): Promise<StoredTrace[]>;
  markReconstructed(traceId: string): Promise<void>;
}

export interface TraceUpsert {
  traceId: string;
  sessionId?: string;
  serviceName?: string;
  recordCount: number;
  firstTimestamp: Date;
  lastTimestamp: Date;
}

export interface StoredTrace {
  traceId: string;
  sessionId: string | null;
  serviceName: string | null;
  recordCount: number;
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
  reconstructed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
