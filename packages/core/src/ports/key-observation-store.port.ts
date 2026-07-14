// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/** payload 필드별 빈도 + 샘플 값 */
export interface PayloadSummary {
  fieldFrequency: Record<string, number>;
  sampleValues: Record<string, unknown>;
}

/** ingest 시 관측 기록 입력 */
export interface KeyObservationEntry {
  packedKey: string;
  prefixId: string;
  /** packed_key에서 parse된 version. 신규 코드에서 명시 권장. */
  version?: string;
  /** packed_key에서 parse된 정수 address. 신규 코드에서 명시 권장. */
  address?: number;
  registered: boolean;
  timestamp: string; // ISO-8601
  payloadFields?: string[];
  samplePayload?: Record<string, unknown>;
}

/** 저장된 관측 결과 */
export interface KeyObservation {
  packedKey: string;
  prefixId: string;
  /** 저장 시 항상 채움 (DB 컬럼화 — coordinate-storage.rule §1.1) */
  version: string;
  /** 저장 시 항상 채움 (DB 컬럼화) */
  address: number;
  registered: boolean;
  count: number;
  firstSeen: string;
  lastSeen: string;
  payloadSummary: PayloadSummary;
}

/** 전체 관측 통계 */
export interface KeyObservationSummary {
  totalKeys: number;
  totalCount: number;
  registeredKeys: number;
  unregisteredKeys: number;
  prefixBreakdown: Record<string, number>;
}

/** prefix 레벨 집계 — version별 분리 (coordinate-storage.rule §1.1: P3) */
export interface PrefixObservationSummary {
  prefixId: string;
  version: string;
  distinctKeys: number;
  totalCount: number;
  firstSeen: string;
  lastSeen: string;
}

/** Key Observation 저장소 계약 */
export interface KeyObservationStore {
  /** 단건 관측 기록 (ingest 핫패스) */
  observe(entry: KeyObservationEntry): Promise<void>;
  /** 벌크 관측 기록 (배치 ingest) */
  observeBatch(entries: readonly KeyObservationEntry[]): Promise<void>;
  /** prefix별 관측 현황 조회 */
  findByPrefix(
    prefixId: string,
    opts?: { limit?: number; orderBy?: 'count' | 'last_seen' },
  ): Promise<KeyObservation[]>;
  /** 전체 관측 통계 */
  summary(): Promise<KeyObservationSummary>;
  /** 특정 시점 이전 미관측 좌표 (cold key) */
  findStale(before: string, limit?: number): Promise<KeyObservation[]>;
  /** 미등록 key 목록 (drift 감지) */
  findUnregistered(opts?: { limit?: number }): Promise<KeyObservation[]>;
  /** prefix 레벨 집계 */
  prefixSummary(prefixId?: string): Promise<PrefixObservationSummary[]>;
}
