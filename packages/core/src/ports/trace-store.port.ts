/** Trace 메타데이터 저장소 계약 */
export interface TraceStore {
  upsert(params: TraceUpsert): Promise<void>;
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
  actorId?: string;
  userId?: string;
  userAttributes?: Record<string, string>;
}

export interface StoredTrace {
  traceId: string;
  sessionId: string | null;
  serviceName: string | null;
  actorId: string | null;
  userId: string | null;
  userAttributes: Record<string, string> | null;
  recordCount: number;
  firstTimestamp: Date | null;
  lastTimestamp: Date | null;
  reconstructed: boolean;
  createdAt: Date;
  updatedAt: Date;
}
